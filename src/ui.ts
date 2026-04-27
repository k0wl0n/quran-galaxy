import { CATEGORIES } from './constants'
import { esc } from './panel'
import type { Topic, SearchResult, CategoryKey, AppStore } from './types'

export function showToast(message: string, kind: 'ok' | 'bad' | 'gold' | undefined, toastsEl: HTMLElement): void {
  const t = document.createElement('div')
  t.className = `toast${kind ? ` ${kind}` : ''}`
  t.textContent = message
  toastsEl.appendChild(t)
  setTimeout(() => {
    t.style.opacity = '0'
    t.style.transform = 'translateY(-10px)'
    setTimeout(() => t.remove(), 300)
  }, 2600)
}

export function showFatal(message: string, retry: boolean, errorEl: HTMLElement): void {
  errorEl.innerHTML = `<b>Aplikasi tertahan</b><br>${esc(message)}${retry ? '<br><button style="margin-top:12px;padding:8px 16px;border-radius:8px;background:rgba(231,201,139,.18);border:1px solid var(--gold);color:var(--gold-soft);cursor:pointer" onclick="location.reload()">Coba lagi</button>' : ''}`
  errorEl.classList.add('open')
}

export function setProgress(percent: number, message: string, progressEl: HTMLElement, msgEl: HTMLElement): void {
  progressEl.style.width = `${Math.max(8, Math.min(100, percent))}%`
  if (message) msgEl.textContent = message
}

export function hideLoading(loadingEl: HTMLElement): void {
  setTimeout(() => loadingEl.classList.add('hide'), 350)
}

export function updateHUD(
  store: AppStore,
  totalTopics: number,
  els: { hexp: HTMLElement; htotal: HTMLElement; hbar: HTMLElement },
): void {
  const count = store.exploredTopics.length
  els.hexp.textContent = String(count)
  els.htotal.textContent = String(totalTopics)
  els.hbar.style.width = `${Math.min(100, totalTopics > 0 ? (count / totalTopics) * 100 : 0)}%`
}

export function applyTheme(theme: 'dark' | 'light', themeBtn: HTMLElement): void {
  document.body.classList.toggle('light', theme === 'light')
}

export function showSuggestions(
  results: SearchResult[],
  suggestEl: HTMLElement,
): void {
  if (!results.length) {
    suggestEl.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:13px">Tidak ada topik yang cocok.</div>'
    suggestEl.classList.add('open')
    return
  }
  suggestEl.innerHTML = results.map((m) => {
    const cat = CATEGORIES[m.topic.category as CategoryKey]
    return `<button class="suggest-item" data-id="${esc(m.topic.id)}" data-label="${esc(m.topic.label_id)}">
      <span class="si-dot" style="color:${cat.color}"></span>
      <span class="si-meta">
        <span class="si-title">${esc(m.topic.label_id)}</span>
        <span class="si-sub">${esc(cat.label)} · ${esc(m.topic.label_en)}</span>
      </span>
      <span class="si-ar">${esc(m.topic.arabic)}</span>
    </button>`
  }).join('')
  suggestEl.classList.add('open')
}

export function hideSuggestions(suggestEl: HTMLElement): void {
  suggestEl.classList.remove('open')
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x !== undefined && x !== null && x !== '' as unknown as T))]
}
