# Hierarchical Galaxy Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a scalable hierarchical cluster → expand topic view so Quran Galaxy can grow beyond the current flat topic list without rendering every node, label, and edge at once.

**Architecture:** Keep the canonical topic list flat and compatible with existing code, then derive a visible topic set from optional hierarchy metadata. `main.ts` owns expanded-cluster state and passes visible topics to `scene3d.ts` or `scene2d.ts`; search and quiz still use all leaf topics. The 3D renderer gains visible-set rebuild APIs, label LOD, and visible-only edge rebuilding before a later `InstancedMesh` migration.

**Tech Stack:** Vite 5, TypeScript 5 strict, Three.js r128, CSS2DRenderer, HTML canvas 2D fallback.

---

## Multi-Agent Wave Plan

```
Wave 1 (parallel, independent):
  Task 1: Topic hierarchy types + module
  Task 2: Sample hierarchy data edits

Wave 2 (sequential integration):
  Task 3: Wire hierarchy into main.ts and 2D fallback

Wave 3 (parallel after Task 3):
  Task 4: Scene3D visible-set rebuild + label LOD
  Task 5: Quiz/search/rail behavior polish

Wave 4 (sequential verification):
  Task 6: Build and browser verification
```

Do not run agents that edit `src/main.ts` and `src/scene3d.ts` at the same time unless their prompts explicitly constrain non-overlapping files. `src/main.ts` is the integration bottleneck.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add optional hierarchy fields to `Topic`. |
| `src/hierarchy.ts` | Create | Build hierarchy indexes and visible topic sets. |
| `public/data/topics.json` | Modify | Add a small initial cluster layer and parent metadata for existing topics. |
| `src/main.ts` | Modify | Own expanded cluster state, visible topics, and cluster-vs-leaf selection behavior. |
| `src/scene3d.ts` | Modify | Add `setVisibleTopics3d`, rebuild visible nodes/edges, and label LOD. |
| `src/scene2d.ts` | Modify | Add `setTopics2d` so fallback can receive visible topic updates. |
| `src/quiz.ts` | Modify | Exclude clusters from question and candidate pools. |
| `src/ui.ts` | Modify | Optionally mark search suggestions for clusters/expanded children without changing markup contracts. |

---

## Task 1: Topic Hierarchy Types and Module

**Files:**
- Modify: `src/types.ts`
- Create: `src/hierarchy.ts`

- [x] **Step 1: Add hierarchy fields to `Topic` in `src/types.ts`**

Replace the current `Topic` interface with this exact shape, preserving all existing required fields:

```typescript
export interface Topic {
  id: string
  label_id: string
  label_en: string
  category: CategoryKey
  arabic: string
  synonyms_id: string[]
  synonyms_ar: string[]
  related_ayat_keys: string[]
  connected_topics: string[]
  position: TopicPosition
  size: number
  kind?: 'cluster' | 'topic'
  parent_id?: string
  child_topic_ids?: string[]
}
```

- [x] **Step 2: Create `src/hierarchy.ts`**

