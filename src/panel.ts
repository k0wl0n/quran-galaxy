import { CATEGORIES } from './constants'
import { tafsirCache, fetchTafsirSurah } from './quran'
import { normalize } from './search'
import type { Topic, AyatItem, CategoryKey, AppStore } from './types'

export function togglePanel(open: boolean, panelEl: HTMLElement): void {
  panelEl.classList.toggle('open', open)
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

export function renderPanelBody(
  topic: Topic,
  tab: 'ayat' | 'related' | 'notes',
  verses: AyatItem[],
  byId: Map<string, Topic>,
  store: AppStore,
  panelBodyEl: HTMLElement,
): void {
  if (tab === 'ayat') {
    panelBodyEl.innerHTML = verses.length
      ? verses.map((v) => renderCard(v, store.markedAyat)).join('')
      : `<p style="color:var(--muted);font-size:14px;line-height:1.6">Ayat terkait belum tersedia dari cache lokal. Coba buka beberapa topik lain agar Quran selesai dimuat.</p>`
    hydrateVerses(verses)
    return
  }

  if (tab === 'related') {
    const conns = (topic.connected_topics || [])
      .map((id) => byId.get(id))
      .filter((t): t is Topic => t !== undefined)
    if (!conns.length) {
      panelBodyEl.innerHTML = '<p style="color:var(--muted);font-size:14px">Belum ada topik terhubung.</p>'
      return
    }
    const byCat: Record<string, Topic[]> = {}
    conns.forEach((c) => { (byCat[c.category] ||= []).push(c) })
    panelBodyEl.innerHTML = (Object.keys(byCat) as CategoryKey[]).map((cat) => {
      const catCfg = CATEGORIES[cat]
      return `<div class="related" style="margin-bottom:22px">
        <h4 style="color:${catCfg.color}">${esc(catCfg.label)}</h4>
        <div class="chips">${byCat[cat].map((c) => `<button class="chip" data-id="${esc(c.id)}">${esc(c.label_id)}</button>`).join('')}</div>
      </div>`
    }).join('')
    return
  }

  // notes tab
  const note = store.notes?.[topic.id] ?? ''
  panelBodyEl.innerHTML = `<div class="related">
    <h4>Catatan pribadi</h4>
    <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:12px">Tulis renungan singkat untuk topik <b style="color:var(--ink)">${esc(topic.label_id)}</b>. Catatan tersimpan di perangkat ini.</p>
    <textarea id="note-area" rows="6" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line-2);background:rgba(255,255,255,.03);color:var(--ink);font:inherit;font-size:14px;line-height:1.6;resize:vertical;outline:none">${esc(note)}</textarea>
    <button id="note-save" class="qstart" style="margin-top:14px;padding:10px;font-size:13px">Simpan catatan</button>
  </div>`
}

export function renderCard(v: AyatItem, markedKeys: string[]): string {
  const marked = markedKeys.includes(v.key)
  const ref = `${v.surahName} ${v.surah}:${v.ayah}`
  return `<article class="verse-card" data-key="${esc(v.key)}">
    <div class="vc-head">
      <span class="vc-ref">${esc(ref)}</span>
      <div class="vc-actions">
        <button class="vc-btn audio" data-key="${esc(v.key)}" title="Putar audio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
        <button class="vc-btn markayah ${marked ? 'on' : ''}" data-key="${esc(v.key)}" title="Tandai ayat">
          <svg viewBox="0 0 24 24" fill="${marked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>
    </div>
    <div class="v-arabic" lang="ar" dir="rtl">${esc(v.arabic)}</div>
    <p class="v-trans">${esc(v.translation)}</p>
    <div class="v-tafsir">
      <span class="lbl">Tafsir singkat</span>
      <div id="taf-${v.key.replace(':', '-')}">Memuat tafsir...</div>
    </div>
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
        : `Tafsir tidak tersedia. Lihat di <a style="color:var(--gold-soft);text-decoration:underline" target="_blank" rel="noopener" href="https://quran.com/${v.surah}/${v.ayah}">Quran.com</a>.`
    }
  })
}

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[c] ?? c))
}
