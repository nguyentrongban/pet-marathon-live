// ─── KÉO CO LIVE · useTugOfWar.js ──────────────────────────────────────────
// Hook chủ của màn hiển thị: giữ state engine, vòng lặp kéo co, nối TikTok WS,
// nhận lệnh từ Admin qua BroadcastChannel, phát snapshot về Admin mỗi 500ms.
// Không bao giờ tự bịa event quà: chỉ event thật từ WS hoặc Admin bấm thử.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS, GiftEngine, TEAMS, advance, applyLikes, applyPull,
  clearBxh, provinceLeader, createMatch, giftIcon, joinProvince, joinTeam, migrateGiftMap, pushToast,
  startMatch, startRound, syncProvinceTeams, teamLabel, topProvinces, topProvincesByComments, topGifters, topLikers,
} from './engine'
import { provinceInfo, detectProvince } from './provinces'
import { createSeqTracker, normalizeEvent, parseCommand } from './adapter'
import { TikTokWS, WS_STATUS } from './wsClient'
import { SoundEngine } from './sound'
import { VoiceEngine, voiceTextBxh, voiceTextFinal, voiceTextGift, voiceTextLikes, voiceTextMatchWin, voiceTextRoundStart, voiceTextRoundWin } from './voice'
import { onSyncMessage, postHeartbeat, postHello, postState } from './sync'

const SETTINGS_KEY = 'pml-settings-v1'
const WS_KEY = 'pml-ws-v1'
const BXH_KEY = 'pml-bxh-v1' // BXH (ai tặng quà / thả tim nhiều nhất) — lưu lại qua các màn/trận + tải lại trang

// BXH lưu ở localStorage trên màn hiển thị (cùng máy với game): tải lại
// trang vẫn còn, chỉ mất khi streamer bấm Xóa BXH ở Admin — hoặc khi tắt
// live: BXH lưu kèm thời gian lưu cuối; mở game lại mà lần lưu cuối đã
// quá 4 TIẾNG (tức live trước đã tắt lâu, đây là live mới) thì tự reset
// BXH về trống. Tải lại trang trong lúc live đang chạy thì thời gian lưu
// cuối luôn mới (lưu mỗi 5 giây) nên BXH không mất. Bản lưu cũ (chưa có
// savedAt) thì giữ nguyên, lần lưu sau sẽ có savedAt.
const BXH_STALE_MS = 4 * 60 * 60 * 1000 // 4 tiếng
export function loadBxh() {
  try {
    const raw = JSON.parse(localStorage.getItem(BXH_KEY) || '{}')
    if (raw.savedAt && typeof raw.savedAt === 'number' && Date.now() - raw.savedAt > BXH_STALE_MS) {
      return { giftTotals: {}, likeTotals: {}, provinceTotals: {}, stale: true }
    }
    return {
      giftTotals: raw.giftTotals && typeof raw.giftTotals === 'object' ? raw.giftTotals : {},
      likeTotals: raw.likeTotals && typeof raw.likeTotals === 'object' ? raw.likeTotals : {},
      provinceTotals: raw.provinceTotals && typeof raw.provinceTotals === 'object' ? raw.provinceTotals : {},
    }
  } catch { return { giftTotals: {}, likeTotals: {}, provinceTotals: {} } }
}
function saveBxh(state) {
  try {
    localStorage.setItem(BXH_KEY, JSON.stringify({
      giftTotals: state.giftTotals || {},
      likeTotals: state.likeTotals || {},
      provinceTotals: state.provinceTotals || {},
      savedAt: Date.now(),
    }))
  } catch { /* ignore */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } }
    const saved = JSON.parse(raw)
    // Đổi luật 2026-11-19: thắng 3 màn → thắng 2 màn (best of 3, tối đa 3
    // màn). Máy nào còn lưu giá trị mặc định cũ (3) thì đổi sang 2; ai
    // chỉnh tay khác 3 thì giữ nguyên lựa chọn của họ.
    if (saved.winsToMatch === 3) saved.winsToMatch = 2
    // Đổi luật 2026-11-19: vạch thắng 0,9 → 0,5 (đội kéo rõ ràng thì thắng
    // ngay, không phải chờ hết giờ) + dây chạy nhanh hơn 0,12 → 0,15.
    // Đổi tiếp 2026-11-19 tối: vạch thắng 0,5 → 0,7 (xa hơn để màn kéo
    // lâu hơn, gay cấn hơn; 0,9 thì xa quá, hay phải chờ hết giờ).
    // Máy nào còn lưu giá trị mặc định cũ (0,9 hoặc 0,5) thì đổi sang 0,7.
    if (saved.winLine === 0.9 || saved.winLine === 0.5) saved.winLine = 0.7
    if (saved.ropeSpeed === 0.12) saved.ropeSpeed = 0.15
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      giftMap: migrateGiftMap({ ...DEFAULT_SETTINGS.giftMap, ...(saved.giftMap || {}) }),
    }
  } catch { return { ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } } }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

