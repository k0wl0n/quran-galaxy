import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { CATEGORIES } from './constants'
import type { Topic, EdgeData, FlightState, CategoryKey, QuizState } from './types'
import { createInstancedNodes, type InstancedNodes } from './nodes'

export interface Scene3DCallbacks {
  onNodeClick: (id: string) => void
  onNodeHover: (id: string | null) => void
}

interface Scene3DState {
  scene: THREE.Scene
  pcam: THREE.PerspectiveCamera
  ocam: THREE.OrthographicCamera
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer
  labels: CSS2DRenderer | null
  controls: OrbitControls
  ray: THREE.Raycaster
  mouse: THREE.Vector2
  clock: THREE.Clock
  nodesI: InstancedNodes | null
  labelMap: Map<string, { el: HTMLElement; obj: CSS2DObject }>
  originalPos: THREE.Vector3[]
  flatPositions: THREE.Vector3[]
  edges: EdgeData[]
  edgeGroup: THREE.Group
  nodeGroup: THREE.Group
  center: THREE.Group
  flight: FlightState | null
  lastInteraction: number
  isMind: boolean
  topics: Topic[]
  byId: Map<string, Topic>
}

let ctx: Scene3DState | null = null

export function init3d(
  container: HTMLElement,
  topics: Topic[],
  callbacks: Scene3DCallbacks,
): void {
  const w = innerWidth, h = innerHeight
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x080c17, 0.012)

  const pcam = new THREE.PerspectiveCamera(58, w / h, 0.1, 1200)
  pcam.position.set(0, 34, 82)
  const ocam = new THREE.OrthographicCamera(w / -22, w / 22, h / 22, h / -22, 0.1, 1500)
  ocam.position.set(0, 0, 120)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  ;(renderer as any).outputEncoding = THREE.sRGBEncoding
  container.appendChild(renderer.domElement)

  let labels: CSS2DRenderer | null = null
  labels = new CSS2DRenderer()
  labels.setSize(w, h)
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
  container.appendChild(labels.domElement)

  const controls = new OrbitControls(pcam, renderer.domElement)
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.055, rotateSpeed: 0.55,
    zoomSpeed: 0.72, panSpeed: 0.55, minDistance: 12, maxDistance: 150,
  })
  controls.addEventListener('start', () => { if (ctx) ctx.lastInteraction = Date.now() })

  const edgeGroup = new THREE.Group()
  const nodeGroup = new THREE.Group()
  const center = new THREE.Group()
  scene.add(edgeGroup, nodeGroup, center)

  const byId = new Map(topics.map((t) => [t.id, t]))

  ctx = {
    scene, pcam, ocam, camera: pcam, renderer, labels, controls,
    ray: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    clock: new THREE.Clock(),
    nodesI: null, labelMap: new Map(), originalPos: [], flatPositions: [],
    edges: [], edgeGroup, nodeGroup, center,
    flight: null, lastInteraction: Date.now(), isMind: false,
    topics, byId,
  }

  renderer.domElement.onpointermove = (ev: PointerEvent) => {
    if (!ctx) return
    ctx.lastInteraction = Date.now()
    const r = renderer.domElement.getBoundingClientRect()
    ctx.mouse.x = (ev.clientX - r.left) / r.width * 2 - 1
    ctx.mouse.y = -(ev.clientY - r.top) / r.height * 2 + 1
    ctx.ray.setFromCamera(ctx.mouse, ctx.camera)
    const hit = ctx.nodesI ? ctx.ray.intersectObject(ctx.nodesI.mesh, false)[0] : undefined
    const id = hit?.instanceId !== undefined ? ctx.nodesI!.ids[hit.instanceId] : null
    callbacks.onNodeHover(id)
    renderer.domElement.style.cursor = hit ? 'pointer' : 'default'
  }

  let _pdx = 0, _pdy = 0
  renderer.domElement.addEventListener('pointerdown', (ev: PointerEvent) => { _pdx = ev.clientX; _pdy = ev.clientY })
  renderer.domElement.addEventListener('pointerup', (ev: PointerEvent) => {
    if (!ctx) return
    if (Math.hypot(ev.clientX - _pdx, ev.clientY - _pdy) > 10) return
    const r = renderer.domElement.getBoundingClientRect()
    ctx.mouse.x = (ev.clientX - r.left) / r.width * 2 - 1
    ctx.mouse.y = -(ev.clientY - r.top) / r.height * 2 + 1
    ctx.ray.setFromCamera(ctx.mouse, ctx.camera)
    const hit = ctx.nodesI ? ctx.ray.intersectObject(ctx.nodesI.mesh, false)[0] : undefined
    if (hit && hit.instanceId !== undefined) { callbacks.onNodeClick(ctx.nodesI!.ids[hit.instanceId]); return }
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
  })

  renderer.domElement.onpointerleave = () => callbacks.onNodeHover(null)

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAnimate()
    else startAnimate()
  })
}

