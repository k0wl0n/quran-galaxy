import { BADGE_DEFS, CATEGORIES } from './constants'
import { esc } from './panel'
import type { Topic, AppStore, CategoryKey } from './types'

export function checkBadges(
  store: AppStore,
  topics: Topic[],
  sessionLinks: number,
  saveStore: () => void,
  renderAch: () => void,
  showToast: (msg: string, kind?: 'ok' | 'bad' | 'gold') => void,
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
    newBadges.forEach((b) => { showToast(`Pencapaian terbuka: ${b.name}`, 'gold'); chimeFn('ach') })
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
  const catKeys = Object.keys(CATEGORIES) as CategoryKey[]
  const exploredCount = store.exploredTopics.length
  const byId = new Map(topics.map((t) => [t.id, t]))

  const statsData: Array<[string, string | number, number]> = [
    ['Topik dijelajahi', `${exploredCount} / ${topics.length}`, exploredCount / Math.max(1, topics.length)],
    ['Ayat ditandai', store.markedAyat.length, Math.min(1, store.markedAyat.length / 20)],
    ['Kategori disentuh', `${new Set(store.exploredTopics.map((id) => byId.get(id)?.category).filter(Boolean)).size} / 6`, new Set(store.exploredTopics.map((id) => byId.get(id)?.category).filter(Boolean)).size / 6],
    ['Streak harian', `${store.dailyStreak} hari`, Math.min(1, store.dailyStreak / 30)],
  ]

  els.stats.innerHTML = statsData.map(([label, val, pct]) =>
    `<div class="stat-card">
      <div class="l">${esc(label)}</div>
      <div class="n">${esc(String(val))}</div>
      <div class="b"><div style="width:${Math.round(pct * 100)}%"></div></div>
    </div>`,
  ).join('')

  els.breakdown.innerHTML = catKeys.map((c) => {
    const total = topics.filter((t) => t.category === c).length
    const ex = store.exploredTopics.filter((id) => byId.get(id)?.category === c).length
    const cat = CATEGORIES[c]
    return `<div class="br-card" style="color:${cat.color}"><span class="nm">${esc(cat.label)}</span><span class="ct">${ex} / ${total}</span></div>`
  }).join('')

  els.badges.innerHTML = BADGE_DEFS.map((b) => {
    const unlocked = store.badges.includes(b.id)
    return `<div class="badge-card ${unlocked ? 'unlocked' : ''}">
      <div class="badge-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="6"/><path d="m9 13.5-2 8.5 5-3 5 3-2-8.5"/>
        </svg>
      </div>
      <div class="badge-name">${esc(b.name)}</div>
      <div class="badge-desc">${esc(b.description)}</div>
    </div>`
  }).join('')
}
