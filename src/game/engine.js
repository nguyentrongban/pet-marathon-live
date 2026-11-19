// ─── KÉO CO LIVE · engine.js ───────────────────────────────────────────────
// Logic thuần của game kéo co 2 đội trên TikTok LIVE. KHÔNG dùng React/Three/DOM
// nên chạy được trực tiếp bằng `node tests/tug.test.js`.
// Thời gian trong engine tính bằng giây (state.now).
// Luật chơi: 2 đội kéo 1 sợi dây qua hố bùn ở giữa. Quà tặng = lực kéo cho
// đội của người tặng (quà càng nhiều xu kéo càng mạnh). Thả tim = tiếp sức
// cho đội đang thua. Đội nào kéo dây qua vạch của mình (hoặc dẫn trước khi
// hết giờ) thì thắng màn. Thắng 3 màn trước thì thắng trận.

// ─── Thú + đội ─────────────────────────────────────────────────────────────
export const PET_TYPES = [
  { id: 'cat',     name: 'Mèo Mun',   color: '#ff9f43', wobble: 0.9 },
  { id: 'dog',     name: 'Chó Vàng',  color: '#b08954', wobble: 1.1 },
  { id: 'rabbit',  name: 'Thỏ Trắng', color: '#f5f0ff', wobble: 1.6 },
  { id: 'beaver',  name: 'Hải Ly',    color: '#e8a04c', wobble: 0.7 },
  { id: 'duck',    name: 'Vịt Con',   color: '#ffd60a', wobble: 1.2 },
  { id: 'panda',   name: 'Gấu Trúc',  color: '#e8e8e8', wobble: 0.8 },
]
export const PET_BY_ID = Object.fromEntries(PET_TYPES.map((p) => [p.id, p]))

export const TEAMS = {
  A: { id: 'A', name: 'Đội Đỏ',  short: 'ĐỎ',  color: '#e03131', emoji: '🔴', pets: ['cat', 'dog', 'rabbit'] },
  B: { id: 'B', name: 'Đội Xanh', short: 'XANH', color: '#1971c2', emoji: '🔵', pets: ['beaver', 'duck', 'panda'] },
}
export const TEAM_IDS = ['A', 'B']
export function teamOfPet(petId) {
  return TEAMS.A.pets.includes(petId) ? 'A' : 'B'
}
export function otherTeam(teamId) { return teamId === 'A' ? 'B' : 'A' }

// ─── Quà TikTok → lực kéo ──────────────────────────────────────────────────
// Giá xu thật (bảng quà TikTok, chỉ quà dưới 100 xu). Xu càng cao kéo càng
// mạnh: 1 xu = 1, 5 xu = 3, 10 xu = 6, 20 xu = 12, 99 xu = 30 lực kéo.
export const DEFAULT_GIFT_MAP = {
  // 1 xu → kéo nhẹ
  'hoa hồng': 1, rose: 1,
  'kem ốc quế': 1, 'ice cream': 1,
  'nhịp trống mirwas': 1, mirwas: 1,
  'nhạc tự do': 1, 'nhạc xưa': 1, 'thả tim cho tôi': 1, 'tiktok': 1, 'đỉnh': 1, 'gg': 1,
  // 5 xu → kéo vừa
  'bing chilling': 3,
  'quả đào': 3, peach: 3,
  'phản ứng quá lố': 3, 'trái bóng xoáy': 3, 'bắn tim': 3, 'finger heart': 3, 'ok': 3,
  // 10 xu → kéo mạnh
  'rosa': 6,
  'cỏ bốn lá': 6, 'four-leaf clover': 6, clover: 6,
  // 20 xu → kéo rất mạnh
  'nước hoa': 12, perfume: 12,
  'little kisses': 12,
  // 99 xu → kéo cực mạnh
  'hạc giấy': 30, 'paper crane': 30,
}

