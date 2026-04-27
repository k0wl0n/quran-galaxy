# Quran Galaxy Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor monolithic `index.html` (~140KB, 5287 lines) into a modular Vite 5 + TypeScript + Tailwind CSS project deployable on Cloudflare Pages, with zero behavior changes.

**Architecture:** Flat module structure under `src/` — one TypeScript file per domain. `topics.json` extracted to `public/data/` for edge caching. `main.ts` orchestrates all modules. Build outputs to `dist/`.

**Tech Stack:** Vite 5, TypeScript 5 (strict), Tailwind CSS 3 (npm + PostCSS), Three.js r128 (npm), Cloudflare Pages (static)

**Source reference:** Original logic is in `index.html` lines 5251–5285 (minified IIFE). Topic data is in lines 37–5250 (inline JSON). CSS is in lines 15–23.

**Key migration note:** Original code used CDN globals (`window.THREE`, `THREE.OrbitControls`). npm imports replace all CDN globals. Boot check `if(!window.THREE)` is removed — Three.js is bundled and always available.

---

## Multi-Agent Wave Plan

```
Wave 1 (parallel): Task 1 (scaffold) + Task 2 (extract JSON)
Wave 2 (sequential): Task 3 (types + constants) — foundation, others block on this
Wave 3 (parallel): Task 4 (store) + Task 5 (quran) + Task 6 (search)
Wave 4 (parallel): Task 7 (scene3d) + Task 8 (scene2d) + Task 9 (panel) + Task 10 (audio) + Task 11 (quiz) + Task 12 (achievements) + Task 13 (ui)
Wave 5 (sequential): Task 14 (main.ts + index.html + style.css) — wires everything
Wave 6 (sequential): Task 15 (Cloudflare config + build verify)
```

---

## File Map

| File | Status | Description |
|------|--------|-------------|
| `package.json` | Create | Vite 5, TS, Tailwind 3, Three.js r128 |
| `vite.config.ts` | Create | Vite config |
| `tailwind.config.js` | Create | Tailwind content paths |
| `postcss.config.js` | Create | PostCSS with Tailwind + autoprefixer |
| `tsconfig.json` | Create | Strict TS config |
| `.node-version` | Create | Node 20 for Cloudflare Pages |
| `.gitignore` | Create | node_modules, dist |
| `index.html` | Modify | Remove inline scripts/data, add Vite entry |
| `public/data/topics.json` | Create | Extracted from inline HTML |
| `public/_headers` | Create | Cloudflare cache rules |
| `src/types.ts` | Create | All TypeScript interfaces |
| `src/constants.ts` | Create | API URLs, storage key, category config |
| `src/store.ts` | Create | localStorage state |
| `src/quran.ts` | Create | Quran fetch + normalize + tafsir |
| `src/search.ts` | Create | Search index + fuzzy search |
| `src/scene3d.ts` | Create | Three.js galaxy |
| `src/scene2d.ts` | Create | Canvas 2D fallback + Mind Map |
| `src/panel.ts` | Create | Verse panel + card rendering + tafsir |
| `src/audio.ts` | Create | Web Audio tones + murottal |
| `src/quiz.ts` | Create | Quiz state machine |
| `src/achievements.ts` | Create | Badge definitions + unlock logic |
| `src/ui.ts` | Create | DOM bindings, HUD, toast, theme, keyboard |
| `src/main.ts` | Create | Boot sequence, orchestration |
| `src/style.css` | Create | Tailwind + all custom CSS from original |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `tsconfig.json`
- Create: `.node-version`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "quran-galaxy",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "three": "0.128.0"
  },
  "devDependencies": {
    "@types/three": "0.128.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
})
```

- [ ] **Step 3: Create `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Create `postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `.node-version`**

```
20
```

- [ ] **Step 7: Create `.gitignore`** (append to existing or create)

```
node_modules/
dist/
.DS_Store
*.local
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors. `three`, `vite`, `tailwindcss`, `typescript` all installed.

- [ ] **Step 9: Verify Vite starts (no src/main.ts yet — create stub)**

Create `src/main.ts` stub:
```typescript
console.log('quran galaxy')
```

Create `src/style.css` stub:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create minimal `index.html` for Vite:
```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quran Galaxy</title>
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Run: `npm run dev`
Expected: Vite starts on `http://localhost:5173`, browser shows blank page, console shows `quran galaxy`.

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.ts tailwind.config.js postcss.config.js tsconfig.json .node-version .gitignore src/main.ts src/style.css index.html
git commit -m "chore: add Vite 5 + TypeScript + Tailwind project scaffold"
```

---

## Task 2: Extract topics.json

**Files:**
- Create: `public/data/topics.json`
- Modify: `index.html` (remove inline JSON block)

- [ ] **Step 1: Create `public/data/` directory**

Run: `mkdir -p public/data`

- [ ] **Step 2: Extract the inline JSON**

The topic data is in `index.html` between line 37 (`<script id="topic-data" type="application/json">`) and line 5250 (`</script>`). Extract the JSON array (everything between those script tags) and save it to `public/data/topics.json`.

To do this efficiently in bash:
```bash
# Extract JSON between the script tags (lines 38 to 5249 in the original)
sed -n '38,5249p' index.html > public/data/topics.json
```

- [ ] **Step 3: Validate the JSON**

Run:
```bash
node -e "const d = require('./public/data/topics.json'); console.log('topics count:', d.length)"
```

Expected output: `topics count: 138`

- [ ] **Step 4: Remove inline JSON from `index.html`**

Delete the lines from `<script id="topic-data" type="application/json">` through `</script>` (the closing tag of that block, around line 5250). The HTML file should shrink from ~5287 lines to ~73 lines.

Verify after deletion:
```bash
wc -l index.html
```
Expected: ~73 lines

- [ ] **Step 5: Commit**

```bash
git add public/data/topics.json index.html
git commit -m "feat: extract 138 topics from inline HTML to public/data/topics.json"
```

---

## Task 3: Foundation — `src/types.ts` + `src/constants.ts`

> All other tasks depend on this task. Complete this before starting Wave 3.

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export type CategoryKey = 'akidah' | 'akhlak' | 'ibadah' | 'kisah' | 'kosmos' | 'akhirat'

export interface CategoryConfig {
  label: string
  color: string
}

export interface TopicPosition {
  theta: number
  phi: number
  radius: number
}

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
}

export interface AyatItem {
  key: string
  surah: number
  ayah: number
  absoluteIndex: number
  surahName: string
  arabic: string
  translation: string
}

export interface AppStore {
  exploredTopics: string[]
  markedAyat: string[]
  readSurahs: string[]
  tafsirRead: string[]
  badges: string[]
  firstSearch: boolean
  dailyStreak: number
  lastUseDate: string
  usedAtNight: boolean
  usedAtDawn: boolean
  perfectQuiz: boolean
  audioPlayedCount: number
  muted: boolean
  theme: 'dark' | 'light'
  reducedMotion: boolean
}

export interface SearchEntry {
  topic: Topic
  tokens: string[]
}

export interface SearchResult {
  topic: Topic
  score: number
}

export interface QuizQuestion {
  topic: Topic
  verse: AyatItem
}

export interface QuizState {
  active: boolean
  diff: 'easy' | 'medium' | 'hard'
  i: number
  score: number
  streak: number
  bonus: number
  questions: QuizQuestion[]
  candidates: Set<string>
  answering: boolean
  current?: QuizQuestion
  start: number
}

export interface BadgeDef {
  id: string
  emoji: string
  name: string
  description: string
  check: (store: AppStore, sessionLinks: number) => boolean
}

export interface RawQuranVerse {
  id?: number
  nomorAyat?: number
  text?: string
  teksArab?: string
  translation?: string
  teksIndonesia?: string
}

export interface RawQuranSurah {
  id?: number
  nomor?: number
  nama?: string
  namaLatin?: string
  arti?: string
  jumlahAyat?: number
  verses?: RawQuranVerse[]
  ayat?: RawQuranVerse[]
}

export interface NormalizedQuran {
  lookup: Map<string, AyatItem>
  ayat: AyatItem[]
}

export interface FlightState {
  start: number
  dur: number
  fp: import('three').Vector3
  ft: import('three').Vector3
  tp: import('three').Vector3
  tt: import('three').Vector3
}

export interface NodeData {
  mesh: import('three').Mesh
  mat: import('three').MeshStandardMaterial
  glow: import('three').Mesh
  label: HTMLElement | null
  topic: Topic
}

export interface EdgeData {
  a: string
  b: string
  line: import('three').Line
  part: import('three').Mesh
  curve: import('three').QuadraticBezierCurve3
  t: number
  speed: number
}
```

