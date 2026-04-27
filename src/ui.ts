import { CATEGORIES } from './constants'
import { esc } from './panel'
import type { Topic, SearchResult, CategoryKey, AppStore } from './types'

export function showToast(message: string, toastsEl: HTMLElement): void {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = message
  toastsEl.appendChild(t)
  setTimeout(() => {
    t.style.opacity = '0'
    t.style.transform = 'translateY(-8px)'
    setTimeout(() => t.remove(), 260)
  }, 3200)
}

export function showFatal(message: string, retry: boolean, errorEl: HTMLElement): void {
  errorEl.innerHTML = `<b>Aplikasi tertahan</b><br>${esc(message)}${retry ? '<br><button class="btn mt-3" onclick="location.reload()">Coba lagi</button>' : ''}`
  errorEl.classList.add('open')
}

export function setProgress(percent: number, message: string, progressEl: HTMLElement, msgEl: HTMLElement): void {
  progressEl.style.width = `${Math.max(6, Math.min(100, percent))}%`
  if (message) msgEl.textContent = message
}

export function hideLoading(loadingEl: HTMLElement): void {
  setTimeout(() => loadingEl.classList.add('hide'), 350)
}

export function updateHUD(
  store: AppStore,
  totalTopics: number,
  hudEls: { htopic: HTMLElement; hcat: HTMLElement; hprogress: HTMLElement },
  topicId: string | null,
  topics: Map<string, Topic>,
): void {
  if (topicId) {
    const t = topics.get(topicId)
    if (t) {
      hudEls.htopic.textContent = t.label_id
      const cat = CATEGORIES[t.category as CategoryKey]
      hudEls.hcat.textContent = cat.label
      hudEls.hcat.style.color = cat.color
    }
  }
  hudEls.hprogress.textContent = `Topik dijelajahi: ${store.exploredTopics.length} / ${totalTopics}`
}

export function applyTheme(theme: 'dark' | 'light', themeBtn: HTMLElement): void {
  document.body.classList.toggle('light', theme === 'light')
  themeBtn.textContent = theme === 'light' ? '☀' : '☾'
}

export function showSuggestions(
  results: SearchResult[],
  suggestEl: HTMLElement,
): void {
  suggestEl.innerHTML = results.length
    ? results.map((m) =>
        `<button data-id="${esc(m.topic.id)}" data-label="${esc(m.topic.label_id)}">
          <span>
            <b>${esc(m.topic.label_id)}</b>
            <small class="block text-slate-400">${esc(m.topic.label_en)} • ${esc(CATEGORIES[m.topic.category as CategoryKey].label)}</small>
          </span>
          <span class="ar">${esc(m.topic.arabic)}</span>
        </button>`,
      ).join('')
    : '<div class="p-3 text-sm text-slate-300">Tidak ada topik yang cocok.</div>'
  suggestEl.classList.add('open')
}

export function hideSuggestions(suggestEl: HTMLElement): void {
  suggestEl.classList.remove('open')
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x !== undefined && x !== null && x !== '' as unknown as T))]
}
