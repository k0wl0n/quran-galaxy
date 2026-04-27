import { esc } from './panel'
import type { AyatItem } from './types'

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'

export function openSurahReader(
  surahNum: number,
  focusAyah: number,
  ayat: AyatItem[],
  overlayEl: HTMLElement,
  titleEl: HTMLElement,
  subEl: HTMLElement,
  bodyEl: HTMLElement,
): void {
  const verses = ayat.filter((v) => v.surah === surahNum).sort((a, b) => a.ayah - b.ayah)
  if (!verses.length) return

  titleEl.textContent = verses[0].surahName
  subEl.textContent = `Surah ${surahNum} · ${verses.length} ayat`

  // All surahs except Al-Fatihah (1) and At-Tawbah (9) display bismillah header
  const bismillah = surahNum !== 1 && surahNum !== 9
    ? `<div class="reader-bismillah" lang="ar" dir="rtl">${BISMILLAH}</div>`
    : ''

  bodyEl.innerHTML = bismillah + verses.map((v) => {
    const isFocus = v.ayah === focusAyah
    return `<div class="reader-verse${isFocus ? ' focus' : ''}" id="rv-${v.surah}-${v.ayah}">
      <div class="reader-vhead">
        <div class="reader-num">${v.ayah}</div>
        <button class="reader-play" data-key="${esc(v.key)}" title="Putar ayat ${v.ayah}">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      <div class="reader-ar" lang="ar" dir="rtl">${esc(v.arabic)}</div>
      <p class="reader-tr">${esc(v.translation)}</p>
    </div>`
  }).join('')

  overlayEl.classList.add('open')
  overlayEl.setAttribute('aria-hidden', 'false')

  requestAnimationFrame(() => {
    const focusEl = document.getElementById(`rv-${surahNum}-${focusAyah}`)
    if (focusEl) focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
