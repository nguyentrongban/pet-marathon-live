// ─── KÉO CO LIVE · engine.js ───────────────────────────────────────────────
// Logic thuần của game kéo co 2 đội trên TikTok LIVE. KHÔNG dùng React/Three/DOM
// nên chạy được trực tiếp bằng `node tests/tug.test.js`.
// Thời gian trong engine tính bằng giây (state.now).
// LUẬT CHƠI (v2 — số đông vs tiền quà, tim = thời gian):
// · Mỗi người bình luận A/B vào đội là +1 lực kéo LIÊN TỤC cho đội đó —
//   đội đông người kéo mạnh hơn, 100 người thì đội 1 người chắc chắn thua.
// · Quà tặng là cú BÙNG sức mạnh (tắt dần sau vài giây): hạc giấy 99 xu =
//   100 lực, bằng 100 người — 1 món quà to đủ để kéo ngang đội đông.
// · Thả tim KHÔNG kéo dây nữa: 1 người thả đủ 100 tim thì màn kéo dài
//   thêm 10 giây (tối đa +60 giây/màn).
// · Đội thua quá nửa đường được ×2 (cơ hội cuối); 10 giây cuối quà ×2
//   (giờ chót). Thắng 2 màn trước thì vô địch trận (best of 3 — tối đa 3
//   màn, 2–1 là vô địch), chuỗi thắng giữ qua trận.
// · Tỉnh thành: quà tính theo tỉnh của người tặng — tỉnh dẫn đầu được
//   thưởng thêm lực kéo (×1,5) để khán giả tặng quà đưa tỉnh mình lên số 1.

import { regionInfo } from './regions.js'

// ─── Người chơi + đội ───────────────────────────────────────────────────────
// 6 người thật (model 3D): Đội Đỏ = Anh Hùng (lính), Kaito (võ sĩ), Mia;
// Đội Xanh = Lan, Hương (2 chị em), Bình (lính). Bình luận tên người để
// vào đội của người đó.
export const MEMBER_TYPES = [
  { id: 'soldier',  name: 'Anh Hùng', color: '#8a9a5b', wobble: 0.9 },
  { id: 'player',   name: 'Miyo',     color: '#5b7a8a', wobble: 1.1 },
  { id: 'michelle', name: 'Mia',      color: '#e8a0b4', wobble: 1.6 },
  { id: 'casual',   name: 'Lan',      color: '#e8a04c', wobble: 0.7 },
  { id: 'casual2',  name: 'Hương',    color: '#b48ae8', wobble: 1.2 },
  { id: 'soldierB', name: 'Bình',     color: '#8a8a8a', wobble: 0.8 },
]
export const MEMBER_BY_ID = Object.fromEntries(MEMBER_TYPES.map((p) => [p.id, p]))

export const TEAMS = {
  A: { id: 'A', name: 'Đội Đỏ',  short: 'ĐỎ',  color: '#e03131', emoji: '🔴', members: ['soldier', 'player', 'michelle'] },
  B: { id: 'B', name: 'Đội Xanh', short: 'XANH', color: '#1971c2', emoji: '🔵', members: ['casual', 'casual2', 'soldierB'] },
}
export const TEAM_IDS = ['A', 'B']
export function teamOfMember(memberId) {
  return TEAMS.A.members.includes(memberId) ? 'A' : 'B'
}
export function otherTeam(teamId) { return teamId === 'A' ? 'B' : 'A' }

// ─── Quà TikTok → lực kéo ──────────────────────────────────────────────────
// Giá xu thật (bảng quà TikTok, chỉ quà dưới 100 xu). Quà là cú bùng sức
// mạnh — 1 món quà to bằng cả đám đông: 99 xu = 100 lực = 100 người.
// 1 xu = 1, 5 xu = 5, 10 xu = 10, 20 xu = 25, 99 xu = 100 lực kéo.
export const DEFAULT_GIFT_MAP = {
  // 1 xu → bùng nhẹ
  'hoa hồng': 1, rose: 1,
  'kem ốc quế': 1, 'ice cream': 1,
  'nhịp trống mirwas': 1, mirwas: 1,
  'nhạc tự do': 1, 'nhạc xưa': 1, 'thả tim cho tôi': 1, 'tiktok': 1, 'đỉnh': 1, 'gg': 1,
  // 5 xu → bùng vừa
  'bing chilling': 5,
  'quả đào': 5, peach: 5,
  'phản ứng quá lố': 5, 'trái bóng xoáy': 5, 'bắn tim': 5, 'finger heart': 5, 'ok': 5,
  // 10 xu → bùng mạnh
  'rosa': 10,
  'cỏ bốn lá': 10, 'four-leaf clover': 10, clover: 10,
  // 20 xu → bùng rất mạnh
  'nước hoa': 25, perfume: 25,
  'little kisses': 25,
  // 99 xu → bùng cực mạnh = 100 người
  'hạc giấy': 100, 'paper crane': 100,
}

