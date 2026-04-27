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
      const vs = topicVerses(t, lookup, ayat, 5).filter((v: AyatItem) => v.translation.length > 24)
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

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
