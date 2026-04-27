import { CATEGORIES } from './constants'
import type { Topic, CategoryKey, QuizState } from './types'

let canvas: HTMLCanvasElement | null = null
let _topics: Topic[] = []
let _byId: Map<string, Topic> = new Map()

export function initCanvas(el: HTMLCanvasElement, topics: Topic[]): void {
  canvas = el
  _topics = topics
  _byId = new Map(topics.map((t) => [t.id, t]))
  resizeCanvas()
}

export function resizeCanvas(): void {
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const r = Math.min(devicePixelRatio || 1, 2)
  canvas.width = innerWidth * r
  canvas.height = innerHeight * r
  canvas.style.width = innerWidth + 'px'
  canvas.style.height = innerHeight + 'px'
  ctx.setTransform(r, 0, 0, r, 0, 0)
}

export function draw2d(selectedId: string | null, quiz: Pick<QuizState, 'active' | 'candidates'>): void {
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const w = innerWidth, h = innerHeight
  const sc = Math.min(w, h) / 118

  ctx.clearRect(0, 0, w, h)

  const gr = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h))
  gr.addColorStop(0, '#10251f')
  gr.addColorStop(1, '#0a0e1a')
  ctx.fillStyle = gr
  ctx.fillRect(0, 0, w, h)

  _topics.forEach((t) => {
    t.connected_topics.forEach((id) => {
      const b = _byId.get(id)
      if (!b) return
      const p = pt(t, sc), q = pt(b, sc)
      const on = !selectedId || t.id === selectedId || id === selectedId || t.connected_topics.includes(selectedId ?? '')
      ctx.strokeStyle = on ? 'rgba(212,165,116,.34)' : 'rgba(148,163,184,.06)'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2, q.x, q.y)
      ctx.stroke()
    })
  })

  _topics.forEach((t) => {
    const p = pt(t, sc)
    const r = Math.max(4, t.size * 5.5)
    const sel = t.id === selectedId
    const cand = !quiz.active || quiz.candidates.has(t.id)
    ctx.globalAlpha = cand ? 1 : 0.24
    ctx.fillStyle = CATEGORIES[t.category as CategoryKey].color
    ctx.shadowColor = CATEGORIES[t.category as CategoryKey].color
    ctx.shadowBlur = sel ? 24 : 10
    ctx.beginPath()
    ctx.arc(p.x, p.y, sel ? r * 1.35 : r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    if (sel || r > 6.2) {
      ctx.fillStyle = 'rgba(254,243,199,.92)'
      ctx.font = '700 11px Inter'
      ctx.textAlign = 'center'
      ctx.fillText(t.label_id, p.x, p.y - r - 8)
    }
    ctx.globalAlpha = 1
  })
}

export function pick2d(x: number, y: number): Topic | null {
  if (!canvas) return null
  const sc = Math.min(innerWidth, innerHeight) / 118
  let best: Topic | null = null
  let bestDist = 1e9
  _topics.forEach((t) => {
    const p = pt(t, sc)
    const dist = Math.hypot(x - p.x, y - p.y)
    if (dist < bestDist && dist < Math.max(12, t.size * 7)) {
      best = t
      bestDist = dist
    }
  })
  return best
}

function pt(t: Topic, sc: number): { x: number; y: number } {
  const cats = Object.keys(CATEGORIES) as CategoryKey[]
  const ci = cats.indexOf(t.category as CategoryKey)
  const same = _topics.filter((x) => x.category === t.category)
  const i = same.findIndex((x) => x.id === t.id)
  const ca = (ci / cats.length) * Math.PI * 2
  const ring = 18 + (i % 4) * 7
  const la = ca + (i - same.length / 2) * 0.055
  const orb = 28 + ci * 3
  const px = Math.cos(ca) * orb + Math.cos(la) * ring
  const py = Math.sin(ca) * orb + Math.sin(la) * ring
  return { x: innerWidth / 2 + px * sc, y: innerHeight / 2 + py * sc }
}
