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
