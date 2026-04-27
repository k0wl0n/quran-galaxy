import { CATEGORIES } from './constants'
import { tafsirCache, fetchTafsirSurah } from './quran'
import { normalize } from './search'
import { hexToRgba } from './scene3d'
import type { Topic, AyatItem, CategoryKey } from './types'

export function openPanel(
  topic: Topic,
  verses: AyatItem[],
  byId: Map<string, Topic>,
  domVerses: HTMLElement,
): void {
  domVerses.innerHTML = verses.length
    ? verses.map((v) => renderCard(topic, v, byId)).join('')
    : `<div class="verse"><b>${esc(topic.label_id)}</b><p class="trans mt-3">Ayat terkait belum tersedia dari cache lokal.</p></div>`
  hydrateVerses(verses)
}

export function togglePanel(open: boolean, panelEl: HTMLElement): void {
  panelEl.classList.toggle('open', open)
  document.body.classList.toggle('panel-open', open)
  panelEl.setAttribute('aria-hidden', String(!open))
}

export function topicVerses(
  topic: Topic,
  lookup: Map<string, AyatItem>,
  ayat: AyatItem[],
  limit: number,
): AyatItem[] {
  const seen = new Set<string>()
  const out: AyatItem[] = []

  topic.related_ayat_keys.forEach((k) => {
    const v = lookup.get(k)
    if (v && !seen.has(k)) { seen.add(k); out.push(v) }
  })

  if (out.length < limit) {
    const needles = [topic.label_id, topic.label_en, topic.arabic, ...topic.synonyms_id, ...topic.synonyms_ar]
      .map(normalize)
      .filter((x) => x.length > 2)
    for (const v of ayat) {
      const h = normalize(v.translation + ' ' + v.arabic)
      if (!seen.has(v.key) && needles.some((n) => h.includes(n))) {
        seen.add(v.key)
        out.push(v)
        if (out.length >= limit) break
      }
    }
  }

  return out.slice(0, limit)
}

export function renderCard(topic: Topic, v: AyatItem, byId: Map<string, Topic>): string {
  const chips = topic.connected_topics.slice(0, 6)
    .map((id) => byId.get(id) ? `<button class="chip rel" data-id="${esc(id)}">${esc(byId.get(id)!.label_id)}</button>` : '')
    .join('')
  return `<article class="verse" data-key="${esc(v.key)}">
    <div class="flex items-start justify-between gap-3">
      <div class="meta">${esc(v.surahName)} : ${v.ayah}</div>
      <button class="btn audio" data-key="${esc(v.key)}">Putar</button>
    </div>
    <div class="arabic mt-4" lang="ar" dir="rtl">${esc(v.arabic)}</div>
    <p class="trans mt-4">${esc(v.translation)}</p>
    <details class="taf" data-key="${esc(v.key)}">
      <summary>Tafsir singkat</summary>
      <div class="tafsir" id="taf-${v.key.replace(':', '-')}">Memuat tafsir ringkas...</div>
    </details>
    <details>
      <summary>Asbabun nuzul</summary>
      <p class="tafsir">Tidak ada riwayat khusus yang tersimpan di aplikasi ini untuk ayat ini.</p>
    </details>
    <div class="chips">${chips}</div>
  </article>`
}

export async function hydrateVerses(verses: AyatItem[]): Promise<void> {
  const surahNums = [...new Set(verses.map((v) => v.surah))]
  for (const s of surahNums) await fetchTafsirSurah(s)
  verses.forEach((v) => {
    const el = document.getElementById(`taf-${v.key.replace(':', '-')}`)
    const m = tafsirCache.get(String(v.surah))
    const tx = m?.get(Number(v.ayah))
    if (el) {
      el.innerHTML = tx
        ? esc(tx.replace(/\s+/g, ' ').slice(0, 900))
        : `Tafsir tidak tersedia. Lihat di <a class="underline text-amber-100" target="_blank" rel="noopener" href="https://quran.com/${v.surah}/${v.ayah}">Quran.com</a>.`
    }
  })
}

export function updatePanelHeader(
  topic: Topic,
  els: {
    pcat: HTMLElement
    ptitle: HTMLElement
    psub: HTMLElement
    htopic: HTMLElement
    hcat: HTMLElement
  },
): void {
  const cat = CATEGORIES[topic.category as CategoryKey]
  els.htopic.textContent = topic.label_id
  els.hcat.textContent = cat.label
  els.hcat.style.color = cat.color
  els.ptitle.textContent = topic.label_id
  els.psub.textContent = `${topic.label_en} • ${topic.arabic}`
  els.pcat.textContent = cat.label
  els.pcat.style.borderColor = hexToRgba(cat.color, 0.38)
  els.pcat.style.background = hexToRgba(cat.color, 0.18)
}

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[c] ?? c))
}
