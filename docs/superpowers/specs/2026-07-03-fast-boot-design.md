# Fast Boot Design (Quran caching + progressive startup)

## Goal

Cut mobile time-to-interactive from ~7.3s (Fast 3G) to ~2s by not blocking the galaxy on the 676KB-gzipped Quran download, and make repeat visits boot instantly via a working local cache.

## Problems (measured on production 2026-07-03)

1. `boot()` awaits the full Quran fetch before hiding the loading screen; the download is 3.1s on Fast 3G and the single dominant startup cost.
2. The existing localStorage Quran cache never persists: the raw JSON (~3MB+) exceeds the localStorage quota, `lsSet` swallows the QuotaExceededError, so every visit re-downloads.
3. `public/_headers` serves `/data/topics.json` with `max-age=31536000, immutable` on a never-changing URL — returning visitors keep stale topic data for a year (the topic dataset changed in the last release).

## Decisions

**A. Cache API replaces localStorage for the Quran** (`src/quran.ts`). `caches.open('qte-quran-v1')` keyed by `PRIMARY_QURAN_URL`; read before network, write after a successful fetch (both primary and fallback paths). All cache operations are try/catch no-ops on failure (private browsing, quota). The old `quran_cache` localStorage entry is proactively removed to free quota. Quran text is immutable, so no revalidation.

**B. Progressive boot** (`src/main.ts`). New boot order: topics → scene init → build scene → **hide loading (galaxy interactive)** → Quran loads in the background. While pending: the panel's existing empty-verses message shows (copy updated to "sedang dimuat"); quiz start is already guarded ("Data ayat belum siap"). When ready: re-render the open panel's ayat tab if any, and toast. On failure: non-blocking error toast instead of the blocking fatal screen.

**C. topics.json cache header** (`public/_headers`): `max-age=300, must-revalidate` instead of 1-year immutable.

## Out of scope

Per-topic on-demand verse fetching, PWA/service worker, any renderer change.

## Verification

Headless Chrome on Fast 3G emulation: loading screen clears in ~2s (was 7.3s); second visit in the same browser context serves the Quran from CacheStorage (no jsdelivr request in the resource timeline); selecting a topic before the Quran arrives shows the pending message, and the open panel auto-fills when it arrives. Deploy, then re-verify on production.
