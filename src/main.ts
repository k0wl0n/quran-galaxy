import { loadStore, saveStore, dailyStreak, trackTimeBadges, lsGet, lsSet } from './store'
import { loadQuran, normalizeQuran } from './quran'
import { buildSearchIndex, search as doSearch, bestMatch } from './search'
import {
  init3d, buildScene, animState, startAnimate, flyTo, resetCamera, highlightEdges,
  setHover3d, toggleMind3d, quizVisuals3d, burst3d,
  saveCamera, restoreCamera, resize3d, checkWebGL, getIsMind,
} from './scene3d'
import { initCanvas, resizeCanvas, draw2d, pick2d } from './scene2d'
import { openPanel, togglePanel, topicVerses, updatePanelHeader, esc } from './panel'
import { playVerseAudio, stopCurrentAudio, whoosh, chime } from './audio'
import { createInitialQuizState, makeQuestions, getCandidates } from './quiz'
import { checkBadges, renderAchievements } from './achievements'
import {
  showToast, showFatal, setProgress, hideLoading, updateHUD,
  applyTheme, showSuggestions, hideSuggestions, uniq,
} from './ui'
import type { Topic, AyatItem, AppStore, QuizState } from './types'

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id) as HTMLElement
const d = {
  loading: $('loading'), progress: $('progress'), loadmsg: $('loadmsg'),
  scene: $('scene'), map2d: $('map2d') as HTMLCanvasElement,
  searchform: $('searchform'), search: $('search') as HTMLInputElement,
  suggest: $('suggest'), theme: $('theme'), mute: $('mute'), reset: $('reset'),
  panel: $('panel'), closepanel: $('closepanel'),
  pcat: $('pcat'), ptitle: $('ptitle'), psub: $('psub'), verses: $('verses'),
  quizpanel: $('quizpanel'), closequiz: $('closequiz'), startquiz: $('startquiz'),
  question: $('question'), qprog: $('qprog'),
  qscore: $('qscore'), qstreak: $('qstreak'), qbonus: $('qbonus'),
  achpanel: $('achpanel'), closeach: $('closeach'),
  stats: $('stats'), breakdown: $('breakdown'), badges: $('badges'),
  htopic: $('htopic'), hcat: $('hcat'), hprogress: $('hprogress'),
  quiz: $('quiz'), ach: $('ach'), mind: $('mind'),
  toasts: $('toasts'), error: $('error'),
}

// ── App state ─────────────────────────────────────────────────────────────
let store: AppStore
let topics: Topic[] = []
let byId: Map<string, Topic> = new Map()
let lookup: Map<string, AyatItem> = new Map()
let ayat: AyatItem[] = []
let selectedId: string | null = null
let hoverId: string | null = null
let isMind = false
let fallback = false
let sessionLinks = 0
let quizState: QuizState = createInitialQuizState()

const toast = (msg: string) => showToast(msg, d.toasts)
const fatal = (msg: string, retry: boolean) => showFatal(msg, retry, d.error)
const bar = (p: number, msg: string) => setProgress(p, msg, d.progress as HTMLElement, d.loadmsg)
const save = () => saveStore()
const chimeFn = (k: 'ok' | 'bad' | 'ach') => chime(k, store.muted)
const whooshFn = () => whoosh(store.muted, store.reducedMotion)

// ── Sync animState ────────────────────────────────────────────────────────
function syncAnimState(): void {
  animState.selectedId = selectedId
  animState.hoverId = hoverId
  animState.quizActive = quizState.active
  animState.quizCandidates = quizState.candidates
  animState.reducedMotion = store?.reducedMotion ?? false
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot)

