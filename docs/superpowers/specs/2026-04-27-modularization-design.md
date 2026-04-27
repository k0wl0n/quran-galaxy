# Quran Galaxy — Modularization Design

**Date:** 2026-04-27  
**Goal:** Refactor monolithic `index.html` (~140KB, 5287 lines) into a modular Vite + TypeScript project deployable on Cloudflare Pages.

---

## 1. Stack & Tooling

| Tool | Version | Purpose |
|---|---|---|
| Vite | 5.x | Bundler + dev server |
| TypeScript | 5.x (strict) | Type safety |
| Tailwind CSS | 3.x (npm) | Utility CSS, purged at build |
| Three.js | r128 (npm) | 3D galaxy rendering |
| Node | 20 | Build runtime |

**Cloudflare Pages config:**
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 (via `.node-version` file)

No backend, no Workers, no `wrangler.toml` — pure static site.

---

## 2. File Structure

```
quran-galaxy/
├── public/
│   ├── data/
│   │   └── topics.json          ← extracted from inline HTML
│   ├── _headers                 ← Cloudflare cache rules
│   └── _redirects               ← (optional) redirect rules
├── src/
│   ├── types.ts                 ← Topic, AyatItem, Store, QuranSurah, Category types
│   ├── constants.ts             ← API URLs, localStorage key prefix, category config
│   ├── store.ts                 ← localStorage state: load, save, update
│   ├── quran.ts                 ← fetch Quran JSON + normalize + localStorage cache
│   ├── search.ts                ← search index build, fuzzy search, levenshtein
│   ├── scene3d.ts               ← Three.js: init, nodes, edges, animation loop
│   ├── scene2d.ts               ← Canvas 2D: fallback rendering + Mind Map mode
│   ├── panel.ts                 ← Verse panel: card render, tafsir fetch, hydration
│   ├── quiz.ts                  ← Quiz: state machine, question generation, answer logic
│   ├── audio.ts                 ← Web Audio API tones + murottal audio streaming
│   ├── achievements.ts          ← Badge definitions, unlock logic, stats rendering
│   ├── ui.ts                    ← DOM bindings, HUD update, toast, theme, keyboard
│   ├── main.ts                  ← Boot sequence, orchestrates all modules
│   └── style.css                ← Tailwind @base/@components/@utilities + custom CSS
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .node-version                ← "20" for Cloudflare Pages
└── .gitignore
```

---

## 3. Module Responsibilities

### `types.ts`
All shared TypeScript interfaces:
- `Topic` — id, label_id, label_en, arabic, category, size, position, connected_topics, related_ayat_keys, synonyms_id, synonyms_ar
- `AyatItem` — key, surah, ayah, absoluteIndex, surahName, arabic, translation
- `Store` — exploredTopics, markedAyat, readSurahs, tafsirRead, badges, streak, etc.
- `Category` — label + hex color pair
- `QuizState` — active, diff, score, streak, questions, etc.

### `constants.ts`
- `STORAGE_KEY = 'qte_v1_'`
- `PRIMARY_QURAN_URL`, `LISTS`, `DETAIL`, `TAFSIR`, `AUDIO` endpoints
- `CATEGORY_CONFIG: Record<string, Category>`

### `store.ts`
- `loadStore(): Store` — merge defaults with localStorage
- `saveStore(store: Store): void`
- `updateStore(patch: Partial<Store>): void`

### `quran.ts`
- `loadQuran(onProgress): Promise<QuranSurah[]>` — tries primary CDN, then fallback APIs
- `normalizeQuran(data): { lookup: Map<string, AyatItem>, ayat: AyatItem[] }`
- `fetchTafsirSurah(surahNum, cache): Promise<void>`

### `search.ts`
- `buildSearchIndex(topics: Topic[]): SearchEntry[]`
- `search(query: string, index): SearchResult[]`
- `bestMatch(query: string, index): SearchResult | undefined`
- `normalize(str: string): string`
- `levenshtein(a: string, b: string): number`

### `scene3d.ts`
- `init3d(container): Scene3DContext`
- `buildScene(ctx, topics): void`
- `animate(ctx): void`
- `selectNode(ctx, id): void`
- `flyTo(ctx, id): void`
- `setHover(ctx, id): void`
- `highlightEdges(ctx, selectedId): void`
- `toggleMind(ctx): void`
- `resetCamera(ctx): void`

### `scene2d.ts`
- `initCanvas(el): Canvas2DContext`
- `draw2d(ctx, topics, selectedId, quizCandidates): void`
- `pick2d(ctx, x, y): Topic | null`

