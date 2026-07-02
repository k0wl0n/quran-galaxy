# Adaptive Quality Mobile Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D galaxy run at ~50–60fps on a mid-range Android phone via a quality tier system (auto-detected, FPS-adaptive, manually overridable) plus renderer refactors (instancing, merged edges, single animation loop) that speed up every tier.

**Architecture:** A new `src/perf.ts` module owns tier detection, the tier parameter table, an FPS monitor that only steps tiers *down*, and a dev-only overlay. `src/scene3d.ts` is refactored so all 144 topic spheres render as one `InstancedMesh` (plus one optional glow `InstancedMesh`), all edges render as one `LineSegments`, and one RAF loop drives everything with zero per-frame allocations. `src/main.ts` resolves the tier at boot and wires the monitor.

**Tech Stack:** TypeScript, Vite 5, three.js **0.128.0** (pinned — see constraints), existing DOM/CSS.

## Global Constraints

- three.js is pinned at `0.128.0`. Only use APIs that exist in r128: `InstancedMesh`, `mesh.setColorAt(i, color)`, `mesh.instanceColor.needsUpdate`, `instanceMatrix.setUsage(THREE.DynamicDrawUsage)`, raycast `instanceId`, `curve.getPoint(t, target)`. Do NOT use `outputColorSpace`, `SRGBColorSpace`, or other post-r150 APIs.
- No new runtime or dev dependencies. This repo has no test framework; verification per task is `npm run build` (which runs `tsc --noEmit`) plus manual browser checks listed in each task.
- Do NOT add `Co-Authored-By` or any AI-attribution footer to git commit messages (user rule).
- `src/scene2d.ts` (WebGL-less fallback) must not be modified.
- UI copy is Indonesian — new user-facing strings follow the existing tone (e.g. `Kualitas grafis`).
- Behavior contract that must survive the refactor: hover highlight, click select, touch near-pick, quiz candidate dimming, edge highlight on select, camera flight, mind-map layout animation, label LOD, camera save/restore, cluster expand rebuild (`setVisibleTopics3d`).

---

## File Structure

- Create: `src/perf.ts` — tier types, `STAR_LAYERS`, `getTierConfig`, `detectTier`, `resolveTier`, persisted auto-tier, `createFpsMonitor`, `createPerfOverlay`.
- Create: `src/nodes.ts` — `InstancedNodes`: instanced sphere + glow rendering with per-instance position/scale/brightness.
- Modify: `src/types.ts` — add `quality` to `AppStore`; reshape `EdgeData`; remove `NodeData`.
- Modify: `src/constants.ts` — `STORE_DEFAULTS.quality`.
- Modify: `src/scene3d.ts` — single loop, visibility pause, instanced nodes, merged edges, tier config consumption, `applyTier`.
- Modify: `src/main.ts` — tier resolution at boot, monitor + overlay wiring, quality selector binding.
- Modify: `index.html` — quality `<select>` in the topbar actions.
- Modify: `src/style.css` — quality select + perf overlay styles.

---

### Task 1: `src/perf.ts` — tier system core

**Files:**
- Create: `src/perf.ts`

**Interfaces:**
- Consumes: `lsGet`, `lsSet` from `./store` (existing: prefix-namespaced localStorage helpers).
- Produces (used by Tasks 2, 6):
  - `type Tier = 'high' | 'medium' | 'low'`
  - `type QualitySetting = 'auto' | Tier`
  - `interface TierConfig { tier: Tier; pixelRatio: number; antialias: boolean; starLayerCount: number; animatedSky: boolean; glow: boolean; edgeParticles: boolean; maxLabels: number; autoRotate: boolean }`
  - `STAR_LAYERS: { c: number; s: number; o: number; r: number }[]` (3 canonical layers)
  - `getTierConfig(tier: Tier): TierConfig`
  - `detectTier(): Tier`
  - `resolveTier(setting: QualitySetting): Tier`
  - `persistTier(tier: Tier): void`
  - `createFpsMonitor(onDowngrade: () => void): { frame(now: number): void; stop(): void }`
  - `createPerfOverlay(getTier: () => Tier): { frame(now: number): void }`

- [ ] **Step 1: Write `src/perf.ts`**

```ts
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
// 2.5s window. Below 45fps -> onDowngrade(). After 4 consecutive good
// windows it switches itself off. Deltas > 500ms (tab was hidden) are ignored.
export function createFpsMonitor(onDowngrade: () => void): { frame(now: number): void; stop(): void } {
  const WARMUP_MS = 1500
  const WINDOW_MS = 2500
  const MIN_FPS = 45
  const GOOD_WINDOWS_TO_STOP = 4
  const started = performance.now()
  let deltas: number[] = []
  let last = 0
  let windowStart = 0
  let active = true
  let good = 0
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
      if (1000 / median < MIN_FPS) { good = 0; onDowngrade() }
      else if (++good >= GOOD_WINDOWS_TO_STOP) active = false
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds (module is not imported yet; `tsc` still type-checks it).

- [ ] **Step 3: Commit**

```bash
git add src/perf.ts
git commit -m "feat: add quality tier detection, fps monitor, and perf overlay module"
```

---

### Task 2: Quality setting — store, selector UI, boot-time tier resolution

**Files:**
- Modify: `src/types.ts:41-58` (AppStore)
- Modify: `src/constants.ts:33-50` (STORE_DEFAULTS)
- Modify: `index.html` (topbar `.actions` block)
- Modify: `src/style.css` (append)
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `resolveTier`, `getTierConfig`, `type QualitySetting`, `type Tier`, `type TierConfig` from `./perf` (Task 1).
- Produces (used by Task 6): `main.ts` module-level `let tier: Tier` and `let tierCfg: TierConfig`, resolved before `init3d` is called; a bound `<select id="quality">`.

- [ ] **Step 1: Add `quality` to `AppStore`** in `src/types.ts` (after `reducedMotion: boolean`):

```ts
  quality: 'auto' | 'high' | 'medium' | 'low'