```typescript
import type { Topic } from './types'

export interface TopicHierarchy {
  allTopics: Topic[]
  leafTopics: Topic[]
  clusters: Topic[]
  byId: Map<string, Topic>
  childrenByParent: Map<string, Topic[]>
  parentByChild: Map<string, string>
}

export function topicKind(topic: Topic): 'cluster' | 'topic' {
  return topic.kind === 'cluster' ? 'cluster' : 'topic'
}

export function isCluster(topic: Topic | undefined): topic is Topic {
  return !!topic && topicKind(topic) === 'cluster'
}

export function isLeafTopic(topic: Topic | undefined): topic is Topic {
  return !!topic && topicKind(topic) === 'topic'
}

export function createTopicHierarchy(topics: Topic[]): TopicHierarchy {
  const byId = new Map(topics.map((topic) => [topic.id, topic]))
  const childrenByParent = new Map<string, Topic[]>()
  const parentByChild = new Map<string, string>()

  topics.forEach((topic) => {
    if (topic.parent_id && byId.has(topic.parent_id)) {
      const siblings = childrenByParent.get(topic.parent_id) ?? []
      siblings.push(topic)
      childrenByParent.set(topic.parent_id, siblings)
      parentByChild.set(topic.id, topic.parent_id)
    }
  })

  topics.forEach((topic) => {
    if (!isCluster(topic)) return
    const explicitChildren = (topic.child_topic_ids ?? [])
      .map((id) => byId.get(id))
      .filter((child): child is Topic => !!child && child.id !== topic.id)
    if (!explicitChildren.length) return
    const existing = childrenByParent.get(topic.id) ?? []
    const merged = [...existing]
    explicitChildren.forEach((child) => {
      if (!merged.some((item) => item.id === child.id)) merged.push(child)
      parentByChild.set(child.id, topic.id)
    })
    childrenByParent.set(topic.id, merged)
  })

  const clusters = topics.filter(isCluster)
  const leafTopics = topics.filter(isLeafTopic)

  return { allTopics: topics, leafTopics, clusters, byId, childrenByParent, parentByChild }
}

export function getVisibleTopics(hierarchy: TopicHierarchy, expandedClusterId: string | null): Topic[] {
  if (!hierarchy.clusters.length) return hierarchy.allTopics
  if (!expandedClusterId) return hierarchy.clusters

  const expandedCluster = hierarchy.byId.get(expandedClusterId)
  if (!isCluster(expandedCluster)) return hierarchy.clusters

  const children = hierarchy.childrenByParent.get(expandedClusterId) ?? []
  if (!children.length) return hierarchy.clusters

  const otherClusters = hierarchy.clusters.filter((topic) => topic.id !== expandedClusterId)
  return [expandedCluster, ...children, ...otherClusters]
}

export function parentClusterIdFor(hierarchy: TopicHierarchy, topicId: string): string | null {
  return hierarchy.parentByChild.get(topicId) ?? null
}
```

- [x] **Step 3: Run build to verify the new module compiles**

Run: `npm run build`

Expected: TypeScript succeeds. If it fails because `hierarchy.ts` is unused, that is acceptable only if there are no TypeScript errors.

---

## Task 2: Add Initial Cluster Metadata to Topic Data

**Files:**
- Modify: `public/data/topics.json`

- [x] **Step 1: Add six cluster records at the start of `public/data/topics.json`**

Insert these objects after the opening `[` and before the existing first topic:

```json
  {
    "id": "cluster_akidah",
    "label_id": "Akidah",
    "label_en": "Creed",
    "category": "akidah",
    "arabic": "العقيدة",
    "synonyms_id": ["akidah", "iman", "tauhid", "kepercayaan"],
    "synonyms_ar": ["العقيدة"],
    "related_ayat_keys": [],
    "connected_topics": ["cluster_akhlak", "cluster_ibadah", "cluster_akhirat"],
    "position": { "theta": 0.15, "phi": 0.9, "radius": 31 },
    "size": 1.75,
    "kind": "cluster"
  },
  {
    "id": "cluster_akhlak",
    "label_id": "Akhlak",
    "label_en": "Character",
    "category": "akhlak",
    "arabic": "الأخلاق",
    "synonyms_id": ["akhlak", "adab", "karakter", "moral"],
    "synonyms_ar": ["الأخلاق"],
    "related_ayat_keys": [],
    "connected_topics": ["cluster_akidah", "cluster_ibadah", "cluster_kisah"],
    "position": { "theta": 1.2, "phi": 1.05, "radius": 32 },
    "size": 1.68,
    "kind": "cluster"
  },
  {
    "id": "cluster_ibadah",
    "label_id": "Ibadah",
    "label_en": "Worship",
    "category": "ibadah",
    "arabic": "العبادة",
    "synonyms_id": ["ibadah", "shalat", "zakat", "puasa", "haji"],
    "synonyms_ar": ["العبادة"],
    "related_ayat_keys": [],
    "connected_topics": ["cluster_akidah", "cluster_akhlak", "cluster_akhirat"],
    "position": { "theta": 2.2, "phi": 1.0, "radius": 33 },
    "size": 1.7,
    "kind": "cluster"
  },
  {
    "id": "cluster_kisah",
    "label_id": "Kisah",
    "label_en": "Stories",
    "category": "kisah",
    "arabic": "القصص",
    "synonyms_id": ["kisah", "nabi", "umat", "sejarah"],
    "synonyms_ar": ["القصص"],
    "related_ayat_keys": [],
    "connected_topics": ["cluster_akhlak", "cluster_kosmos"],
    "position": { "theta": 3.25, "phi": 1.08, "radius": 34 },
    "size": 1.64,
    "kind": "cluster"
  },
  {
    "id": "cluster_kosmos",
    "label_id": "Kosmos",
    "label_en": "Cosmos",
    "category": "kosmos",
    "arabic": "الكون",
    "synonyms_id": ["kosmos", "alam", "penciptaan", "langit", "bumi"],
    "synonyms_ar": ["الكون"],
    "related_ayat_keys": [],
    "connected_topics": ["cluster_kisah", "cluster_akhirat"],
    "position": { "theta": 4.3, "phi": 0.95, "radius": 33 },
    "size": 1.66,
    "kind": "cluster"
  },
  {
    "id": "cluster_akhirat",
    "label_id": "Akhirat",
    "label_en": "Hereafter",
    "category": "akhirat",
    "arabic": "الآخرة",
    "synonyms_id": ["akhirat", "surga", "neraka", "kiamat", "hisab"],
    "synonyms_ar": ["الآخرة"],
    "related_ayat_keys": [],
    "connected_topics": ["cluster_akidah", "cluster_ibadah", "cluster_kosmos"],
    "position": { "theta": 5.35, "phi": 1.02, "radius": 32 },
    "size": 1.72,
    "kind": "cluster"
  },
```

