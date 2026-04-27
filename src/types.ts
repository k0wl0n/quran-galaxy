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
  notes: Record<string, string>
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
  check: (store: AppStore, sessionLinks: number, totalTopics?: number) => boolean
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
  fp: any
  ft: any
  tp: any
  tt: any
}

export interface NodeData {
  mesh: any
  mat: any
  glow: any
  label: HTMLElement | null
  topic: Topic
}

export interface EdgeData {
  a: string
  b: string
  line: any
  part: any
  curve: any
  t: number
  speed: number
}