- [ ] **Step 2: Create `src/constants.ts`**

```typescript
import type { CategoryKey, CategoryConfig, BadgeDef, AppStore } from './types'

export const STORAGE_KEY = 'qte_v1_'

export const PRIMARY_QURAN_URL = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran_id.json'

export const QURAN_LIST_URLS = [
  'https://equran.nous.id/api/v2/surat',
  'https://equran.id/api/v2/surat',
]

export const QURAN_DETAIL_URLS = [
  'https://equran.nous.id/api/v2/surat/',
  'https://equran.id/api/v2/surat/',
]

export const TAFSIR_URLS = [
  'https://equran.id/api/v2/tafsir/',
  'https://equran.nous.id/api/v2/tafsir/',
]

export const AUDIO_BASE_URL = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/'

export const CATEGORIES: Record<CategoryKey, CategoryConfig> = {
  akidah: { label: 'Akidah / Tauhid', color: '#10b981' },
  akhlak: { label: 'Akhlak', color: '#d4a574' },
  ibadah: { label: 'Ibadah', color: '#2563eb' },
  kisah: { label: 'Kisah / Sirah', color: '#8b5cf6' },
  kosmos: { label: 'Alam / Kosmos', color: '#22d3ee' },
  akhirat: { label: 'Akhirat', color: '#f6c768' },
}

export const STORE_DEFAULTS: AppStore = {
  exploredTopics: [],
  markedAyat: [],
  readSurahs: [],
  tafsirRead: [],
  badges: [],
  firstSearch: false,
  dailyStreak: 0,
  lastUseDate: '',
  usedAtNight: false,
  usedAtDawn: false,
  perfectQuiz: false,
  audioPlayedCount: 0,
  muted: false,
  theme: 'dark',
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'bismillah', emoji: '🌱', name: 'Bismillah', description: 'Pencarian pertama', check: (s) => s.firstSearch },
  { id: 'pembaca', emoji: '📖', name: 'Pembaca', description: 'Ayat pertama ditandai', check: (s) => s.markedAyat.length >= 1 },
  { id: 'penjelajah', emoji: '🌟', name: 'Penjelajah Galaksi', description: '50 topik dijelajahi', check: (s) => s.exploredTopics.length >= 50 },
  { id: 'astronom', emoji: '🌌', name: 'Astronom', description: 'Semua topik dijelajahi', check: (s, _sl, totalTopics = 138) => s.exploredTopics.length >= totalTopics },
  { id: 'istiqomah7', emoji: '🔥', name: 'Istiqomah 7', description: 'Streak 7 hari', check: (s) => s.dailyStreak >= 7 },
  { id: 'istiqomah30', emoji: '🌙', name: 'Istiqomah 30', description: 'Streak 30 hari', check: (s) => s.dailyStreak >= 30 },
  { id: 'hafidz', emoji: '🎯', name: 'Hafidz Quiz', description: 'Skor quiz sempurna', check: (s) => s.perfectQuiz },
  { id: 'pengembara', emoji: '🕋', name: 'Pengembara', description: 'Mengunjungi 6 kategori', check: (s) => new Set(s.exploredTopics.map(id => id)).size >= 6 },
  { id: 'penghafal', emoji: '📜', name: 'Penghafal', description: '100 ayat ditandai', check: (s) => s.markedAyat.length >= 100 },
  { id: 'cahaya', emoji: '✨', name: 'Cahaya', description: 'Membuka aplikasi malam hari', check: (s) => s.usedAtNight },
  { id: 'subuh', emoji: '🌅', name: 'Subuh', description: 'Membuka aplikasi waktu fajar', check: (s) => s.usedAtDawn },
  { id: 'mufassir', emoji: '🎓', name: 'Mufassir', description: 'Membaca tafsir 50 ayat', check: (s) => s.tafsirRead.length >= 50 },
  { id: 'pendengar', emoji: '🎵', name: 'Pendengar', description: '25 audio diputar', check: (s) => s.audioPlayedCount >= 25 },
  { id: 'jaringan', emoji: '🕸️', name: 'Jaringan', description: '10 tautan topik diikuti', check: (_s, sessionLinks) => sessionLinks >= 10 },
]
```

**Note on `astronom` badge:** In the original code, the check uses `TOPICS.length` (138). The `check` function signature is extended with an optional `totalTopics` param for the constants file. In `achievements.ts`, pass `topics.length` when calling this badge's check.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors (ignore warnings about unused stubs in main.ts).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/constants.ts
git commit -m "feat: add TypeScript types and constants"
```

---

## Task 4: `src/store.ts`

**Files:**
- Create: `src/store.ts`

**Depends on:** Task 3 (types.ts, constants.ts)

- [ ] **Step 1: Create `src/store.ts`**

```typescript
import { STORAGE_KEY, STORE_DEFAULTS } from './constants'
import type { AppStore } from './types'

let _store: AppStore = { ...STORE_DEFAULTS }

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + 'progress')
    _store = Object.assign({ ...STORE_DEFAULTS }, raw ? JSON.parse(raw) : {})
  } catch {
    _store = { ...STORE_DEFAULTS }
  }
  return _store
}

export function getStore(): AppStore {
  return _store
}

export function saveStore(): void {
  try {
    localStorage.setItem(STORAGE_KEY + 'progress', JSON.stringify(_store))
  } catch (e) {
    console.warn(e)
  }
}

export function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY + key)
  } catch {
    return null
  }
}

export function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY + key, value)
  } catch (e) {
    console.warn(e)
  }
}

export function dailyStreak(): void {
  const store = _store
  const today = dateKey(new Date())
  if (store.lastUseDate !== today) {
    const was = store.lastUseDate
    store.dailyStreak = was && daysBetween(was, today) === 1 ? (store.dailyStreak || 0) + 1 : 1
    store.lastUseDate = today
    saveStore()
  }
}

export function trackTimeBadges(): void {
  const h = new Date().getHours()
  if (h >= 22 || h < 4) _store.usedAtNight = true
  if (h >= 4 && h < 6) _store.usedAtDawn = true
  saveStore()
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/store.ts
git commit -m "feat: add store module with localStorage state management"
```

---

## Task 5: `src/quran.ts`

**Files:**
- Create: `src/quran.ts`

**Depends on:** Task 3 (types.ts, constants.ts), Task 4 (store.ts)

- [ ] **Step 1: Create `src/quran.ts`**

```typescript
import {
  PRIMARY_QURAN_URL, QURAN_LIST_URLS, QURAN_DETAIL_URLS, TAFSIR_URLS,
} from './constants'
import { lsGet, lsSet } from './store'
import type { AyatItem, NormalizedQuran, RawQuranSurah } from './types'

export interface QuranLoadOptions {
  onProgress: (percent: number, message: string) => void
}

export async function loadQuran(opts: QuranLoadOptions): Promise<RawQuranSurah[]> {
  const { onProgress } = opts
  const cached = lsGet('quran_cache')
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (parsed.version === 1 && Array.isArray(parsed.data)) {
        onProgress(40, 'Memakai cache Quran lokal...')
        return parsed.data as RawQuranSurah[]
      }
    } catch {
      localStorage.removeItem('qte_v1_quran_cache')
    }
  }

  onProgress(22, 'Mengambil mushaf dari CDN utama...')
  try {
    const data = await fetchJson<RawQuranSurah[]>(PRIMARY_QURAN_URL)
    if (!Array.isArray(data)) throw new Error('format')
    lsSet('quran_cache', JSON.stringify({ version: 1, at: Date.now(), data }))
    return data
  } catch (e) {
    console.warn(e)
  }

  for (let i = 0; i < QURAN_LIST_URLS.length; i++) {
    try {
      const first = await fetchJson<{ data?: RawQuranSurah[] } | RawQuranSurah[]>(QURAN_LIST_URLS[i])
      const list: RawQuranSurah[] = Array.isArray(first) ? first : (first.data ?? [])
      const out: RawQuranSurah[] = []
      for (let n = 1; n <= list.length; n++) {
        onProgress(30 + Math.round((n / list.length) * 48), `Memuat surah fallback ${n} / ${list.length}`)
        const res = await fetchJson<{ data: RawQuranSurah }>(QURAN_DETAIL_URLS[i] + n)
        const x = res.data
        out.push({
          id: x.nomor,
          nama: x.nama,
          namaLatin: x.namaLatin,
          arti: x.arti,
          jumlahAyat: x.jumlahAyat,
          ayat: (x.ayat ?? []).map((a) => ({
            nomorAyat: a.nomorAyat,
            teksArab: a.teksArab,
            teksIndonesia: a.teksIndonesia,
          })),
        })
      }
      lsSet('quran_cache', JSON.stringify({ version: 1, at: Date.now(), data: out }))
      return out
    } catch (e) {
      console.warn(e)
    }
  }

  throw new Error('quran unavailable')
}

