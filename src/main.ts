import { loadStore, saveStore, dailyStreak, trackTimeBadges, lsGet, lsSet } from './store'
import { loadQuran, normalizeQuran } from './quran'
import { buildSearchIndex, search as doSearch, bestMatch } from './search'
import {
  init3d, buildScene, animState, startAnimate, flyTo, resetCamera, highlightEdges,
  setHover3d, toggleMind3d, quizVisuals3d, burst3d,
  saveCamera, restoreCamera, resize3d, checkWebGL, getIsMind,
} from './scene3d'
import { initCanvas, resizeCanvas, draw2d, pick2d } from './scene2d'
import { togglePanel, topicVerses, renderPanelBody, esc } from './panel'
import { openSurahReader } from './reader'
import { playVerseAudio, stopCurrentAudio, whoosh, chime } from './audio'
import { createInitialQuizState, makeQuestions, getCandidates } from './quiz'
import { checkBadges, renderAchievements } from './achievements'
import {
  showToast, showFatal, setProgress, hideLoading, updateHUD,
  applyTheme, showSuggestions, hideSuggestions, uniq,
} from './ui'
import { CATEGORIES } from './constants'
import type { Topic, AyatItem, AppStore, QuizState, CategoryKey } from './types'

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id) as HTMLElement
const d = {
  loading: $('loading'), progress: $('progress'), loadmsg: $('loadmsg'),
  scene: $('scene'), map2d: $('map2d') as HTMLCanvasElement,
  searchform: $('searchform'), search: $('search') as HTMLInputElement,
  suggest: $('suggest'),
  theme: $('theme'), mute: $('mute'), reset: $('reset'),
  rail: $('rail'), railToggle: $('rail-toggle'), railCount: $('rail-count'),
  cats: $('cats'), topicList: $('topic-list'),
  hoverCard: $('hover-card'), hcTitle: $('hc-title'), hcSub: $('hc-sub'), hcAr: $('hc-ar'),
  panel: $('panel'), closepanel: $('closepanel'),
  pcat: $('pcat'), pcatName: $('pcat-name'), ptitle: $('ptitle'), psub: $('psub'), par: $('par'),
  panelBody: $('panel-body'),
  quizOverlay: $('quiz-overlay'), closequiz: $('closequiz'), startquiz: $('startquiz'),
  question: $('question'), qprog: $('qprog'), qbar: $('qbar'),
  qscore: $('qscore'), qstreak: $('qstreak'), qbonus: $('qbonus'),
  achOverlay: $('ach-overlay'), closeach: $('closeach'),
  stats: $('stats'), breakdown: $('breakdown'), badges: $('badges'),
  readerOverlay: $('reader-overlay'), closereader: $('closereader'),
  readerTitle: $('reader-title'), readerSub: $('reader-sub'), readerBody: $('reader-body'),
  htopic: $('htopic'), hcat: $('hcat'), hexp: $('hexp'), htotal: $('htotal'), hbar: $('hbar'),
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
let activeTab: 'ayat' | 'related' | 'notes' = 'ayat'
let currentCat: 'all' | CategoryKey = 'all'
let quizState: QuizState = createInitialQuizState()

const toast = (msg: string, kind?: 'ok' | 'bad' | 'gold') => showToast(msg, kind, d.toasts)
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

  buildRail()
  if (window.innerWidth <= 768) {
    d.rail.classList.add('collapsed')
    d.railToggle.classList.remove('on')
  }
  updateHUD(store, topics.length, { hexp: d.hexp, htotal: d.htotal, hbar: d.hbar })
  renderAch()
  doCheckBadges()
  bar(100, 'Siap menjelajah.')
  hideLoading(d.loading)
}