export function buildScene(): void {
  if (!ctx) return
  buildSky()
  buildStars()
  buildLights()
  buildCenterOrb()
  buildTopicNodes()
  rebuildEdges()
}

function disposeObject(obj: THREE.Object3D): void {
  const cssObject = obj as THREE.Object3D & { element?: HTMLElement }
  cssObject.element?.remove()
  const mesh = obj as THREE.Mesh
  if (mesh.geometry) mesh.geometry.dispose()
  const material = mesh.material as THREE.Material | THREE.Material[] | undefined
  if (Array.isArray(material)) material.forEach((m) => m.dispose())
  else material?.dispose()
  obj.children.forEach(disposeObject)
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

export function setVisibleTopics3d(topics: Topic[]): void {
  if (!ctx) return
  ctx.topics = topics
  ctx.byId = new Map(topics.map((t) => [t.id, t]))
  clearTopicNodes()
  buildTopicNodes()
  rebuildEdges()
}

function buildSky(): void {
  if (!ctx) return
  const g = new THREE.SphereGeometry(520, 48, 32)
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      t: { value: 0 },
      top: { value: new THREE.Color('#07111d') },
      bot: { value: new THREE.Color('#0a0e1a') },
      em: { value: new THREE.Color('#073b36') },
    },
    vertexShader: 'varying vec3 v;void main(){v=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bot;uniform vec3 em;uniform float t;varying vec3 v;void main(){float h=normalize(v).y*.5+.5;float n=sin(v.x*.018+t*.08)*sin(v.z*.017-t*.05);vec3 c=mix(bot,top,smoothstep(0.,1.,h));c=mix(c,em,max(0.,n)*.16);gl_FragColor=vec4(c,1.);}',
  })
  ctx.scene.add(new THREE.Mesh(g, m))
  ctx.scene.userData.sky = m
}

function buildStars(): void {
  if (!ctx) return
  ;[
    { c: 2600, s: 0.12, o: 0.85, r: 440 },
    { c: 1700, s: 0.20, o: 0.68, r: 390 },
    { c: 900,  s: 0.34, o: 0.45, r: 330 },
  ].forEach((L) => {
    const p = new Float32Array(L.c * 3)
    const col = new Float32Array(L.c * 3)
    for (let i = 0; i < L.c; i++) {
      const r = L.r * (0.5 + Math.random() * 0.5)
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const b = 0.52 + Math.random() * 0.48
      p[i * 3]     = r * Math.sin(ph) * Math.cos(th)
      p[i * 3 + 1] = r * Math.cos(ph)
      p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
      col[i * 3]     = b
      col[i * 3 + 1] = b * (0.86 + Math.random() * 0.14)
      col[i * 3 + 2] = b * (0.72 + Math.random() * 0.24)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    ctx!.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: L.s, transparent: true, opacity: L.o, vertexColors: true, depthWrite: false })))
  })
}

function buildLights(): void {
  if (!ctx) return
  ctx.scene.add(new THREE.AmbientLight(0x8fb7ff, 0.35))
  ctx.scene.add(new THREE.PointLight(0xffd08a, 2.4, 180, 1.6))
  const e = new THREE.PointLight(0x10b981, 0.88, 120, 1.9)
  e.position.set(-34, 26, 18)
  ctx.scene.add(e)
}

function buildCenterOrb(): void {
  if (!ctx) return
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 512
  const x = c.getContext('2d')!
  const gr = x.createLinearGradient(0, 0, 1024, 512)
  gr.addColorStop(0, '#6b4522'); gr.addColorStop(0.48, '#fef3c7'); gr.addColorStop(1, '#d4a574')
  x.fillStyle = '#120d08'; x.fillRect(0, 0, 1024, 512)
  x.fillStyle = gr
  x.font = "700 168px 'Scheherazade New', serif"
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'
  ;[120, 270, 420].forEach((y) => x.fillText('القرآن', 512, y))
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1.6, 1)
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0xd4a574, emissive: 0x9f6b2f, emissiveIntensity: 0.72, metalness: 0.18, roughness: 0.38, map: tex }),
  )
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(6.3, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(7.3, 0.025, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xd4a574, transparent: true, opacity: 0.42 }),
  )
  ring.rotation.x = Math.PI * 0.5
  ctx.center.add(orb, shell, ring)
  ctx.center.userData = { orb, shell, ring }
}

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