- [x] **Step 2: Add `parent_id` to existing leaf topics by category**

For each existing topic object, add the matching parent field after `category`:

```json
"parent_id": "cluster_akidah"
```

Use this mapping:

- `akidah` → `cluster_akidah`
- `akhlak` → `cluster_akhlak`
- `ibadah` → `cluster_ibadah`
- `kisah` → `cluster_kisah`
- `kosmos` → `cluster_kosmos`
- `akhirat` → `cluster_akhirat`

Do not add `parent_id` to cluster records.

- [x] **Step 3: Validate JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/data/topics.json','utf8')); console.log('topics json ok')"`

Expected output: `topics json ok`

---

## Task 3: Main Orchestration and 2D Visible Topics

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scene2d.ts`

- [x] **Step 1: Import hierarchy helpers in `src/main.ts`**

Add this import near the other imports:

```typescript
import {
  createTopicHierarchy, getVisibleTopics, isCluster, isLeafTopic, parentClusterIdFor,
  type TopicHierarchy,
} from './hierarchy'
```

- [x] **Step 2: Import new scene APIs in `src/main.ts`**

Change the 3D import to include `setVisibleTopics3d` after `buildScene`:

```typescript
import {
  init3d, buildScene, setVisibleTopics3d, animState, startAnimate, flyTo, resetCamera, highlightEdges,
  setHover3d, toggleMind3d, quizVisuals3d, burst3d,
  saveCamera, restoreCamera, resize3d, checkWebGL, getIsMind,
} from './scene3d'
```

Change the 2D import to include `setTopics2d`:

```typescript
import { initCanvas, setTopics2d, resizeCanvas, draw2d, pick2d } from './scene2d'
```

- [x] **Step 3: Add hierarchy state in `src/main.ts` after `byId`**

```typescript
let hierarchy: TopicHierarchy | null = null
let visibleTopics: Topic[] = []
let expandedClusterId: string | null = null
```

- [x] **Step 4: Add helpers in `src/main.ts` before `syncAnimState()`**

```typescript
function leafTopics(): Topic[] {
  return hierarchy?.leafTopics ?? topics
}

function refreshVisibleTopics(): void {
  visibleTopics = hierarchy ? getVisibleTopics(hierarchy, expandedClusterId) : topics
  if (fallback) {
    setTopics2d(visibleTopics)
    draw2d(selectedId, quizState)
  } else {
    setVisibleTopics3d(visibleTopics)
    syncAnimState()
    highlightEdges(selectedId)
  }
}

function ensureTopicVisible(id: string): void {
  if (!hierarchy) return
  if (visibleTopics.some((topic) => topic.id === id)) return
  const parentId = parentClusterIdFor(hierarchy, id)
  if (!parentId) return
  expandedClusterId = parentId
  refreshVisibleTopics()
}
```

- [x] **Step 5: Build hierarchy after topics load in `boot()`**

After `byId = new Map(topics.map((t) => [t.id, t]))`, add:

```typescript
    hierarchy = createTopicHierarchy(topics)
    visibleTopics = getVisibleTopics(hierarchy, expandedClusterId)
```

- [x] **Step 6: Pass visible topics to scene initializers**

Change fallback init:

```typescript
    initCanvas(d.map2d, visibleTopics)