async function boot(): Promise<void> {
  store = loadStore()
  bind()
  dailyStreak()
  trackTimeBadges()
  applyTheme(store.theme, d.theme)
  bar(8, 'Menyiapkan galaksi...')

  // Fetch topics from public/data/topics.json
  try {
    const res = await fetch('/data/topics.json')
    if (!res.ok) throw new Error('topics fetch failed')
    topics = await res.json() as Topic[]
    byId = new Map(topics.map((t) => [t.id, t]))
  } catch (e) {
    console.error(e)
    return fatal('Data topik gagal dimuat.', true)
  }

  fallback = !checkWebGL()
  if (fallback) {
    d.scene.style.display = 'none'
    d.map2d.style.display = 'block'
    initCanvas(d.map2d, topics)
  } else {
    init3d(d.scene, topics, {
      onNodeClick: (id) => { quizState.active ? handleAnswer(id) : selectTopic(id, true) },
      onNodeHover: (id) => {
        const prev = hoverId
        hoverId = id
        syncAnimState()
        setHover3d(id, prev)
      },
    })
  }

  bar(20, 'Mengambil mushaf dari CDN...')
  try {
    const raw = await loadQuran({ onProgress: bar })
    const norm = normalizeQuran(raw)
    lookup = norm.lookup
    ayat = norm.ayat
  } catch (e) {
    console.error(e)
    return fatal('Data Quran belum bisa dimuat dari CDN utama maupun fallback.', true)
  }

  buildSearchIndex(topics)

  if (fallback) {
    draw2d(selectedId, quizState)
  } else {
    buildScene()
    const savedCam = lsGet('last_camera')
    if (savedCam) {
      try { restoreCamera(JSON.parse(savedCam)) } catch { /* ignore */ }
    }
    syncAnimState()
    startAnimate()
  }

  updateHUD(store, topics.length, { htopic: d.htopic, hcat: d.hcat, hprogress: d.hprogress }, null, byId)
  renderAch()
  doCheckBadges()
  bar(100, 'Siap menjelajah.')
  hideLoading(d.loading)
}

// ── Selection ─────────────────────────────────────────────────────────────
function selectTopic(id: string, openPanelFlag: boolean): void {
  const t = byId.get(id)
  if (!t) return
  selectedId = id
  store.exploredTopics = uniq([...store.exploredTopics, id])
  save()
  syncAnimState()
  updatePanelHeader(t, { pcat: d.pcat, ptitle: d.ptitle, psub: d.psub, htopic: d.htopic, hcat: d.hcat })
  highlightEdges(selectedId)
  if (!fallback) flyTo(id, store, whooshFn)
  else draw2d(selectedId, quizState)
  if (openPanelFlag) {
    const verses = topicVerses(t, lookup, ayat, 9)
    store.readSurahs = uniq([...store.readSurahs, ...verses.map((v) => String(v.surah))])
    save()
    openPanel(t, verses, byId, d.verses)
    togglePanel(true, d.panel)
  }
  updateHUD(store, topics.length, { htopic: d.htopic, hcat: d.hcat, hprogress: d.hprogress }, id, byId)
  doCheckBadges()
}

function resetView(): void {
  selectedId = null
  syncAnimState()
  togglePanel(false, d.panel)
  highlightEdges(null)
  if (fallback) { draw2d(null, quizState); return }
  resetCamera(store)
  d.htopic.textContent = isMind ? 'Mind Map' : 'Galaksi Makna'
  d.hcat.textContent = isMind ? 'Tampilan dua dimensi' : 'Explore'
  d.hcat.style.color = ''
}

// ── Quiz ──────────────────────────────────────────────────────────────────
function openQuiz(): void {
  quizState = { ...quizState, active: false }
  syncAnimState()
  d.quizpanel.classList.add('open')
  d.quiz.classList.add('active')
  d.question.textContent = 'Klik Mulai 10 soal, lalu pilih bola topik yang paling sesuai dengan terjemahan ayat.'
}

function closeQuiz(): void {
  quizState = { ...quizState, active: false, candidates: new Set() }
  syncAnimState()
  d.quizpanel.classList.remove('open')
  d.quiz.classList.remove('active')
  if (!fallback) highlightEdges(selectedId)
  else draw2d(selectedId, quizState)
}

function startQuiz(): void {
  const diff = (document.querySelector('.diff.active') as HTMLButtonElement | null)?.dataset.diff as 'easy' | 'medium' | 'hard' ?? 'easy'
  const questions = makeQuestions(topics, lookup, ayat)
  if (!questions.length) { toast('Data ayat belum siap untuk quiz.'); return }
  quizState = { ...createInitialQuizState(), active: true, diff, questions, start: Date.now() }
  syncAnimState()
  advanceQuiz()
}