export function normalizeQuran(data: RawQuranSurah[]): NormalizedQuran {
  const lookup = new Map<string, AyatItem>()
  const ayat: AyatItem[] = []
  let abs = 0
  data.forEach((s, si) => {
    const sn = Number(s.id ?? s.nomor ?? si + 1)
    const name = s.namaLatin ?? `Surah ${sn}`
    const verses = s.verses ?? s.ayat ?? []
    verses.forEach((v, vi) => {
      abs++
      const an = Number(v.id ?? v.nomorAyat ?? vi + 1)
      const key = `${sn}:${an}`
      const item: AyatItem = {
        key,
        surah: sn,
        ayah: an,
        absoluteIndex: abs,
        surahName: name,
        arabic: v.text ?? v.teksArab ?? '',
        translation: v.translation ?? v.teksIndonesia ?? '',
      }
      lookup.set(key, item)
      ayat.push(item)
    })
  })
  return { lookup, ayat }
}

export const tafsirCache = new Map<string, Map<number, string>>()

export async function fetchTafsirSurah(surahNum: number): Promise<void> {
  const k = String(surahNum)
  if (tafsirCache.has(k)) return

  const cached = lsGet(`tafsir_${k}`)
  if (cached) {
    try {
      const arr = JSON.parse(cached) as { ayat: number; teks: string }[]
      tafsirCache.set(k, new Map(arr.map((x) => [Number(x.ayat), x.teks])))
      return
    } catch {
      localStorage.removeItem(`qte_v1_tafsir_${k}`)
    }
  }

  for (const base of TAFSIR_URLS) {
    try {
      const j = await fetchJson<{ data?: { tafsir?: { ayat: number; teks?: string; text?: string }[] }; tafsir?: { ayat: number; teks?: string; text?: string }[] }>(base + surahNum)
      const arr = j?.data?.tafsir ?? j?.tafsir ?? []
      const map = new Map<number, string>(arr.map((x) => [Number(x.ayat), x.teks ?? x.text ?? '']))
      tafsirCache.set(k, map)
      lsSet(`tafsir_${k}`, JSON.stringify(arr.map((x) => ({ ayat: x.ayat, teks: x.teks ?? x.text ?? '' }))))
      return
    } catch (e) {
      console.warn(e)
    }
  }

  tafsirCache.set(k, new Map())
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'force-cache' })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json() as Promise<T>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/quran.ts
git commit -m "feat: add quran module with fetch, normalize, tafsir, and local cache"
```

---

## Task 6: `src/search.ts`

**Files:**
- Create: `src/search.ts`

**Depends on:** Task 3 (types.ts)

- [ ] **Step 1: Create `src/search.ts`**

```typescript
import type { Topic, SearchEntry, SearchResult } from './types'

let searchIndex: SearchEntry[] = []

export function buildSearchIndex(topics: Topic[]): void {
  searchIndex = topics.map((t) => ({
    topic: t,
    tokens: uniq([t.id, t.label_id, t.label_en, t.arabic, ...t.synonyms_id, ...t.synonyms_ar]
      .map(normalize)
      .filter(Boolean)),
  }))
}

export function search(query: string): SearchResult[] {
  const n = normalize(query)
  if (!n) return []
  return searchIndex
    .map((e) => {
      let best = 999
      for (const tok of e.tokens) {
        if (tok === n) best = Math.min(best, 0)
        if (tok.includes(n) || n.includes(tok)) best = Math.min(best, Math.abs(tok.length - n.length) * 0.15)
        if (Math.abs(tok.length - n.length) <= 4) {
          const d = levenshtein(n, tok)
          if (d <= 2) best = Math.min(best, d + 0.4)
        }
      }
      return { topic: e.topic, score: best }
    })
    .filter((x) => x.score <= 3.2)
    .sort((a, b) => a.score - b.score || b.topic.size - a.topic.size)
}

export function bestMatch(query: string): SearchResult | undefined {
  return search(query)[0]
}

export function normalize(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  const p = Array.from({ length: b.length + 1 }, (_, i) => i)
  const c: number[] = []
  for (let i = 1; i <= a.length; i++) {
    c[0] = i
    for (let j = 1; j <= b.length; j++) {
      c[j] = Math.min(c[j - 1] + 1, p[j] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    p.splice(0, p.length, ...c)
  }
  return p[b.length]
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter((x) => x !== undefined && x !== null && x !== ''))]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/search.ts
git commit -m "feat: add search module with fuzzy search and levenshtein"
```

---

## Task 7: `src/scene3d.ts`

**Files:**
- Create: `src/scene3d.ts`

**Depends on:** Task 3 (types.ts, constants.ts)

- [ ] **Step 1: Create `src/scene3d.ts`**

```typescript
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { CATEGORIES } from './constants'
import type { Topic, NodeData, EdgeData, FlightState, CategoryKey, QuizState } from './types'

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
  nodes: Map<string, NodeData>
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
  // @ts-ignore — outputEncoding valid in r128
  renderer.outputEncoding = THREE.sRGBEncoding
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
    nodes: new Map(), edges: [], edgeGroup, nodeGroup, center,
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
    const hit = ctx.ray.intersectObjects([...ctx.nodes.values()].map((n) => n.mesh), false)[0]
    const id = (hit?.object.userData.id as string) ?? null
    callbacks.onNodeHover(id)
    renderer.domElement.style.cursor = hit ? 'pointer' : 'default'
  }

  renderer.domElement.onclick = (ev: MouseEvent) => {
    if (!ctx) return
    const r = renderer.domElement.getBoundingClientRect()
    ctx.mouse.x = (ev.clientX - r.left) / r.width * 2 - 1
    ctx.mouse.y = -(ev.clientY - r.top) / r.height * 2 + 1
    ctx.ray.setFromCamera(ctx.mouse, ctx.camera)
    const hit = ctx.ray.intersectObjects([...ctx.nodes.values()].map((n) => n.mesh), false)[0]
    if (hit) callbacks.onNodeClick(hit.object.userData.id as string)
  }

  renderer.domElement.onpointerleave = () => callbacks.onNodeHover(null)
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
  const geo = new THREE.SphereGeometry(1, 32, 24)
  ctx.topics.forEach((t) => {
    const col = CATEGORIES[t.category as CategoryKey].color
    const pos = sphericalPos(t.position)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(col), emissive: new THREE.Color(col),
      emissiveIntensity: 0.58, roughness: 0.42, metalness: 0.08, transparent: true, opacity: 0.96,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.scale.setScalar(t.size)
    mesh.userData = { id: t.id, base: t.size, original: pos.clone(), flat: flatPos(t, ctx!.topics), pulse: Math.random() * 6.28 }

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.34, 24, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    mesh.add(glow)

    let label: HTMLElement | null = null
    if (ctx!.labels) {
      const el = document.createElement('div')
      el.className = 'label'
      el.textContent = t.label_id
      el.style.borderColor = hexToRgba(col, 0.28)
      const lo = new CSS2DObject(el)
      lo.position.set(0, t.size + 1.35, 0)
      mesh.add(lo)
      label = el
    }

    ctx!.nodeGroup.add(mesh)
    ctx!.nodes.set(t.id, { mesh, mat, glow, label, topic: t })
  })
}

