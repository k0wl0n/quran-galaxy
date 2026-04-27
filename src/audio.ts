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