### `panel.ts`
- `openPanel(topic, verses): void`
- `closePanel(): void`
- `renderVerseCard(topic, ayat): string`
- `hydrateVerses(verses, tafsirCache): Promise<void>`
- `topicVerses(topic, quranIndex, limit): AyatItem[]`

### `quiz.ts`
- `startQuiz(topics, topicVerses): QuizState`
- `nextQuestion(state): QuizState`
- `answerQuestion(state, answerId): { correct: boolean, next: QuizState }`
- `makeQuestions(topics, topicVerses, count): QuizQuestion[]`
- `getCandidates(topicId, difficulty, allTopics): Set<string>`

### `audio.ts`
- `playAudio(ayatItem, btn, store): void`
- `stopCurrentAudio(): void`
- `playTone(freq, dur, gain, type): void`
- `chime(kind): void`
- `whoosh(): void`

### `achievements.ts`
- `BADGES: BadgeDef[]`
- `checkBadges(store, sessionState): string[]` — returns newly unlocked badge ids
- `renderAchievements(store, topics): void`

### `ui.ts`
- `bindAll(handlers): void` — wire all DOM event listeners
- `updateHUD(topic, store, topicCount): void`
- `showToast(message): void`
- `applyTheme(theme): void`
- `showSuggestions(results): void`
- `hideSuggestions(): void`

### `main.ts`
Boot sequence:
1. Fetch `topics.json`
2. `loadStore()`
3. Check WebGL → init `scene3d` or `scene2d`
4. `loadQuran()` with progress bar
5. `normalizeQuran()`
6. `buildSearchIndex()`
7. `bindAll()` with all handlers
8. `animate()` or `draw2d()`
9. `checkBadges()`, `renderAchievements()`
10. Hide loading screen

---

## 4. Data Flow

```
topics.json (public/data/)
    ↓ fetch on boot
main.ts
    ├── store.ts (localStorage state)
    ├── quran.ts (Quran data, cached in localStorage)
    ├── search.ts (in-memory index)
    ├── scene3d.ts | scene2d.ts (rendering)
    ├── panel.ts (verse display)
    ├── quiz.ts (game state)
    ├── audio.ts (sound)
    ├── achievements.ts (badge tracking)
    └── ui.ts (DOM, HUD, toasts)
```

Cross-module communication: function calls with typed parameters. No shared mutable globals except `Store` (managed exclusively through `store.ts`).

---

## 5. Cloudflare Pages Optimization

### `public/_headers`
```
/data/topics.json
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### `.node-version`
```
20
```

### Build output estimate
| Asset | Before | After (gzip) |
|---|---|---|
| HTML | 140KB all-in | ~5KB |
| JS bundle | — | ~50-80KB |
| CSS | 300KB CDN | ~15-30KB |
| topics.json | inline in HTML | ~80-100KB, cached at edge |

---

## 6. Migration Strategy

The existing minified JS in `index.html` maps directly to the modules above. Migration is a decomposition + typed rewrite — no new features, no behavior changes. Each function from the original IIFE is assigned to exactly one module.

Key extractions:
- Lines 37-5250 → `public/data/topics.json`
- `init3d`, `buildScene`, `animate`, `move3d`, `click3d`, `flyTo` → `scene3d.ts`
- `draw2d`, `canvasSize`, `pick2d` → `scene2d.ts`
- `loadQuran`, `normalizeQuran`, `fetchJson` → `quran.ts`
- `buildSearch`, `search`, `best`, `norm`, `lev` → `search.ts`
- `openPanel`, `topicVerses`, `card`, `hydrate`, `tafsirSurah` → `panel.ts`
- `openQuiz`, `startQuiz`, `nextQ`, `answerQuiz`, `makeQuestions`, `candidates` → `quiz.ts`
- `audio`, `whoosh`, `chime`, `tone` → `audio.ts`
- `renderAch`, `checkBadges`, `BADGES` → `achievements.ts`
- `loadStore`, `save`, `daily`, `timeBadges` → `store.ts`
- `bind`, `hud`, `toast`, `toggleTheme`, `applyTheme`, `keys`, `resize`, `suggest`, `hideSuggest` → `ui.ts`
- `boot`, top-level orchestration → `main.ts`
- `K`, `PRIMARY`, `LISTS`, `DETAIL`, `TAFSIR`, `AUDIO`, `CAT`, `BADGES` → `constants.ts`

---

## 7. Out of Scope

- No new features added
- No backend or Cloudflare Workers
- No new UI components
- Audio CDN endpoint unchanged (`cdn.islamic.network`)
- Quran data CDN endpoints unchanged