export function rebuildEdges(): void {
  if (!ctx) return
  if (!ctx.nodesI) return
  while (ctx.edgeGroup.children.length) {
    const child = ctx.edgeGroup.children[0]
    ctx.edgeGroup.remove(child)
    disposeObject(child)
  }
  ctx.edges = []
  const seen = new Set<string>()
  const visibleIds = new Set(ctx.topics.map((topic) => topic.id))
  const pg = new THREE.SphereGeometry(0.08, 10, 8)
  ctx.topics.forEach((a) => {
    a.connected_topics.forEach((bid) => {
      const b = ctx!.byId.get(bid)
      if (!visibleIds.has(a.id) || !visibleIds.has(bid)) return
      const ia = ctx!.nodesI!.indexOf(a.id)
      const ib = ctx!.nodesI!.indexOf(bid)
      if (!b || ia < 0 || ib < 0) return
      const k = [a.id, bid].sort().join('--')
      if (seen.has(k)) return
      seen.add(k)
      const curve = edgeCurve(
        ctx!.nodesI!.getPosition(ia, new THREE.Vector3()),
        ctx!.nodesI!.getPosition(ib, new THREE.Vector3()),
        ctx!.isMind,
      )
      const pts = curve.getPoints(34)
      const col = new THREE.Color(CATEGORIES[a.category as CategoryKey].color)
        .lerp(new THREE.Color(CATEGORIES[b.category as CategoryKey].color), 0.5)
      const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
      const pm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
      const part = new THREE.Mesh(pg, pm)
      part.position.copy(curve.getPoint(Math.random()))
      ctx!.edgeGroup.add(line, part)
      ctx!.edges.push({ a: a.id, b: bid, line, part, curve, t: Math.random(), speed: 0.045 + Math.random() * 0.075 })
    })
  })
  highlightEdges(null)
}

// ── Module-level animation state (updated by main.ts) ─────────────────────
export const animState = {
  selectedId: null as string | null,
  hoverId: null as string | null,
  quizActive: false,
  quizCandidates: new Set<string>(),
  reducedMotion: false,
}

let lastLod = 0
const _v = new THREE.Vector3()

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

  ctx.edges.forEach((e) => {
    e.t = (e.t + dt * e.speed) % 1
    e.part.position.copy(e.curve.getPoint(e.t))
  })

  if (ctx.flight) flyStep()

  ctx.controls.autoRotate = !reducedMotion && !ctx.isMind && !quizActive && Date.now() - ctx.lastInteraction > 10000
  ctx.controls.autoRotateSpeed = 0.22
  ctx.controls.update()
  updateLabelLod(selectedId, hoverId, el)
  ctx.renderer.render(ctx.scene, ctx.camera)
  if (ctx.labels) ctx.labels.render(ctx.scene, ctx.camera)
  if (frameCallback) frameCallback(performance.now())
}

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

export function resetCamera(store: { reducedMotion: boolean }): void {
  if (!ctx) return
  ctx.flight = {
    start: performance.now(),
    dur: store.reducedMotion ? 200 : 1200,
    fp: ctx.camera.position.clone(),
    ft: ctx.controls.target.clone(),
    tp: ctx.isMind ? new THREE.Vector3(0, 0, 120) : new THREE.Vector3(0, 34, 82),
    tt: new THREE.Vector3(0, 0, 0),
  }
}

export function highlightEdges(selectedId: string | null): void {
  if (!ctx) return
  const t = selectedId ? ctx.byId.get(selectedId) : null
  const rel = new Set(t ? [...t.connected_topics, t.id] : [])
  ctx.edges.forEach((e) => {
    const on = !t || (rel.has(e.a) && rel.has(e.b))
    ;(e.line.material as THREE.LineBasicMaterial).opacity = on ? (t ? 0.56 : 0.22) : 0.045
    ;(e.part.material as THREE.MeshBasicMaterial).opacity = on ? 0.78 : 0.08
    e.part.visible = on || !t
  })
  ctx.nodesI?.ids.forEach((id, i) => {
    const dim = !!t && id !== t.id && !rel.has(id)
    ctx!.labelMap.get(id)?.el.classList.toggle('dim', dim)
    ctx!.nodesI!.setBrightness(i, dim ? 0.35 : 1)
  })
}

export function setHover3d(hoverId: string | null, prevHoverId: string | null): void {
  if (!ctx) return
  if (prevHoverId) ctx.labelMap.get(prevHoverId)?.el.classList.remove('hot')
  if (hoverId) ctx.labelMap.get(hoverId)?.el.classList.add('hot')
}

export function toggleMind3d(store: { reducedMotion: boolean }): void {
  if (!ctx) return
  ctx.isMind = !ctx.isMind
  ctx.camera = ctx.isMind ? ctx.ocam : ctx.pcam
  ;(ctx.controls as any).object = ctx.camera
  ctx.controls.enableRotate = !ctx.isMind
  ctx.controls.target.set(0, 0, 0)
  if (ctx.isMind) {
    ctx.ocam.position.set(0, 0, 120)
    ctx.ocam.lookAt(0, 0, 0)
  }
  layoutAnim(ctx.isMind, store)
}