// Quà cũ (bản đua thú) lưu chiêu dạng chữ ('banana', 'ice'...) — đổi sang lực
// kéo tương đương để cài đặt cũ của streamer không bị hỏng.
const OLD_ABILITY_POWER = {
  banana: 1, ice: 3, glove: 6, net: 6, melon: 12, heal: 12,
  dizzy: 30, rocket: 6, shield: 6, magnet: 6,
}
export function migrateGiftMap(map) {
  const out = {}
  for (const [k, v] of Object.entries(map || {})) {
    if (typeof v === 'number') out[k] = v
    else if (typeof v === 'string' && OLD_ABILITY_POWER[v] != null) out[k] = OLD_ABILITY_POWER[v]
    else if (typeof v === 'string') out[k] = 1
  }
  return out
}

// ─── Icon khớp với quà trên TikTok ──────────────────────────────────────────
export const GIFT_ICONS = {
  'hoa hồng': '🌹', rose: '🌹', hoa: '🌸',
  'kem': '🍦', 'ice cream': '🍦',
  'dưa hấu': '🍉', watermelon: '🍉',
  'găng tay': '🥊', boxing: '🥊', găng: '🥊',
  'lưới': '🕸️',
  'bom': '💣',
  'tên lửa': '🚀', rocket: '🚀',
  'khiên': '🛡️', shield: '🛡️',
  'thuốc': '🧪', potion: '🧪',
  'nam châm': '🧲', magnet: '🧲',
  'bánh': '🎂', cake: '🎂', 'bánh kem': '🎂',
  'bóng bay': '🎈', balloon: '🎈',
  'tim': '❤️', heart: '❤️',
  'ngôi sao': '⭐', star: '⭐',
  'vương miện': '👑', crown: '👑',
  'xe hơi': '🚗', car: '🚗',
  'kẹo': '🍬', candy: '🍬',
  'trà sữa': '🧋', 'cà phê': '☕', coffee: '☕',
  'mèo': '🐱', 'gấu': '🧸',
  'kem ốc quế': '🍦', 'ice cream': '🍦', 'bing chilling': '🍦',
  'quả đào': '🍑', peach: '🍑',
  'hạc giấy': '🕊️', 'paper crane': '🕊️',
  'nhịp trống mirwas': '🥁', mirwas: '🥁',
  'ok': '👌',
  'phản ứng quá lố': '🤪',
  'trái bóng xoáy': '⚽',
  'bắn tim': '🫰', 'finger heart': '🫰',
  'nhạc tự do': '🎵', 'nhạc xưa': '📻',
  'thả tim cho tôi': '❤️',
  'gg': '🎮',
  'tiktok': '🎵',
  'đỉnh': '🐱',
  'rosa': '🌹',
  'cỏ bốn lá': '🍀', 'four-leaf clover': '🍀', clover: '🍀',
  'nước hoa': '🧴', perfume: '🧴',
  'little kisses': '💋',
}
export function giftIcon(giftName) {
  if (!giftName) return '🎁'
  return GIFT_ICONS[GiftEngine.normGiftName(giftName)] || '🎁'
}

// Giá xu thật của quà TikTok (theo bảng quà TikTok), chỉ quà dưới 100 xu.
export const GIFT_PRICES = {
  'hoa hồng': 1, rose: 1,
  'kem ốc quế': 1, 'ice cream': 1,
  'nhịp trống mirwas': 1, mirwas: 1,
  'nhạc tự do': 1, 'nhạc xưa': 1, 'thả tim cho tôi': 1, 'gg': 1, 'tiktok': 1, 'đỉnh': 1,
  'bing chilling': 5, 'quả đào': 5, peach: 5, 'ok': 5,
  'phản ứng quá lố': 5, 'trái bóng xoáy': 5, 'bắn tim': 5, 'finger heart': 5,
  'rosa': 10, 'cỏ bốn lá': 10, 'four-leaf clover': 10, clover: 10,
  'nước hoa': 20, perfume: 20, 'little kisses': 20,
  'hạc giấy': 99, 'paper crane': 99,
}
export function giftPrice(giftName) {
  if (!giftName) return null
  const p = GIFT_PRICES[GiftEngine.normGiftName(giftName)]
  return p == null ? null : p
}
// Xu càng cao kéo càng mạnh (theo giá quà TikTok).
export function giftTier(coins) {
  if (coins == null) return ''
  if (coins <= 1) return 'Kéo nhẹ'
  if (coins <= 5) return 'Kéo vừa'
  if (coins <= 20) return 'Kéo mạnh'
  return 'Kéo cực mạnh'
}