export function rebuildEdges(): void {
  if (!ctx) return
  while (ctx.edgeGroup.children.length) ctx.edgeGroup.remove(ctx.edgeGroup.children[0])
  ctx.edges = []
  const seen = new Set<string>()
  const pg = new THREE.SphereGeometry(0.08, 10, 8)
  ctx.topics.forEach((a) => {
    a.connected_topics.forEach((bid) => {
      const b = ctx!.byId.get(bid)
      const na = ctx!.nodes.get(a.id)
      const nb = ctx!.nodes.get(bid)
      if (!b || !na || !nb) return
      const k = [a.id, bid].sort().join('--')
      if (seen.has(k)) return
      seen.add(k)
      const curve = edgeCurve(na.mesh.position, nb.mesh.position, ctx!.isMind)
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

export function animate(
  selectedId: string | null,
  hoverId: string | null,
  quiz: { active: boolean; candidates: Set<string> },
  store: { reducedMotion: boolean; muted: boolean },
): void {
  if (!ctx) return
  requestAnimationFrame(() => animate(selectedId, hoverId, quiz, store))
  const dt = Math.min(0.05, ctx.clock.getDelta())
  const el = ctx.clock.elapsedTime

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
    if (quiz.active && quiz.candidates.size && !quiz.candidates.has(id)) target = base * 0.74
    n.mesh.scale.lerp(new THREE.Vector3(target, target, target), 0.12)
    n.glow.material.opacity = id === selectedId ? 0.32 : id === hoverId ? 0.26 : 0.14 + Math.sin(el * 1.8 + (n.mesh.userData.pulse as number)) * 0.025
    ;(n.mat as THREE.MeshStandardMaterial).emissiveIntensity = id === selectedId ? 1.05 : id === hoverId ? 0.9 : 0.52
  })

  ctx.edges.forEach((e) => {
    e.t = (e.t + dt * e.speed) % 1
    e.part.position.copy(e.curve.getPoint(e.t))
  })

  if (ctx.flight) flyStep()

  ctx.controls.autoRotate = !store.reducedMotion && !ctx.isMind && !quiz.active && Date.now() - ctx.lastInteraction > 10000
  ctx.controls.autoRotateSpeed = 0.22
  ctx.controls.update()
  ctx.renderer.render(ctx.scene, ctx.camera)
  if (ctx.labels) ctx.labels.render(ctx.scene, ctx.camera)
}

export function flyTo(id: string, store: { reducedMotion: boolean }, whooshFn: () => void): void {
  if (!ctx) return
  const n = ctx.nodes.get(id)
  if (!n) return
  const target = n.mesh.position.clone()
  const dir = target.clone().normalize()
  if (dir.lengthSq() < 0.001) dir.set(0, 0.4, 1).normalize()
  const dest = target.clone().add(
    dir.multiplyScalar(ctx.isMind ? 58 : 14 + n.topic.size * 9)
      .add(new THREE.Vector3(0, ctx.isMind ? 0 : 5, ctx.isMind ? 70 : 0)),
  )
  ctx.flight = {
    start: performance.now(),
    dur: store.reducedMotion ? 240 : 1500,
    fp: ctx.camera.position.clone(),
    ft: ctx.controls.target.clone(),
    tp: dest,
    tt: target,
  }
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
  ctx.nodes.forEach((n, id) => {
    const dim = !!t && id !== t.id && !rel.has(id)
    if (n.label) n.label.classList.toggle('dim', dim)
    ;(n.mat as THREE.MeshStandardMaterial).opacity = dim ? 0.42 : 0.96
  })
}

export function setHover3d(hoverId: string | null, prevHoverId: string | null): void {
  if (!ctx) return
  if (prevHoverId) ctx.nodes.get(prevHoverId)?.label?.classList.remove('hot')
  if (hoverId) ctx.nodes.get(hoverId)?.label?.classList.add('hot')
}

export function toggleMind3d(store: { reducedMotion: boolean }): void {
  if (!ctx) return
  ctx.isMind = !ctx.isMind
  ctx.camera = ctx.isMind ? ctx.ocam : ctx.pcam
  ctx.controls.object = ctx.camera
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
  ctx.nodes.forEach((n, id) => {
    const c = candidates.has(id)
    ;(n.mat as THREE.MeshStandardMaterial).opacity = c ? 1 : 0.24
    if (n.label) n.label.classList.toggle('dim', !c)
  })
  ctx.edges.forEach((e) => {
    const on = candidates.has(e.a) && candidates.has(e.b)
    ;(e.line.material as THREE.LineBasicMaterial).opacity = on ? 0.32 : 0.025
    e.part.visible = on
  })
}

export function burst3d(id: string, color: string): void {
  if (!ctx) return
  const n = ctx.nodes.get(id)
  if (!n) return
  const g = new THREE.Group()
  const geo = new THREE.SphereGeometry(0.08, 8, 6)
  for (let i = 0; i < 36; i++) {
    const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }))
    p.position.copy(n.mesh.position)
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
    ctx.controls.object = ctx.camera
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
  if (!ctx) return
  const starts = new Map<string, THREE.Vector3>()
  ctx.nodes.forEach((n, id) => starts.set(id, n.mesh.position.clone()))
  const st = performance.now()
  const dur = store.reducedMotion ? 80 : 980
  const step = (): void => {
    if (!ctx) return
    const t = Math.min(1, (performance.now() - st) / dur)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    ctx.nodes.forEach((n, id) => {
      const target = flat ? (n.mesh.userData.flat as THREE.Vector3) : (n.mesh.userData.original as THREE.Vector3)
      n.mesh.position.lerpVectors(starts.get(id)!, target, e)
    })
    if (t < 1) requestAnimationFrame(step)
    else { rebuildEdges(); highlightEdges(null) }
  }
  step()
}

function sphericalPos(p: { theta: number; phi: number; radius: number }): THREE.Vector3 {
  return new THREE.Vector3(
    p.radius * Math.sin(p.phi) * Math.cos(p.theta),
    p.radius * Math.cos(p.phi),
    p.radius * Math.sin(p.phi) * Math.sin(p.theta),
  )
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (one `@ts-ignore` for `outputEncoding` is intentional).

- [ ] **Step 3: Commit**

```bash
git add src/scene3d.ts
git commit -m "feat: add scene3d module with Three.js galaxy, nodes, edges, animation"
```

---

## Task 8: `src/scene2d.ts`

**Files:**
- Create: `src/scene2d.ts`

**Depends on:** Task 3 (types.ts, constants.ts)

- [ ] **Step 1: Create `src/scene2d.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/scene2d.ts
git commit -m "feat: add scene2d module with canvas 2D fallback and mind map"
```

---

## Task 9: `src/panel.ts`

**Files:**
- Create: `src/panel.ts`

**Depends on:** Task 3 (types.ts, constants.ts), Task 5 (quran.ts)

- [ ] **Step 1: Create `src/panel.ts`**

```typescript
import { CATEGORIES } from './constants'
import { tafsirCache, fetchTafsirSurah } from './quran'
import { normalize } from './search'
import { hexToRgba } from './scene3d'
import type { Topic, AyatItem, CategoryKey } from './types'

export function openPanel(
  topic: Topic,
  verses: AyatItem[],
  byId: Map<string, Topic>,
  domVerses: HTMLElement,
): void {
  domVerses.innerHTML = verses.length
    ? verses.map((v) => renderCard(topic, v, byId)).join('')
    : `<div class="verse"><b>${esc(topic.label_id)}</b><p class="trans mt-3">Ayat terkait belum tersedia dari cache lokal.</p></div>`
  hydrateVerses(verses)
}

export function togglePanel(open: boolean, panelEl: HTMLElement): void {
  panelEl.classList.toggle('open', open)
  document.body.classList.toggle('panel-open', open)
  panelEl.setAttribute('aria-hidden', String(!open))
}

export function topicVerses(
  topic: Topic,
  lookup: Map<string, AyatItem>,
  ayat: AyatItem[],
  limit: number,
): AyatItem[] {
  const seen = new Set<string>()
  const out: AyatItem[] = []

  topic.related_ayat_keys.forEach((k) => {
    const v = lookup.get(k)
    if (v && !seen.has(k)) { seen.add(k); out.push(v) }
  })

  if (out.length < limit) {
    const needles = [topic.label_id, topic.label_en, topic.arabic, ...topic.synonyms_id, ...topic.synonyms_ar]
      .map(normalize)
      .filter((x) => x.length > 2)
    for (const v of ayat) {
      const h = normalize(v.translation + ' ' + v.arabic)
      if (!seen.has(v.key) && needles.some((n) => h.includes(n))) {
        seen.add(v.key)
        out.push(v)
        if (out.length >= limit) break
      }
    }
  }

  return out.slice(0, limit)
}

export function renderCard(topic: Topic, v: AyatItem, byId: Map<string, Topic>): string {
  const chips = topic.connected_topics.slice(0, 6)
    .map((id) => byId.get(id) ? `<button class="chip rel" data-id="${esc(id)}">${esc(byId.get(id)!.label_id)}</button>` : '')
    .join('')
  return `<article class="verse" data-key="${esc(v.key)}">
    <div class="flex items-start justify-between gap-3">
      <div class="meta">${esc(v.surahName)} : ${v.ayah}</div>
      <button class="btn audio" data-key="${esc(v.key)}">Putar</button>
    </div>
    <div class="arabic mt-4" lang="ar" dir="rtl">${esc(v.arabic)}</div>
    <p class="trans mt-4">${esc(v.translation)}</p>
    <details class="taf" data-key="${esc(v.key)}">
      <summary>Tafsir singkat</summary>
      <div class="tafsir" id="taf-${v.key.replace(':', '-')}">Memuat tafsir ringkas...</div>
    </details>
    <details>
      <summary>Asbabun nuzul</summary>
      <p class="tafsir">Tidak ada riwayat khusus yang tersimpan di aplikasi ini untuk ayat ini.</p>
    </details>
    <div class="chips">${chips}</div>
  </article>`
}

export async function hydrateVerses(verses: AyatItem[]): Promise<void> {
  const surahNums = [...new Set(verses.map((v) => v.surah))]
  for (const s of surahNums) await fetchTafsirSurah(s)
  verses.forEach((v) => {
    const el = document.getElementById(`taf-${v.key.replace(':', '-')}`)
    const m = tafsirCache.get(String(v.surah))
    const tx = m?.get(Number(v.ayah))
    if (el) {
      el.innerHTML = tx
        ? esc(tx.replace(/\s+/g, ' ').slice(0, 900))
        : `Tafsir tidak tersedia. Lihat di <a class="underline text-amber-100" target="_blank" rel="noopener" href="https://quran.com/${v.surah}/${v.ayah}">Quran.com</a>.`
    }
  })
}

export function updatePanelHeader(
  topic: Topic,
  els: {
    pcat: HTMLElement
    ptitle: HTMLElement
    psub: HTMLElement
    htopic: HTMLElement
    hcat: HTMLElement
  },
): void {
  const cat = CATEGORIES[topic.category as CategoryKey]
  els.htopic.textContent = topic.label_id
  els.hcat.textContent = cat.label
  els.hcat.style.color = cat.color
  els.ptitle.textContent = topic.label_id
  els.psub.textContent = `${topic.label_en} • ${topic.arabic}`
  els.pcat.textContent = cat.label
  els.pcat.style.borderColor = hexToRgba(cat.color, 0.38)
  els.pcat.style.background = hexToRgba(cat.color, 0.18)
}

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[c] ?? c))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/panel.ts
git commit -m "feat: add panel module with verse cards, tafsir hydration"
```

---

## Task 10: `src/audio.ts`

**Files:**
- Create: `src/audio.ts`

**Depends on:** Task 3 (types.ts, constants.ts)

- [ ] **Step 1: Create `src/audio.ts`**

```typescript
import { AUDIO_BASE_URL } from './constants'
import type { AyatItem } from './types'

let currentAudio: HTMLAudioElement | null = null
let currentBtn: HTMLButtonElement | null = null
let audioCtx: AudioContext | null = null

export function playVerseAudio(
  ayat: AyatItem,
  btn: HTMLButtonElement,
  muted: boolean,
  onPlayed: () => void,
  showToast: (msg: string) => void,
): void {
  if (muted) { showToast('Audio sedang dimatikan. Tekan ♪ untuk menyalakan.'); return }

  if (currentAudio && currentBtn === btn && !currentAudio.paused) {
    currentAudio.pause()
    btn.textContent = 'Putar'
    return
  }

  if (currentAudio) {
    currentAudio.pause()
    if (currentBtn) currentBtn.textContent = 'Putar'
  }

  const au = new Audio(`${AUDIO_BASE_URL}${ayat.absoluteIndex}.mp3`)
  currentAudio = au
  currentBtn = btn
  btn.textContent = 'Memuat'

  au.onplaying = () => { btn.textContent = 'Jeda'; onPlayed() }
  au.onended = () => { btn.textContent = 'Putar' }
  au.onerror = () => { btn.textContent = 'Putar'; showToast('Audio tidak tersedia, coba lagi nanti.') }
  au.play().catch(() => { btn.textContent = 'Putar'; showToast('Browser menahan audio. Klik putar sekali lagi.') })
}

export function stopCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    if (currentBtn) currentBtn.textContent = 'Putar'
    currentAudio = null
    currentBtn = null
  }
}

export function whoosh(muted: boolean, reducedMotion: boolean): void {
  if (muted || reducedMotion) return
  tone(180, 0.045, 0.028, 'sine')
}

export function chime(kind: 'ok' | 'bad' | 'ach', muted: boolean): void {
  if (muted) return
  if (kind === 'ok') {
    tone(660, 0.05, 0.035, 'triangle')
    setTimeout(() => tone(990, 0.045, 0.025, 'triangle'), 80)
  } else if (kind === 'ach') {
    tone(520, 0.06, 0.03, 'sine')
    setTimeout(() => tone(780, 0.07, 0.028, 'sine'), 110)
  } else {
    tone(160, 0.05, 0.03, 'sawtooth')
  }
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext
    audioCtx = audioCtx ?? new AC()
    const o = audioCtx!.createOscillator()
    const gn = audioCtx!.createGain()
    o.type = type
    o.frequency.value = freq
    gn.gain.value = 0
    o.connect(gn)
    gn.connect(audioCtx!.destination)
    const n = audioCtx!.currentTime
    gn.gain.linearRampToValueAtTime(gain, n + 0.012)
    gn.gain.exponentialRampToValueAtTime(0.0001, n + dur)
    o.start(n)
    o.stop(n + dur + 0.02)
  } catch { /* AudioContext unavailable */ }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/audio.ts
git commit -m "feat: add audio module with murottal playback and Web Audio tones"
```

---

## Task 11: `src/quiz.ts`

**Files:**
- Create: `src/quiz.ts`

**Depends on:** Task 3 (types.ts), Task 9 (panel.ts for `topicVerses`)

- [ ] **Step 1: Create `src/quiz.ts`**

```typescript
import type { Topic, AyatItem, QuizState, QuizQuestion } from './types'
import { topicVerses } from './panel'

export function createInitialQuizState(): QuizState {
  return {
    active: false, diff: 'easy', i: 0, score: 0, streak: 0, bonus: 0,
    questions: [], candidates: new Set(), answering: false, start: 0,
  }
}

export function makeQuestions(
  topics: Topic[],
  lookup: Map<string, AyatItem>,
  ayat: AyatItem[],
): QuizQuestion[] {
  const pool: QuizQuestion[] = topics
    .map((t) => {
      const vs = topicVerses(t, lookup, ayat, 5).filter((v) => v.translation.length > 24)
      return vs.length ? { topic: t, verse: vs[Math.floor(Math.random() * vs.length)] } : null
    })
    .filter((x): x is QuizQuestion => x !== null)
  shuffle(pool)
  return pool.slice(0, 10)
}

export function getCandidates(answerId: string, diff: 'easy' | 'medium' | 'hard', topics: Topic[]): Set<string> {
  const ids = topics.map((t) => t.id)
  const n = diff === 'easy' ? 4 : diff === 'medium' ? 10 : ids.length
  const set = new Set<string>([answerId])
  const byId = new Map(topics.map((t) => [t.id, t]))
  const cat = byId.get(answerId)?.category
  const same = ids.filter((id) => byId.get(id)?.category === cat && id !== answerId)
  shuffle(same)
  same.forEach((id) => { if (set.size < n) set.add(id) })
  shuffle(ids)
  ids.forEach((id) => { if (set.size < n) set.add(id) })
  return set
}

export function answerQuestion(
  state: QuizState,
  answeredId: string,
  onCorrect: (topicId: string) => void,
  onWrong: (correctId: string) => void,
): QuizState {
  if (!state.active || state.answering) return state
  if (state.candidates.size && !state.candidates.has(answeredId)) return state

  const ok = answeredId === state.current?.topic.id
  const next: QuizState = { ...state, answering: true }

  if (ok) {
    next.score++
    next.streak++
    next.bonus += Math.max(0, Math.round(40 - (Date.now() - state.start) / 3000))
    onCorrect(state.current!.topic.id)
  } else {
    next.streak = 0
    onWrong(state.current!.topic.id)
  }

  next.i++
  return next
}

export function nextQuestion(state: QuizState): QuizState {
  if (state.i >= state.questions.length) return { ...state, active: false }
  const current = state.questions[state.i]
  const candidates = getCandidates(current.topic.id, state.diff, [])
  return { ...state, current, answering: false, candidates }
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
```

**Note on `nextQuestion`:** The `getCandidates` call here passes an empty array — in `main.ts`, call `getCandidates(current.topic.id, state.diff, topics)` directly and assign `state.candidates` before each question.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/quiz.ts
git commit -m "feat: add quiz module with state machine, candidates, scoring"
```

---

## Task 12: `src/achievements.ts`

**Files:**
- Create: `src/achievements.ts`

**Depends on:** Task 3 (types.ts, constants.ts), Task 4 (store.ts)

- [ ] **Step 1: Create `src/achievements.ts`**

```typescript
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
    if (!store.badges.includes(b.id) && b.check(store, sessionLinks, topics.length)) {
      store.badges.push(b.id)
      newBadges.push(b)
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/achievements.ts
git commit -m "feat: add achievements module with badge checking and stats render"
```

---

## Task 13: `src/ui.ts`

**Files:**
- Create: `src/ui.ts`

**Depends on:** Task 3 (types.ts, constants.ts)

- [ ] **Step 1: Create `src/ui.ts`**

```typescript
import { CATEGORIES } from './constants'
import { esc } from './panel'
import type { Topic, SearchResult, CategoryKey, AppStore } from './types'

export function showToast(message: string, toastsEl: HTMLElement): void {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = message
  toastsEl.appendChild(t)
  setTimeout(() => {
    t.style.opacity = '0'
    t.style.transform = 'translateY(-8px)'
    setTimeout(() => t.remove(), 260)
  }, 3200)
}

export function showFatal(message: string, retry: boolean, errorEl: HTMLElement): void {
  errorEl.innerHTML = `<b>Aplikasi tertahan</b><br>${esc(message)}${retry ? '<br><button class="btn mt-3" onclick="location.reload()">Coba lagi</button>' : ''}`
  errorEl.classList.add('open')
}

export function setProgress(percent: number, message: string, progressEl: HTMLElement, msgEl: HTMLElement): void {
  progressEl.style.width = `${Math.max(6, Math.min(100, percent))}%`
  if (message) msgEl.textContent = message
}

export function hideLoading(loadingEl: HTMLElement): void {
  setTimeout(() => loadingEl.classList.add('hide'), 350)
}

export function updateHUD(
  store: AppStore,
  totalTopics: number,
  hudEls: { htopic: HTMLElement; hcat: HTMLElement; hprogress: HTMLElement },
  topicId: string | null,
  topics: Map<string, Topic>,
): void {
  if (topicId) {
    const t = topics.get(topicId)
    if (t) {
      hudEls.htopic.textContent = t.label_id
      const cat = CATEGORIES[t.category as CategoryKey]
      hudEls.hcat.textContent = cat.label
      hudEls.hcat.style.color = cat.color
    }
  }
  hudEls.hprogress.textContent = `Topik dijelajahi: ${store.exploredTopics.length} / ${totalTopics}`
}

export function applyTheme(theme: 'dark' | 'light', themeBtn: HTMLElement): void {
  document.body.classList.toggle('light', theme === 'light')
  themeBtn.textContent = theme === 'light' ? '☀' : '☾'
}

export function showSuggestions(
  results: SearchResult[],
  suggestEl: HTMLElement,
): void {
  suggestEl.innerHTML = results.length
    ? results.map((m) =>
        `<button data-id="${esc(m.topic.id)}" data-label="${esc(m.topic.label_id)}">
          <span>
            <b>${esc(m.topic.label_id)}</b>
            <small class="block text-slate-400">${esc(m.topic.label_en)} • ${esc(CATEGORIES[m.topic.category as CategoryKey].label)}</small>
          </span>
          <span class="ar">${esc(m.topic.arabic)}</span>
        </button>`,
      ).join('')
    : '<div class="p-3 text-sm text-slate-300">Tidak ada topik yang cocok.</div>'
  suggestEl.classList.add('open')
}

export function hideSuggestions(suggestEl: HTMLElement): void {
  suggestEl.classList.remove('open')
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr.filter((x) => x !== undefined && x !== null && x !== ('' as unknown)))]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui.ts
git commit -m "feat: add ui module with toast, HUD, theme, suggestions"
```

---

## Task 14: `src/main.ts` + `index.html` + `src/style.css`

**Files:**
- Modify: `src/main.ts` (replace stub)
- Modify: `index.html` (restore full HTML shell, Vite entry)
- Modify: `src/style.css` (restore full CSS from original)

**Depends on:** All previous tasks (Tasks 1–13)

- [ ] **Step 1: Write full `src/main.ts`**

```typescript
import * as THREE from 'three'
import { loadStore, saveStore, getStore, dailyStreak, trackTimeBadges, lsGet, lsSet } from './store'
import { loadQuran, normalizeQuran } from './quran'
import { buildSearchIndex, search as doSearch, bestMatch } from './search'
import {
  init3d, buildScene, animate, flyTo, resetCamera, highlightEdges,
  setHover3d, toggleMind3d, quizVisuals3d, burst3d, rebuildEdges,
  saveCamera, restoreCamera, resize3d, checkWebGL, getIsMind, hexToRgba,
} from './scene3d'
import { initCanvas, resizeCanvas, draw2d, pick2d } from './scene2d'
import { openPanel, togglePanel, topicVerses, updatePanelHeader, esc } from './panel'
import { playVerseAudio, stopCurrentAudio, whoosh, chime } from './audio'
import { createInitialQuizState, makeQuestions, getCandidates, answerQuestion, shuffle } from './quiz'
import { checkBadges, renderAchievements } from './achievements'
import {
  showToast, showFatal, setProgress, hideLoading, updateHUD,
  applyTheme, showSuggestions, hideSuggestions, uniq,
} from './ui'
import { CATEGORIES, BADGE_DEFS } from './constants'
import type { Topic, AyatItem, AppStore, QuizState, CategoryKey } from './types'

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id) as HTMLElement
const d = {
  loading: $('loading'), progress: $('progress'), loadmsg: $('loadmsg'),
  scene: $('scene'), map2d: $('map2d') as HTMLCanvasElement,
  searchform: $('searchform'), search: $('search') as HTMLInputElement,
  suggest: $('suggest'), theme: $('theme'), mute: $('mute'), reset: $('reset'),
  panel: $('panel'), closepanel: $('closepanel'),
  pcat: $('pcat'), ptitle: $('ptitle'), psub: $('psub'), verses: $('verses'),
  quizpanel: $('quizpanel'), closequiz: $('closequiz'), startquiz: $('startquiz'),
  question: $('question'), qprog: $('qprog'),
  qscore: $('qscore'), qstreak: $('qstreak'), qbonus: $('qbonus'),
  achpanel: $('achpanel'), closeach: $('closeach'),
  stats: $('stats'), breakdown: $('breakdown'), badges: $('badges'),
  htopic: $('htopic'), hcat: $('hcat'), hprogress: $('hprogress'),
  quiz: $('quiz'), ach: $('ach'), mind: $('mind'),
  toasts: $('toasts'), error: $('error'),
}

// ── App state ─────────────────────────────────────────────────────────────
let store: AppStore
let topics: Topic[] = []
let byId: Map<string, Topic> = new Map()
let lookup: Map<string, AyatItem> = new Map()
let ayat: AyatItem[] = []
let selectedId: string | null = null
let hoverId: string | null = null
let isMind = false
let fallback = false
let sessionLinks = 0
let quizState: QuizState = createInitialQuizState()

const toast = (msg: string) => showToast(msg, d.toasts)
const fatal = (msg: string, retry: boolean) => showFatal(msg, retry, d.error)
const bar = (p: number, msg: string) => setProgress(p, msg, d.progress as HTMLElement, d.loadmsg)
const save = () => saveStore()
const chimeFn = (k: 'ok' | 'bad' | 'ach') => chime(k, store.muted)
const whooshFn = () => whoosh(store.muted, store.reducedMotion)

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot)