// Quà cũ (bản đua thú) lưu chiêu dạng chữ ('banana', 'ice'...) — đổi sang lực
// kéo tương đương để cài đặt cũ của streamer không bị hỏng.
const OLD_ABILITY_POWER = {
  banana: 1, ice: 5, glove: 10, net: 10, melon: 25, heal: 25,
  dizzy: 100, rocket: 10, shield: 10, magnet: 10,
}
// Bảng lực kéo đổi v2 (2026-11-19): 1/3/6/12/30 → 1/5/10/25/100. Cài đặt
// cũ trên máy streamer còn lưu giá trị mặc định cũ thì đổi sang giá trị
// mới; quà nào chỉnh tay khác giá trị cũ thì giữ nguyên.
const OLD_TO_NEW_POWER = { 3: 5, 6: 10, 12: 25, 30: 100 }
export function migrateGiftMap(map) {
  const out = {}
  for (const [k, v] of Object.entries(map || {})) {
    if (typeof v === 'number') {
      const isDefaultGift = DEFAULT_GIFT_MAP[k] != null
      out[k] = isDefaultGift && OLD_TO_NEW_POWER[v] != null ? OLD_TO_NEW_POWER[v] : v
    }
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
  if (coins <= 10) return 'Kéo mạnh'
  if (coins <= 20) return 'Kéo rất mạnh'
  return 'Kéo cực mạnh'
}

// ─── Cài đặt mặc định (Admin sửa được) ─────────────────────────────────────
export const DEFAULT_SETTINGS = {
  roundSeconds: 45,          // 1 màn kéo tối đa 45 giây (chưa tính tim cộng thêm)
  countdownSeconds: 3,
  winsToMatch: 2,            // thắng 2 màn trước thì thắng trận (best of 3 — tối đa 3 màn)
  winLine: 0.7,              // vạch giữa chạm ±0,7 (cờ chạy qua ~84% thước) là thắng màn ngay — xa hơn 0,5 để màn kéo lâu hơn, gay cấn hơn (0,9 thì xa quá, hay phải chờ hết giờ)
  ropeSpeed: 0.15,           // tốc độ vạch giữa tối đa — 1 phe áp đảo hoàn toàn thì vạch chạy 0,15/giây
  ropeDecay: 0.02,           // dây tự trôi nhẹ về giữa 2%/giây
  boostDecay: 0.2,           // quà tặng tắt dần — bùng lực giảm một nửa sau ~3,5 giây
  comebackAt: 0.55,          // đội thua quá 0,55 thì vào "cơ hội cuối"
  comebackMult: 2,           // ... quà của đội thua nhân đôi lực kéo
  globalPullIntervalSec: 0.5, // tối đa 1 lượt kéo / 0,5 giây toàn trận (còn lại xếp hàng)
  likeTimeEvery: 100,        // 1 người thả đủ 100 tim → +thời gian kéo
  likeTimeSeconds: 10,       // ... +10 giây
  likeTimeMaxBonus: 60,      // ... tối đa +60 giây / màn
  finalSeconds: 10,          // 10 giây cuối là "giờ chót"
  finalGiftMult: 2,          // ... quà tặng trong giờ chót nhân đôi lực kéo
  provinceLeaderMult: 1.5,    // tỉnh dẫn đầu BXH tỉnh thành: quà của tỉnh đó ×1,5 lực kéo
  giftMap: { ...DEFAULT_GIFT_MAP },
  streamerId: '',
  soundOn: true,
  voiceOn: true,            // giọng đọc bình luận (FPT.AI, hết lượt thì tự chuyển giọng máy)
  voice: 'banmai',          // giọng FPT.AI mặc định: Ban Mai — nữ, miền Bắc
}

export const BALANCE_NOTE =
  'Cân bằng: mỗi người vào đội là +1 lực kéo liên tục — đội đông người ' +
  'kéo mạnh hơn, 100 người thì đội 1 người chắc chắn thua. Quà tặng là cú ' +
  'bùng sức mạnh (tắt dần sau vài giây): hạc giấy 99 xu = 100 lực, bằng ' +
  '100 người — 1 món quà to đủ để kéo ngang đội đông. Tim không kéo dây ' +
  'nữa: 1 người thả đủ 100 tim thì màn kéo dài thêm 10 giây (tối đa +60 ' +
  'giây/màn). 10 giây cuối quà ×2, đội thua quá nửa đường cũng ×2 (cơ hội ' +
  'cuối), nên màn nào cũng có thể lật kèo vào phút chót.'

// ─── Trạng thái trận đấu ────────────────────────────────────────────────────
let uidCounter = 1
export function nextId(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${uidCounter++}` }

export function makeTeamState(teamId) {
  return {
    id: teamId, members: [], totalPull: 0, roundWins: 0,
    boost: 0, // lực bùng từ quà tặng — tắt dần theo boostDecay
    pullRate: 0, // sức mạnh hiện tại = số người + bùng quà (cho 3D nghiêng người)
    lastPullAt: -999,
  }
}

// Sức mạnh đội = số người (mỗi người +1, kéo liên tục) + bùng quà (tắt dần).
export function teamStrength(state, teamId) {
  const team = state.teams[teamId]
  return team.members.length + team.boost
}

export function createMatch(settings = DEFAULT_SETTINGS) {
  return {
    phase: 'waiting', // waiting | countdown | pulling | roundEnd | matchEnd
    now: 0, countdown: 0, roundTimeLeft: 0, matchId: nextId('match'),
    rope: 0, // -1 (Xanh thắng) … 0 (giữa) … +1 (Đỏ thắng)
    teams: { A: makeTeamState('A'), B: makeTeamState('B') },
    round: 1, roundWinner: null, matchWinner: null,
    luckyStar: null, // { team } — đội thắng màn trước được bắt đầu màn sau lệch 0,12 về phía mình
    streak: { A: 0, B: 0 }, // chuỗi thắng trận liên tiếp của mỗi đội (giữ qua trận)
    feed: [], floaters: [], effects: [],
    likes: 0, likesInRound: 0, timeAddedByLikes: 0, finalTime: false,
    // BXH (lưu lại qua các màn/trận — chỉ xóa khi streamer bấm Xóa BXH):
    // giftTotals: userId → { nickname, power, coins, count, avatar }
    // likeTotals: userId → { nickname, likes, avatar }
    // provinceTotals: mã tỉnh → { code, power, count, lastGiver }
    giftTotals: {}, likeTotals: {}, provinceTotals: {},
    // Tỉnh mỗi người đã chọn (bình luận tên tỉnh): userId → mã tỉnh.
    userProvince: {},
    // Người ủng hộ từng tỉnh (để chọn 2 đội đấu): userId → { nickname, avatar, province, joinedAt }.
    provinceUsers: {},
    // 2 tỉnh đang đấu (mã tỉnh cho đội A/B; null = chưa đủ 2 tỉnh → đội Đỏ/Xanh thường).
    provinceTeams: { A: null, B: null },
    nextRoundIn: 0, matchEndIn: 0,
    // Chờ streamer ấn bắt đầu màn sau: true = đang chờ bắt đầu màn tiếp
    // theo của trận đang đấu (hết màn thì hiện bảng hướng dẫn, streamer
    // xem đủ người rồi ấn bắt đầu); false = chờ bắt đầu trận mới.
    waitingNextRound: false,
    // Camera quay cận khi có quà to (≥25 lực): { teamId, at } — đội được
    // tặng + lúc tặng (theo state.now, giây); null = không quay.
    giftCam: null,
    settings: { ...settings },
    stats: { gifts: 0, pulls: 0 },
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ─── BXH: ai tặng quà nhiều nhất / thả tim nhiều nhất ──────────────────────
// Tính theo TỔNG CẢ PHIÊN (không tính lại theo màn) để bảng nhỏ ở góc trái
// màn hình luôn có người đứng đầu. Lưu lại bằng localStorage ở màn hiển
// thị (xem useTugOfWar) nên tải lại trang vẫn còn.
export function recordGift(state, userId, nickname, power, coins = 0, avatar = '') {
  const uid = userId || 'anon'
  const cur = state.giftTotals[uid] || { nickname: nickname || uid, power: 0, coins: 0, count: 0, avatar: avatar || '' }
  cur.nickname = nickname || cur.nickname
  if (avatar) cur.avatar = avatar
  cur.power += power || 0
  cur.coins += coins || 0
  cur.count += 1
  state.giftTotals[uid] = cur
  return cur
}
export function recordLike(state, userId, nickname, count, avatar = '') {
  const uid = userId || 'anon'
  const cur = state.likeTotals[uid] || { nickname: nickname || uid, likes: 0, avatar: avatar || '' }
  cur.nickname = nickname || cur.nickname
  if (avatar) cur.avatar = avatar
  cur.likes += count || 0
  state.likeTotals[uid] = cur
  return cur
}
// Top N người tặng quà nhiều nhất (theo tổng lực kéo từ quà).
export function topGifters(state, n = 3) {
  return Object.values(state.giftTotals || {})
    .sort((a, b) => b.power - a.power)
    .slice(0, n)
}
// Top N người thả tim nhiều nhất (theo tổng tim).
export function topLikers(state, n = 3) {
  return Object.values(state.likeTotals || {})
    .sort((a, b) => b.likes - a.likes)
    .slice(0, n)
}
// Xóa BXH (streamer bấm ở Admin khi bắt đầu live mới).
export function clearBxh(state) {
  state.giftTotals = {}
  state.likeTotals = {}
  state.provinceTotals = {}
  state.userProvince = {}
  state.provinceUsers = {}
  state.provinceTeams = { A: null, B: null }
}

// ─── BXH Tỉnh thành: quà tặng tính theo tỉnh của người tặng ──────────────
// Tỉnh dẫn đầu được thưởng thêm lực kéo (×1,5) để khán giả tặng quà đưa
// tỉnh mình lên số 1 rồi giữ vị trí đó. Tính theo TỔNG CẢ PHIÊN như BXH
// người tặng, lưu lại bằng localStorage ở màn hiển thị (xem useTugOfWar).
export function recordProvinceGift(state, code, power, nickname = '') {
  if (!code) return null
  const cur = state.provinceTotals[code] || { code, power: 0, count: 0, lastGiver: '' }
  cur.power += power || 0
  cur.count += 1
  if (nickname) cur.lastGiver = nickname
  state.provinceTotals[code] = cur
  return cur
}
// Top N vùng (tỉnh/nước) tặng quà nhiều nhất (theo tổng lực kéo từ quà của vùng đó).
export function topProvinces(state, n = 3) {
  return Object.values(state.provinceTotals || {})
    .sort((a, b) => b.power - a.power)
    .slice(0, n)
    .map((c) => ({ ...c, ...(regionInfo(c.code) || { name: c.code, short: c.code, flag: '' }) }))
}
// Tỉnh đang dẫn đầu BXH tỉnh thành (null nếu chưa ai tặng quà có tỉnh).
export function provinceLeader(state) {
  return topProvinces(state, 1)[0] || null
}

// Tên hiển thị của 1 đội: nếu đội đó là 1 vùng (tỉnh/nước) đang đấu thì
// hiện tên vùng đó (nước thì kèm cờ, vd "🇺🇸 Mỹ"), chưa có vùng thì hiện
// tên đội thường (Đội Đỏ / Đội Xanh).
export function teamLabel(state, teamId) {
  const code = state.provinceTeams?.[teamId]
  if (code) {
    const info = regionInfo(code)
    if (info) return info.flag ? `${info.flag} ${info.name}` : info.name
  }
  return TEAMS[teamId].name
}

// ─── Đấu tỉnh thành: bình luận tên tỉnh là tự vào đội tỉnh đó ────────────
// 2 tỉnh có NHIỀU NGƯỜI bình luận nhất (mỗi người tính 1 lần, tránh 1
// người spam) thành 2 đội kéo dây. Chọn lại 2 tỉnh này ở ĐẦU MỖI MÀN
// (xem syncProvinceTeams) — tỉnh nào vượt lên thì được đấu màn sau.
// Tỉnh chưa vào top 2 vẫn có người ủng hộ (challenger): bình luận + quà
// của họ vẫn tính cho tỉnh đó, chờ vượt lên top 2 màn sau.
export function topProvincesByComments(state, n = 2) {
  const counts = {}
  for (const u of Object.values(state.provinceUsers || {})) {
    if (!u.province) continue
    counts[u.province] = (counts[u.province] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([code, count]) => ({ code, count, ...(regionInfo(code) || { name: code, short: code, flag: '' }) }))
}

// Bình luận tên tỉnh → vào đội tỉnh đó ngay (tự vào đội luôn).
// Tỉnh đó đang là 1 trong 2 đội đấu thì vào đội đó; chưa phải thì làm
// người ủng hộ (challenger) — bình luận vẫn tính để tỉnh đó lên top 2.
export function joinProvince(state, code, nickname, userId, avatar = '') {
  if (!code || !userId) return { ok: false, reason: 'no-province' }
  const member = findMember(state, userId)
  if (state.userProvince[userId] === code && member) return { ok: true, teamId: member.teamId, province: code, already: true }
  // Đổi tỉnh: rời đội cũ trước (1 người chỉ ở 1 đội).
  if (member) {
    const t = state.teams[member.teamId]
    t.members = t.members.filter((m) => m.userId !== userId)
  }
  state.userProvince[userId] = code
  state.provinceUsers[userId] = { nickname, avatar: avatar || '', province: code, joinedAt: state.now }
  const teamId = state.provinceTeams?.A === code ? 'A' : state.provinceTeams?.B === code ? 'B' : null
  if (!teamId) return { ok: true, province: code, teamId: null, challenger: true }
  const team = state.teams[teamId]
  if (team.members.length >= 100) return { ok: false, reason: 'full', teamId, province: code }
  team.members.push({ nickname, userId, avatar: avatar || '', teamId, pulls: 0, gifts: 0, joinedAt: state.now })
  return { ok: true, teamId, province: code }
}

// Chọn lại 2 đội đấu ở ĐẦU MỖI MÀN: 2 tỉnh có nhiều người bình luận nhất.
// Xếp lại thành viên theo tỉnh (giữ pulls/gifts của người đã ở đội).
// Người không có tỉnh (vào bằng A/B/tên người) giữ nguyên đội cũ.
export function syncProvinceTeams(state) {
  const top = topProvincesByComments(state, 2)
  const codeA = top[0] ? top[0].code : null
  const codeB = top[1] ? top[1].code : null
  state.provinceTeams = { A: codeA, B: codeB }
  // Giữ lại pulls/gifts của thành viên cũ theo userId.
  const oldById = {}
  for (const t of TEAM_IDS) for (const m of state.teams[t].members) oldById[m.userId] = m
  const next = { A: [], B: [] }
  // 1) Người có tỉnh: xếp theo tỉnh (đội top-2, không thì challenger).
  for (const [userId, u] of Object.entries(state.provinceUsers || {})) {
    const teamId = u.province === codeA ? 'A' : u.province === codeB ? 'B' : null
    if (!teamId) continue
    const old = oldById[userId]
    const m = old && old.teamId === teamId
      ? old
      : { nickname: u.nickname, userId, avatar: u.avatar || '', teamId, pulls: old?.pulls || 0, gifts: old?.gifts || 0, joinedAt: u.joinedAt ?? state.now }
    m.teamId = teamId
    next[teamId].push(m)
  }
  // 2) Người không có tỉnh (vào bằng A/B/tên người): giữ nguyên đội cũ.
  for (const m of Object.values(oldById)) {
    if (!state.userProvince[m.userId] && !next[m.teamId].some((x) => x.userId === m.userId)) {
      next[m.teamId].push(m)
    }
  }
  // Giữ thứ tự vào đội (mới vào ở cuối) để 3 người mới nhất hiện trên sân.
  for (const t of TEAM_IDS) {
    next[t].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    state.teams[t].members = next[t]
    state.teams[t].pullRate = state.teams[t].members.length + state.teams[t].boost
  }
  return { A: codeA, B: codeB }
}

// ─── Toast: có ai vào xem / theo dõi / chia sẻ thì hiện 2 giây rồi mất ────
// Chỉ giữ 1 toast: ai vào sau thì đổi chữ + tính lại 2 giây (không xếp chồng).
export function pushToast(state, text) {
  const cur = state.effects.find((e) => e.kind === 'toast')
  if (cur) { cur.text = text; cur.t = 0; return cur }
  const fx = { id: nextId('fx'), kind: 'toast', text, t: 0, dur: 2 }
  state.effects.push(fx)
  return fx
}

export function pushFeed(state, kind, text) {
  state.feed.push({ id: nextId('feed'), kind, text, at: state.now })
  if (state.feed.length > 40) state.feed.splice(0, state.feed.length - 40)
}
export function pushFloater(state, teamId, text) {
  state.floaters.push({ id: nextId('fl'), team: teamId, text, at: state.now })
  if (state.floaters.length > 12) state.floaters.shift()
}

// ─── Vào đội ───────────────────────────────────────────────────────────────
// Bình luận "A" / "ĐỎ" → Đội Đỏ; "B" / "XANH" → Đội Xanh; tên người → đội của
// người đó (Miyo / Anh Hùng / Mia = Đỏ; Lan / Hương / Bình = Xanh);
// "THAM GIA" / "JOIN" → đội đang ít người hơn (cho cân).
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
  // như "lan man" hay "a ơi" (chữ A).
  if (tokens.length > 2) return null
  if (has('XANH', 'B', 'BLUE')) return 'B'
  if (has('DO', 'A', 'RED')) return 'A'
  if (has('MIYO', 'MIA') || flat === 'ANH HUNG') return 'A'
  if (has('LAN', 'HUONG', 'BINH')) return 'B'
  return null
}

export function joinTeam(state, teamId, nickname, userId, avatar = '') {
  if (teamId === 'balance') {
    teamId = state.teams.A.members.length <= state.teams.B.members.length ? 'A' : 'B'
  }
  if (teamId !== 'A' && teamId !== 'B') return { ok: false, reason: 'no-team' }
  // 1 người chỉ ở 1 đội — đã vào đội nào thì không vào thêm đội kia.
  if (userId && findMember(state, userId)) return { ok: false, reason: 'already', teamId: findMember(state, userId).teamId }
  const team = state.teams[teamId]
  if (team.members.length >= 100) return { ok: false, reason: 'full', teamId }
  // Mỗi người vào đội là 1 nhân vật hiện ra trên sân kéo dây (+1 lực kéo).
  // Lưu avatar (ảnh đại diện TikTok, nếu có) + lúc vào đội để 3D xếp hàng.
  const member = { nickname, userId: userId || '', avatar: avatar || '', teamId, pulls: 0, gifts: 0, joinedAt: state.now }
  team.members.push(member)
  pushFeed(state, 'join', `${TEAMS[teamId].emoji} ${nickname} vào ${TEAMS[teamId].name}!`)
  return { ok: true, teamId, member }
}

// Những thành viên HIỆN RA trên sân 3D (mới vào gần nhất, tối đa cap
// người/đội — sân không chứa nổi 100 người, còn lại chỉ tính lực kéo).
export function visibleMembers(state, teamId, cap = 3) {
  const members = state.teams[teamId]?.members || []
  return members.slice(-cap)
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
// Quà tặng là cú bùng sức mạnh: tối đa 100 lực / 1 món — 1 con hạc giấy
// (99 xu) bằng 100 người, nhưng bùng lực tắt dần sau vài giây nên đội đông
// vẫn thắng về lâu dài nếu không có quà tiếp.
export function giftBoost(power) {
  return Math.min(100, Math.max(0, power || 0))
}

export function applyPull(state, teamId, power, sender = {}, giftName = '', opts = {}) {
  const now = state.now
  if (state.phase !== 'pulling') return { ok: false, blocked: 'not-pulling' }
  if (teamId !== 'A' && teamId !== 'B') return { ok: false, blocked: 'no-team' }
  const team = state.teams[teamId]
  // Cơ hội cuối: đội đang thua quá vạch thì quà nhân đôi lực kéo.
  const losing = (teamId === 'A' && state.rope < -state.settings.comebackAt)
    || (teamId === 'B' && state.rope > state.settings.comebackAt)
  // Giờ chót: 10 giây cuối quà nhân đôi — kéo quà tặng về phút chót.
  const final = state.roundTimeLeft <= (state.settings.finalSeconds ?? 10)
  // Tỉnh của người tặng: kèm theo quà, hoặc đã chọn trước đó bằng bình luận
  // tên tỉnh. Tỉnh đang dẫn đầu BXH tỉnh thành được thưởng thêm lực kéo.
  const senderName = sender.nickname || 'Khán giả'
  const pv = sender.province || state.userProvince[sender.userId] || null
  if (pv && sender.userId) state.userProvince[sender.userId] = pv
  const leader = provinceLeader(state)
  const provinceBonus = !!(pv && leader && pv === leader.code)
  let effect = giftBoost(power)
  if (losing) effect *= state.settings.comebackMult
  if (final) effect *= state.settings.finalGiftMult ?? 2
  if (provinceBonus) effect *= state.settings.provinceLeaderMult ?? 1.5
  team.boost += effect
  team.pullRate = team.members.length + team.boost
  team.totalPull += effect
  team.lastPullAt = now
  const member = findMember(state, sender.userId)
  if (member) { member.pulls += effect; member.gifts += 1 }
  state.stats.pulls++
  state.stats.gifts++
  // BXH: ghi tổng quà của người tặng (tính cả khi chưa vào đội).
  // Chỉ ghi khi đây là quà THẬT (opts.gift !== false) — lượt kéo thử
  // (Admin/demo) không phải quà nên không lên BXH.
  if (opts.gift !== false) {
    const coins = giftPrice(giftName) ?? 0
    recordGift(state, sender.userId, senderName, effect, coins, sender.avatar || '')
    // BXH tỉnh thành: quà tính cho tỉnh của người tặng (lực cuối cùng, đã
    // nhân các hệ số) để tỉnh dẫn đầu càng được củng cố.
    if (pv) recordProvinceGift(state, pv, effect, senderName)
  }
  // LẬT KÈO: 1 món quà mạnh hơn cả số người đội kia — khoảnh khắc "cá voi
  // cân cả đám đông", hiện to trên màn hình.
  const otherBase = state.teams[otherTeam(teamId)].members.length
  const flip = effect > otherBase && otherBase > 0
  const big = effect >= 25
  const pvInfo = pv ? regionInfo(pv) : null
  const pvTag = pvInfo ? `${pvInfo.flag ? `${pvInfo.flag} ` : '📍'}${pvInfo.name} ` : ''
  pushFeed(state, 'pull',
    `${TEAMS[teamId].emoji} ${pvTag}${senderName} kéo ${big ? 'CỰC MẠNH' : 'một phát'} cho ${TEAMS[teamId].name}!${losing ? ' (cơ hội cuối ×2)' : ''}${final ? ' (giờ chót ×2)' : ''}${provinceBonus ? ' (tỉnh dẫn đầu ×1,5)' : ''}${flip ? ' 🌊 LẬT KÈO!' : ''}`)
  pushFloater(state, teamId, big ? '💪 KÉO CỰC MẠNH!' : '💪 +KÉO!')
  state.effects.push({ id: nextId('fx'), kind: 'pull', team: teamId, t: 0, dur: 0.6 })
  if (flip) state.effects.push({ id: nextId('fx'), kind: 'flip', team: teamId, sender: senderName, t: 0, dur: 2.5 })
  // Hiệu ứng tặng quà (đỉnh của chóp): quà nhỏ = hộp quà mở ra + hiện tên;
  // quà to (≥25 lực) = nổ pháo hoa + tên người tặng hiện nổi bật.
  // opts.gift === false thì không hiện (lượt kéo thử / demo, không phải quà).
  if (opts.gift !== false) {
    state.effects.push({
      id: nextId('fx'), kind: 'gift', team: teamId,
      sender: senderName, gift: giftName || '', icon: giftIcon(giftName),
      power: effect, big, t: 0, dur: big ? 3.5 : 2,
      province: pv || null, provinceBonus,
    })
  }
  // Camera quay cận: MỌI quà thật (kể cả 1 xu) đều quay cận từng người
  // của đội được tặng — quà to (≥25) thì quay cận đẹp hơn + bùn dính ống
  // kính (xem TugScene/App). Quà thử (Admin/demo) không quay.
  // Cùng đội đang quay cận mà có quà mới tới thì KHÔNG quay lại từ đầu
  // (để màn quay trước→sau chạy hết); chỉ nâng lên quà to nếu quà mới to.
  if (opts.gift !== false) {
    const cur = state.giftCam
    const giftAge = cur ? state.now - cur.at : 99
    if (!cur || cur.teamId !== teamId || giftAge >= 3.6) {
      state.giftCam = { teamId, at: state.now, big }
    } else if (big && !cur.big) {
      cur.big = true
    }
  }
  return { ok: true, teamId, effect, comeback: losing, final, flip, province: pv, provinceBonus }
}

// Thả tim: KHÔNG kéo dây nữa — chỉ +thời gian kéo. Cả phòng thả đủ 100
// tim (cộng dồn mọi người, không tính theo từng người) thì màn kéo dài
// thêm 10 giây (tối đa +60 giây/màn). Cả phòng cùng tap tim để cộng giờ
// cho đội mình thích — vui hơn là bắt 1 người tap đủ 100 cái.
// BXH tim tính TỔNG CẢ PHIÊN (ghi cả khi chưa vào màn kéo) để bảng nhỏ
// ở góc trái luôn có người đứng đầu.
export function applyLikes(state, userId, count, nickname = '', avatar = '') {
  state.likes += count || 0
  recordLike(state, userId, nickname || userId || 'Khán giả', count || 0, avatar)
  if (state.phase !== 'pulling') return 0
  const every = state.settings.likeTimeEvery || 100
  const per = state.settings.likeTimeSeconds || 10
  const maxBonus = state.settings.likeTimeMaxBonus ?? 60
  state.likesInRound = (state.likesInRound || 0) + (count || 0)
  let added = 0
  while (state.likesInRound >= every && state.timeAddedByLikes < maxBonus) {
    state.likesInRound -= every
    state.roundTimeLeft += per
    state.timeAddedByLikes += per
    added++
    pushFeed(state, 'like', `❤️ Đủ ${every} tim: +${per}s kéo co!`)
    state.effects.push({ id: nextId('fx'), kind: 'time', team: null, t: 0, dur: 1.5 })
  }
  return added
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
  // Hết 1 trận (3 màn, phân thắng thua) → reset đội tỉnh về bảng trống.
  // Trận sau bình luận tỉnh mới sẽ chọn lại 2 tỉnh đấu từ đầu (tỉnh cũ
  // không dính lại trận sau). BXH (quà/tim/tỉnh) thì GIỮ NGUYÊN — BXH
  // chỉ reset khi tắt live (xem loadBxh trong useTugOfWar.js).
  state.provinceUsers = {}
  state.provinceTeams = { A: null, B: null }
  startRound(state)
  pushFeed(state, 'info', '🪢 Trận kéo co mới bắt đầu! Bình luận A (Đỏ) hoặc B (Xanh) để chọn đội!')
}

export function startRound(state) {
  state.rope = 0
  // Đã bắt đầu màn (streamer ấn hoặc demo tự ấn) thì hết trạng thái chờ.
  state.waitingNextRound = false
  if (state.luckyStar) {
    // Đội thắng màn trước được bắt đầu màn sau lệch 0,12 về phía mình.
    state.rope = state.luckyStar.team === 'A' ? 0.12 : -0.12
  }
  // Đấu tỉnh thành: chọn lại 2 đội đấu ở đầu mỗi màn — 2 tỉnh có nhiều
  // người bình luận nhất. Tỉnh nào vượt lên thì được đấu màn này.
  syncProvinceTeams(state)
  state.roundWinner = null
  state.phase = 'countdown'
  state.countdown = state.settings.countdownSeconds
  state.roundTimeLeft = state.settings.roundSeconds
  state.effects = []
  // Màn mới: bùng quà tắt hết, tim tính lại từ đầu (mỗi màn 1 cuộc đua mới).
  // Thành viên trong đội GIỮ NGUYÊN qua các màn (cùng 1 khán phòng).
  for (const t of TEAM_IDS) {
    state.teams[t].boost = 0
    state.teams[t].pullRate = state.teams[t].members.length
  }
  state.likesInRound = 0
  state.timeAddedByLikes = 0
  state.finalTime = false
  pushFeed(state, 'info', `🏁 Màn ${state.round} — chuẩn bị… 3 — 2 — 1!`)
}

export function endRound(state, winnerTeamId) {
  const winner = winnerTeamId ? TEAMS[winnerTeamId] : null
  // Chúc mừng tỉnh thắng (đấu tỉnh thành) — hiện tên tỉnh thay tên đội thường.
  const winnerLabel = winnerTeamId ? teamLabel(state, winnerTeamId) : null
  state.roundWinner = winnerTeamId
  state.phase = 'roundEnd'
  state.nextRoundIn = 10 // hết màn: 4s xem đội thua té bùn + 6s xem đội thắng ăn mừng rồi mới sang màn sau
  if (winnerTeamId) {
    state.teams[winnerTeamId].roundWins++
    state.luckyStar = { team: winnerTeamId }
    state.effects.push({ id: nextId('fx'), kind: 'confetti', team: winnerTeamId, t: 0, dur: 2.5 })
    state.effects.push({ id: nextId('fx'), kind: 'splash', team: otherTeam(winnerTeamId), t: 0, dur: 1.5 })
    pushFeed(state, 'win', `${winner.emoji} ${winnerLabel} thắng màn ${state.round}! Tỉ số ${state.teams.A.roundWins}–${state.teams.B.roundWins}`)
  } else {
    pushFeed(state, 'info', `🤝 Màn ${state.round} hòa! Không đội nào thắng.`)
  }
  if (winnerTeamId && state.teams[winnerTeamId].roundWins >= state.settings.winsToMatch) {
    state.phase = 'matchEnd'
    state.matchWinner = winnerTeamId
    state.matchEndIn = 15
    // Chuỗi thắng trận liên tiếp — đội thắng +1, đội thua về 0.
    state.streak[winnerTeamId] = (state.streak[winnerTeamId] || 0) + 1
    state.streak[otherTeam(winnerTeamId)] = 0
    state.effects.push({ id: nextId('fx'), kind: 'confetti', team: winnerTeamId, t: 0, dur: 4 })
    pushFeed(state, 'win', `🏆 ${winnerLabel} VÔ ĐỊCH TRẬN ĐẤU! (${state.teams.A.roundWins}–${state.teams.B.roundWins})${state.streak[winnerTeamId] > 1 ? ` · 🔥 Thắng ${state.streak[winnerTeamId]} trận liên tiếp!` : ''}`)
  }
}

// ─── Vòng lặp chính (gọi mỗi khung hình với dt giây) ───────────────────────
export function tick(state, dt) {
  dt = clamp(dt, 0, 0.1)
  state.now += dt
  state.floaters = state.floaters.filter((f) => state.now - f.at < 2.2)
  state.effects = state.effects.filter((e) => { e.t += dt; return e.t < e.dur })

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
      // Hết màn: KHÔNG tự sang màn sau nữa — về chờ, hiện bảng hướng
      // dẫn, streamer xem đủ người rồi ấn bắt đầu mới kéo màn sau.
      state.phase = 'waiting'
      state.waitingNextRound = true
    }
    return
  }
  if (state.phase === 'matchEnd') {
    state.matchEndIn -= dt
    if (state.matchEndIn <= 0) {
      // Hết trận: KHÔNG tự bắt đầu trận mới — về chờ, streamer xem đủ
      // người rồi ấn bắt đầu trận mới.
      state.phase = 'waiting'
      state.waitingNextRound = false
    }
    return
  }
  if (state.phase !== 'pulling') return

  state.roundTimeLeft -= dt
  state.finalTime = state.roundTimeLeft <= (state.settings.finalSeconds ?? 10)
  // Sức mạnh đội = số người (kéo liên tục) + bùng quà (tắt dần).
  for (const t of TEAM_IDS) {
    const team = state.teams[t]
    team.boost *= Math.exp(-state.settings.boostDecay * dt)
    team.pullRate = team.members.length + team.boost
  }
  // Dây chạy theo CHÊNH LỆCH sức mạnh (tỉ lệ): đội mạnh gấp đôi thì dây
  // chạy nhanh, 2 đội ngang nhau thì dây đứng yên — quà to hay đội đông
  // đều thể hiện ngay bằng tốc độ dây.
  const strA = state.teams.A.pullRate
  const strB = state.teams.B.pullRate
  const total = Math.max(1, strA + strB)
  const diff = (strA - strB) / total
  state.rope = clamp(state.rope + diff * state.settings.ropeSpeed * dt, -1, 1)
  // Dây tự trôi nhẹ về giữa — không ai kéo thì lợi thế mất dần.
  state.rope *= Math.exp(-state.settings.ropeDecay * dt)
  if (Math.abs(state.rope) >= state.settings.winLine) {
    // Dừng cờ ĐÚNG vạch thắng (không vượt quá): dây chạy theo vận tốc nên
    // 1 nhịp có thể vọt qua vạch 1 tí, cờ sẽ lệch khỏi gạch vàng. Kẹp về
    // đúng ±winLine để cờ nằm đúng vạch khi màn kết thúc.
    state.rope = Math.sign(state.rope) * state.settings.winLine
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
    this.applyFn = applyFn || ((power, sender, teamId, giftName) => applyPull(state, teamId, power, sender, giftName))
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
    this.queue.push({ power, sender: { nickname: ev.nickname, userId: ev.userId, avatar: ev.avatar || '', province: ev.province || '' }, teamId, giftName: ev.giftName, at: this.state.now })
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
    const res = this.applyFn(job.power, job.sender, job.teamId, job.giftName)
    // Trả kèm thông tin quà để màn hiển thị đọc giọng bình luận (tên người
    // tặng + tên quà + lực kéo) — applyPull không trả mấy thứ này.
    return { ...res, giftName: job.giftName, sender: job.sender, power: job.power, queued: this.queue.length }
  }
  get queueLength() { return this.queue.length }
}
