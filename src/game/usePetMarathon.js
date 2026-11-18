// ─── PET MARATHON LIVE · usePetMarathon.js ─────────────────────────────────
// Hook chủ của màn hiển thị: giữ state engine, vòng lặp đua, nối TikTok WS,
// nhận lệnh từ Admin qua BroadcastChannel, phát snapshot về Admin mỗi 500ms.
// Không bao giờ tự bịa event quà: chỉ event thật từ WS hoặc Admin bấm thử.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ABILITY_BY_ID, DEFAULT_SETTINGS, GiftEngine, advance, applyAbility, applyChaosEvent,
  createRace, fillBots, finishRace, joinRacer, parseTarget, startRace,
} from './engine'
import { normalizeEvent, parseCommand } from './adapter'
import { TikTokWS, WS_STATUS } from './wsClient'
import { SoundEngine } from './sound'
import { onSyncMessage, postHeartbeat, postHello, postState } from './sync'

const SETTINGS_KEY = 'pml-settings-v1'
const WS_KEY = 'pml-ws-v1'

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap }, durations: { ...DEFAULT_SETTINGS.durations } }
    const saved = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      giftMap: { ...DEFAULT_SETTINGS.giftMap, ...(saved.giftMap || {}) },
      durations: { ...DEFAULT_SETTINGS.durations, ...(saved.durations || {}) },
    }
  } catch { return { ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap }, durations: { ...DEFAULT_SETTINGS.durations } } }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

function loadWs() {
  try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}') } catch { return {} }
}