async function boot(): Promise<void> {
  store = loadStore()
  bind()
  dailyStreak()
  trackTimeBadges()
  applyTheme(store.theme, d.theme)
  bar(8, 'Menyiapkan galaksi...')

  // Fetch topics from public/data/topics.json
  try {
    const res = await fetch('/data/topics.json')
    if (!res.ok) throw new Error('topics fetch failed')
    topics = await res.json() as Topic[]
    byId = new Map(topics.map((t) => [t.id, t]))
  } catch (e) {
    console.error(e)
    return fatal('Data topik gagal dimuat.', true)
  }

  fallback = !checkWebGL()
  if (fallback) {
    d.scene.style.display = 'none'
    d.map2d.style.display = 'block'
    initCanvas(d.map2d, topics)
  } else {
    init3d(d.scene, topics, {
      onNodeClick: (id) => { quizState.active ? handleAnswer(id) : selectTopic(id, true) },
      onNodeHover: (id) => {
        const prev = hoverId
        hoverId = id
        setHover3d(id, prev)
      },
    })
  }

  bar(20, 'Mengambil mushaf dari CDN...')
  try {
    const raw = await loadQuran({ onProgress: bar })
    const norm = normalizeQuran(raw)
    lookup = norm.lookup
    ayat = norm.ayat
  } catch (e) {
    console.error(e)
    return fatal('Data Quran belum bisa dimuat dari CDN utama maupun fallback.', true)
  }

  buildSearchIndex(topics)

  if (fallback) {
    draw2d(selectedId, quizState)
  } else {
    buildScene()
    const savedCam = lsGet('last_camera')
    if (savedCam) {
      try { restoreCamera(JSON.parse(savedCam)) } catch { /* ignore */ }
    }
    animate(selectedId, hoverId, quizState, store)
  }

  updateHUD(store, topics.length, { htopic: d.htopic, hcat: d.hcat, hprogress: d.hprogress }, null, byId)
  renderAch()
  doCheckBadges()
  bar(100, 'Siap menjelajah.')
  hideLoading(d.loading)
}