```

- [ ] **Step 2: Add default** in `src/constants.ts` `STORE_DEFAULTS` (after `reducedMotion` line):

```ts
  quality: 'auto',
```

(Existing users' saved stores lack the key; `loadStore()` already merges defaults via `Object.assign`.)

- [ ] **Step 3: Add the selector to `index.html`** inside `<div class="actions">`, before the `#theme` button:

```html
      <select id="quality" class="icon-btn quality-select" aria-label="Kualitas grafis" title="Kualitas grafis">
        <option value="auto">Auto</option>
        <option value="high">Tinggi</option>
        <option value="medium">Sedang</option>
        <option value="low">Ringan</option>
      </select>
```

- [ ] **Step 4: Append styles to `src/style.css`:**

```css
/* ── Quality selector + perf overlay ─────────────────────────────────── */
.quality-select {
  appearance: none;
  -webkit-appearance: none;
  width: auto;
  padding: 0 10px;
  font: 600 11px/1 'Inter', sans-serif;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
#perf-overlay {
  position: fixed;
  left: 10px;
  bottom: 10px;
  z-index: 999;
  pointer-events: none;
  font: 500 11px 'JetBrains Mono', monospace;
  color: #7fd9c4;
  background: rgba(8, 12, 23, 0.7);
  padding: 4px 8px;
  border-radius: 6px;
}
```

- [ ] **Step 5: Wire it in `src/main.ts`:**

Add import:

```ts
import { resolveTier, getTierConfig, type Tier, type TierConfig } from './perf'
```

Add to the `d` DOM-refs object: `quality: $('quality') as HTMLSelectElement,`

Add module-level state (near `let store: AppStore`):

```ts
let tier: Tier = 'high'
let tierCfg: TierConfig = getTierConfig('high')
```

In `boot()`, immediately after `store = loadStore()`:

```ts
  tier = resolveTier(store.quality ?? 'auto')
  tierCfg = getTierConfig(tier)
```

In `bind()` (next to `d.theme.onclick = toggleTheme`):

```ts
  d.quality.value = store.quality ?? 'auto'
  d.quality.onchange = () => {
    store.quality = d.quality.value as AppStore['quality']
    save()
    toast('Kualitas grafis diperbarui — memuat ulang…')
    setTimeout(() => location.reload(), 450)
  }
```

