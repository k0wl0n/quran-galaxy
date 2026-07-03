# Hierarchical Galaxy Renderer Design

## Goal

Scale Quran Galaxy toward a much larger thematic dataset without rendering every topic, label, and edge at once.

## Decision

Use a hierarchical cluster → expand model. The default galaxy shows a small curated cluster layer. Selecting a cluster expands only that cluster's child topics. Detailed edges and labels are shown on demand.

This is the safest path because the current app is flat and ID-centric: search, quiz, panel, rail, 2D fallback, and 3D selection all assume every visible item is a `Topic`. The design preserves that compatibility while adding hierarchy as metadata and a derived visible topic set.

## Architecture

### Data model

`Topic` gains optional hierarchy fields:

- `kind?: 'cluster' | 'topic'`
- `parent_id?: string`
- `child_topic_ids?: string[]`

Existing topic fields stay intact so current consumers continue to work. A cluster is still a `Topic`, but can summarize children. A leaf topic remains answerable and readable by panel/quiz.

### Topic hierarchy module

Add a small module that derives hierarchy views from the flat topic list:

- normalize missing `kind` to `topic`
- build `byParent` and `clusterIds`
- return visible topics for a selected/expanded cluster
- expand a cluster into immediate children while keeping other clusters collapsed

The module owns hierarchy decisions so `main.ts`, `scene3d.ts`, and `scene2d.ts` do not duplicate parent/child filtering.

### 3D renderer

Refactor 3D node rendering into a visible-set renderer:

- keep `ctx.topics` as the currently visible topic set
- rebuild visible nodes when the expanded cluster changes
- keep current per-topic mesh implementation initially, then replace the hot path with instanced rendering after behavior is stable
- add label LOD immediately: only selected, hovered, and a bounded number of nearest nodes keep labels visible
- rebuild edges only for visible topic pairs, and emphasize edges for the selected node

This reduces browser work before the full `InstancedMesh` migration and avoids breaking raycasting, labels, quiz visuals, and camera flight in one large edit.

### App behavior

Selecting a cluster expands it first. Selecting a leaf topic keeps the existing behavior: panel, ayat, highlight, progress, camera flight, and related topics.

Search continues to index all topics. If a search result is a hidden child, the app expands its parent before selecting it.

Quiz uses leaf topics only. Clusters are navigation nodes, not answer choices.

2D fallback uses the same visible topic set as 3D, so WebGL fallback remains consistent.

## Data flow

1. Boot fetches `/data/topics.json`.
2. `createTopicHierarchy(topics)` derives cluster/parent lookup maps.
3. `getVisibleTopics(hierarchy, expandedClusterId)` returns default cluster layer or expanded cluster layer.
4. `main.ts` passes visible topics to 3D or 2D scene updates.
5. Selection decides whether an ID is a cluster or leaf topic.
6. Search and related-topic navigation expand parents as needed before selection.

## Performance strategy

Phase 1 keeps behavior correct and caps visible work:

- visible nodes are cluster layer plus one expanded child set
- labels are limited by selected/hovered/nearest rules
- edges are rebuilt only among visible nodes
- quiz excludes clusters

Phase 2 converts visible node rendering to `THREE.InstancedMesh`:

- one draw call for topic spheres
- one draw call for glow shells if needed
- per-instance color/scale/matrix updates
- raycasting maps `instanceId` back to visible topic ID

Phase 3 moves data generation into a reproducible script:

- generate hierarchy from translation + synonym dictionary
- derive child membership and co-occurrence edges
- deduplicate synonyms and ayat keys
- emit compact runtime JSON

## Error handling

If hierarchy fields are absent, all topics behave as leaf topics and the app works as it does now.

If a cluster references missing child IDs, missing children are ignored.

If a hidden topic is selected by search or related navigation, its parent is expanded first when available; otherwise the current visible set is left unchanged and selection continues with existing behavior.

## Testing and verification

Automated tests are not configured in this repo. Verification uses:

- `npm run build`
- manual browser test via `npm run dev`
- check default galaxy loads
- check cluster click expands children
- check leaf click opens panel and ayat
- check search expands hidden child result
- check quiz candidates exclude clusters
- check 2D fallback path compiles and uses visible topics

## Multiagent execution strategy

Use subagents for independent implementation domains:

1. hierarchy data/types and sample data
2. scene visible-set APIs and label LOD
3. main orchestration/search/quiz integration
4. validation/build/browser review

Agents must not edit the same file in parallel unless their prompts explicitly constrain non-overlapping sections. Integration happens in the main session after each wave.