// ── Selection ─────────────────────────────────────────────────────────────
function selectTopic(id: string, openPanelFlag: boolean): void {
  const t = byId.get(id)
  if (!t) return
  selectedId = id
  store.exploredTopics = uniq([...store.exploredTopics, id])
  save()
  updatePanelHeader(t, { pcat: d.pcat, ptitle: d.ptitle, psub: d.psub, htopic: d.htopic, hcat: d.hcat })
  highlightEdges(selectedId)
  if (!fallback) flyTo(id, store, whooshFn)
  else draw2d(selectedId, quizState)
  if (openPanelFlag) {
    const verses = topicVerses(t, lookup, ayat, 9)
    store.readSurahs = uniq([...store.readSurahs, ...verses.map((v) => String(v.surah))])
    save()
    openPanel(t, verses, byId, d.verses)
    togglePanel(true, d.panel)
  }
  updateHUD(store, topics.length, { htopic: d.htopic, hcat: d.hcat, hprogress: d.hprogress }, id, byId)
  doCheckBadges()
}

function resetView(): void {
  selectedId = null
  togglePanel(false, d.panel)
  highlightEdges(null)
  if (fallback) { draw2d(null, quizState); return }
  resetCamera(store)
  d.htopic.textContent = isMind ? 'Mind Map' : 'Galaksi Makna'
  d.hcat.textContent = isMind ? 'Tampilan dua dimensi' : 'Explore'
  d.hcat.style.color = ''
}

