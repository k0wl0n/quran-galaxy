import {
  PRIMARY_QURAN_URL, QURAN_LIST_URLS, QURAN_DETAIL_URLS, TAFSIR_URLS,
} from './constants'
import { lsGet, lsSet } from './store'
import type { AyatItem, NormalizedQuran, RawQuranSurah } from './types'

export interface QuranLoadOptions {
  onProgress: (percent: number, message: string) => void
}

export async function loadQuran(opts: QuranLoadOptions): Promise<RawQuranSurah[]> {
  const { onProgress } = opts
  const cached = lsGet('quran_cache')
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (parsed.version === 1 && Array.isArray(parsed.data)) {
        onProgress(40, 'Memakai cache Quran lokal...')
        return parsed.data as RawQuranSurah[]
      }
    } catch {
      localStorage.removeItem('qte_v1_quran_cache')
    }
  }

  onProgress(22, 'Mengambil mushaf dari CDN utama...')
  try {
    const data = await fetchJson<RawQuranSurah[]>(PRIMARY_QURAN_URL)
    if (!Array.isArray(data)) throw new Error('format')
    lsSet('quran_cache', JSON.stringify({ version: 1, at: Date.now(), data }))
    return data
  } catch (e) {
    console.warn(e)
  }

  for (let i = 0; i < QURAN_LIST_URLS.length; i++) {
    try {
      const first = await fetchJson<{ data?: RawQuranSurah[] } | RawQuranSurah[]>(QURAN_LIST_URLS[i])
      const list: RawQuranSurah[] = Array.isArray(first) ? first : (first.data ?? [])
      const out: RawQuranSurah[] = []
      for (let n = 1; n <= list.length; n++) {
        onProgress(30 + Math.round((n / list.length) * 48), `Memuat surah fallback ${n} / ${list.length}`)
        const res = await fetchJson<{ data: RawQuranSurah }>(QURAN_DETAIL_URLS[i] + n)
        const x = res.data
        out.push({
          id: x.nomor,
          nama: x.nama,
          namaLatin: x.namaLatin,
          arti: x.arti,
          jumlahAyat: x.jumlahAyat,
          ayat: (x.ayat ?? []).map((a) => ({
            nomorAyat: a.nomorAyat,
            teksArab: a.teksArab,
            teksIndonesia: a.teksIndonesia,
          })),
        })
      }
      lsSet('quran_cache', JSON.stringify({ version: 1, at: Date.now(), data: out }))
      return out
    } catch (e) {
      console.warn(e)
    }
  }

  throw new Error('quran unavailable')
}

export function normalizeQuran(data: RawQuranSurah[]): NormalizedQuran {
  const lookup = new Map<string, AyatItem>()
  const ayat: AyatItem[] = []
  let abs = 0
  data.forEach((s, si) => {
    const sn = Number(s.id ?? s.nomor ?? si + 1)
    const name = s.namaLatin ?? `Surah ${sn}`
    const verses = s.verses ?? s.ayat ?? []
    verses.forEach((v, vi) => {
      abs++
      const an = Number(v.id ?? v.nomorAyat ?? vi + 1)
      const key = `${sn}:${an}`
      const item: AyatItem = {
        key,
        surah: sn,
        ayah: an,
        absoluteIndex: abs,
        surahName: name,
        arabic: v.text ?? v.teksArab ?? '',
        translation: v.translation ?? v.teksIndonesia ?? '',
      }
      lookup.set(key, item)
      ayat.push(item)
    })
  })
  return { lookup, ayat }
}

export const tafsirCache = new Map<string, Map<number, string>>()

export async function fetchTafsirSurah(surahNum: number): Promise<void> {
  const k = String(surahNum)
  if (tafsirCache.has(k)) return

  const cached = lsGet(`tafsir_${k}`)
  if (cached) {
    try {
      const arr = JSON.parse(cached) as { ayat: number; teks: string }[]
      tafsirCache.set(k, new Map(arr.map((x) => [Number(x.ayat), x.teks])))
      return
    } catch {
      localStorage.removeItem(`qte_v1_tafsir_${k}`)
    }
  }

  for (const base of TAFSIR_URLS) {
    try {
      const j = await fetchJson<{ data?: { tafsir?: { ayat: number; teks?: string; text?: string }[] }; tafsir?: { ayat: number; teks?: string; text?: string }[] }>(base + surahNum)
      const arr = j?.data?.tafsir ?? j?.tafsir ?? []
      const map = new Map<number, string>(arr.map((x) => [Number(x.ayat), x.teks ?? x.text ?? '']))
      tafsirCache.set(k, map)
      lsSet(`tafsir_${k}`, JSON.stringify(arr.map((x) => ({ ayat: x.ayat, teks: x.teks ?? x.text ?? '' }))))
      return
    } catch (e) {
      console.warn(e)
    }
  }

  tafsirCache.set(k, new Map())
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'force-cache' })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json() as Promise<T>
}
