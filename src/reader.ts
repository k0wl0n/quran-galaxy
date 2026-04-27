import { esc } from './panel'
import type { AyatItem } from './types'

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

  bodyEl.innerHTML = verses.map((v) => {
    const isFocus = v.ayah === focusAyah
    return `<div class="reader-verse${isFocus ? ' focus' : ''}" id="rv-${v.surah}-${v.ayah}">
      <div class="reader-num">${v.ayah}</div>
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