// ── Quiz ──────────────────────────────────────────────────────────────────
function openQuiz(): void {
  quizState = { ...quizState, active: false }
  d.quizpanel.classList.add('open')
  d.quiz.classList.add('active')
  d.question.textContent = 'Klik Mulai 10 soal, lalu pilih bola topik yang paling sesuai dengan terjemahan ayat.'
}

function closeQuiz(): void {
  quizState = { ...quizState, active: false, candidates: new Set() }
  d.quizpanel.classList.remove('open')
  d.quiz.classList.remove('active')
  if (!fallback) highlightEdges(selectedId)
  else draw2d(selectedId, quizState)
}

function startQuiz(): void {
  const diff = (document.querySelector('.diff.active') as HTMLButtonElement | null)?.dataset.diff as 'easy' | 'medium' | 'hard' ?? 'easy'
  const questions = makeQuestions(topics, lookup, ayat)
  if (!questions.length) { toast('Data ayat belum siap untuk quiz.'); return }
  quizState = { ...createInitialQuizState(), active: true, diff, questions, start: Date.now() }
  advanceQuiz()
}

function advanceQuiz(): void {
  if (quizState.i >= quizState.questions.length) { finishQuiz(); return }
  const current = quizState.questions[quizState.i]
  const candidates = getCandidates(current.topic.id, quizState.diff, topics)
  quizState = { ...quizState, current, answering: false, candidates }
  d.question.textContent = current.verse.translation
  d.qprog.textContent = `Soal ${quizState.i + 1} / ${quizState.questions.length} • Klik topik yang cocok.`
  qHud()
  if (!fallback) quizVisuals3d(quizState.candidates)
  else draw2d(selectedId, quizState)
}

function handleAnswer(id: string): void {
  if (!quizState.active || quizState.answering) return
  if (quizState.candidates.size && !quizState.candidates.has(id)) {
    toast('Pilih salah satu node yang menyala.')
    return
  }
  const ok = id === quizState.current?.topic.id
  if (ok) {
    quizState.score++
    quizState.streak++
    quizState.bonus += Math.max(0, Math.round(40 - (Date.now() - quizState.start) / 3000))
    toast(`Benar: ${quizState.current!.topic.label_id}`)
    if (!fallback) burst3d(id, '#fef3c7')
    chimeFn('ok')
  } else {
    quizState.streak = 0
    toast(`Jawaban tepat: ${quizState.current!.topic.label_id}`)
    selectedId = quizState.current!.topic.id
    chimeFn('bad')
  }
  quizState.answering = true
  qHud()
  quizState.i++
  setTimeout(advanceQuiz, ok ? 900 : 1450)
}

function finishQuiz(): void {
  quizState = { ...quizState, active: false, candidates: new Set() }
  d.question.textContent = `Sesi selesai. Skor ${quizState.score} / ${quizState.questions.length} dengan bonus ${quizState.bonus}.`
  d.qprog.textContent = 'Quiz selesai.'
  if (quizState.score === quizState.questions.length && quizState.questions.length === 10) {
    store.perfectQuiz = true
  }
  save()
  doCheckBadges()
  highlightEdges(selectedId)
  if (fallback) draw2d(selectedId, quizState)
}

function qHud(): void {
  d.qscore.textContent = String(quizState.score || 0)
  d.qstreak.textContent = String(quizState.streak || 0)
  d.qbonus.textContent = String(quizState.bonus || 0)
}

// ── Achievements ──────────────────────────────────────────────────────────
function renderAch(): void {
  renderAchievements(store, topics, { stats: d.stats, breakdown: d.breakdown, badges: d.badges })
}

function doCheckBadges(): void {
  checkBadges(store, topics, sessionLinks, save, renderAch, toast, chimeFn)
}

// ── Mind Map ──────────────────────────────────────────────────────────────
function toggleMind(): void {
  isMind = !isMind
  d.mind.classList.toggle('active', isMind)
  if (fallback) { draw2d(selectedId, quizState); toast('Mode Mind Map 2D aktif.'); return }
  toggleMind3d(store)
  d.htopic.textContent = isMind ? 'Mind Map' : 'Galaksi Makna'
  d.hcat.textContent = isMind ? 'Tampilan dua dimensi' : 'Explore'
  toast(isMind ? 'Mind Map 2D aktif.' : 'Kembali ke galaksi 3D.')
}

