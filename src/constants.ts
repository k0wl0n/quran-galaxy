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
  akidah: { label: 'Akidah / Tauhid', color: '#7fd9c4' },
  akhlak: { label: 'Akhlak', color: '#e7c98b' },
  ibadah: { label: 'Ibadah', color: '#9cc4f0' },
  kisah: { label: 'Kisah / Sirah', color: '#b9a3d6' },
  kosmos: { label: 'Alam / Kosmos', color: '#b6d29a' },
  akhirat: { label: 'Akhirat', color: '#f0a3a3' },
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
  notes: {},
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'bismillah', emoji: '🌱', name: 'Bismillah', description: 'Pencarian pertama', check: (s) => s.firstSearch },
  { id: 'pembaca', emoji: '📖', name: 'Pembaca', description: 'Ayat pertama ditandai', check: (s) => s.markedAyat.length >= 1 },
  { id: 'penjelajah', emoji: '🌟', name: 'Penjelajah Galaksi', description: '50 topik dijelajahi', check: (s) => s.exploredTopics.length >= 50 },
  { id: 'astronom', emoji: '🌌', name: 'Astronom', description: 'Semua topik dijelajahi', check: (s, _sl, totalTopics = 138) => s.exploredTopics.length >= (totalTopics ?? 138) },
  { id: 'istiqomah7', emoji: '🔥', name: 'Istiqomah 7', description: 'Streak 7 hari', check: (s) => s.dailyStreak >= 7 },
  { id: 'istiqomah30', emoji: '🌙', name: 'Istiqomah 30', description: 'Streak 30 hari', check: (s) => s.dailyStreak >= 30 },
  { id: 'hafidz', emoji: '🎯', name: 'Hafidz Quiz', description: 'Skor quiz sempurna', check: (s) => s.perfectQuiz },
  { id: 'pengembara', emoji: '🕋', name: 'Pengembara', description: 'Mengunjungi 6 kategori', check: () => false },
  { id: 'penghafal', emoji: '📜', name: 'Penghafal', description: '100 ayat ditandai', check: (s) => s.markedAyat.length >= 100 },
  { id: 'cahaya', emoji: '✨', name: 'Cahaya', description: 'Membuka aplikasi malam hari', check: (s) => s.usedAtNight },
  { id: 'subuh', emoji: '🌅', name: 'Subuh', description: 'Membuka aplikasi waktu fajar', check: (s) => s.usedAtDawn },
  { id: 'mufassir', emoji: '🎓', name: 'Mufassir', description: 'Membaca tafsir 50 ayat', check: (s) => s.tafsirRead.length >= 50 },
  { id: 'pendengar', emoji: '🎵', name: 'Pendengar', description: '25 audio diputar', check: (s) => s.audioPlayedCount >= 25 },
  { id: 'jaringan', emoji: '🕸️', name: 'Jaringan', description: '10 tautan topik diikuti', check: (_s, sessionLinks) => sessionLinks >= 10 },
]