// ── Rail ──────────────────────────────────────────────────────────────────
function buildRail(): void {
  d.railCount.textContent = `${topics.length} topik · ${Object.keys(CATEGORIES).length} kategori`

  const cats: Array<'all' | CategoryKey> = ['all', ...Object.keys(CATEGORIES) as CategoryKey[]]
  d.cats.innerHTML = cats.map((c) => {
    const col = c === 'all' ? 'var(--gold)' : CATEGORIES[c as CategoryKey].color
    const name = c === 'all' ? 'Semua' : CATEGORIES[c as CategoryKey].label.replace(' / ', ' · ')
    return `<button class="cat-chip ${c === currentCat ? 'active' : ''}" data-cat="${c}" style="color:${col}"><span class="dot"></span>${esc(name)}</button>`
  }).join('')

  d.cats.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((el) => {
    el.onclick = () => {
      currentCat = el.dataset.cat as typeof currentCat
      buildRail()
      updateRailActive()
    }
  })

  const list = (currentCat === 'all' ? topics : topics.filter((t) => t.category === currentCat))
    .slice()
    .sort((a, b) => a.label_id.localeCompare(b.label_id, 'id'))

  d.topicList.innerHTML = list.map((t) => {
    const col = CATEGORIES[t.category].color
    return `<button class="topic-row ${selectedId === t.id ? 'active' : ''}" data-id="${esc(t.id)}" style="color:${col}">
      <span class="pip"></span>
      <span class="name">${esc(t.label_id)}<small style="display:block;font-size:10.5px;color:var(--muted);font-weight:400;margin-top:1px">${esc(t.label_en)}</small></span>
      <span class="ar">${esc(t.arabic)}</span>
    </button>`
  }).join('')

  d.topicList.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((b) => {
    b.onclick = () => selectTopic(b.dataset.id!, true)
  })
}

function updateRailActive(): void {
  d.topicList.querySelectorAll<HTMLButtonElement>('.topic-row').forEach((r) => {
    r.classList.toggle('active', r.dataset.id === selectedId)
  })
}

// ── Selection ─────────────────────────────────────────────────────────────
function selectTopic(id: string, openPanelFlag: boolean): void {
  const t = byId.get(id)
  if (!t) return
  selectedId = id
  store.exploredTopics = uniq([...store.exploredTopics, id])
  save()
  syncAnimState()

  // Update panel header
  const cat = CATEGORIES[t.category as CategoryKey]
  d.pcat.style.color = cat.color
  d.pcatName.textContent = cat.label
  d.ptitle.textContent = t.label_id
  d.psub.textContent = t.label_en
  d.par.textContent = t.arabic
  // Update HUD topic
  d.htopic.textContent = t.label_id
  d.hcat.style.color = cat.color
  const hcatText = d.hcat.querySelector<HTMLElement>('span:last-child')
  if (hcatText) hcatText.textContent = cat.label

  highlightEdges(selectedId)
  if (!fallback) flyTo(id, store, whooshFn)
  else draw2d(selectedId, quizState)

  if (openPanelFlag) {
    const verses = topicVerses(t, lookup, ayat, 9)
    store.readSurahs = uniq([...store.readSurahs, ...verses.map((v) => String(v.surah))])
    save()
    renderPanelBody(t, activeTab, verses, byId, store, d.panelBody)
    togglePanel(true, d.panel)
  }

  updateHUD(store, topics.length, { hexp: d.hexp, htotal: d.htotal, hbar: d.hbar })
  updateRailActive()
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
  d.hcat.style.color = 'var(--gold-soft)'
  const hcatText = d.hcat.querySelector<HTMLElement>('span:last-child')
  if (hcatText) hcatText.textContent = isMind ? 'Tampilan dua dimensi' : 'Eksplorasi terbuka'
  updateRailActive()
}

// ── Quiz ──────────────────────────────────────────────────────────────────
function openQuiz(): void {
  quizState = { ...quizState, active: false }
  syncAnimState()
  d.quizOverlay.classList.add('open')
  d.quiz.classList.add('active')
  d.question.textContent = 'Klik Mulai 10 soal, lalu pilih bola topik yang paling sesuai dengan terjemahan ayat.'
}

function closeQuiz(): void {
  quizState = { ...quizState, active: false, candidates: new Set() }
  syncAnimState()
  d.quizOverlay.classList.remove('open')
  d.quiz.classList.remove('active')
  if (!fallback) highlightEdges(selectedId)
  else draw2d(selectedId, quizState)
}

function startQuiz(): void {
  const diff = (document.querySelector('.diff-btn.active') as HTMLButtonElement | null)?.dataset.diff as 'easy' | 'medium' | 'hard' ?? 'easy'
  const questions = makeQuestions(topics, lookup, ayat)
  if (!questions.length) { toast('Data ayat belum siap untuk quiz.', 'bad'); return }
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
  d.qprog.textContent = `Soal ${quizState.i + 1} / ${quizState.questions.length} · klik bola yang menyala di galaksi`
  d.qbar.style.width = `${(quizState.i / quizState.questions.length) * 100}%`
  qHud()
  if (!fallback) quizVisuals3d(quizState.candidates)
  else draw2d(selectedId, quizState)
}