(A manual change reloads the page — antialias and star buffers are fixed at renderer creation, so a clean reload is the honest way to apply any direction of change. The FPS monitor's automatic *downgrades* apply live in Task 6.)

- [ ] **Step 6: Build + manual check**

Run: `npm run build` → succeeds.
Run: `npm run dev -- --host 127.0.0.1`, open the URL: the select renders in the topbar; changing it shows the toast and reloads; the choice persists (re-open the select after reload). `tierCfg` is not consumed by the renderer yet — visuals unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/constants.ts index.html src/style.css src/main.ts
git commit -m "feat: add graphics quality setting with boot-time tier resolution"
```

---

### Task 3: Single animation loop, visibility pause, frame callback

**Files:**
- Modify: `src/scene3d.ts:351-435` (the two loops), `src/scene3d.ts:37-125` (`init3d`)
- Modify: `src/main.ts` (only if the build reveals a stray `animate` import — currently it imports `startAnimate`)

**Interfaces:**
- Consumes: existing `animState`, `ctx`.
- Produces (used by Task 6): `setFrameCallback(cb: ((now: number) => void) | null): void` exported from `scene3d.ts`; the loop invokes it once per rendered frame.

- [ ] **Step 1: Delete the legacy loop.** Remove the entire exported `animate(...)` function (`src/scene3d.ts:392-435`). It self-schedules with stale captured arguments and nothing imports it (verify: `grep -n "animate" src/*.ts` shows only `startAnimate` imported in `main.ts`).

- [ ] **Step 2: Restructure `startAnimate` for pause/resume.** Replace the current `startAnimate` (lines 351-390) with:

```ts
let rafId = 0
let running = false
let frameCallback: ((now: number) => void) | null = null

export function setFrameCallback(cb: ((now: number) => void) | null): void {
  frameCallback = cb
}

export function startAnimate(): void {
  if (!ctx || running) return
  running = true
  ctx.clock.getDelta() // flush any large pending delta
  loop()
}

function stopAnimate(): void {
  running = false
  cancelAnimationFrame(rafId)
}

function loop(): void {
  if (!ctx || !running) return
  rafId = requestAnimationFrame(loop)
  const dt = Math.min(0.05, ctx.clock.getDelta())
  const el = ctx.clock.elapsedTime
  const { selectedId, hoverId, quizActive, quizCandidates, reducedMotion } = animState

  if (ctx.scene.userData.sky) ctx.scene.userData.sky.uniforms.t.value = el

  if (ctx.center.userData.orb) {
    ctx.center.userData.orb.rotation.y += dt * 0.12
    ctx.center.userData.shell.scale.setScalar(1 + Math.sin(el * 1.3) * 0.035)
    ctx.center.userData.ring.rotation.z += dt * 0.06
  }

  ctx.nodes.forEach((n, id) => {
    const base = n.mesh.userData.base as number
    let target = base
    if (id === hoverId) target = base * 1.3
    if (id === selectedId) target = base * (1.18 + Math.sin(el * 4) * 0.04)
    if (quizActive && quizCandidates.size && !quizCandidates.has(id)) target = base * 0.74
    n.mesh.scale.lerp(_scaleTarget.set(target, target, target), 0.12)
    n.glow.material.opacity = id === selectedId ? 0.32 : id === hoverId ? 0.26 : 0.14 + Math.sin(el * 1.8 + (n.mesh.userData.pulse as number)) * 0.025
    ;(n.mat as THREE.MeshStandardMaterial).emissiveIntensity = id === selectedId ? 1.05 : id === hoverId ? 0.9 : 0.52
  })

  ctx.edges.forEach((e) => {
    e.t = (e.t + dt * e.speed) % 1
    e.part.position.copy(e.curve.getPoint(e.t))
  })

  if (ctx.flight) flyStep()

  ctx.controls.autoRotate = !reducedMotion && !ctx.isMind && !quizActive && Date.now() - ctx.lastInteraction > 10000
  ctx.controls.autoRotateSpeed = 0.22
  ctx.controls.update()
  updateLabelLod(selectedId, hoverId)
  ctx.renderer.render(ctx.scene, ctx.camera)
  if (ctx.labels) ctx.labels.render(ctx.scene, ctx.camera)
  if (frameCallback) frameCallback(performance.now())
}
```

Add the scratch vector at module level (next to `let ctx`):

```ts
const _scaleTarget = new THREE.Vector3()
```

(The node/edge sections above are interim — Tasks 4 and 5 replace them. The `_scaleTarget` scratch removes the last per-frame allocation of this loop in the meantime.)

- [ ] **Step 3: Pause on hidden tab.** At the end of `init3d(...)` (after the `onpointerleave` line), add:

```ts
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAnimate()
    else startAnimate()
  })
```

Note: `startAnimate()` in `main.ts:183` still works unchanged — the `running` guard makes repeat calls safe.

- [ ] **Step 4: Build + manual check**

Run: `npm run build` → succeeds.
Dev server: galaxy renders and rotates as before; switch to another tab for ~10s, return — scene resumes without a jump (orb rotation doesn't leap). Select a topic — pulse still animates.

- [ ] **Step 5: Commit**

```bash
git add src/scene3d.ts
git commit -m "refactor: single animation loop with visibility pause and frame callback"
```

---

### Task 4: Instanced topic nodes

**Files:**
- Create: `src/nodes.ts`
- Modify: `src/types.ts:131-137` (remove `NodeData`)
- Modify: `src/scene3d.ts` (node building, picking, labels, LOD, hover, highlight, quiz visuals, burst, flyTo, layoutAnim, setVisibleTopics3d, loop node section)

**Interfaces:**
- Consumes: `Topic`, `CATEGORIES`.
- Produces (used by Tasks 5, 6):
  - `createInstancedNodes(topics: Topic[], glowEnabled: boolean, parent: THREE.Group): InstancedNodes`
  - `interface InstancedNodes { mesh: THREE.InstancedMesh; count: number; ids: string[]; topics: Topic[]; indexOf(id: string): number; getPosition(index: number, out: THREE.Vector3): THREE.Vector3; setPosition(index: number, pos: THREE.Vector3): void; baseSize(index: number): number; setScaleTarget(index: number, s: number): void; setBrightness(index: number, f: number): void; update(): void; disposeGlow(): void; dispose(): void }`
  - `scene3d.ts` internal: `ctx.nodesI: InstancedNodes | null`, `ctx.labelMap: Map<string, { el: HTMLElement; obj: CSS2DObject }>`, `ctx.originalPos: THREE.Vector3[]`, `ctx.flatPositions: THREE.Vector3[]`

**Design note (visual deltas, intentional):** the shared material becomes `MeshBasicMaterial` (unlit) because per-instance `emissiveIntensity`/`opacity` are impossible with one material. Nodes already read as self-lit orbs (emissive ≈ color today), so the look is close. Selection dim/undim is expressed as per-instance color *brightness* (dim = ×0.35, quiz non-candidate = ×0.22) instead of opacity, and the glow shell's per-node opacity pulse becomes a constant 0.16.

- [ ] **Step 1: Write `src/nodes.ts`:**

```ts
import * as THREE from 'three'
import { CATEGORIES } from './constants'
import type { Topic, CategoryKey } from './types'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

export interface InstancedNodes {
  mesh: THREE.InstancedMesh
  count: number
  ids: string[]
  topics: Topic[]
  indexOf(id: string): number
  getPosition(index: number, out: THREE.Vector3): THREE.Vector3
  setPosition(index: number, pos: THREE.Vector3): void
  baseSize(index: number): number
  setScaleTarget(index: number, s: number): void
  setBrightness(index: number, f: number): void
  update(): void
  disposeGlow(): void
  dispose(): void
}

export function createInstancedNodes(
  topics: Topic[],
  glowEnabled: boolean,
  parent: THREE.Group,
): InstancedNodes {
  const n = topics.length
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 24, 18),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.96 }),
    n,
  )
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false

  let glow: THREE.InstancedMesh | null = null
  if (glowEnabled) {
    glow = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.34, 16, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
      n,
    )
    glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    glow.frustumCulled = false
  }

  const ids = topics.map((t) => t.id)
  const index = new Map(ids.map((id, i) => [id, i]))
  const pos = new Float32Array(n * 3)
  const cur = new Float32Array(n)
  const target = new Float32Array(n)
  const bright = new Float32Array(n).fill(1)
  const baseCol: THREE.Color[] = []
  let colorDirty = true

  topics.forEach((t, i) => {
    const p = t.position
    pos[i * 3]     = p.radius * Math.sin(p.phi) * Math.cos(p.theta)
    pos[i * 3 + 1] = p.radius * Math.cos(p.phi)
    pos[i * 3 + 2] = p.radius * Math.sin(p.phi) * Math.sin(p.theta)
    cur[i] = target[i] = t.size
    baseCol.push(new THREE.Color(CATEGORIES[t.category as CategoryKey].color))
  })

  function writeMatrices(): void {
    _q.identity()
    for (let i = 0; i < n; i++) {
      _p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      _s.setScalar(cur[i])
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
      if (glow) glow.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (glow) glow.instanceMatrix.needsUpdate = true
  }

  function writeColors(): void {
    for (let i = 0; i < n; i++) {
      _c.copy(baseCol[i]).multiplyScalar(bright[i])
      mesh.setColorAt(i, _c)
      if (glow) glow.setColorAt(i, _c)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (glow?.instanceColor) glow.instanceColor.needsUpdate = true
    colorDirty = false
  }

  writeMatrices()
  writeColors()
  parent.add(mesh)
  if (glow) parent.add(glow)

  return {
    mesh,
    count: n,
    ids,
    topics,
    indexOf: (id) => index.get(id) ?? -1,
    getPosition: (i, out) => out.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]),
    setPosition(i, p): void {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z
    },
    baseSize: (i) => topics[i].size,
    setScaleTarget(i, s): void { target[i] = s },
    setBrightness(i, f): void {
      if (bright[i] !== f) { bright[i] = f; colorDirty = true }
    },
    update(): void {
      for (let i = 0; i < n; i++) cur[i] += (target[i] - cur[i]) * 0.12
      writeMatrices()
      if (colorDirty) writeColors()
    },
    disposeGlow(): void {
      if (!glow) return
      parent.remove(glow)
      glow.geometry.dispose()
      ;(glow.material as THREE.Material).dispose()
      glow = null
    },
    dispose(): void {
      this.disposeGlow()
      parent.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    },
  }
}
```

- [ ] **Step 2: Remove `NodeData` from `src/types.ts`** (lines 131-137). Verify nothing else imports it: `grep -rn "NodeData" src/` should only show `types.ts` and `scene3d.ts` (whose import list you fix in the next step).

- [ ] **Step 3: Rework `src/scene3d.ts` state and node building.**

Imports: drop `NodeData` from the type import; add:

```ts
import { createInstancedNodes, type InstancedNodes } from './nodes'
```

In `Scene3DState`, replace `nodes: Map<string, NodeData>` with:

```ts
  nodesI: InstancedNodes | null
  labelMap: Map<string, { el: HTMLElement; obj: CSS2DObject }>
  originalPos: THREE.Vector3[]
  flatPositions: THREE.Vector3[]
```

In the `ctx = {...}` literal inside `init3d`, replace `nodes: new Map(),` with:

```ts
    nodesI: null, labelMap: new Map(), originalPos: [], flatPositions: [],
```

Replace `buildTopicNodes()` and `clearTopicNodes()` entirely with:

```ts
function buildTopicNodes(): void {
  if (!ctx) return
  ctx.nodesI = createInstancedNodes(ctx.topics, true, ctx.nodeGroup)
  ctx.originalPos = []
  ctx.flatPositions = []
  const v = new THREE.Vector3()
  ctx.topics.forEach((t, i) => {
    ctx!.nodesI!.getPosition(i, v)
    ctx!.originalPos.push(v.clone())
    ctx!.flatPositions.push(flatPos(t, ctx!.topics))
    if (ctx!.labels) {
      const el = document.createElement('div')
      el.className = 'label'
      el.textContent = t.label_id
      el.style.borderColor = hexToRgba(CATEGORIES[t.category as CategoryKey].color, 0.28)
      const lo = new CSS2DObject(el)
      lo.position.set(v.x, v.y + t.size + 1.35, v.z)
      ctx!.nodeGroup.add(lo)
      ctx!.labelMap.set(t.id, { el, obj: lo })
    }
  })
}

function clearTopicNodes(): void {
  if (!ctx) return
  ctx.nodesI?.dispose()
  ctx.nodesI = null
  ctx.labelMap.forEach(({ el, obj }) => { ctx!.nodeGroup.remove(obj); el.remove() })
  ctx.labelMap.clear()
  ctx.originalPos = []
  ctx.flatPositions = []
}
```

Delete the now-unused `sphericalPos` helper (positions are computed inside `nodes.ts`). Keep `flatPos`.

- [ ] **Step 4: Rework picking in `init3d`.**

Replace the raycast lines in `onpointermove` (`intersectObjects([...ctx.nodes.values()]...)` and the id extraction) with:

```ts
    const hit = ctx.nodesI ? ctx.ray.intersectObject(ctx.nodesI.mesh, false)[0] : undefined
    const id = hit?.instanceId !== undefined ? ctx.nodesI!.ids[hit.instanceId] : null
```

In the `pointerup` handler, same replacement for the click raycast:

```ts
    const hit = ctx.nodesI ? ctx.ray.intersectObject(ctx.nodesI.mesh, false)[0] : undefined
    if (hit && hit.instanceId !== undefined) { callbacks.onNodeClick(ctx.nodesI!.ids[hit.instanceId]); return }
```

And the touch near-pick loop becomes:

```ts
    if (ev.pointerType === 'touch' && ctx.nodesI) {
      const proj = new THREE.Vector3()
      let bestId: string | null = null, bestDist = 48
      for (let i = 0; i < ctx.nodesI.count; i++) {
        ctx.nodesI.getPosition(i, proj).project(ctx.camera)
        const sx = (proj.x * 0.5 + 0.5) * r.width + r.left
        const sy = (-proj.y * 0.5 + 0.5) * r.height + r.top
        const d = Math.hypot(ev.clientX - sx, ev.clientY - sy)
        if (d < bestDist) { bestDist = d; bestId = ctx.nodesI.ids[i] }
      }
      if (bestId) callbacks.onNodeClick(bestId)
    }
```

- [ ] **Step 5: Rework the per-node consumers.**

`updateLabelLod` — throttled, index-based (add `let lastLod = 0` at module level, and a module-level `const _v = new THREE.Vector3()`):

```ts
function updateLabelLod(selectedId: string | null, hoverId: string | null, el: number): void {
  if (!ctx?.labels || !ctx.nodesI) return
  if (el - lastLod < 0.25) return
  lastLod = el
  const camPos = ctx.camera.position
  const ranked = ctx.nodesI.ids
    .map((id, i) => ({ id, d: ctx!.nodesI!.getPosition(i, _v).distanceToSquared(camPos) }))
    .sort((a, b) => a.d - b.d)
  const visible = new Set(ranked.slice(0, 28).map((r) => r.id))
  if (selectedId) visible.add(selectedId)
  if (hoverId) visible.add(hoverId)
  ctx.labelMap.forEach(({ el: labelEl }, id) => {
    labelEl.style.display = visible.has(id) ? '' : 'none'
  })
}
```

The loop's node section (from Task 3) becomes:

```ts
  const nodesI = ctx.nodesI
  if (nodesI) {
    for (let i = 0; i < nodesI.count; i++) {
      const id = nodesI.ids[i]
      const base = nodesI.baseSize(i)
      let t = base
      if (id === hoverId) t = base * 1.3
      if (id === selectedId) t = base * (1.18 + Math.sin(el * 4) * 0.04)
      if (quizActive && quizCandidates.size && !quizCandidates.has(id)) t = base * 0.74
      nodesI.setScaleTarget(i, t)
    }
    nodesI.update()
  }
```

and the LOD call becomes `updateLabelLod(selectedId, hoverId, el)`. Delete the `_scaleTarget` scratch from Task 3 (no longer used).

`setHover3d`:

```ts
export function setHover3d(hoverId: string | null, prevHoverId: string | null): void {
  if (!ctx) return
  if (prevHoverId) ctx.labelMap.get(prevHoverId)?.el.classList.remove('hot')
  if (hoverId) ctx.labelMap.get(hoverId)?.el.classList.add('hot')
}
```

`highlightEdges` — node-dim half only (edge half is Task 5; adapt to whatever shape `ctx.edges` currently has so this task still builds — set per-edge line/particle opacity exactly as the old code did):

```ts
  ctx.nodesI?.ids.forEach((id, i) => {
    const dim = !!t && id !== t.id && !rel.has(id)
    ctx!.labelMap.get(id)?.el.classList.toggle('dim', dim)
    ctx!.nodesI!.setBrightness(i, dim ? 0.35 : 1)
  })
```

`quizVisuals3d` — node half:

```ts
  ctx.nodesI?.ids.forEach((id, i) => {
    const c = candidates.has(id)
    ctx!.nodesI!.setBrightness(i, c ? 1 : 0.22)
    ctx!.labelMap.get(id)?.el.classList.toggle('dim', !c)
  })
```

`flyTo`:

```ts
export function flyTo(id: string, store: { reducedMotion: boolean }, whooshFn: () => void): void {
  if (!ctx?.nodesI) return
  const i = ctx.nodesI.indexOf(id)
  if (i < 0) return
  const target = ctx.nodesI.getPosition(i, new THREE.Vector3())
  const size = ctx.nodesI.baseSize(i)
  const dir = target.clone().normalize()
  if (dir.lengthSq() < 0.001) dir.set(0, 0.4, 1).normalize()
  const dest = target.clone().add(
    dir.multiplyScalar(ctx.isMind ? 58 : 14 + size * 9)
      .add(new THREE.Vector3(0, ctx.isMind ? 0 : 5, ctx.isMind ? 70 : 0)),
  )
  ctx.flight = { start: performance.now(), dur: store.reducedMotion ? 240 : 1500, fp: ctx.camera.position.clone(), ft: ctx.controls.target.clone(), tp: dest, tt: target }
  whooshFn()
}
```

`burst3d` — replace `const n = ctx.nodes.get(id) ... n.mesh.position` with:

```ts
  const i = ctx.nodesI?.indexOf(id) ?? -1
  if (i < 0 || !ctx.nodesI) return
  const origin = ctx.nodesI.getPosition(i, new THREE.Vector3())
```

and use `origin` where `n.mesh.position` was used.

`layoutAnim`:

```ts
function layoutAnim(flat: boolean, store: { reducedMotion: boolean }): void {
  if (!ctx?.nodesI) return
  const nodesI = ctx.nodesI
  const starts: THREE.Vector3[] = []
  for (let i = 0; i < nodesI.count; i++) starts.push(nodesI.getPosition(i, new THREE.Vector3()).clone())
  const st = performance.now()
  const dur = store.reducedMotion ? 80 : 980
  const step = (): void => {
    if (!ctx?.nodesI) return
    const t = Math.min(1, (performance.now() - st) / dur)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    for (let i = 0; i < nodesI.count; i++) {
      _v.lerpVectors(starts[i], flat ? ctx.flatPositions[i] : ctx.originalPos[i], e)
      nodesI.setPosition(i, _v)
      const entry = ctx.labelMap.get(nodesI.ids[i])
      if (entry) entry.obj.position.set(_v.x, _v.y + nodesI.baseSize(i) + 1.35, _v.z)
    }
    if (t < 1) requestAnimationFrame(step)
    else { rebuildEdges(); highlightEdges(null) }
  }
  step()
}
```

`rebuildEdges` — interim fix so this task builds: replace `na.mesh.position` / `nb.mesh.position` lookups with index-based positions:

```ts
      const ia = ctx!.nodesI!.indexOf(a.id)
      const ib = ctx!.nodesI!.indexOf(bid)
      if (!b || ia < 0 || ib < 0) return
      const curve = edgeCurve(
        ctx!.nodesI!.getPosition(ia, new THREE.Vector3()),
        ctx!.nodesI!.getPosition(ib, new THREE.Vector3()),
        ctx!.isMind,
      )
```

(and add `if (!ctx.nodesI) return` at the top of `rebuildEdges`). Everything else in `rebuildEdges` stays as-is until Task 5.

- [ ] **Step 6: Build + manual check**

Run: `npm run build` → succeeds.
Dev server checks: galaxy renders (colors per category correct); hover grows a node + shows hover card + `hot` label; click opens panel and flies camera; touch emulation tap near a node selects it; selecting dims unrelated nodes (darker, not transparent — intended); quiz start dims non-candidates; wrong/right answers work; burst particles appear on correct answer; Mind Map toggle animates to flat layout and back, labels follow; Reset works; labels cap at ~28 nearest.

- [ ] **Step 7: Commit**

```bash
git add src/nodes.ts src/types.ts src/scene3d.ts
git commit -m "perf: render topic spheres as InstancedMesh (one draw call per layer)"
```

---

### Task 5: Merged edge rendering

**Files:**
- Modify: `src/types.ts:139-147` (`EdgeData`)
- Modify: `src/scene3d.ts` (`rebuildEdges`, `highlightEdges`, `quizVisuals3d`, loop edge section, state)

**Interfaces:**
- Consumes: `ctx.nodesI` (Task 4).
- Produces (used by Task 6): `ctx.edgesState: { lines: THREE.LineSegments; colorAttr: THREE.BufferAttribute; particles: THREE.Points | null; particleAttr: THREE.BufferAttribute | null; list: EdgeData[] } | null`; internal `disposeEdgeParticles(): void`.

- [ ] **Step 1: Reshape `EdgeData` in `src/types.ts`:**

```ts
export interface EdgeData {
  a: string
  b: string
  curve: any
  baseColor: any
  vertStart: number
  vertCount: number
  t: number
  speed: number
  on: boolean
}
```

- [ ] **Step 2: Replace edge state in `scene3d.ts`.**

In `Scene3DState`, replace `edges: EdgeData[]` with:

```ts
  edgesState: {
    lines: THREE.LineSegments
    colorAttr: THREE.BufferAttribute
    particles: THREE.Points | null
    particleAttr: THREE.BufferAttribute | null
    list: EdgeData[]
  } | null
```

In the `ctx = {...}` literal: `edgesState: null,` (remove `edges: [],`).

- [ ] **Step 3: Rewrite `rebuildEdges`:**

```ts
const EDGE_POINTS = 24

export function rebuildEdges(): void {
  if (!ctx?.nodesI) return
  if (ctx.edgesState) {
    ctx.edgeGroup.remove(ctx.edgesState.lines)
    ctx.edgesState.lines.geometry.dispose()
    ;(ctx.edgesState.lines.material as THREE.Material).dispose()
    disposeEdgeParticles()
    ctx.edgesState = null
  }

  const list: EdgeData[] = []
  const curves: THREE.QuadraticBezierCurve3[] = []
  const seen = new Set<string>()
  const visibleIds = new Set(ctx.topics.map((topic) => topic.id))
  ctx.topics.forEach((a) => {
    a.connected_topics.forEach((bid) => {
      const b = ctx!.byId.get(bid)
      if (!b || !visibleIds.has(a.id) || !visibleIds.has(bid)) return
      const ia = ctx!.nodesI!.indexOf(a.id)
      const ib = ctx!.nodesI!.indexOf(bid)
      if (ia < 0 || ib < 0) return
      const k = [a.id, bid].sort().join('--')
      if (seen.has(k)) return
      seen.add(k)
      const curve = edgeCurve(
        ctx!.nodesI!.getPosition(ia, new THREE.Vector3()),
        ctx!.nodesI!.getPosition(ib, new THREE.Vector3()),
        ctx!.isMind,
      )
      const col = new THREE.Color(CATEGORIES[a.category as CategoryKey].color)
        .lerp(new THREE.Color(CATEGORIES[b.category as CategoryKey].color), 0.5)
      curves.push(curve)
      list.push({
        a: a.id, b: bid, curve, baseColor: col,
        vertStart: 0, vertCount: 0,
        t: Math.random(), speed: 0.045 + Math.random() * 0.075, on: true,
      })
    })
  })

  const segsPerEdge = EDGE_POINTS - 1
  const vertsPerEdge = segsPerEdge * 2
  const positions = new Float32Array(list.length * vertsPerEdge * 3)
  const colors = new Float32Array(list.length * vertsPerEdge * 3)
  list.forEach((e, k) => {
    e.vertStart = k * vertsPerEdge
    e.vertCount = vertsPerEdge
    const pts = curves[k].getPoints(EDGE_POINTS - 1)
    for (let j = 0; j < segsPerEdge; j++) {
      for (const [slot, pt] of [[0, pts[j]], [1, pts[j + 1]]] as [number, THREE.Vector3][]) {
        const v = (e.vertStart + j * 2 + slot) * 3
        positions[v] = pt.x; positions[v + 1] = pt.y; positions[v + 2] = pt.z
      }
    }
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const colorAttr = new THREE.BufferAttribute(colors, 3)
  geo.setAttribute('color', colorAttr)
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  lines.frustumCulled = false
  ctx.edgeGroup.add(lines)

  let particles: THREE.Points | null = null
  let particleAttr: THREE.BufferAttribute | null = null
  if (list.length) {
    const ppos = new Float32Array(list.length * 3)
    const pcol = new Float32Array(list.length * 3)
    list.forEach((e, k) => {
      const p = e.curve.getPoint(e.t) as THREE.Vector3
      ppos[k * 3] = p.x; ppos[k * 3 + 1] = p.y; ppos[k * 3 + 2] = p.z
      pcol[k * 3] = e.baseColor.r; pcol[k * 3 + 1] = e.baseColor.g; pcol[k * 3 + 2] = e.baseColor.b
    })
    const pgeo = new THREE.BufferGeometry()
    particleAttr = new THREE.BufferAttribute(ppos, 3)
    pgeo.setAttribute('position', particleAttr)
    pgeo.setAttribute('color', new THREE.BufferAttribute(pcol, 3))
    particles = new THREE.Points(pgeo, new THREE.PointsMaterial({
      size: 0.32, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }))
    particles.frustumCulled = false
    ctx.edgeGroup.add(particles)
  }

  ctx.edgesState = { lines, colorAttr, particles, particleAttr, list }
  highlightEdges(null)
}

function disposeEdgeParticles(): void {
  if (!ctx?.edgesState?.particles) return
  ctx.edgeGroup.remove(ctx.edgesState.particles)
  ctx.edgesState.particles.geometry.dispose()
  ;(ctx.edgesState.particles.material as THREE.Material).dispose()
  ctx.edgesState.particles = null
  ctx.edgesState.particleAttr = null
}

function paintEdge(e: EdgeData, factor: number): void {
  if (!ctx?.edgesState) return
  const attr = ctx.edgesState.colorAttr
  for (let v = e.vertStart; v < e.vertStart + e.vertCount; v++) {
    attr.setXYZ(v, e.baseColor.r * factor, e.baseColor.g * factor, e.baseColor.b * factor)
  }
}
```

(Delete the old per-edge `Line`/particle-mesh code, and the `disposeObject`-based edge clearing.)

- [ ] **Step 4: Rewrite the edge halves of `highlightEdges` and `quizVisuals3d`.**

`highlightEdges` (keep the Task 4 node half):

```ts
export function highlightEdges(selectedId: string | null): void {
  if (!ctx) return
  const t = selectedId ? ctx.byId.get(selectedId) : null
  const rel = new Set(t ? [...t.connected_topics, t.id] : [])
  if (ctx.edgesState) {
    ctx.edgesState.list.forEach((e) => {
      const on = !t || (rel.has(e.a) && rel.has(e.b))
      paintEdge(e, on ? (t ? 0.56 : 0.22) : 0.045)
      e.on = on || !t
    })
    ctx.edgesState.colorAttr.needsUpdate = true
  }
  // ...node-dim half from Task 4 unchanged...
}
```

`quizVisuals3d` edge half:

```ts
  if (ctx.edgesState) {
    ctx.edgesState.list.forEach((e) => {
      const on = candidates.has(e.a) && candidates.has(e.b)
      paintEdge(e, on ? 0.32 : 0.02)
      e.on = on
    })
    ctx.edgesState.colorAttr.needsUpdate = true
  }
```

- [ ] **Step 5: Rewrite the loop's edge section** (replaces `ctx.edges.forEach(...)`):

```ts
  const es = ctx.edgesState
  if (es?.particles && es.particleAttr) {
    es.list.forEach((e, i) => {
      if (!e.on) { es.particleAttr!.setXYZ(i, 0, 99999, 0); return }
      e.t = (e.t + dt * e.speed) % 1
      e.curve.getPoint(e.t, _v)
      es.particleAttr!.setXYZ(i, _v.x, _v.y, _v.z)
    })
    es.particleAttr.needsUpdate = true
  }
```

- [ ] **Step 6: Build + manual check**

Run: `npm run build` → succeeds.
Dev server: edges visible with blended category colors and moving particles; selecting a topic brightens its edges and nearly hides the rest; quiz mode shows only candidate-pair edges; Mind Map toggle rebuilds curved flat edges; cluster expand (`setVisibleTopics3d`) rebuilds edges without leaks (toggle repeatedly, watch memory in devtools ≈ stable).

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/scene3d.ts
git commit -m "perf: merge edges into single LineSegments and one particle Points buffer"
```

---

### Task 6: Tier config consumption, live downgrade, monitor + overlay wiring

**Files:**
- Modify: `src/scene3d.ts` (`init3d` signature, `buildScene`, `buildStars`, sky/loop gating, `updateLabelLod` cap, `applyTier`)
- Modify: `src/main.ts` (pass config, wire monitor/overlay)

**Interfaces:**
- Consumes: `TierConfig`, `STAR_LAYERS`, `createFpsMonitor`, `createPerfOverlay`, `getTierConfig`, `persistTier` (Task 1); `tier`/`tierCfg` in `main.ts` (Task 2); `setFrameCallback` (Task 3); `ctx.nodesI.disposeGlow` (Task 4); `disposeEdgeParticles` (Task 5).
- Produces: `init3d(container, topics, callbacks, cfg: TierConfig)`; `applyTier(cfg: TierConfig): void` exported from `scene3d.ts`.

- [ ] **Step 1: Thread the config through `scene3d.ts`.**

Imports: `import { STAR_LAYERS, type TierConfig } from './perf'`

`Scene3DState` gains `cfg: TierConfig` and `stars: THREE.Points[]`.

`init3d` signature becomes `init3d(container, topics, callbacks, cfg: TierConfig)`. Use the config where the renderer is created:

```ts
  const renderer = new THREE.WebGLRenderer({ antialias: cfg.antialias, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(cfg.pixelRatio)
```

Add `cfg, stars: [],` to the `ctx = {...}` literal.

- [ ] **Step 2: Gate the scene builders.**

`buildStars` — iterate `STAR_LAYERS.slice(0, ctx.cfg.starLayerCount)` instead of the inline array (keep the existing point-generation loop body), and push each created `THREE.Points` into `ctx.stars` as well as the scene.

`buildTopicNodes` — pass the flag: `createInstancedNodes(ctx.topics, ctx.cfg.glow, ctx.nodeGroup)`.

`rebuildEdges` — wrap the particle-creation block: `if (ctx.cfg.edgeParticles && list.length) { ... }`.

Sky animation in the loop: `if (ctx.cfg.animatedSky && ctx.scene.userData.sky) ctx.scene.userData.sky.uniforms.t.value = el` (a static `t=0` sky is the low-tier "static gradient").

Label cap in `updateLabelLod`: `ranked.slice(0, ctx.cfg.maxLabels)`.

Auto-rotate in the loop: `ctx.controls.autoRotate = ctx.cfg.autoRotate && !reducedMotion && !ctx.isMind && !quizActive && Date.now() - ctx.lastInteraction > 10000`.

- [ ] **Step 3: Add `applyTier` (live downgrade path) to `scene3d.ts`:**

```ts
export function applyTier(cfg: TierConfig): void {
  if (!ctx) return
  ctx.cfg = cfg
  ctx.renderer.setPixelRatio(cfg.pixelRatio)
  ctx.stars.forEach((p, i) => { p.visible = i < cfg.starLayerCount })
  if (!cfg.glow) ctx.nodesI?.disposeGlow()
  if (!cfg.edgeParticles) disposeEdgeParticles()
}
```

(Antialias cannot change on a live renderer — an auto-downgrade keeps the boot AA setting; a manual quality change reloads, which fully applies it. Star layers built at boot can only be hidden, never added — consistent with "downgrades only".)

- [ ] **Step 4: Wire `main.ts`.**

Extend the perf import with `createFpsMonitor, createPerfOverlay, persistTier`; extend the scene3d import with `setFrameCallback, applyTier`.

Pass the config: `init3d(d.scene, visibleTopics, { ... }, tierCfg)`.

After `startAnimate()` in `boot()`:

```ts
    const overlay = location.search.includes('perf') ? createPerfOverlay(() => tier) : null
    const monitor = (store.quality ?? 'auto') === 'auto'
      ? createFpsMonitor(() => {
          if (tier === 'low') return
          tier = tier === 'high' ? 'medium' : 'low'
          persistTier(tier)
          tierCfg = getTierConfig(tier)
          applyTier(tierCfg)
        })
      : null
    if (overlay || monitor) {
      setFrameCallback((now) => { monitor?.frame(now); overlay?.frame(now) })
    }
```

Also: when the user selects `auto` in the quality handler from Task 2, clear the stale persisted tier so detection reruns after reload — add `if (d.quality.value === 'auto') lsSet('auto_tier', '')` before the reload (extend the `lsSet` import; `resolveTier` already treats a non-tier string as absent).

- [ ] **Step 5: Build + manual checks**

Run: `npm run build` → succeeds.
- Desktop Chrome, `?perf`: overlay shows `~60 fps · high`; glow shells, particles, 3 star layers present.
- DevTools device emulation (mobile UA + touch) + hard reload: tier resolves `medium` (no glow/particles, fewer stars, AA off). With "Low-end mobile" CPU throttle (6×), watch the overlay: within ~15s it steps to `low` (star layers hidden, pixel ratio drops, auto-rotate off) and persists — reload stays `low`.
- Select `Ringan` manually: static sky (no slow color drift), 1 star layer, 6 labels max. Select `Auto`: reload re-detects.
- Verify the full behavior contract from Global Constraints once more on `high`.

- [ ] **Step 6: Commit**

```bash
git add src/scene3d.ts src/main.ts
git commit -m "feat: consume tier config in renderer with live fps-driven downgrade"
```

---

### Task 7: Final verification sweep

**Files:** none (verification only).

- [ ] **Step 1:** `npm run build` — passes clean.
- [ ] **Step 2:** Dev server full pass on desktop (high tier): boot → hover → select → panel/ayat → search select (hidden child expands) → quiz full round (candidate dimming, burst, scoring) → Mind Map toggle both ways → Reset → theme/mute toggles → tab hide/show pause-resume → camera persists across reload.
- [ ] **Step 3:** Emulated mobile pass (medium/low): same flow via touch; tap near-pick works; `?perf` confirms fps ≥ 45–50 under 4–6× CPU throttle.
- [ ] **Step 4:** WebGL-off check: launch Chrome with `--disable-webgl --disable-webgl2` (or emulate `checkWebGL()` returning false) → 2D fallback still renders and topics are clickable.
- [ ] **Step 5:** Report results to the user, including anything that needs a real-device check on a deployed preview (`https://<preview-url>/?perf`).

## Self-Review

- **Spec coverage:** tier detection/table/monitor/persistence/override (Tasks 1-2), instancing + labels + zero-alloc loop + single loop + visibility pause (Tasks 3-4), merged edges + particles (Task 5), config consumption + live downgrade + overlay + settings UI (Task 6), verification (Task 7). Spec's "settings UI quality selector" is the topbar select; spec's "live apply for manual changes" is intentionally narrowed to reload-on-manual-change (Task 2 note) because antialias/star buffers are boot-fixed — auto-downgrades remain live, which is what mobile perf needs.
- **Placeholder scan:** none; every code step carries full code.
- **Type consistency:** `nodesI: InstancedNodes | null`, `edgesState`, `labelMap`, `applyTier(cfg)`, `setFrameCallback(cb)` names match across Tasks 3-6; `EdgeData` fields used in Task 5 loop/highlight match the Task 5 type; `TierConfig.starLayerCount` used in Tasks 1/6 consistently.