```

Change 3D init:

```typescript
    init3d(d.scene, visibleTopics, {
```

- [x] **Step 7: Update `buildRail()` to list visible topics and total topics correctly**

Replace `d.railCount.textContent = ...` with:

```typescript
  d.railCount.textContent = `${visibleTopics.length} tampil · ${leafTopics().length} topik`
```

Replace the `list` source with:

```typescript
  const list = (currentCat === 'all' ? visibleTopics : visibleTopics.filter((t) => t.category === currentCat))
```

- [x] **Step 8: Update `selectTopic()` cluster behavior**

After `if (!t) return`, insert:

```typescript
  if (hierarchy && isCluster(t) && !quizState.active) {
    expandedClusterId = expandedClusterId === id ? null : id
    selectedId = id
    refreshVisibleTopics()
    buildRail()
    const cat = CATEGORIES[t.category as CategoryKey]
    d.htopic.textContent = expandedClusterId === id ? `${t.label_id}: pilih topik` : 'Galaksi Makna'
    d.hcat.style.color = cat.color
    const hcatText = d.hcat.querySelector<HTMLElement>('span:last-child')
    if (hcatText) hcatText.textContent = expandedClusterId === id ? cat.label : 'Eksplorasi terbuka'
    toast(expandedClusterId === id ? `${t.label_id} dibuka.` : `${t.label_id} ditutup.`)
    return
  }

  ensureTopicVisible(id)
```

- [x] **Step 9: Update `selectTopic()` HUD total**

Replace:

```typescript
  updateHUD(store, topics.length, { hexp: d.hexp, htotal: d.htotal, hbar: d.hbar })
```

with:

```typescript
  updateHUD(store, leafTopics().length, { hexp: d.hexp, htotal: d.htotal, hbar: d.hbar })
```

- [x] **Step 10: Update quiz pools in `src/main.ts`**

Replace:

```typescript
  const questions = makeQuestions(topics, lookup, ayat)
```

with:

```typescript
  const questions = makeQuestions(leafTopics(), lookup, ayat)
```

Replace:

```typescript
  const candidates = getCandidates(current.topic.id, quizState.diff, topics)
```

with:

```typescript
  const candidates = getCandidates(current.topic.id, quizState.diff, leafTopics())
  ensureTopicVisible(current.topic.id)
```

- [x] **Step 11: Update keyboard navigation**

Replace:

```typescript
      const ids = topics.map((t) => t.id)
```

with:

```typescript
      const ids = visibleTopics.map((t) => t.id)
```

- [x] **Step 12: Add `setTopics2d()` to `src/scene2d.ts`**

After `initCanvas()`, add:

```typescript
export function setTopics2d(topics: Topic[]): void {
  _topics = topics
  _byId = new Map(topics.map((t) => [t.id, t]))
}
```

- [x] **Step 13: Run build**

Run: `npm run build`

Expected: TypeScript succeeds, except `setVisibleTopics3d` will be missing until Task 4 if tasks are executed separately. If Task 4 is not done yet, pause here and complete Task 4 before final build.

---

## Task 4: Scene3D Visible Set and Label LOD

**Files:**
- Modify: `src/scene3d.ts`

- [x] **Step 1: Add a reusable node cleanup helper after `buildScene()`**

```typescript
function disposeObject(obj: THREE.Object3D): void {
  const mesh = obj as THREE.Mesh
  if (mesh.geometry) mesh.geometry.dispose()
  const material = mesh.material as THREE.Material | THREE.Material[] | undefined
  if (Array.isArray(material)) material.forEach((m) => m.dispose())
  else material?.dispose()
  obj.children.forEach(disposeObject)
}

function clearTopicNodes(): void {
  if (!ctx) return
  while (ctx.nodeGroup.children.length) {
    const child = ctx.nodeGroup.children[0]
    ctx.nodeGroup.remove(child)
    disposeObject(child)
  }
  ctx.nodes.clear()
}
```

- [x] **Step 2: Export `setVisibleTopics3d()` after `buildScene()`**

```typescript
export function setVisibleTopics3d(topics: Topic[]): void {
  if (!ctx) return
  ctx.topics = topics
  ctx.byId = new Map(topics.map((t) => [t.id, t]))
  clearTopicNodes()
  buildTopicNodes()
  rebuildEdges()
}
```

- [x] **Step 3: Make pointer raycasting use current visible nodes**

Both existing raycast calls already use `ctx.nodes`. Keep that behavior. Verify no code raycasts against `ctx.topics` directly.

- [x] **Step 4: Make `rebuildEdges()` visible-only and robust**

At the top of `rebuildEdges()` after `const seen = new Set<string>()`, add:

```typescript
  const visibleIds = new Set(ctx.topics.map((topic) => topic.id))
```

Inside the `connected_topics.forEach`, after `const b = ctx!.byId.get(bid)`, add:

```typescript
      if (!visibleIds.has(a.id) || !visibleIds.has(bid)) return
```

- [x] **Step 5: Add label LOD helper before `startAnimate()`**

```typescript
function updateLabelLod(selectedId: string | null, hoverId: string | null): void {
  if (!ctx?.labels) return
  const cameraPosition = ctx.camera.position
  const ranked = [...ctx.nodes.entries()]
    .map(([id, node]) => ({ id, node, distance: node.mesh.position.distanceTo(cameraPosition) }))
    .sort((a, b) => a.distance - b.distance)
  const visible = new Set(ranked.slice(0, 28).map((item) => item.id))
  if (selectedId) visible.add(selectedId)
  if (hoverId) visible.add(hoverId)
  ctx.nodes.forEach((node, id) => {
    if (node.label) node.label.style.display = visible.has(id) ? '' : 'none'
  })
}
```

- [x] **Step 6: Call label LOD from `startAnimate()`**

Before `ctx.renderer.render(ctx.scene, ctx.camera)`, add:

```typescript
  updateLabelLod(selectedId, hoverId)
```

- [x] **Step 7: Call label LOD from legacy `animate()` too**

Before `ctx.renderer.render(ctx.scene, ctx.camera)` in `animate()`, add:

```typescript
  updateLabelLod(selectedId, hoverId)
```

- [x] **Step 8: Run build**

Run: `npm run build`

Expected: TypeScript succeeds.

---

## Task 5: Quiz, Search, and Navigation Polish

**Files:**
- Modify: `src/quiz.ts`
- Modify: `src/main.ts`

- [x] **Step 1: Import `isLeafTopic` in `src/quiz.ts`**

```typescript
import { isLeafTopic } from './hierarchy'
```

- [x] **Step 2: Filter quiz question pool in `makeQuestions()`**

Replace:

```typescript
  const pool: QuizQuestion[] = topics
```

with:

```typescript
  const pool: QuizQuestion[] = topics.filter(isLeafTopic)
```

- [x] **Step 3: Filter candidate pool in `getCandidates()`**

Replace:

```typescript
  const ids = topics.map((t) => t.id)
```

with:

```typescript
  const answerableTopics = topics.filter(isLeafTopic)
  const ids = answerableTopics.map((t) => t.id)
```

Replace:

```typescript
  const byId = new Map(topics.map((t) => [t.id, t]))
```

with:

```typescript
  const byId = new Map(answerableTopics.map((t) => [t.id, t]))
```

- [x] **Step 4: Ensure search expands hidden result in `src/main.ts`**

In the search submit handler, `selectTopic(m.topic.id, true)` already calls `ensureTopicVisible`. Keep it.

In suggestion click handler, `selectTopic(b.dataset.id!, true)` already calls `ensureTopicVisible`. Keep it.

- [x] **Step 5: Keep cluster progress out of explored count**

In `selectTopic()`, verify the cluster early return happens before:

```typescript
  store.exploredTopics = uniq([...store.exploredTopics, id])
```

- [x] **Step 6: Run build**

Run: `npm run build`

Expected: TypeScript succeeds.

---

## Task 6: Verification

**Files:**
- Read/verify only unless build errors require fixes.

- [x] **Step 1: Run production build**

Run: `npm run build`

Expected: `tsc` completes and Vite writes `dist/`.

- [x] **Step 2: Start dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL.

- [ ] **Step 3: Manual browser checks**

Note: deferred in this run because the browser plugin's required Node REPL control tool was not exposed in the session. Verified dev server HTTP response from `http://127.0.0.1:5173/` instead.

Open the local URL and verify:

- default galaxy shows the six category clusters if hierarchy data is present
- clicking `Akidah` expands Akidah child topics
- clicking `Akidah` again collapses back to clusters
- clicking a child topic opens the panel and ayat tab
- search for a child topic expands its cluster and opens the child
- quiz starts and only child topics become candidates
- labels do not appear on every visible node at once when many nodes are visible
- canvas fallback remains TypeScript-valid through `setTopics2d`

- [x] **Step 4: Stop dev server**

Stop the Vite process after browser verification.

- [x] **Step 5: Report final status**

Report files changed, build result, and any manual verification that could not be completed.