function handleAnswer(id: string): void {
  if (!quizState.active || quizState.answering) return
  if (quizState.candidates.size && !quizState.candidates.has(id)) {
    toast('Pilih salah satu node yang menyala.', 'bad')
    return
  }
  const ok = id === quizState.current?.topic.id
  if (ok) {
    quizState.score++
    quizState.streak++
    quizState.bonus += Math.max(0, Math.round(40 - (Date.now() - quizState.start) / 3000))
    toast(`Benar: ${quizState.current!.topic.label_id}`, 'ok')
    if (!fallback) burst3d(id, '#f5e2b3')
    chimeFn('ok')
  } else {
    quizState.streak = 0
    toast(`Jawaban tepat: ${quizState.current!.topic.label_id}`, 'bad')
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
  d.quizOverlay.classList.add('open')
  d.quiz.classList.remove('active')
  d.question.textContent = `Sesi selesai. Skor ${quizState.score} / ${quizState.questions.length} dengan bonus ${quizState.bonus}.`
  d.qprog.textContent = 'Quiz selesai. Tekan Mulai lagi untuk sesi baru.'
  d.qbar.style.width = '100%'
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
  if (fallback) { draw2d(selectedId, quizState); toast(isMind ? 'Mind Map 2D aktif.' : 'Kembali ke galaksi 3D.'); return }
  toggleMind3d(store)
  d.htopic.textContent = isMind ? 'Mind Map' : 'Galaksi Makna'
  d.hcat.style.color = 'var(--gold-soft)'
  const hcatText = d.hcat.querySelector<HTMLElement>('span:last-child')
  if (hcatText) hcatText.textContent = isMind ? 'Tampilan dua dimensi' : 'Eksplorasi terbuka'
  toast(isMind ? 'Mind Map 2D aktif.' : 'Kembali ke galaksi 3D.')
}

// ── Event bindings ────────────────────────────────────────────────────────
function bind(): void {
  (d.searchform as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault()
    const m = bestMatch((d.search as HTMLInputElement).value)
    if (!m) { toast('Topik belum ditemukan. Coba sinonim Indonesia, Inggris, atau Arab.', 'bad'); return }
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

  d.search.onfocus = () => {
    const v = (d.search as HTMLInputElement).value.trim()
    if (v) showSuggestions(doSearch(v).slice(0, 8), d.suggest)
  }

  d.suggest.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]')
    if (b) {
      (d.search as HTMLInputElement).value = b.dataset.label ?? ''
      store.firstSearch = true; save()
      selectTopic(b.dataset.id!, true)
      hideSuggestions(d.suggest)
      ;(d.search as HTMLInputElement).blur()
      doCheckBadges()
    }
  }

  document.addEventListener('click', (e) => {
    if (!(d.searchform as HTMLElement).contains(e.target as Node)) hideSuggestions(d.suggest)
  })

  d.railToggle.onclick = () => {
    d.rail.classList.toggle('collapsed')
    d.railToggle.classList.toggle('on', !d.rail.classList.contains('collapsed'))
  }

  d.reset.onclick = resetView
  d.closepanel.onclick = () => togglePanel(false, d.panel)
  d.quiz.onclick = openQuiz
  d.closequiz.onclick = closeQuiz
  d.startquiz.onclick = startQuiz
  d.ach.onclick = () => d.achOverlay.classList.contains('open') ? closeAch() : openAch()
  d.closeach.onclick = closeAch
  d.closereader.onclick = closeReader

  d.readerBody.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.reader-play')
    if (!btn) return
    const v = lookup.get(btn.dataset.key!)
    if (v) playVerseAudio(v, btn, store.muted, () => { store.audioPlayedCount++; save(); doCheckBadges() }, toast)
  })
  d.mind.onclick = toggleMind
  d.mute.onclick = toggleMute
  d.theme.onclick = toggleTheme

  document.querySelectorAll('.diff-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      quizState = { ...quizState, diff: (b as HTMLButtonElement).dataset.diff as 'easy' | 'medium' | 'hard' }
    })
  })

  // Panel tab switching
  document.querySelectorAll<HTMLButtonElement>('.ptab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll<HTMLButtonElement>('.ptab').forEach((x) => x.classList.remove('active'))
      t.classList.add('active')
      activeTab = t.dataset.tab as typeof activeTab
      if (selectedId) {
        const topic = byId.get(selectedId)
        if (topic) {
          const verses = activeTab === 'ayat' ? topicVerses(topic, lookup, ayat, 9) : []
          renderPanelBody(topic, activeTab, verses, byId, store, d.panelBody)
        }
      }
    }
  })

  // Panel body click delegation
  d.panelBody.onclick = (e) => {
    const target = e.target as HTMLElement
    const audioBtn = target.closest<HTMLButtonElement>('.audio')
    const markBtn = target.closest<HTMLButtonElement>('.markayah')
    const surahLink = target.closest<HTMLButtonElement>('.vc-ref[data-surah]')
    const chipBtn = target.closest<HTMLButtonElement>('.chip[data-id]')
    const noteSaveBtn = target.closest<HTMLButtonElement>('#note-save')

    if (surahLink) {
      openSurahReader(
        Number(surahLink.dataset.surah),
        Number(surahLink.dataset.ayah),
        ayat,
        d.readerOverlay, d.readerTitle, d.readerSub, d.readerBody,
      )
      return
    }

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
      const alreadyMarked = store.markedAyat.includes(key)
      if (alreadyMarked) {
        store.markedAyat = store.markedAyat.filter((k) => k !== key)
      } else {
        store.markedAyat.push(key)
      }
      markBtn.classList.toggle('on', !alreadyMarked)
      const svg = markBtn.querySelector('svg')
      if (svg) svg.setAttribute('fill', !alreadyMarked ? 'currentColor' : 'none')
      save()
      toast(alreadyMarked ? 'Penanda dihapus.' : `Ayat ${key} ditandai.`, alreadyMarked ? undefined : 'ok')
      updateHUD(store, topics.length, { hexp: d.hexp, htotal: d.htotal, hbar: d.hbar })
      doCheckBadges()
      return
    }

    if (chipBtn) {
      sessionLinks++
      selectTopic(chipBtn.dataset.id!, true)
      doCheckBadges()
      return
    }

    if (noteSaveBtn && selectedId) {
      const noteArea = document.getElementById('note-area') as HTMLTextAreaElement | null
      if (noteArea) {
        if (!store.notes) store.notes = {}
        store.notes[selectedId] = noteArea.value
        save()
        toast('Catatan tersimpan.', 'ok')
      }
    }
  }

  // Hover card tracking
  d.scene.addEventListener('pointermove', (e: PointerEvent) => {
    if (hoverId) {
      d.hoverCard.style.left = `${e.clientX}px`
      d.hoverCard.style.top = `${e.clientY}px`
      const t = byId.get(hoverId)
      if (t) {
        const cat = CATEGORIES[t.category as CategoryKey]
        d.hoverCard.style.color = cat.color
        d.hcTitle.textContent = t.label_id
        const subSpan = d.hcSub.querySelector<HTMLElement>('span:last-child')
        if (subSpan) subSpan.textContent = `${cat.label} · ${t.label_en}`
        d.hcAr.textContent = t.arabic
      }
      d.hoverCard.classList.add('show')
    } else {
      d.hoverCard.classList.remove('show')
    }
  })
  d.scene.addEventListener('pointerleave', () => { d.hoverCard.classList.remove('show') })

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
      closeReader()
      hideSuggestions(d.suggest)
    } else if (!typing && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      const ids = topics.map((t) => t.id)
      const i = Math.max(0, ids.indexOf(selectedId ?? ids[0]))
      const n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length
      selectTopic(ids[n], true)
    }
  })

  d.mute.classList.toggle('on', !store.muted)
}

// ── UI helpers ────────────────────────────────────────────────────────────
function openAch(): void { renderAch(); d.achOverlay.classList.add('open'); d.ach.classList.add('active') }
function closeAch(): void { d.achOverlay.classList.remove('open'); d.ach.classList.remove('active') }
function closeReader(): void { d.readerOverlay.classList.remove('open'); d.readerOverlay.setAttribute('aria-hidden', 'true') }

function toggleMute(): void {
  store.muted = !store.muted
  if (store.muted) stopCurrentAudio()
  d.mute.classList.toggle('on', !store.muted)
  save()
  toast(store.muted ? 'Audio dimatikan.' : 'Audio dinyalakan.')
}

function toggleTheme(): void {
  store.theme = store.theme === 'light' ? 'dark' : 'light'
  applyTheme(store.theme, d.theme)
  save()
}

void esc
