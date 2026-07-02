# Adaptive Quality Mobile Rendering Design

## Goal

Make the 3D galaxy run smoothly on mobile devices (target: ~50–60fps on a mid-range Android phone) without maintaining a second render path or degrading the desktop experience.

## Decision

Keep one 3D galaxy for all devices. Add a quality tier system (`high | medium | low`) that is auto-detected at boot, adapts downward at runtime from measured FPS, and can be manually overridden. Independently of tiers, refactor the renderer's hot paths (instancing, merged edges, zero-allocation frame loop) so every tier gets faster.

Scope is rendering performance only. Mobile UI/layout is out of scope (a mobile-first layout overhaul already shipped). The 2D canvas fallback remains only for browsers without WebGL.

## Architecture

### New module: `src/perf.ts` — quality tier system

Owns one decision: which tier is this device on.

**Initial guess at boot** from cheap signals:

- `navigator.deviceMemory` and `navigator.hardwareConcurrency`
- coarse pointer / small screen width (mobile heuristic)
- GPU renderer string via `WEBGL_DEBUG_RENDERER_INFO` when available
- `prefers-reduced-motion` forces low-tier animation behavior (no auto-rotate, no idle pulsing)

**Runtime adaptation:** a rolling FPS monitor runs for ~10 seconds after boot and after any tier change. If median FPS falls below ~45, step down one tier. Tiers only step down automatically — never up — to avoid oscillation. The settled tier is persisted to `localStorage` so subsequent visits boot directly into the right tier.

**Manual override:** a `quality` setting (`auto | high | medium | low`) in the existing settings store. `auto` is the default and enables detection + adaptation; an explicit tier disables both.

**API shape:**

- `detectTier(renderer?): Tier` — boot-time guess
- `getTierConfig(tier): TierConfig` — the parameter table below
- `createFpsMonitor(onDowngrade): { frame(now): void, stop(): void }` — called once per rendered frame

### Tier parameter table

All tier differences live in one `TierConfig` object. No scattered `if (mobile)` checks anywhere in the renderer.

| Parameter | High | Medium | Low |
|---|---|---|---|
| Pixel ratio | min(devicePixelRatio, 2) | 1.25 | 1 |
| Antialias | on | off | off |
| Background stars | 5,200 (3 layers) | ~1,500 (2 layers) | ~500 (1 layer) |
| Sky shader | animated | animated | static gradient |
| Glow shells | on | off | off |
| Edge flow particles | on | off | off |
| Max visible labels | 28 | 12 | 6 |
| Auto-rotate when idle | on | on | off |

### Renderer refactor: `src/scene3d.ts`

These changes apply to all tiers and are where most of the performance comes from:

**Instanced topic spheres.** Replace per-topic `Mesh` + glow `Mesh` (~290 draw calls) with one `THREE.InstancedMesh` using per-instance color (`instanceColor`) and per-instance matrix — one draw call. Glow becomes a second additive-blend `InstancedMesh` created only on high tier. Raycasting hits the `InstancedMesh` and maps `instanceId` back to the visible topic ID. Hover/selection/quiz pulse effects write only the affected instance matrices/colors and set the buffer's `needsUpdate` flag, instead of touching every node's material every frame.

**Merged edges.** All edge curves are baked into a single `LineSegments` geometry with per-vertex colors — one draw call regardless of edge count. Edge flow particles become a single `THREE.Points` buffer whose positions are updated in place, created only on high tier. `rebuildEdges()` keeps its signature; it rebuilds the merged buffers.

**Zero-allocation frame loop.** Module-level scratch `Vector3`/`Color` objects are reused; no `new` inside the animation loop.

**Single animation loop.** `scene3d.ts` currently has two RAF loops (`startAnimate` and the legacy `animate`, which also captures stale arguments). Consolidate to one loop driven by the existing `animState` object and delete the legacy loop. This also removes a potential double-render.

**Pause when hidden.** On `visibilitychange`, stop the RAF loop when the tab is hidden and resume on return. Applies to all tiers.

**Labels** stay CSS2D with the existing LOD ranking; only the per-tier visible cap changes.

### Integration: `src/main.ts`

1. Boot resolves the tier (manual override → persisted tier → `detectTier`).
2. `initScene` receives the `TierConfig` and builds stars/sky/glow/particles accordingly.
3. The FPS monitor hooks into the animation loop; on downgrade it applies the new config live.
4. Live tier changes apply cheap settings without a scene rebuild: pixel ratio, star layer visibility, particle on/off, label cap, auto-rotate. Star layers are all built up-front only on high/medium and toggled by visibility; glow/particles are disposed on downgrade. Instancing is used on every tier, so no structural rebuild is ever needed.
5. The settings UI gains a quality selector wired to the store.

### Dev-only FPS overlay

A `?perf` query param shows a small FPS/tier overlay so real phones can be checked against deployed previews. Not rendered otherwise.

## Data flow

1. Boot reads quality setting and persisted tier → resolves initial tier.
2. `getTierConfig(tier)` → passed to `initScene`.
3. Animation loop reports frame times to the FPS monitor.
4. Monitor downgrade → new config applied live → new tier persisted.
5. Manual setting change → same live-apply path, monitor disabled unless `auto`.

## Error handling

- WebGL unavailable → existing `scene2d.ts` fallback, unchanged.
- GPU string unavailable (privacy settings) → rely on remaining signals; unknown mobile devices default to `medium` and the FPS monitor corrects downward.
- `deviceMemory` absent (Firefox/Safari) → treated as unknown, not low.
- Persisted tier from a previous visit is validated against the allowed values; invalid values fall back to `auto` detection.

## Testing and verification

No test framework is configured in this repo. Verification:

- `npm run build` passes.
- Desktop Chrome: high tier detected, visuals unchanged (stars, glow, particles, labels).
- Chrome DevTools mobile emulation + 4× CPU throttle: tier resolves to medium/low, ≥45–50fps steady, `?perf` overlay confirms.
- Force low tier via setting: static sky, no glow/particles, reduced stars/labels, pixel ratio 1.
- Interactions still correct under instancing: hover highlight, click select, quiz candidate dimming, camera flight, search select, cluster expand/rebuild.
- Tab hide/show pauses and resumes rendering.
- Real phone check against deployed preview with `?perf`.

## Out of scope

- Mobile UI/layout changes (touch targets, panels, sheets).
- 2D scene feature parity work.
- Data/hierarchy changes.