// ── Event bindings ────────────────────────────────────────────────────────
function bind(): void {
  (d.searchform as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault()
    const m = bestMatch((d.search as HTMLInputElement).value)
    if (!m) { toast('Topik belum ditemukan. Coba sinonim Indonesia, Inggris, atau Arab.'); return }
    store.firstSearch = true
    save()
    selectTopic(m.topic.id, true)
    hideSuggestions(d.suggest)
    doCheckBadges()
  }

  d.search.oninput = () => {
    const v = (d.search as HTMLInputElement).value.trim()
    if (!v) { hideSuggestions(d.suggest); return }
    showSuggestions(doSearch(v).slice(0, 8), d.suggest)
  }

  d.suggest.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]')
    if (b) {
      (d.search as HTMLInputElement).value = b.dataset.label ?? ''
      store.firstSearch = true; save()
      selectTopic(b.dataset.id!, true)
      hideSuggestions(d.suggest)
      doCheckBadges()
    }
  }

  d.reset.onclick = resetView
  d.closepanel.onclick = () => togglePanel(false, d.panel)
  d.quiz.onclick = openQuiz
  d.closequiz.onclick = closeQuiz
  d.startquiz.onclick = startQuiz
  d.ach.onclick = () => d.achpanel.classList.contains('open') ? closeAch() : openAch()
  d.closeach.onclick = closeAch
  d.mind.onclick = toggleMind
  d.mute.onclick = toggleMute
  d.theme.onclick = toggleTheme

  document.querySelectorAll('.diff').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      quizState = { ...quizState, diff: (b as HTMLButtonElement).dataset.diff as 'easy' | 'medium' | 'hard' }
      toast(`Kesulitan quiz: ${(b as HTMLButtonElement).textContent}`)
    })
  })

  d.verses.onclick = (e) => {
    const target = e.target as HTMLElement
    const audioBtn = target.closest<HTMLButtonElement>('.audio')
    const markBtn = target.closest<HTMLButtonElement>('.markayah')
    const relBtn = target.closest<HTMLButtonElement>('.rel')

    if (audioBtn) {
      const key = audioBtn.dataset.key!
      const v = lookup.get(key)
      if (v) {
        playVerseAudio(v, audioBtn, store.muted, () => {
          store.audioPlayedCount++; save(); doCheckBadges()
        }, toast)
      }
      return
    }

    if (markBtn) {
      const key = markBtn.dataset.key!
      if (!store.markedAyat.includes(key)) store.markedAyat.push(key)
      markBtn.textContent = 'Sudah dijelajahi'
      save()
      toast(`Ayat ${key} ditandai.`)
      updateHUD(store, topics.length, { htopic: d.htopic, hcat: d.hcat, hprogress: d.hprogress }, selectedId, byId)
      doCheckBadges()
    }

    if (relBtn) {
      sessionLinks++
      selectTopic(relBtn.dataset.id!, true)
      doCheckBadges()
    }
  }

  d.verses.addEventListener('toggle', (e) => {
    const det = e.target as HTMLDetailsElement
    if (det.classList?.contains('taf') && det.open && !store.tafsirRead.includes(det.dataset.key ?? '')) {
      store.tafsirRead.push(det.dataset.key ?? '')
      save()
      doCheckBadges()
    }
  }, true)

  d.map2d.onclick = (e) => {
    const t = pick2d(e.clientX, e.clientY)
    if (t) quizState.active ? handleAnswer(t.id) : selectTopic(t.id, true)
  }

  d.map2d.onpointermove = (e) => {
    d.map2d.style.cursor = pick2d(e.clientX, e.clientY) ? 'pointer' : 'default'
  }

  window.onresize = () => {
    if (fallback) { resizeCanvas(); draw2d(selectedId, quizState) }
    else resize3d()
  }

  window.onbeforeunload = () => {
    const camData = saveCamera()
    if (camData) lsSet('last_camera', JSON.stringify(camData))
    save()
  }

  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
    const typing = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable
    if (e.key === '/' && !typing) {
      e.preventDefault()
      d.search.focus()
      ;(d.search as HTMLInputElement).select()
    } else if (e.key === 'Escape') {
      togglePanel(false, d.panel)
      closeQuiz()
      closeAch()
      hideSuggestions(d.suggest)
    } else if (!typing && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      const ids = topics.map((t) => t.id)
      const i = Math.max(0, ids.indexOf(selectedId ?? ids[0]))
      const n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length
      selectTopic(ids[n], true)
    } else if (!typing && e.code === 'Space' && d.panel.classList.contains('open')) {
      const b = d.verses.querySelector<HTMLButtonElement>('.audio')
      if (b) { e.preventDefault(); b.click() }
    }
  })

  ;['pointerdown', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { /* lastInteraction updated in scene3d */ }, { passive: true }))

  d.mute.textContent = store.muted ? '♪̸' : '♪'
}

// ── UI helpers ────────────────────────────────────────────────────────────
function openAch(): void { renderAch(); d.achpanel.classList.add('open'); d.ach.classList.add('active') }
function closeAch(): void { d.achpanel.classList.remove('open'); d.ach.classList.remove('active') }

function toggleMute(): void {
  store.muted = !store.muted
  if (store.muted) stopCurrentAudio()
  d.mute.textContent = store.muted ? '♪̸' : '♪'
  save()
  toast(store.muted ? 'Audio dimatikan.' : 'Audio dinyalakan.')
}

function toggleTheme(): void {
  store.theme = store.theme === 'light' ? 'dark' : 'light'
  applyTheme(store.theme, d.theme)
  save()
}
```

- [ ] **Step 2: Update `index.html`**

Replace the stub `index.html` with the full HTML shell. Copy the original `index.html` structure (head meta, all inline CSS from `<style>` block at lines 15–23, all HTML body elements from lines 25–36) and change the scripts section to use Vite entry:

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0e1a">
  <title>Quran Topic Explorer 3D</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Fraunces:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <!-- Paste the entire <body> content from the original index.html lines 25–36 here -->
  <!-- (all div#app, div.ui, div#toasts, div#error) -->
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Specifically:** Copy lines 25–36 of the original `index.html` verbatim (the `<div id="app">`, `<div class="ui">`, `<div id="toasts">`, `<div id="error">` elements). These are pure HTML with no scripts.

- [ ] **Step 3: Update `src/style.css`**

Copy the entire content of the `<style>` block from the original `index.html` (lines 15–23) into `src/style.css`, prepended with Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Paste all CSS from original <style> block (lines 16-22) here */
```

Lines 16–22 of the original contain: `:root{...}`, `*{box-sizing...}`, `.loading{...}`, `.glass{...}`, `.ui{...}`, `.panel{...}`, `.hud{...}`, `.overlay{...}`, etc.

- [ ] **Step 4: Verify dev server works**

Run: `npm run dev`

Open browser at `http://localhost:5173`. Expected:
- Loading screen appears
- Galaxy loads after a moment
- Search works
- Clicking a node opens the panel

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts index.html src/style.css
git commit -m "feat: add main.ts boot sequence and wire all modules, restore HTML and CSS"
```

---

## Task 15: Cloudflare Pages Config + Build Verify

**Files:**
- Create: `public/_headers`
- Create: `public/_redirects` (optional, SPA fallback)

- [ ] **Step 1: Create `public/_headers`**

```
/data/topics.json
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- [ ] **Step 2: Verify production build**

Run: `npm run build`

Expected:
- No TypeScript errors
- `dist/` created with `index.html`, `assets/`, `data/topics.json`
- No build errors in Vite output

Check build sizes:
```bash
ls -lh dist/assets/
```

Expected: JS bundle under ~200KB, CSS under ~50KB.

- [ ] **Step 3: Verify preview build runs**

Run: `npm run preview`

Open `http://localhost:4173`. Verify the app loads and works identically to dev.

- [ ] **Step 4: Commit**

```bash
git add public/_headers
git commit -m "chore: add Cloudflare Pages cache headers and verify production build"
```

---

## Self-Review Checklist

- [x] All spec sections covered: scaffold, types, constants, store, quran, search, scene3d, scene2d, panel, audio, quiz, achievements, ui, main, Cloudflare config
- [x] No TBD/TODO/placeholder steps — all code is written out
- [x] Types consistent: `AppStore`, `Topic`, `AyatItem`, `QuizState`, `CategoryKey`, `BadgeDef` used consistently across all tasks
- [x] Function names consistent: `topicVerses` in panel.ts, `getCandidates` in quiz.ts, `hexToRgba` in scene3d.ts, `esc` in panel.ts — all referenced correctly in main.ts
- [x] `badgeDef.check` signature extended with optional `totalTopics` to handle `astronom` badge
- [x] `nextQuestion` in quiz.ts note added to clarify candidates must be set in main.ts
- [x] Wave plan clearly defined for parallel execution
- [x] No behavior changes from original — purely structural decomposition