function loadWs() {
  try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}') } catch { return {} }
}

export function useTugOfWar() {
  const stateRef = useRef(null)
  if (!stateRef.current) {
    const settings = loadSettings()
    const st = createMatch(settings)
    st.paused = false
    st.pendingJoins = []
    // BXH lưu lại từ phiên trước (tải lại trang vẫn còn).
    const bxh = loadBxh()
    st.giftTotals = bxh.giftTotals
    st.likeTotals = bxh.likeTotals
    st.provinceTotals = bxh.provinceTotals
    stateRef.current = st
  }
  const engineRef = useRef(null)
  if (!engineRef.current) engineRef.current = new GiftEngine(stateRef.current)
  const soundRef = useRef(null)
  if (!soundRef.current) soundRef.current = new SoundEngine()
  const wsRef = useRef(null)
  const pendingJoinsRef = useRef([])
  // Bắt kịp sau khi rớt mạng: seq cao nhất đã nhận + các seq đã áp dụng
  // (để bỏ qua event trùng khi connector gửi lại).
  const lastSeqRef = useRef(0)
  const seqTrackerRef = useRef(null)
  if (!seqTrackerRef.current) seqTrackerRef.current = createSeqTracker()

  const [snap, setSnap] = useState(null)
  const [wsStatus, setWsStatus] = useState(WS_STATUS.IDLE)
  const [wsDetail, setWsDetail] = useState('')
  const [wsLog, setWsLog] = useState([])
  const [muted, setMuted] = useState(() => !loadSettings().soundOn)
  const prevCountRef = useRef(null)
  const prevPhaseRef = useRef(null)
  const prevFinalTimeRef = useRef(false)
  const prevRoundWinnerRef = useRef(null)
  const reportedMatchRef = useRef('')

  const logWs = useCallback((line) => {
    setWsLog((prev) => [{ at: new Date().toLocaleTimeString('vi-VN'), line }, ...prev].slice(0, 40))
  }, [])

  // ── Giọng đọc bình luận (FPT.AI Ban Mai mặc định; hết lượt / lỗi thì tự
  // chuyển giọng máy miễn phí trên điện thoại, thử lại FPT.AI sau 5 phút).
  const voiceRef = useRef(null)
  if (!voiceRef.current) {
    const settings0 = loadSettings()
    voiceRef.current = new VoiceEngine({
      apiBase: import.meta.env?.VITE_API_URL || '',
      voice: settings0.voice || 'banmai',
      // Giọng đọc chỉ theo nút voiceOn trong Admin — KHÔNG theo nút tắt
      // tiếng trên màn hình (nút đó chỉ tắt nhạc hiệu ứng). Trước đây giọng
      // đọc tắt theo tiếng nên streamer tắt tiếng là mất luôn giọng đọc.
      // Giọng AI FPT.AI TẮT hẳn (useFpt: false) theo yêu cầu của tấn 23:47
      // — chỉ dùng giọng máy miễn phí trên điện thoại.
      useFpt: false,
      enabled: settings0.voiceOn !== false,
      onModeChange: (mode) => {
        if (mode === 'device') logWs('🎙️ Hết lượt / lỗi giọng FPT.AI — đang dùng giọng máy miễn phí, thử lại sau 5 phút.')
        else logWs('🎙️ Đã nối lại giọng FPT.AI.')
      },
    })
  }

  // ── Gửi kết quả trận về API (nếu có cấu hình) — không có thì bỏ qua lặng lẽ ──
  const reportMatch = useCallback((state) => {
    const api = import.meta.env?.VITE_API_URL || ''
    if (!api || reportedMatchRef.current === state.matchId || !state.matchWinner) return
    reportedMatchRef.current = state.matchId
    try {
      fetch(`${api.replace(/\/$/, '')}/match-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: state.matchId,
          winnerTeam: state.matchWinner,
          score: { A: state.teams.A.roundWins, B: state.teams.B.roundWins },
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
      roundTimeLeft: s.roundTimeLeft, matchId: s.matchId, round: s.round,
      now: s.now, nextRoundIn: s.nextRoundIn, matchEndIn: s.matchEndIn,
      rope: s.rope,
      teams: {
        A: { ...s.teams.A, members: s.teams.A.members.slice(0, 20) },
        B: { ...s.teams.B, members: s.teams.B.members.slice(0, 20) },
      },
      teamCounts: { A: s.teams.A.members.length, B: s.teams.B.members.length },
      roundWinner: s.roundWinner, matchWinner: s.matchWinner,
      luckyStar: s.luckyStar, streak: { ...s.streak },
      finalTime: !!s.finalTime, timeAddedByLikes: s.timeAddedByLikes || 0,
      feed: s.feed.slice(-8),
      floaters: [...s.floaters],
      effects: [...s.effects],
      stats: { ...s.stats },
      likes: s.likes,
      bxh: { gifters: topGifters(s, 3), likers: topLikers(s, 3), provinces: topProvinces(s, 3) },
      // Đấu tỉnh thành: 2 tỉnh đang đấu + top tỉnh theo số người bình luận.
      provinceTeams: { ...s.provinceTeams },
      provinceBattle: topProvincesByComments(s, 2),
      queueLength: engineRef.current.queueLength,
      settings: s.settings,
      voiceMode: voiceRef.current ? voiceRef.current.getMode() : 'device',
      pendingJoins: pendingJoinsRef.current.length,
    })
  }, [])

  // ── Gửi snapshot đầy đủ về Admin (định kỳ + khi Admin xin) ──
  const broadcastState = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    postState({
      phase: s.phase, paused: !!s.paused, countdown: s.countdown,
      roundTimeLeft: s.roundTimeLeft, matchId: s.matchId, round: s.round,
      rope: s.rope,
      teams: {
        A: { roundWins: s.teams.A.roundWins, totalPull: s.teams.A.totalPull, pullRate: s.teams.A.pullRate, boost: s.teams.A.boost, members: s.teams.A.members.map((m) => ({ nickname: m.nickname, pulls: m.pulls, gifts: m.gifts })) },
        B: { roundWins: s.teams.B.roundWins, totalPull: s.teams.B.totalPull, pullRate: s.teams.B.pullRate, boost: s.teams.B.boost, members: s.teams.B.members.map((m) => ({ nickname: m.nickname, pulls: m.pulls, gifts: m.gifts })) },
      },
      roundWinner: s.roundWinner, matchWinner: s.matchWinner,
      streak: { ...s.streak }, finalTime: !!s.finalTime, timeAddedByLikes: s.timeAddedByLikes || 0,
      feed: s.feed.slice(-8), stats: s.stats, likes: s.likes,
      bxh: { gifters: topGifters(s, 3), likers: topLikers(s, 3), provinces: topProvinces(s, 3) },
      provinceLeader: provinceLeader(s),
      provinceTeams: { ...s.provinceTeams },
      provinceBattle: topProvincesByComments(s, 2),
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
      // Chọn tỉnh: bình luận tên tỉnh/thành (Hà Nội, Sài Gòn, Đà Nẵng...)
      // để quà của mình tính cho tỉnh đó. Bình luận tỉnh là TỰ VÀO ĐỘI
      // tỉnh đó luôn (đấu tỉnh thành) — chỉ hiện toast khi mới chọn/đổi tỉnh.
      const pv = detectProvince(ev.comment, '')
      if (pv) {
        const isNew = s.userProvince[ev.userId] !== pv
        const jr = joinProvince(s, pv, ev.nickname, ev.userId, ev.avatar || '')
        if (isNew && jr.ok) {
          const info = provinceInfo(pv)
          if (info) pushToast(s, `📍 ${ev.nickname} đã chọn ${info.name}! Tặng quà để đưa ${info.name} lên số 1!`)
        }
      }
      const cmd = parseCommand(ev.comment)
      const streamerId = (s.settings.streamerId || '').trim().toLowerCase()
      const isStreamer = streamerId && (ev.userId.toLowerCase() === streamerId || ev.nickname.toLowerCase() === streamerId)
      if (cmd?.cmd === 'join' || cmd?.cmd === 'joinTeam') {
        const teamId = cmd.cmd === 'joinTeam' ? cmd.teamId : 'balance'
        const r = joinTeam(s, teamId, ev.nickname, ev.userId, ev.avatar || '')
        if (!r.ok && r.reason === 'full') {
          pendingJoinsRef.current.push({ nickname: ev.nickname, userId: ev.userId, teamId })
        }
        takeSnap()
        return
      }
      if (cmd?.cmd === 'start' && (s.phase === 'waiting' || s.phase === 'roundEnd' || s.phase === 'matchEnd')) { doStart(); return }
      if (cmd?.cmd === 'pause' && isStreamer) { s.paused = true; takeSnap(); return }
      if (cmd?.cmd === 'resume' && isStreamer) { s.paused = false; takeSnap(); return }
      if (cmd?.cmd === 'addTime' && isStreamer) {
        if (s.phase === 'pulling' || s.phase === 'countdown') {
          s.roundTimeLeft += cmd.seconds
          s.feed.push({ id: `f${Date.now()}`, kind: 'info', text: `⚡ Streamer cộng thêm ${cmd.seconds} giây kéo co!`, at: s.now })
          sound.go()
        }
        takeSnap()
        return
      }
      // Bình luận thường: chỉ hiện trong log, không làm gì khác
      logWs(`💬 ${ev.nickname}: ${ev.comment}`)
      return
    }

    if (ev.kind === 'gift') {
      // Tỉnh của người tặng: tên tỉnh trong chữ kèm quà hoặc tên người tặng,
      // rồi tới tỉnh người đó đã chọn trước đó.
      const pv = detectProvince(ev.text || '', ev.nickname) || s.userProvince[ev.userId] || null
      if (pv) s.userProvince[ev.userId] = pv
      const res = engineRef.current.receive({
        id: ev.id || `${ev.userId}:${ev.giftName}:${Date.now()}`,
        giftName: ev.giftName, nickname: ev.nickname, userId: ev.userId, text: ev.text || '',
        avatar: ev.avatar || '', province: pv || '',
      })
      if (res.ok) logWs(`${giftIcon(ev.giftName)} ${ev.nickname} tặng ${ev.giftName} → kéo ${TEAMS[res.teamId].name} (${res.power} lực)`)
      else if (res.reason === 'unmapped') logWs(`${giftIcon(ev.giftName)} ${ev.nickname} tặng ${ev.giftName} (chưa gán lực kéo — xem tab Quà & Lực kéo)`)
      else if (res.reason !== 'duplicate') logWs(`${giftIcon(ev.giftName)} ${ev.nickname} tặng ${ev.giftName}: ${res.reason}`)
      takeSnap()
      return
    }

    if (ev.kind === 'like') {
      // Tim chỉ +thời gian kéo (tính theo từng người: đủ 100 tim → +10s).
      // BXH tim ghi tên người thả để bảng nhỏ ở góc trái có người đứng đầu.
      const added = applyLikes(s, ev.userId, ev.likeCount, ev.nickname, ev.avatar || '')
      if (added > 0) {
        sound.coin()
        voiceRef.current.speak(voiceTextLikes(added * (s.settings.likeTimeSeconds || 10)), 'low')
      }
      takeSnap()
      return
    }

    if (ev.kind === 'join') {
      s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `👋 ${ev.nickname} vừa vào xem live!`, at: s.now })
      pushToast(s, `👋 ${ev.nickname} vừa vào xem!`)
      takeSnap()
      return
    }
    if (ev.kind === 'follow') {
      s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `💖 ${ev.nickname} vừa theo dõi!`, at: s.now })
      pushToast(s, `💖 ${ev.nickname} vừa theo dõi!`)
      takeSnap()
      return
    }
    if (ev.kind === 'share') {
      s.feed.push({ id: `f${Date.now()}`, kind: 'join', text: `🔁 ${ev.nickname} vừa chia sẻ live!`, at: s.now })
      pushToast(s, `🔁 ${ev.nickname} vừa chia sẻ live!`)
      takeSnap()
      return
    }
  }, [logWs, takeSnap])

  // ── Bắt đầu trận / màn ──
  const doStart = useCallback(() => {
    const s = stateRef.current
    if (s.phase === 'roundEnd') {
      s.round++
      startRound(s)
    } else if (s.phase === 'waiting' || s.phase === 'matchEnd') {
      for (const p of pendingJoinsRef.current.splice(0)) {
        joinTeam(s, p.teamId || 'balance', p.nickname, p.userId, p.avatar || '')
      }
      startMatch(s)
    }
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
        const giftTotals = s.giftTotals || {}
        const likeTotals = s.likeTotals || {}
        const provinceTotals = s.provinceTotals || {}
        const userProvince = s.userProvince || {}
        const provinceUsers = s.provinceUsers || {}
        const provinceTeams = s.provinceTeams || { A: null, B: null }
        const fresh = createMatch(settings)
        fresh.paused = false
        fresh.pendingJoins = []
        // Trận mới: xóa tỉ số + đội, nhưng GIỮ BXH (BXH tính cả phiên)
        // + GIỮ người ủng hộ từng tỉnh (họ vẫn đang xem live).
        fresh.giftTotals = giftTotals
        fresh.likeTotals = likeTotals
        fresh.provinceTotals = provinceTotals
        fresh.userProvince = userProvince
        fresh.provinceUsers = provinceUsers
        fresh.provinceTeams = provinceTeams
        stateRef.current = fresh
        engineRef.current = new GiftEngine(fresh)
        pendingJoinsRef.current = []
        reportedMatchRef.current = ''
        takeSnap()
      } else if (msg.cmd === 'resetBxh') {
        // Xóa BXH (bắt đầu live mới / ngày mới): xóa cả trên màn + localStorage.
        clearBxh(s)
        saveBxh(s)
        takeSnap()
      } else if (msg.cmd === 'inject') {
        if (s.phase === 'pulling') {
          const res = applyPull(s, msg.teamId, msg.power || 6, { nickname: msg.sender || 'Admin thử', userId: 'admin' }, '', { gift: false })
          if (res.ok) sound.playForPull(res.effect)
        }
        takeSnap()
      } else if (msg.cmd === 'settings') {
        Object.assign(s.settings, msg.settings || {})
        if (msg.settings?.giftMap) s.settings.giftMap = migrateGiftMap(msg.settings.giftMap)
        sound.enabled = s.settings.soundOn !== false
        if (msg.settings?.voice) voiceRef.current?.setVoice(msg.settings.voice)
        voiceRef.current?.setEnabled(s.settings.voiceOn !== false)
        saveSettings(s.settings)
        takeSnap()
      } else if (msg.cmd === 'testVoice') {
        // Thử giọng đọc: đọc thẳng bằng giọng máy (không chờ FPT.AI), kể
        // cả khi đang tắt tiếng (để streamer kiểm tra giọng có kêu không).
        voiceRef.current?.speakDeviceTest('Hà Nội đang dẫn đầu, thử giọng đọc bình luận!')
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
  // trận đóng băng và Admin mất đồng bộ. advance() chia dt thành bước ≤0,1s
  // nên dù timer nền chỉ chạy 1 lần/giây, trận vẫn tiến đúng giờ thực.
  useEffect(() => {
    let lastTick = performance.now()
    let lastSnap = 0
    let lastBroadcast = 0
    let lastHeartbeat = 0
    let lastBxhSave = 0
    let lastBxhVoice = 0
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
        if (done?.ok) {
          soundRef.current.playForPull(done.effect || 0)
          // Giọng đọc quà: quà to đọc đủ câu, quà nhỏ đọc ngắn; lật kèo
          // thì đọc câu lật kèo. Quà thử (Admin/demo) không qua hàng đợi
          // nên không đọc — chỉ quà thật mới đọc.
          voiceRef.current.speak(voiceTextGift({
            sender: done.sender?.nickname || 'Khán giả',
            giftName: done.giftName || 'quà',
            effect: done.effect || 0,
            teamName: teamLabel(s, done.teamId),
            flip: !!done.flip,
          }), done.flip ? 'high' : (done.effect >= 25 ? 'normal' : 'low'))
        }
        // Âm thanh đếm ngược / bắt đầu kéo
        const c = Math.ceil(s.countdown)
        if (s.phase === 'countdown' && c !== prevCountRef.current) {
          prevCountRef.current = c
          if (c > 0) soundRef.current.countdown()
        }
        if (s.phase === 'pulling' && prevPhaseRef.current !== 'pulling') {
          soundRef.current.go()
          // Giọng đọc đầu màn: 2 tỉnh/đội nào đấu nhau.
          voiceRef.current.speak(voiceTextRoundStart(s.round, teamLabel(s, 'A'), teamLabel(s, 'B')), 'normal')
        }
        // Giờ chót: đọc 1 lần khi vừa vào 10 giây cuối.
        if (s.finalTime && !prevFinalTimeRef.current) voiceRef.current.speak(voiceTextFinal(), 'normal')
        prevFinalTimeRef.current = !!s.finalTime
        // Thắng màn / thắng trận: kèn + té bùn + giọng đọc.
        if (s.roundWinner && s.roundWinner !== prevRoundWinnerRef.current) {
          prevRoundWinnerRef.current = s.roundWinner
          soundRef.current.cheer()
          soundRef.current.splash()
          if (s.matchWinner) voiceRef.current.speak(voiceTextMatchWin(teamLabel(s, s.matchWinner)), 'high')
          else voiceRef.current.speak(voiceTextRoundWin(teamLabel(s, s.roundWinner), s.round), 'high')
        }
        if (s.phase === 'matchEnd') reportMatch(s)
        if (!s.roundWinner) prevRoundWinnerRef.current = null
        prevPhaseRef.current = s.phase
      }
      if (nowMs - lastSnap > 200) { lastSnap = nowMs; takeSnap() }
      if (nowMs - lastBroadcast > 500) { lastBroadcast = nowMs; broadcastState() }
      // Lưu BXH mỗi 5 giây — tải lại trang vẫn còn (mất tối đa 5 giây cuối).
      if (nowMs - lastBxhSave > 5000) { lastBxhSave = nowMs; saveBxh(s) }
      // Giọng đọc BXH mỗi 60 giây trong lúc kéo (chỉ khi có dữ liệu).
      if (s.phase === 'pulling' && nowMs - lastBxhVoice > 60000) {
        lastBxhVoice = nowMs
        const bxhText = voiceTextBxh(provinceLeader(s), topGifters(s, 1)[0] || null)
        if (bxhText) voiceRef.current.speak(bxhText, 'normal')
      }
      if (nowMs - lastHeartbeat > 2000) {
        lastHeartbeat = nowMs
        postHeartbeat({ phase: s.phase, round: s.round, matchId: s.matchId })
      }
    }
    const id = setInterval(step, 100)
    return () => clearInterval(id)
  }, [reportMatch, takeSnap, broadcastState])

  // ── Nối TikTok WS ──
  useEffect(() => {
    const ws = new TikTokWS({
      onStatus: (st, detail) => { setWsStatus(st); setWsDetail(detail || '') },
      onRaw: () => {},
      // Mở nối xong là xin ngay các event đã lỡ khi rớt mạng.
      onOpen: () => { wsRef.current?.send({ type: 'sync', lastSeq: lastSeqRef.current }) },
      onEvent: (raw) => {
        let obj = raw
        if (typeof raw === 'string') {
          try { obj = JSON.parse(raw) } catch { obj = raw }
        }
        // Áp dụng 1 event: bỏ qua nếu seq đã nhận rồi (tránh tính 2 lần),
        // rồi mới đưa qua bộ chuẩn hóa như event live bình thường.
        const deliver = (item) => {
          if (item && typeof item === 'object' && typeof item.seq === 'number') {
            if (seqTrackerRef.current.seen(item.seq)) return
            lastSeqRef.current = Math.max(lastSeqRef.current, item.seq)
          }
          const norm = normalizeEvent(item)
          const list = Array.isArray(norm) ? norm : [norm]
          for (const ev of list) if (ev) handleEvent(ev)
        }
        // Gói bắt kịp từ connector: { type: 'catchup', events: [...] }
        if (obj && typeof obj === 'object' && obj.type === 'catchup' && Array.isArray(obj.events)) {
          for (const item of obj.events) deliver(item)
          return
        }
        deliver(obj)
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
    const unlock = () => { soundRef.current.ensure(); voiceRef.current?.unlock() }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => { takeSnap() }, [takeSnap])

  // ── Chế độ xem thử ?demo=1: tự bắt đầu trận + tự kéo 2 đội qua lại để
  // xem sân 3D mà không cần live thật. Không có ?demo=1 thì không chạy.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return
    const t1 = setTimeout(() => {
      // Demo: khán giả bình luận tỉnh để vào đội tỉnh đó (đấu tỉnh thành) —
      // 2 tỉnh có nhiều người bình luận nhất sẽ thành 2 đội ở màn đầu.
      joinProvince(stateRef.current, 'hanoi', 'Lan Thử', 'demo-a')
      joinProvince(stateRef.current, 'hcm', 'Hoa Thử', 'demo-a2')
      joinProvince(stateRef.current, 'danang', 'Nam Thử', 'demo-a3')
      joinProvince(stateRef.current, 'hanoi', 'Minh Thử', 'demo-b')
      joinProvince(stateRef.current, 'hcm', 'Linh Thử', 'demo-b2')
      joinProvince(stateRef.current, 'danang', 'Tuấn Thử', 'demo-b3')
      doStart()
      // Tặng ngay 1 món quà to khi bắt đầu (để xem hiệu ứng pháo hoa + BXH).
      engineRef.current.receive({
        id: 'demo-gift-start', giftName: 'hạc giấy',
        nickname: 'Bạn Tặng Thử', userId: 'demo-g1', text: 'A', province: 'hanoi',
      })
    }, 800)
    const powers = [1, 5, 10, 25]
    let n = 0
    // Quà mẫu (đi qua đường quà thật để hiện hiệu ứng + lên BXH): xen kẽ
    // quà nhỏ (hộp quà mở) + quà to (pháo hoa), 3 người tặng thay phiên —
    // mỗi người 1 tỉnh để xem BXH tỉnh thành + tên tỉnh trên hiệu ứng quà.
    const demoGifters = [
      { nickname: 'Bạn Tặng Thử', userId: 'demo-g1', province: 'hanoi' },
      { nickname: 'Hoa Thử', userId: 'demo-g2', province: 'hcm' },
      { nickname: 'Nam Thử', userId: 'demo-g3', province: 'danang' },
    ]
    const demoGifts = ['hoa hồng', 'bing chilling', 'nước hoa', 'hạc giấy']
    const demoLikers = [
      { nickname: 'Bạn Tim Thử', userId: 'demo-l1' },
      { nickname: 'Lan Thử', userId: 'demo-a' },
      { nickname: 'Minh Thử', userId: 'demo-b' },
    ]
    // Có người vào xem live (để hiện toast "vừa vào xem" 2 giây).
    const demoJoiners = ['Bạn Mới', 'Người Xem Mới', 'Khách Lạ']
    const iv = setInterval(() => {
      const s = stateRef.current
      if (!s) return
      // Trận mới reset đội tỉnh về trống → demo vào lại 6 người tỉnh mẫu
      // ở đầu màn (countdown) để màn sau vẫn đấu tỉnh thành, như khán
      // giả thật bình luận tỉnh mới.
      if ((s.phase === 'countdown' || s.phase === 'waiting') && (!s.provinceUsers || !s.provinceUsers['demo-a'])) {
        joinProvince(s, 'hanoi', 'Lan Thử', 'demo-a')
        joinProvince(s, 'hcm', 'Hoa Thử', 'demo-a2')
        joinProvince(s, 'danang', 'Nam Thử', 'demo-a3')
        joinProvince(s, 'hanoi', 'Minh Thử', 'demo-b')
        joinProvince(s, 'hcm', 'Linh Thử', 'demo-b2')
        joinProvince(s, 'danang', 'Tuấn Thử', 'demo-b3')
        syncProvinceTeams(s)
      }
      if (s.phase === 'pulling') {
        const teamId = n % 2 === 0 ? 'A' : 'B'
        const power = powers[Math.floor(Math.random() * powers.length)]
        // Lượt kéo mẫu (không phải quà) → không hiện hiệu ứng quà.
        applyPull(s, teamId, power, { nickname: 'Khán giả thử', userId: `demo-${n}` }, '', { gift: false })
        n++
        // Cứ 6 nhịp thì tặng 1 món quà thật (hiện hiệu ứng + lên BXH).
        if (n % 6 === 0) {
          const g = demoGifters[Math.floor(n / 6) % demoGifters.length]
          const giftName = demoGifts[Math.floor(Math.random() * demoGifts.length)]
          engineRef.current.receive({
            id: `demo-gift-${n}`, giftName,
            nickname: g.nickname, userId: g.userId,
            text: teamId, province: g.province,
          })
        }
        if (n % 7 === 0) {
          const liker = demoLikers[Math.floor(n / 7) % demoLikers.length]
          applyLikes(s, liker.userId, 100, liker.nickname)
        }
        // Cứ 15 nhịp thì có 1 người vào xem (hiện toast 2 giây).
        if (n % 15 === 0) {
          const joiner = demoJoiners[Math.floor(n / 15) % demoJoiners.length]
          handleEvent({ kind: 'join', nickname: joiner, userId: `demo-join-${n}` })
        }
      }
    }, 700)
    return () => { clearTimeout(t1); clearInterval(iv) }
  }, [doStart, handleEvent])

  const toggleMute = useCallback(() => {
    const s = stateRef.current
    s.settings.soundOn = !s.settings.soundOn
    soundRef.current.enabled = s.settings.soundOn
    saveSettings(s.settings)
    setMuted(!s.settings.soundOn)
    takeSnap()
  }, [takeSnap])

  // Thử giọng ngay trên tab màn hình này: cử chỉ chạm ở đây mở khóa âm
  // thanh cho tab này — bấm thử trong Admin thì tab màn hình không có cử
  // chỉ nên iPhone chặn, nghe không thấy gì. Bấm xong hiện toast báo trạng
  // thái giọng máy (mấy giọng / có tiếng Việt không) để chẩn đoán.
  const testVoice = useCallback(() => {
    const info = voiceRef.current?.getVoiceInfo?.() || null
    voiceRef.current?.speakDeviceTest('Hà Nội đang dẫn đầu, thử giọng đọc bình luận!')
    const s = stateRef.current
    if (info) {
      const msg = info.count === 0
        ? '🔇 Máy chưa tải được giọng đọc nào — thử lại sau vài giây.'
        : info.hasVi
          ? `🔊 Đang đọc thử bằng giọng ${info.viName}…`
          : `🔊 Đang đọc thử bằng giọng mặc định của máy (chưa có tiếng Việt).`
      pushToast(s, msg)
      takeSnap()
    }
  }, [takeSnap])

  return {
    stateRef, snap, wsStatus, wsDetail, wsLog, muted,
    start: doStart, toggleMute, testVoice,
    apiConfigured: Boolean(import.meta.env?.VITE_API_URL),
  }
}