export function usePetMarathon() {
  const stateRef = useRef(null)
  if (!stateRef.current) {
    const settings = loadSettings()
    const st = createRace(settings)
    st.paused = false
    st.pendingJoins = []
    stateRef.current = st
  }
  const engineRef = useRef(null)
  if (!engineRef.current) engineRef.current = new GiftEngine(stateRef.current)
  const soundRef = useRef(null)
  if (!soundRef.current) soundRef.current = new SoundEngine()
  const wsRef = useRef(null)
  const pendingJoinsRef = useRef([])

  const [snap, setSnap] = useState(null)
  const [wsStatus, setWsStatus] = useState(WS_STATUS.IDLE)
  const [wsDetail, setWsDetail] = useState('')
  const [wsLog, setWsLog] = useState([])
  const [muted, setMuted] = useState(() => !loadSettings().soundOn)
  const prevChaosRef = useRef(null)
  const prevCountRef = useRef(null)
  const reportedRaceRef = useRef('')
  const likeAccRef = useRef(0)

  const logWs = useCallback((line) => {
    setWsLog((prev) => [{ at: new Date().toLocaleTimeString('vi-VN'), line }, ...prev].slice(0, 40))
  }, [])

  // ── Gửi kết quả đua về API (nếu có cấu hình) — không có thì bỏ qua lặng lẽ ──
  const reportRace = useCallback((state) => {
    const api = import.meta.env?.VITE_API_URL || ''
    if (!api || reportedRaceRef.current === state.raceId) return
    reportedRaceRef.current = state.raceId
    try {
      fetch(`${api.replace(/\/$/, '')}/race-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId: state.raceId,
          winner: state.results[0] || null,
          results: state.results,
          durationMs: Math.round(state.raceTime * 1000),
          gifts: state.stats.gifts,
        }),
      }).catch(() => {})
    } catch { /* chạy local thì thôi */ }
  }, [])

  // ── Chụp nhanh state cho React UI + Admin ──
  const takeSnap = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    setSnap({
      v: Date.now(),
      phase: s.phase, paused: !!s.paused, countdown: Math.max(0, s.countdown),
      raceTime: s.raceTime, distance: s.distance, raceId: s.raceId,
      now: s.now, nextRaceIn: s.nextRaceIn,
      racers: s.racers.map((r) => ({
        id: r.id, lane: r.lane, petId: r.petId, petName: r.petName, color: r.color,
        nickname: r.nickname, isBot: r.isBot, dist: r.dist, speed: r.speed,
        finished: r.finished, place: r.place, coins: r.coins, anim: r.anim,
        shield: r.shieldCharges > 0 && s.now < r.st.shieldUntil,
        immune: s.now < r.st.immuneUntil,
        slowed: s.now < r.st.slowUntil || s.now < r.st.iceUntil || s.now < r.st.dizzyUntil,
        trapped: s.now < r.st.trappedUntil,
        rocket: s.now < r.st.rocketUntil,
        attacksReceived: r.attacksReceived,
      })),
      feed: s.feed.slice(-8),
      floaters: [...s.floaters],
      chaos: { active: s.chaos.active, nextIn: Math.round(s.chaos.nextIn), activeUntil: s.chaos.activeUntil },
      results: s.results,
      stats: { ...s.stats },
      likes: s.likes,
      queueLength: engineRef.current.queueLength,
      settings: s.settings,
      pendingJoins: pendingJoinsRef.current.length,
    })
  }, [])

  // ── Gửi snapshot đầy đủ về Admin (định kỳ + khi Admin xin) ──
  const broadcastState = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    postState({
      phase: s.phase, paused: !!s.paused, countdown: s.countdown,
      raceTime: s.raceTime, distance: s.distance,
      racers: s.racers.map((r) => ({ id: r.id, lane: r.lane, petId: r.petId, petName: r.petName, nickname: r.nickname, isBot: r.isBot, dist: r.dist, finished: r.finished, place: r.place })),
      feed: s.feed.slice(-8), results: s.results,
      chaos: s.chaos, stats: s.stats, likes: s.likes,
      queueLength: engineRef.current.queueLength,
      settings: s.settings, wsStatus, wsDetail,
      wsLog: wsLog.slice(0, 30),
    })
  }, [wsStatus, wsDetail, wsLog])

  // ── Chào Admin ngay khi tải + gửi snapshot đầu tiên ──
  useEffect(() => {
    postHello()
    broadcastState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const handleEvent = useCallback((ev) => {
    const s = stateRef.current
    if (!s || !ev) return
    if (ev.kind === 'system') return
    if (ev.kind === 'unknown') { logWs(`Event lạ bỏ qua: ${ev.reason || ''}`); return }
    const sound = soundRef.current

    if (ev.kind === 'chat') {
      const cmd = parseCommand(ev.comment)
      const streamerId = (s.settings.streamerId || '').trim().toLowerCase()
      const isStreamer = streamerId && (ev.userId.toLowerCase() === streamerId || ev.nickname.toLowerCase() === streamerId)
      if (cmd?.cmd === 'join') {
        if (s.phase === 'waiting' || s.phase === 'countdown') {
          const r = joinRacer(s, ev.nickname, ev.userId)
          if (!r.ok && r.reason === 'full') pendingJoinsRef.current.push({ nickname: ev.nickname, userId: ev.userId })
        } else {
          if (!pendingJoinsRef.current.some((p) => p.userId === ev.userId)) {
            pendingJoinsRef.current.push({ nickname: ev.nickname, userId: ev.userId })
          }
          s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `🏁 ${ev.nickname} đăng ký — vào cuộc đua sau!`, at: s.now })
        }
        takeSnap()
        return
      }
      if (cmd?.cmd === 'start' && s.phase === 'waiting') { doStart(); return }
      if (cmd?.cmd === 'pause' && isStreamer) { s.paused = true; takeSnap(); return }
      if (cmd?.cmd === 'resume' && isStreamer) { s.paused = false; takeSnap(); return }
      if (cmd?.cmd === 'addTime' && isStreamer) {
        for (const r of s.racers) r.st.rocketUntil = Math.max(r.st.rocketUntil, s.now + 3)
        s.feed.push({ id: `f${Date.now()}`, kind: 'info', text: `⚡ Streamer tặng +${cmd.seconds}S: tất cả tăng tốc!`, at: s.now })
        sound.rocket()
        takeSnap()
        return
      }
      // Bình luận thường: chỉ hiện trong log, không làm gì khác
      logWs(`💬 ${ev.nickname}: ${ev.comment}`)
      return
    }

    if (ev.kind === 'gift') {
      // Quà lặp (streak) chỉ tính 1 lần khi kết thúc chuỗi — connector đã lọc,
      // ở đây nhận đúng 1 lần cho mỗi event id.
      const res = engineRef.current.receive({
        id: ev.id || `${ev.userId}:${ev.giftName}:${Date.now()}`,
        giftName: ev.giftName, nickname: ev.nickname, userId: ev.userId, text: ev.text || '',
      })
      if (res.ok) logWs(`🎁 ${ev.nickname} tặng ${ev.giftName} → ${ABILITY_BY_ID[res.abilityId]?.name || ''}`)
      else if (res.reason === 'unmapped') logWs(`🎁 ${ev.nickname} tặng ${ev.giftName} (chưa gán chiêu — xem tab Quà & Chiêu)`)
      else if (res.reason !== 'duplicate') logWs(`🎁 ${ev.nickname} tặng ${ev.giftName}: ${res.reason}`)
      takeSnap()
      return
    }

    if (ev.kind === 'like') {
      s.likes += ev.likeCount
      likeAccRef.current += ev.likeCount
      const every = s.settings.likeBoostEvery || 100
      while (likeAccRef.current >= every) {
        likeAccRef.current -= every
        const pool = s.racers.filter((r) => !r.finished)
        if (pool.length && s.phase === 'racing') {
          const lucky = pool[Math.floor(Math.random() * pool.length)]
          lucky.st.boostUntil = Math.max(lucky.st.boostUntil, s.now + 2)
          s.feed.push({ id: `f${Date.now()}`, kind: 'info', text: `❤️ Đủ ${every} tim: ${lucky.nickname} tăng tốc!`, at: s.now })
        }
      }
      takeSnap()
      return
    }

    if (ev.kind === 'join') {
      s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `👋 ${ev.nickname} vừa vào xem live!`, at: s.now })
      takeSnap()
      return
    }
    if (ev.kind === 'follow') {
      s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `💖 ${ev.nickname} vừa theo dõi!`, at: s.now })
      takeSnap()
      return
    }
    if (ev.kind === 'share') {
      s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `🔁 ${ev.nickname} vừa chia sẻ live!`, at: s.now })
      takeSnap()
      return
    }
  }, [logWs, takeSnap])

  // ── Bắt đầu cuộc đua (áp dụng người chờ + lấp bot) ──
  const doStart = useCallback(() => {
    const s = stateRef.current
    for (const p of pendingJoinsRef.current.splice(0)) {
      joinRacer(s, p.nickname, p.userId)
    }
    fillBots(s)
    startRace(s)
    takeSnap()
  }, [takeSnap])

  // ── Lệnh từ Admin ──
  useEffect(() => {
    const off = onSyncMessage((msg) => {
      if (!msg || msg.type !== 'cmd') return
      const s = stateRef.current
      const sound = soundRef.current
      if (msg.cmd === 'start') doStart()
      else if (msg.cmd === 'snapshotReq') broadcastState()
      else if (msg.cmd === 'pause') { s.paused = true; takeSnap() }
      else if (msg.cmd === 'resume') { s.paused = false; takeSnap() }
      else if (msg.cmd === 'reset') {
        const settings = s.settings
        const fresh = createRace(settings)
        fresh.paused = false
        fresh.pendingJoins = []
        stateRef.current = fresh
        engineRef.current = new GiftEngine(fresh)
        pendingJoinsRef.current = []
        takeSnap()
      } else if (msg.cmd === 'addBot') {
        if (s.phase === 'waiting' && s.racers.length < 6) { fillBots(s); takeSnap() }
      } else if (msg.cmd === 'removeBot') {
        if (s.phase === 'waiting') {
          const i = s.racers.findIndex((r) => r.isBot)
          if (i >= 0) { s.racers.splice(i, 1); s.racers.forEach((r, idx) => { r.lane = idx }); takeSnap() }
        }
      } else if (msg.cmd === 'inject') {
        const res = applyAbility(s, msg.abilityId, { nickname: msg.sender || 'Admin thử', userId: 'admin' }, msg.targetId || null)
        if (res.ok) sound.playForAbility(msg.abilityId)
        takeSnap()
      } else if (msg.cmd === 'chaos') {
        const r = applyChaosEvent(s, msg.eventId)
        if (r.ok) sound.playForChaos()
        takeSnap()
      } else if (msg.cmd === 'settings') {
        Object.assign(s.settings, msg.settings || {})
        if (msg.settings?.durations) Object.assign(s.settings.durations, msg.settings.durations)
        if (msg.settings?.giftMap) s.settings.giftMap = { ...msg.settings.giftMap }
        sound.enabled = s.settings.soundOn !== false
        saveSettings(s.settings)
        takeSnap()
      } else if (msg.cmd === 'connect') {
        try { localStorage.setItem(WS_KEY, JSON.stringify({ wsUrl: msg.wsUrl, key: msg.key })) } catch { /* ignore */ }
        wsRef.current?.connect(msg.wsUrl, msg.key)
      } else if (msg.cmd === 'disconnect') {
        wsRef.current?.disconnect()
      } else if (msg.cmd === 'simChat') {
        handleEvent({ kind: 'chat', nickname: msg.nickname || 'Khán giả thử', userId: msg.userId || 'test', comment: msg.text || '' })
      } else if (msg.cmd === 'simGift') {
        engineRef.current.receive({
          id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          giftName: msg.giftName, nickname: msg.nickname || 'Khán giả thử', userId: msg.userId || 'test',
          text: msg.text || '',
        })
        takeSnap()
      } else if (msg.cmd === 'simLike') {
        handleEvent({ kind: 'like', nickname: 'Khán giả thử', userId: 'test', likeCount: msg.count || 10 })
      } else if (msg.cmd === 'toggleSound') {
        s.settings.soundOn = !s.settings.soundOn
        sound.enabled = s.settings.soundOn
        saveSettings(s.settings)
        setMuted(!s.settings.soundOn)
        takeSnap()
      }
    })
    return off
  }, [doStart, handleEvent, takeSnap, broadcastState])

  // ── Vòng lặp chính: setInterval + thời gian thực ──────────────────────────
  // KHÔNG dùng requestAnimationFrame: trình duyệt bóp rAF khi tab ở nền làm
  // đua đóng băng và Admin mất đồng bộ. advance() chia dt thành bước ≤0,1s
  // nên dù timer nền chỉ chạy 1 lần/giây, đua vẫn tiến đúng giờ thực.
  useEffect(() => {
    let lastTick = performance.now()
    let lastSnap = 0
    let lastBroadcast = 0
    let lastHeartbeat = 0
    const step = () => {
      const nowMs = performance.now()
      const dt = Math.min(5, Math.max(0, (nowMs - lastTick) / 1000))
      lastTick = nowMs
      const s = stateRef.current
      if (!s) return
      if (!s.paused) {
        advance(s, dt)
        // Xử lý hàng đợi quà theo giới hạn toàn cục
        const done = engineRef.current.process(s.now)
        if (done?.ok && done.abilityId) soundRef.current.playForAbility(done.abilityId)
        if (done?.blocked === 'shield') soundRef.current.shield()
        // Âm thanh đếm ngược / xuất phát
        const c = Math.ceil(s.countdown)
        if (s.phase === 'countdown' && c !== prevCountRef.current) {
          prevCountRef.current = c
          if (c > 0) soundRef.current.countdown()
        }
        if (s.phase === 'racing' && prevCountRef.current !== 0) { prevCountRef.current = 0; soundRef.current.go() }
        // Âm thanh sự kiện hỗn loạn + về đích
        if (s.chaos.active && s.chaos.active !== prevChaosRef.current) {
          prevChaosRef.current = s.chaos.active
          soundRef.current.playForChaos()
        }
        if (s.phase === 'finished') {
          reportRace(s)
          if (prevChaosRef.current !== 'finished') { prevChaosRef.current = 'finished'; soundRef.current.fanfare() }
          if (s.nextRaceIn <= 0) doStart()
        } else if (prevChaosRef.current === 'finished') {
          prevChaosRef.current = null
        }
      }
      if (nowMs - lastSnap > 200) { lastSnap = nowMs; takeSnap() }
      if (nowMs - lastBroadcast > 500) { lastBroadcast = nowMs; broadcastState() }
      if (nowMs - lastHeartbeat > 2000) {
        lastHeartbeat = nowMs
        postHeartbeat({ phase: s.phase, racers: s.racers.length, raceId: s.raceId })
      }
    }
    const id = setInterval(step, 100)
    return () => clearInterval(id)
  }, [doStart, reportRace, takeSnap, broadcastState])

  // ── Nối TikTok WS ──
  useEffect(() => {
    const ws = new TikTokWS({
      onStatus: (st, detail) => { setWsStatus(st); setWsDetail(detail || '') },
      onRaw: () => {},
      onEvent: (raw) => {
        const norm = normalizeEvent(raw)
        const list = Array.isArray(norm) ? norm : [norm]
        for (const ev of list) if (ev) handleEvent(ev)
      },
    })
    wsRef.current = ws
    const saved = loadWs()
    if (saved.wsUrl) ws.connect(saved.wsUrl, saved.key || '')
    return () => ws.disconnect(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mở khóa âm thanh sau lần chạm đầu (trình duyệt chặn autoplay) ──
  useEffect(() => {
    const unlock = () => soundRef.current.ensure()
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => { takeSnap() }, [takeSnap])

  const toggleMute = useCallback(() => {
    const s = stateRef.current
    s.settings.soundOn = !s.settings.soundOn
    soundRef.current.enabled = s.settings.soundOn
    saveSettings(s.settings)
    setMuted(!s.settings.soundOn)
    takeSnap()
  }, [takeSnap])

  return {
    stateRef, snap, wsStatus, wsDetail, wsLog, muted,
    start: doStart, toggleMute,
    apiConfigured: Boolean(import.meta.env?.VITE_API_URL),
  }
}
