import { lsGet, lsSet } from './store'

export type Tier = 'high' | 'medium' | 'low'
export type QualitySetting = 'auto' | Tier

export interface TierConfig {
  tier: Tier
  pixelRatio: number
  antialias: boolean
  starLayerCount: number
  animatedSky: boolean
  glow: boolean
  edgeParticles: boolean
  maxLabels: number
  autoRotate: boolean
}

// Canonical star layers, ordered brightest-first so lower tiers keep a
// visible prefix: low = layer 0 (500), medium = 0+1 (1500), high = all (5200).
export const STAR_LAYERS = [
  { c: 500,  s: 0.34, o: 0.45, r: 330 },
  { c: 1000, s: 0.20, o: 0.68, r: 390 },
  { c: 3700, s: 0.12, o: 0.85, r: 440 },
]

export function getTierConfig(tier: Tier): TierConfig {
  if (tier === 'high') {
    return {
      tier, pixelRatio: Math.min(devicePixelRatio || 1, 2), antialias: true,
      starLayerCount: 3, animatedSky: true, glow: true, edgeParticles: true,
      maxLabels: 28, autoRotate: true,
    }
  }
  if (tier === 'medium') {
    return {
      tier, pixelRatio: 1.25, antialias: false,
      starLayerCount: 2, animatedSky: true, glow: false, edgeParticles: false,
      maxLabels: 12, autoRotate: true,
    }
  }
  return {
    tier, pixelRatio: 1, antialias: false,
    starLayerCount: 1, animatedSky: false, glow: false, edgeParticles: false,
    maxLabels: 6, autoRotate: false,
  }
}

function getGpuString(): string {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl') as WebGLRenderingContext | null
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
  } catch {
    return ''
  }
}

export function detectTier(): Tier {
  const gpu = getGpuString()
  if (/swiftshader|llvmpipe|mali-4|mali-t|adreno [1-4]\d\d|powervr/i.test(gpu)) return 'low'
  const coarse = matchMedia('(pointer: coarse)').matches
  const isMobile = coarse && Math.min(screen.width, screen.height) <= 820
  if (!isMobile) return 'high'
  const mem = (navigator as { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency || 0
  if ((mem !== undefined && mem <= 3) || (cores > 0 && cores <= 4)) return 'low'
  return 'medium'
}

const TIER_KEY = 'auto_tier'

export function persistTier(tier: Tier): void {
  lsSet(TIER_KEY, tier)
}

export function resolveTier(setting: QualitySetting): Tier {
  if (setting !== 'auto') return setting
  const saved = lsGet(TIER_KEY)
  if (saved === 'high' || saved === 'medium' || saved === 'low') return saved
  return detectTier()
}

// Rolling FPS monitor: warms up, then evaluates the median frame time per
// 2.5s window. Below 45fps -> onDowngrade(). Runs for the page's lifetime
// (cost is negligible). Deltas > 500ms (tab was hidden) are ignored.
export function createFpsMonitor(onDowngrade: () => void): { frame(now: number): void; stop(): void } {
  const WARMUP_MS = 1500
  const WINDOW_MS = 2500
  const MIN_FPS = 45
  const started = performance.now()
  let deltas: number[] = []
  let last = 0
  let windowStart = 0
  let active = true
  return {
    frame(now: number): void {
      if (!active) return
      if (now - started < WARMUP_MS) { last = now; return }
      if (!windowStart) windowStart = now
      const dt = last ? now - last : 0
      last = now
      if (dt > 0 && dt < 500) deltas.push(dt)
      if (now - windowStart < WINDOW_MS || !deltas.length) return
      const sorted = [...deltas].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      deltas = []
      windowStart = now
      if (1000 / median < MIN_FPS) onDowngrade()
    },
    stop(): void { active = false },
  }
}

// Dev-only overlay, created by main.ts when the URL contains ?perf.
export function createPerfOverlay(getTier: () => Tier): { frame(now: number): void } {
  const el = document.createElement('div')
  el.id = 'perf-overlay'
  document.body.appendChild(el)
  let frames = 0
  let lastUpdate = performance.now()
  return {
    frame(now: number): void {
      frames++
      if (now - lastUpdate < 500) return
      el.textContent = `${Math.round((frames * 1000) / (now - lastUpdate))} fps · ${getTier()}`
      frames = 0
      lastUpdate = now
    },
  }
}
