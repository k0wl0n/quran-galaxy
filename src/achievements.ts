import { BADGE_DEFS, CATEGORIES } from './constants'
import { hexToRgba } from './scene3d'
import { esc } from './panel'
import type { Topic, AppStore, CategoryKey } from './types'

export function checkBadges(
  store: AppStore,
  topics: Topic[],
  sessionLinks: number,
  saveStore: () => void,
  renderAch: () => void,
  showToast: (msg: string) => void,
  chimeFn: (kind: 'ach') => void,
): void {
  const newBadges: typeof BADGE_DEFS = []
  BADGE_DEFS.forEach((b) => {
    if (!store.badges.includes(b.id)) {
      let passes = false
      if (b.id === 'pengembara') {
        const byId = new Map(topics.map((t) => [t.id, t]))
        const cats = new Set(store.exploredTopics.map((id) => byId.get(id)?.category).filter(Boolean))
        passes = cats.size >= 6
      } else {
        passes = b.check(store, sessionLinks, topics.length)
      }
      if (passes) { store.badges.push(b.id); newBadges.push(b) }
    }
  })
  if (newBadges.length) {
    saveStore()
    renderAch()
    newBadges.forEach((b) => { showToast(`Pencapaian terbuka: ${b.name}`); chimeFn('ach') })
  }
}

export function renderAchievements(
  store: AppStore,
  topics: Topic[],
  els: {
    stats: HTMLElement
    breakdown: HTMLElement
    badges: HTMLElement
  },
): void {
  els.stats.innerHTML = [
    ['Topik dijelajahi', `${store.exploredTopics.length} / ${topics.length}`],
    ['Surat dibaca', `${store.readSurahs.length} / 114`],
    ['Ayat ditandai', String(store.markedAyat.length)],
    ['Streak harian', `${store.dailyStreak} hari`],
  ].map(([label, val]) => `<div class="stat"><span class="text-xs uppercase text-slate-400">${label}</span><br><strong>${val}</strong></div>`).join('')

  els.breakdown.innerHTML = (Object.keys(CATEGORIES) as CategoryKey[]).map((c) => {
    const total = topics.filter((t) => t.category === c).length
    const ex = store.exploredTopics.filter((id) => topics.find((t) => t.id === id)?.category === c).length
    const cat = CATEGORIES[c]
    return `<span class="badge mr-2 mb-2" style="border-color:${hexToRgba(cat.color, 0.34)};background:${hexToRgba(cat.color, 0.18)}">${cat.label}: ${ex} / ${total}</span>`
  }).join('')

  els.badges.innerHTML = BADGE_DEFS.map((b) =>
    `<div class="badge-card ${store.badges.includes(b.id) ? 'unlocked' : ''}">
      <div class="text-2xl">${b.emoji}</div>
      <div class="mt-2 font-extrabold text-amber-100">${esc(b.name)}</div>
      <div class="mt-1 text-xs text-slate-300">${esc(b.description)}</div>
    </div>`,
  ).join('')
}