// ─── Cài đặt mặc định (Admin sửa được) ─────────────────────────────────────
export const DEFAULT_SETTINGS = {
  roundSeconds: 45,          // 1 màn kéo tối đa 45 giây
  countdownSeconds: 3,
  winsToMatch: 3,            // thắng 3 màn trước thì thắng trận
  winLine: 0.9,              // dây chạm ±0,9 là thắng màn ngay
  pullK: 0.02,               // 1 lực kéo = dây nhích 0,02 (quà 1 xu)
  ropeDecay: 0.04,           // dây tự trôi về giữa 4%/giây — phải tặng liên tục mới thắng
  comebackAt: 0.55,          // đội thua quá 0,55 thì vào "cơ hội cuối"
  comebackMult: 2,           // ... quà của đội thua nhân đôi lực kéo
  globalPullIntervalSec: 0.5, // tối đa 1 lượt kéo / 0,5 giây toàn trận (còn lại xếp hàng)
  likeBoostEvery: 100,       // mỗi 100 tim → tiếp sức đội đang thua
  likeBoostPower: 0.06,      // ... đẩy dây 0,06 về phía đội thua
  giftMap: { ...DEFAULT_GIFT_MAP },
  streamerId: '',
  soundOn: true,
}

export const BALANCE_NOTE =
  'Cân bằng: dây tự trôi về giữa nên một món quà không quyết định được màn — ' +
  'phải tặng liên tục mới kéo đối thủ xuống bùn. Đội đang thua được nhân đôi ' +
  'lực kéo (cơ hội cuối) và tim khán giả cũng tiếp sức cho đội thua, nên màn ' +
  'nào cũng có thể lật kèo vào phút chót.'