export function quizVisuals3d(candidates: Set<string>): void {
  if (!ctx) return
  ctx.nodesI?.ids.forEach((id, i) => {
    const c = candidates.has(id)
    ctx!.nodesI!.setBrightness(i, c ? 1 : 0.22)
    ctx!.labelMap.get(id)?.el.classList.toggle('dim', !c)
  })
  ctx.edges.forEach((e) => {
    const on = candidates.has(e.a) && candidates.has(e.b)
    ;(e.line.material as THREE.LineBasicMaterial).opacity = on ? 0.32 : 0.025
    e.part.visible = on
  })
}

export function burst3d(id: string, color: string): void {
  if (!ctx) return
  const i = ctx.nodesI?.indexOf(id) ?? -1
  if (i < 0 || !ctx.nodesI) return
  const origin = ctx.nodesI.getPosition(i, new THREE.Vector3())
  const g = new THREE.Group()
  const geo = new THREE.SphereGeometry(0.08, 8, 6)
  for (let i = 0; i < 36; i++) {
    const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }))
    p.position.copy(origin)
    p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7)
    g.add(p)
  }
  ctx.scene.add(g)
  const st = performance.now()
  const tick = (): void => {
    const age = (performance.now() - st) / 900
    g.children.forEach((p) => {
      const mesh = p as THREE.Mesh
      mesh.position.add(mesh.userData.v as THREE.Vector3)
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - age)
    })
    if (age < 1) requestAnimationFrame(tick)
    else ctx!.scene.remove(g)
  }
  tick()
}

export function saveCamera(): { position: number[]; target: number[]; mind: boolean } | null {
  if (!ctx) return null
  return {
    position: ctx.camera.position.toArray(),
    target: ctx.controls.target.toArray(),
    mind: ctx.isMind,
  }
}

export function restoreCamera(data: { position: number[]; target: number[]; mind: boolean }): void {
  if (!ctx) return
  if (data.mind && !ctx.isMind) {
    ctx.isMind = true
    ctx.camera = ctx.ocam
    ;(ctx.controls as any).object = ctx.camera
    ctx.controls.enableRotate = false
  }
  if (Array.isArray(data.position)) ctx.camera.position.fromArray(data.position)
  if (Array.isArray(data.target)) ctx.controls.target.fromArray(data.target)
}

export function resize3d(): void {
  if (!ctx) return
  const w = innerWidth, h = innerHeight
  ctx.pcam.aspect = w / h
  ctx.pcam.updateProjectionMatrix()
  ctx.ocam.left = w / -22; ctx.ocam.right = w / 22
  ctx.ocam.top = h / 22; ctx.ocam.bottom = h / -22
  ctx.ocam.updateProjectionMatrix()
  ctx.renderer.setSize(w, h)
  if (ctx.labels) ctx.labels.setSize(w, h)
}

export function getIsMind(): boolean {
  return ctx?.isMind ?? false
}

function flyStep(): void {
  if (!ctx?.flight) return
  const t = Math.min(1, (performance.now() - ctx.flight.start) / ctx.flight.dur)
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  ctx.camera.position.lerpVectors(ctx.flight.fp, ctx.flight.tp, e)
  ctx.controls.target.lerpVectors(ctx.flight.ft, ctx.flight.tt, e)
  if (t >= 1) ctx.flight = null
}

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

function flatPos(t: Topic, topics: Topic[]): THREE.Vector3 {
  const cats = Object.keys(CATEGORIES) as CategoryKey[]
  const ci = cats.indexOf(t.category as CategoryKey)
  const same = topics.filter((x) => x.category === t.category)
  const i = same.findIndex((x) => x.id === t.id)
  const ca = (ci / cats.length) * Math.PI * 2
  const ring = 18 + (i % 4) * 7
  const la = ca + (i - same.length / 2) * 0.055
  const orb = 28 + ci * 3
  return new THREE.Vector3(Math.cos(ca) * orb + Math.cos(la) * ring, Math.sin(ca) * orb + Math.sin(la) * ring, 0)
}

function edgeCurve(a: THREE.Vector3, b: THREE.Vector3, flat: boolean): THREE.QuadraticBezierCurve3 {
  const s = a.clone(), e = b.clone()
  const m = s.clone().add(e).multiplyScalar(0.5)
  if (flat) {
    const dir = new THREE.Vector3(-m.y, m.x, 0).normalize()
    const lift = Math.min(12, Math.max(1.2, s.distanceTo(e) * 0.16))
    return new THREE.QuadraticBezierCurve3(s, m.add(dir.multiplyScalar(lift)), e)
  }
  return new THREE.QuadraticBezierCurve3(s, m.add(m.clone().normalize().multiplyScalar(Math.min(16, Math.max(4, s.distanceTo(e) * 0.18)))), e)
}

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export function checkWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}
