# Rotatable 400 Open Galaxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the app with up to 400 visible leaf topic spheres already forming the galaxy, and ensure users can rotate the 3D galaxy reliably.

**Architecture:** Keep the existing hierarchy data model, but change the default visible topic set to an open leaf-topic galaxy capped at 400 items. Keep Mind Map as an explicit flat layout mode while making restored camera state synchronize with the main `isMind` state and button UI so users can return to rotatable galaxy mode.

**Tech Stack:** TypeScript, Vite, Three.js `OrbitControls`, existing DOM event handlers.

---

## File Structure

- Modify `src/hierarchy.ts`: add an exported constant and helper for the default open leaf-topic visible set.
- Modify `src/main.ts`: initialize and reset visible topics through the new helper; synchronize restored Mind Map state with app state and button UI.
- Modify `src/scene3d.ts`: expose a small helper to read the renderer's Mind Map state after restore.

### Task 1: Default to 400 open leaf topics

**Files:**
- Modify: `src/hierarchy.ts:59-71`
- Modify: `src/main.ts:21-24`
- Modify: `src/main.ts:81-90`
- Modify: `src/main.ts:123-130`

- [ ] **Step 1: Add hierarchy helper**

In `src/hierarchy.ts`, add:

```ts
export const DEFAULT_VISIBLE_TOPIC_LIMIT = 400

export function getDefaultVisibleTopics(hierarchy: TopicHierarchy): Topic[] {
  if (!hierarchy.clusters.length) return hierarchy.allTopics.slice(0, DEFAULT_VISIBLE_TOPIC_LIMIT)
  return hierarchy.leafTopics.slice(0, DEFAULT_VISIBLE_TOPIC_LIMIT)
}
```

- [ ] **Step 2: Update visible topic lookup**

In `src/main.ts`, import `getDefaultVisibleTopics` and make `refreshVisibleTopics()` use it whenever no cluster is expanded:

```ts
visibleTopics = hierarchy
  ? expandedClusterId ? getVisibleTopics(hierarchy, expandedClusterId) : getDefaultVisibleTopics(hierarchy)
  : topics
```

- [ ] **Step 3: Update boot initialization**

In `src/main.ts`, initialize `visibleTopics` with `getDefaultVisibleTopics(hierarchy)` after creating the hierarchy.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: TypeScript and Vite build succeed.

### Task 2: Synchronize restored Mind Map state

**Files:**
- Modify: `src/scene3d.ts:582-584`
- Modify: `src/main.ts:169-173`

- [ ] **Step 1: Use existing renderer state helper**

`src/scene3d.ts` already exports:

```ts
export function getIsMind(): boolean {
  return ctx?.isMind ?? false
}
```

Keep this as the app-facing source of truth after restore.

- [ ] **Step 2: Sync app state after camera restore**

In `src/main.ts`, after `restoreCamera(JSON.parse(savedCam))`, set:

```ts
isMind = getIsMind()
d.mind.classList.toggle('active', isMind)
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: TypeScript and Vite build succeed.

### Task 3: Manual verification

**Files:**
- No code files.

- [ ] **Step 1: Start dev server**

Run: `npm run dev -- --host 127.0.0.1`
Expected: Vite reports a local URL.

- [ ] **Step 2: Browser check**

Open the local URL and verify:
- initial scene shows many topic spheres instead of only closed clusters
- dragging the 3D galaxy rotates it
- clicking Mind Map flattens layout
- clicking Mind Map again returns to rotatable 3D galaxy
- Reset returns to open 400-topic galaxy

- [ ] **Step 3: Stop dev server**

Stop the dev server process after verification.

## Self-Review

- Spec coverage: default open galaxy and rotation restore are covered.
- Placeholder scan: no placeholders remain.
- Type consistency: new helper uses existing `TopicHierarchy` and `Topic` types.
