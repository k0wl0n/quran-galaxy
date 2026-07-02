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