function advanceQuiz(): void {
  if (quizState.i >= quizState.questions.length) { finishQuiz(); return }
  const current = quizState.questions[quizState.i]
  const candidates = getCandidates(current.topic.id, quizState.diff, topics)
  quizState = { ...quizState, current, answering: false, candidates }
  syncAnimState()
  d.question.textContent = current.verse.translation
  d.qprog.textContent = `Soal ${quizState.i + 1} / ${quizState.questions.length} • Klik topik yang cocok.`
  qHud()
  if (!fallback) quizVisuals3d(quizState.candidates)
  else draw2d(selectedId, quizState)
}

function handleAnswer(id: string): void {
  if (!quizState.active || quizState.answering) return
  if (quizState.candidates.size && !quizState.candidates.has(id)) {
    toast('Pilih salah satu node yang menyala.')
    return
  }
  const ok = id === quizState.current?.topic.id
  if (ok) {
    quizState.score++
    quizState.streak++
    quizState.bonus += Math.max(0, Math.round(40 - (Date.now() - quizState.start) / 3000))
    toast(`Benar: ${quizState.current!.topic.label_id}`)
    if (!fallback) burst3d(id, '#fef3c7')
    chimeFn('ok')
  } else {
    quizState.streak = 0
    toast(`Jawaban tepat: ${quizState.current!.topic.label_id}`)
    selectedId = quizState.current!.topic.id
    chimeFn('bad')
  }
  quizState.answering = true
  syncAnimState()
  qHud()
  quizState.i++
  setTimeout(advanceQuiz, ok ? 900 : 1450)
}

function finishQuiz(): void {
  quizState = { ...quizState, active: false, candidates: new Set() }
  syncAnimState()
  d.question.textContent = `Sesi selesai. Skor ${quizState.score} / ${quizState.questions.length} dengan bonus ${quizState.bonus}.`
  d.qprog.textContent = 'Quiz selesai.'
  if (quizState.score === quizState.questions.length && quizState.questions.length === 10) {
    store.perfectQuiz = true
  }
  save()
  doCheckBadges()
  highlightEdges(selectedId)
  if (fallback) draw2d(selectedId, quizState)
}

function qHud(): void {
  d.qscore.textContent = String(quizState.score || 0)
  d.qstreak.textContent = String(quizState.streak || 0)
  d.qbonus.textContent = String(quizState.bonus || 0)
}

// ── Achievements ──────────────────────────────────────────────────────────
function renderAch(): void {
  renderAchievements(store, topics, { stats: d.stats, breakdown: d.breakdown, badges: d.badges })
}

function doCheckBadges(): void {
  checkBadges(store, topics, sessionLinks, save, renderAch, toast, chimeFn)
}

// ── Mind Map ──────────────────────────────────────────────────────────────
function toggleMind(): void {
  isMind = !isMind
  d.mind.classList.toggle('active', isMind)
  if (fallback) { draw2d(selectedId, quizState); toast('Mode Mind Map 2D aktif.'); return }
  toggleMind3d(store)
  d.htopic.textContent = isMind ? 'Mind Map' : 'Galaksi Makna'
  d.hcat.textContent = isMind ? 'Tampilan dua dimensi' : 'Explore'
  toast(isMind ? 'Mind Map 2D aktif.' : 'Kembali ke galaksi 3D.')
}