// ─── Trạng thái trận đấu ────────────────────────────────────────────────────
let uidCounter = 1
export function nextId(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${uidCounter++}` }

export function makeTeamState(teamId) {
  return {
    id: teamId, members: [], totalPull: 0, roundWins: 0,
    pullRate: 0, // tốc độ kéo gần đây (cho 3D nghiêng người) — tự giảm dần
    lastPullAt: -999,
  }
}

export function createMatch(settings = DEFAULT_SETTINGS) {
  return {
    phase: 'waiting', // waiting | countdown | pulling | roundEnd | matchEnd
    now: 0, countdown: 0, roundTimeLeft: 0, matchId: nextId('match'),
    rope: 0, // -1 (Xanh thắng) … 0 (giữa) … +1 (Đỏ thắng)
    teams: { A: makeTeamState('A'), B: makeTeamState('B') },
    round: 1, roundWinner: null, matchWinner: null,
    luckyStar: null, // { team } — đội thắng màn trước được bắt đầu màn sau lệch 0,12 về phía mình
    feed: [], floaters: [], effects: [],
    likes: 0, likeAcc: 0, nextRoundIn: 0, matchEndIn: 0,
    settings: { ...settings },
    stats: { gifts: 0, pulls: 0 },
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function pushFeed(state, kind, text) {
  state.feed.push({ id: nextId('feed'), kind, text, at: state.now })
  if (state.feed.length > 40) state.feed.splice(0, state.feed.length - 40)
}
export function pushFloater(state, teamId, text) {
  state.floaters.push({ id: nextId('fl'), team: teamId, text, at: state.now })
  if (state.floaters.length > 12) state.floaters.shift()
}

// ─── Vào đội ───────────────────────────────────────────────────────────────
// Bình luận "A" / "ĐỎ" → Đội Đỏ; "B" / "XANH" → Đội Xanh; tên thú → đội của
// thú đó; "THAM GIA" / "JOIN" → đội đang ít người hơn (cho cân).
export function parseTeamJoin(comment) {
  if (!comment) return null
  const flat = String(comment).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!flat) return null
  const tokens = flat.split(' ')
  const has = (...words) => words.some((w) => tokens.includes(w))
  // "THAM GIA" / "JOIN" → đội đang ít người hơn. Chỉ tính đúng cụm từ
  // (tránh nhận nhầm "tham khảo", "vào xem"...).
  if (flat === 'THAM GIA' || flat.startsWith('THAM GIA ') || tokens.includes('THAMGIA') || tokens.includes('JOIN')) return 'balance'
  // "ĐỘI A" / "TEAM B" → rõ ràng, dài cũng tính.
  if ((has('DOI') || has('TEAM') || has('NHOM')) && has('A')) return 'A'
  if ((has('DOI') || has('TEAM') || has('NHOM')) && has('B')) return 'B'
  // Còn lại chỉ tính khi bình luận ngắn (≤2 từ) — tránh nhận nhầm câu thường
  // như "cho em hỏi" (chữ CHO trùng tên Chó) hay "a ơi" (chữ A).
  if (tokens.length > 2) return null
  if (has('XANH', 'B', 'BLUE')) return 'B'
  if (has('DO', 'A', 'RED')) return 'A'
  if (has('MEO', 'CHO', 'THO', 'CAT', 'DOG', 'RABBIT', 'BUNNY')) return 'A'
  if (has('HAI', 'HAILY', 'VIT', 'GAU', 'BEAVER', 'DUCK', 'PANDA')) return 'B'
  return null
}

export function joinTeam(state, teamId, nickname, userId) {
  if (teamId === 'balance') {
    teamId = state.teams.A.members.length <= state.teams.B.members.length ? 'A' : 'B'
  }
  if (teamId !== 'A' && teamId !== 'B') return { ok: false, reason: 'no-team' }
  // 1 người chỉ ở 1 đội — đã vào đội nào thì không vào thêm đội kia.
  if (userId && findMember(state, userId)) return { ok: false, reason: 'already', teamId: findMember(state, userId).teamId }
  const team = state.teams[teamId]
  if (team.members.length >= 100) return { ok: false, reason: 'full', teamId }
  const member = { nickname, userId: userId || '', teamId, pulls: 0, gifts: 0 }
  team.members.push(member)
  pushFeed(state, 'join', `${TEAMS[teamId].emoji} ${nickname} vào ${TEAMS[teamId].name}!`)
  return { ok: true, teamId, member }
}

export function findMember(state, userId) {
  if (!userId) return null
  for (const t of TEAM_IDS) {
    const m = state.teams[t].members.find((x) => x.userId === userId)
    if (m) return m
  }
  return null
}

// Đội nhận lực kéo từ 1 món quà: ưu tiên chữ kèm theo quà ("A"/"B"), rồi đội
// của người tặng, cuối cùng là đội đang thua (tiếp sức cho kẻ yếu).
export function giftTeam(state, userId, textHint) {
  const hint = parseTeamJoin(textHint)
  if (hint === 'A' || hint === 'B') return hint
  const member = findMember(state, userId)
  if (member) return member.teamId
  if (state.rope > 0.05) return 'B'
  if (state.rope < -0.05) return 'A'
  return state.teams.A.members.length <= state.teams.B.members.length ? 'A' : 'B'
}

// ─── Lực kéo ───────────────────────────────────────────────────────────────
// Quà to kéo mạnh nhưng có giới hạn: trên 10 lực thì phần vượt chỉ tính một
// nửa, tối đa 20 lực / 1 món — 1 con hạc giấy không thể thắng màn trong 1 nốt.
export function pullEffect(power) {
  let e = power <= 10 ? power : 10 + (power - 10) * 0.5
  return Math.min(20, Math.max(0, e))
}

export function applyPull(state, teamId, power, sender = {}) {
  const now = state.now
  if (state.phase !== 'pulling') return { ok: false, blocked: 'not-pulling' }
  if (teamId !== 'A' && teamId !== 'B') return { ok: false, blocked: 'no-team' }
  const team = state.teams[teamId]
  const dir = teamId === 'A' ? 1 : -1
  // Cơ hội cuối: đội đang thua quá vạch thì quà nhân đôi lực kéo.
  const losing = (teamId === 'A' && state.rope < -state.settings.comebackAt)
    || (teamId === 'B' && state.rope > state.settings.comebackAt)
  const effect = pullEffect(power) * (losing ? state.settings.comebackMult : 1)
  state.rope = clamp(state.rope + dir * effect * state.settings.pullK, -1, 1)
  team.totalPull += effect
  team.pullRate += effect
  team.lastPullAt = now
  const member = findMember(state, sender.userId)
  if (member) { member.pulls += effect; member.gifts += 1 }
  state.stats.pulls++
  state.stats.gifts++
  const senderName = sender.nickname || 'Khán giả'
  const big = effect >= 12
  pushFeed(state, 'pull',
    `${TEAMS[teamId].emoji} ${senderName} kéo ${big ? 'CỰC MẠNH' : 'một phát'} cho ${TEAMS[teamId].name}!${losing ? ' (cơ hội cuối ×2)' : ''}`)
  pushFloater(state, teamId, big ? '💪 KÉO CỰC MẠNH!' : '💪 +KÉO!')
  state.effects.push({ id: nextId('fx'), kind: 'pull', team: teamId, t: 0, dur: 0.6 })
  return { ok: true, teamId, effect, comeback: losing }
}

// Thả tim: đủ 100 tim thì tiếp sức cho đội đang thua (đẩy dây về phía họ).
export function applyLikeBoost(state, count) {
  state.likes += count
  const every = state.settings.likeBoostEvery || 100
  let boosted = 0
  while (state.likeAcc + count >= every) {
    count -= (every - state.likeAcc)
    state.likeAcc = 0
    boosted++
  }
  state.likeAcc += count
  let applied = 0
  for (let i = 0; i < boosted; i++) {
    if (state.phase !== 'pulling') continue
    const losingTeam = state.rope > 0.05 ? 'B' : state.rope < -0.05 ? 'A' : null
    if (!losingTeam) continue
    const dir = losingTeam === 'A' ? 1 : -1
    state.rope = clamp(state.rope + dir * state.settings.likeBoostPower, -1, 1)
    state.teams[losingTeam].pullRate += 2
    applied++
    pushFeed(state, 'like', `❤️ Đủ ${every} tim: ${TEAMS[losingTeam].name} được tiếp sức!`)
  }
  return applied
}

// ─── Màn / trận ────────────────────────────────────────────────────────────
export function startMatch(state) {
  state.teams.A.roundWins = 0
  state.teams.B.roundWins = 0
  state.teams.A.totalPull = 0
  state.teams.B.totalPull = 0
  state.round = 1
  state.matchWinner = null
  state.luckyStar = null
  startRound(state)
  pushFeed(state, 'info', '🪢 Trận kéo co mới bắt đầu! Bình luận A (Đỏ) hoặc B (Xanh) để chọn đội!')
}

export function startRound(state) {
  state.rope = 0
  if (state.luckyStar) {
    // Đội thắng màn trước được bắt đầu màn sau lệch 0,12 về phía mình.
    state.rope = state.luckyStar.team === 'A' ? 0.12 : -0.12
  }
  state.roundWinner = null
  state.phase = 'countdown'
  state.countdown = state.settings.countdownSeconds
  state.roundTimeLeft = state.settings.roundSeconds
  state.effects = []
  pushFeed(state, 'info', `🏁 Màn ${state.round} — chuẩn bị… 3 — 2 — 1!`)
}

export function endRound(state, winnerTeamId) {
  const winner = winnerTeamId ? TEAMS[winnerTeamId] : null
  state.roundWinner = winnerTeamId
  state.phase = 'roundEnd'
  state.nextRoundIn = 8
  if (winnerTeamId) {
    state.teams[winnerTeamId].roundWins++
    state.luckyStar = { team: winnerTeamId }
    state.effects.push({ id: nextId('fx'), kind: 'confetti', team: winnerTeamId, t: 0, dur: 2.5 })
    state.effects.push({ id: nextId('fx'), kind: 'splash', team: otherTeam(winnerTeamId), t: 0, dur: 1.5 })
    pushFeed(state, 'win', `${winner.emoji} ${winner.name} thắng màn ${state.round}! Tỉ số ${state.teams.A.roundWins}–${state.teams.B.roundWins}`)
  } else {
    pushFeed(state, 'info', `🤝 Màn ${state.round} hòa! Không đội nào thắng.`)
  }
  if (winnerTeamId && state.teams[winnerTeamId].roundWins >= state.settings.winsToMatch) {
    state.phase = 'matchEnd'
    state.matchWinner = winnerTeamId
    state.matchEndIn = 15
    state.effects.push({ id: nextId('fx'), kind: 'confetti', team: winnerTeamId, t: 0, dur: 4 })
    pushFeed(state, 'win', `🏆 ${winner.name} VÔ ĐỊCH TRẬN ĐẤU! (${state.teams.A.roundWins}–${state.teams.B.roundWins})`)
  }
}

// ─── Vòng lặp chính (gọi mỗi khung hình với dt giây) ───────────────────────
export function tick(state, dt) {
  dt = clamp(dt, 0, 0.1)
  state.now += dt
  state.floaters = state.floaters.filter((f) => state.now - f.at < 2.2)
  state.effects = state.effects.filter((e) => { e.t += dt; return e.t < e.dur })
  for (const t of TEAM_IDS) {
    // Tốc độ kéo gần đây giảm dần để 3D biết lúc nào thú đang gồng sức.
    state.teams[t].pullRate *= Math.exp(-2.5 * dt)
  }

  if (state.phase === 'countdown') {
    state.countdown -= dt
    if (state.countdown <= 0) {
      state.phase = 'pulling'
      pushFeed(state, 'info', '🪢 KÉO!!!')
    }
    return
  }
  if (state.phase === 'roundEnd') {
    state.nextRoundIn -= dt
    if (state.nextRoundIn <= 0) {
      state.round++
      startRound(state)
    }
    return
  }
  if (state.phase === 'matchEnd') {
    state.matchEndIn -= dt
    if (state.matchEndIn <= 0) startMatch(state)
    return
  }
  if (state.phase !== 'pulling') return

  state.roundTimeLeft -= dt
  // Dây tự trôi về giữa — phải tặng liên tục mới giữ được lợi thế.
  state.rope *= Math.exp(-state.settings.ropeDecay * dt)
  if (Math.abs(state.rope) >= state.settings.winLine) {
    endRound(state, state.rope > 0 ? 'A' : 'B')
    return
  }
  if (state.roundTimeLeft <= 0) {
    if (state.rope > 0.05) endRound(state, 'A')
    else if (state.rope < -0.05) endRound(state, 'B')
    else endRound(state, null)
  }
}

// ─── Tiến thời gian thực ────────────────────────────────────────────────────
// tick() tự cắt dt > 0,1s nên gọi thẳng với dt lớn (tab nền bị bóp timer)
// sẽ làm trận chậm lại. advance() chia dt lớn thành bước ≤0,1s để trận tiến
// đúng theo thời gian thực dù tab ở nền.
export function advance(state, dt) {
  if (!(dt > 0)) return
  if (dt > 5) dt = 5 // tab ngủ dài: cắt để khỏi nhảy cóc
  let rem = dt
  while (rem > 1e-9) {
    const d = Math.min(rem, 0.1)
    tick(state, d)
    rem -= d
  }
}

// ─── Gift Engine: chống trùng, xếp hàng, giới hạn tốc độ toàn cục ──────────
// Không bao giờ tự bịa event: chỉ xử lý event thật từ WebSocket / Admin thử.
export class GiftEngine {
  constructor(state, applyFn) {
    this.state = state
    this.applyFn = applyFn || ((power, sender, teamId) => applyPull(state, teamId, power, sender))
    this.seen = new Set()
    this.seenOrder = []
    this.queue = []
    this.lastProcessedAt = -999
    this.droppedDuplicates = 0
    this.droppedUnmapped = 0
  }
  // Chuẩn hóa tên quà để so khớp bảng map (không phân biệt hoa/thường, khoảng trắng, dấu)
  static normGiftName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
  }
  static stripGiftName(name) {
    return GiftEngine.normGiftName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  }
  resolveGift(giftName) {
    const rawMap = this.state.settings.giftMap || {}
    const map = migrateGiftMap(rawMap)
    const norm = GiftEngine.normGiftName(giftName)
    if (map[norm] != null) return map[norm]
    const stripped = GiftEngine.stripGiftName(giftName)
    for (const [k, v] of Object.entries(map)) {
      if (GiftEngine.stripGiftName(k) === stripped) return v
    }
    for (const [k, v] of Object.entries(map)) {
      if (norm.includes(k) || k.includes(norm)) return v
    }
    return null
  }
  // Nhận 1 event quà đã chuẩn hóa: { id?, giftName, nickname, userId, text? }
  receive(ev) {
    if (!ev || !ev.giftName) return { ok: false, reason: 'no-gift' }
    const id = ev.id || `${ev.userId || ''}:${ev.giftName}:${ev.at || ''}`
    if (this.seen.has(id)) { this.droppedDuplicates++; return { ok: false, reason: 'duplicate' } }
    this.seen.add(id)
    this.seenOrder.push(id)
    if (this.seenOrder.length > 1000) { const old = this.seenOrder.shift(); this.seen.delete(old) }
    const power = this.resolveGift(ev.giftName)
    if (power == null) { this.droppedUnmapped++; return { ok: false, reason: 'unmapped', giftName: ev.giftName } }
    const teamId = giftTeam(this.state, ev.userId, ev.text || '')
    this.queue.push({ power, sender: { nickname: ev.nickname, userId: ev.userId }, teamId, at: this.state.now })
    if (this.queue.length > 50) this.queue.shift() // hàng đợi đầy: bỏ lượt cũ nhất
    return { ok: true, queued: true, power, teamId }
  }
  // Xử lý hàng đợi theo giới hạn toàn cục (tối đa 1 lượt kéo / globalPullIntervalSec).
  // Chưa vào màn kéo thì giữ nguyên hàng đợi — quà tặng trước giờ G vẫn tính.
  process(now = this.state.now) {
    const interval = this.state.settings.globalPullIntervalSec ?? 0.5
    if (!this.queue.length) return null
    if (this.state.phase !== 'pulling') return { ok: false, reason: 'not-pulling', queued: this.queue.length }
    if (now - this.lastProcessedAt < interval) return { ok: false, reason: 'rate-limited', queued: this.queue.length }
    const job = this.queue.shift()
    this.lastProcessedAt = now
    const res = this.applyFn(job.power, job.sender, job.teamId)
    return { ...res, queued: this.queue.length }
  }
  get queueLength() { return this.queue.length }
}
