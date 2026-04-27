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
    .replace(/[ً-ٰٟ]/g, '')
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