// ── Event bindings ────────────────────────────────────────────────────────
function bind(): void {
  (d.searchform as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault()
    const m = bestMatch((d.search as HTMLInputElement).value)
    if (!m) { toast('Topik belum ditemukan. Coba sinonim Indonesia, Inggris, atau Arab.'); return }
    store.firstSearch = true
    save()
    selectTopic(m.topic.id, true)
    hideSuggestions(d.suggest)
    doCheckBadges()
  }

  d.search.oninput = () => {
    const v = (d.search as HTMLInputElement).value.trim()
    if (!v) { hideSuggestions(d.suggest); return }
    showSuggestions(doSearch(v).slice(0, 8), d.suggest)
  }

  d.suggest.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]')
    if (b) {
      (d.search as HTMLInputElement).value = b.dataset.label ?? ''
      store.firstSearch = true; save()
      selectTopic(b.dataset.id!, true)
      hideSuggestions(d.suggest)
      doCheckBadges()
    }
  }

  d.reset.onclick = resetView
  d.closepanel.onclick = () => togglePanel(false, d.panel)
  d.quiz.onclick = openQuiz
  d.closequiz.onclick = closeQuiz
  d.startquiz.onclick = startQuiz
  d.ach.onclick = () => d.achpanel.classList.contains('open') ? closeAch() : openAch()
  d.closeach.onclick = closeAch
  d.mind.onclick = toggleMind
  d.mute.onclick = toggleMute
  d.theme.onclick = toggleTheme

  document.querySelectorAll('.diff').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      quizState = { ...quizState, diff: (b as HTMLButtonElement).dataset.diff as 'easy' | 'medium' | 'hard' }
      toast(`Kesulitan quiz: ${(b as HTMLButtonElement).textContent}`)
    })
  })

  d.verses.onclick = (e) => {
    const target = e.target as HTMLElement
    const audioBtn = target.closest<HTMLButtonElement>('.audio')
    const markBtn = target.closest<HTMLButtonElement>('.markayah')
    const relBtn = target.closest<HTMLButtonElement>('.rel')

    if (audioBtn) {
      const key = audioBtn.dataset.key!
      const v = lookup.get(key)
      if (v) {
        playVerseAudio(v, audioBtn, store.muted, () => {
          store.audioPlayedCount++; save(); doCheckBadges()
        }, toast)
      }
      return
    }

    if (markBtn) {
      const key = markBtn.dataset.key!
      if (!store.markedAyat.includes(key)) store.markedAyat.push(key)
      markBtn.textContent = 'Sudah dijelajahi'
      save()
      toast(`Ayat ${key} ditandai.`)
      updateHUD(store, topics.length, { htopic: d.htopic, hcat: d.hcat, hprogress: d.hprogress }, selectedId, byId)
      doCheckBadges()
    }

    if (relBtn) {
      sessionLinks++
      selectTopic(relBtn.dataset.id!, true)
      doCheckBadges()
    }
  }

  d.verses.addEventListener('toggle', (e) => {
    const det = e.target as HTMLDetailsElement
    if (det.classList?.contains('taf') && det.open && !store.tafsirRead.includes(det.dataset.key ?? '')) {
      store.tafsirRead.push(det.dataset.key ?? '')
      save()
      doCheckBadges()
    }
  }, true)

  d.map2d.onclick = (e) => {
    const t = pick2d(e.clientX, e.clientY)
    if (t) quizState.active ? handleAnswer(t.id) : selectTopic(t.id, true)
  }

  d.map2d.onpointermove = (e) => {
    d.map2d.style.cursor = pick2d(e.clientX, e.clientY) ? 'pointer' : 'default'
  }

  window.onresize = () => {
    if (fallback) { resizeCanvas(); draw2d(selectedId, quizState) }
    else resize3d()
  }

  window.onbeforeunload = () => {
    const camData = saveCamera()
    if (camData) lsSet('last_camera', JSON.stringify(camData))
    save()
  }

  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
    const typing = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable
    if (e.key === '/' && !typing) {
      e.preventDefault()
      d.search.focus()
      ;(d.search as HTMLInputElement).select()
    } else if (e.key === 'Escape') {
      togglePanel(false, d.panel)
      closeQuiz()
      closeAch()
      hideSuggestions(d.suggest)
    } else if (!typing && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      const ids = topics.map((t) => t.id)
      const i = Math.max(0, ids.indexOf(selectedId ?? ids[0]))
      const n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length
      selectTopic(ids[n], true)
    } else if (!typing && e.code === 'Space' && d.panel.classList.contains('open')) {
      const b = d.verses.querySelector<HTMLButtonElement>('.audio')
      if (b) { e.preventDefault(); b.click() }
    }
  })

  ;['pointerdown', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { /* lastInteraction updated in scene3d */ }, { passive: true }))

  d.mute.textContent = store.muted ? '♪̸' : '♪'
}

// ── UI helpers ────────────────────────────────────────────────────────────
function openAch(): void { renderAch(); d.achpanel.classList.add('open'); d.ach.classList.add('active') }
function closeAch(): void { d.achpanel.classList.remove('open'); d.ach.classList.remove('active') }

function toggleMute(): void {
  store.muted = !store.muted
  if (store.muted) stopCurrentAudio()
  d.mute.textContent = store.muted ? '♪̸' : '♪'
  save()
  toast(store.muted ? 'Audio dimatikan.' : 'Audio dinyalakan.')
}

function toggleTheme(): void {
  store.theme = store.theme === 'light' ? 'dark' : 'light'
  applyTheme(store.theme, d.theme)
  save()
}

// suppress unused import warning for esc
void (esc as unknown)
