// ─── PET MARATHON LIVE · engine.js ─────────────────────────────────────────
// Logic thuần của game đua thú + hệ chiêu hỗn loạn. KHÔNG dùng React/Three/DOM
// nên chạy được trực tiếp bằng `node tests/battle.test.js`.
// Thời gian trong engine tính bằng giây (state.now). Mọi giới hạn cân bằng đều
// là logic thật, không phải trang trí.

// ─── Thú đua ───────────────────────────────────────────────────────────────
export const PET_TYPES = [
  { id: 'cat',     name: 'Mèo Mun',   color: '#ff9f43', baseSpeed: 9.4, wobble: 0.9 },
  { id: 'dog',     name: 'Chó Vàng',  color: '#b08954', baseSpeed: 9.0, wobble: 1.1 },
  { id: 'rabbit',  name: 'Thỏ Trắng', color: '#f5f0ff', baseSpeed: 10.2, wobble: 1.6 },
  { id: 'hamster', name: 'Chuột Béo', color: '#e8a04c', baseSpeed: 8.6, wobble: 0.7 },
  { id: 'duck',    name: 'Vịt Con',   color: '#ffd60a', baseSpeed: 9.2, wobble: 1.2 },
  { id: 'panda',   name: 'Gấu Trúc',  color: '#e8e8e8', baseSpeed: 8.8, wobble: 0.8 },
]
export const MAX_RACERS = 6
export const BOT_NAMES = ['Bé Bự', 'Mít Ướt', 'Cục Bông', 'Tí Hon', 'Bánh Bao', 'Cà Rốt']

// ─── 10 chiêu ─────────────────────────────────────────────────────────────
// kind: 'attack' (tấn công đối thủ) | 'buff' (tăng sức cho thú của người gửi)
export const ABILITIES = [
  { id: 'banana',  name: 'Vỏ Chuối',       icon: '🍌', kind: 'attack', duration: 3,   desc: 'Trượt ngã sấp mặt, chậm 60% trong 3 giây' },
  { id: 'melon',   name: 'Dưa Hấu Khổng Lồ', icon: '🍉', kind: 'attack', duration: 0, desc: 'Lăn qua đường đua, hất mục tiêu lùi ~15m' },
  { id: 'net',     name: 'Lưới Đánh Cá',   icon: '🕸️', kind: 'attack', duration: 2.5, desc: 'Bẫy mục tiêu đứng yên 2,5 giây' },
  { id: 'glove',   name: 'Găng Tay Boxing', icon: '🥊', kind: 'attack', duration: 0,  desc: 'Đấm bay mục tiêu lùi ~10m' },
  { id: 'ice',     name: 'Bẫy Băng',       icon: '🧊', kind: 'attack', duration: 3,   desc: 'Trượt lung tung, chậm 40% trong 3 giây' },
  { id: 'dizzy',   name: 'Bom Chóng Mặt',  icon: '💫', kind: 'attack', duration: 3,   desc: 'Chạy vòng tròn, chậm 50% trong 3 giây' },
  { id: 'rocket',  name: 'Tên Lửa Mini',   icon: '🚀', kind: 'buff',   duration: 3,   desc: 'Tăng tốc +80% trong 3 giây' },
  { id: 'shield',  name: 'Khiên Bảo Vệ',   icon: '🛡️', kind: 'buff',   duration: 10,  desc: 'Chặn 1 đòn tấn công, tồn tại 10 giây' },
  { id: 'heal',    name: 'Thuốc Hồi Phục', icon: '🧪', kind: 'buff',   duration: 0,   desc: 'Xóa hết hiệu ứng xấu ngay lập tức' },
  { id: 'magnet',  name: 'Nam Châm Vàng',  icon: '🧲', kind: 'buff',   duration: 5,   desc: 'Hút xu thưởng gần đó trong 5 giây' },
]
export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]))

// Quà mặc định → chiêu, theo đúng dữ liệu quà TikTok (tên + giá xu lấy từ
// bảng quà TikTok, chỉ lấy quà dưới 100 xu). Xu càng cao chiêu càng mạnh:
// 1 xu = thử thách nhỏ (trượt vỏ chuối), 5 xu = vừa, 10–20 xu = lớn,
// 99 xu = cực mạnh. Tên ngắn để cuối bảng để khớp chuỗi con không nhận nhầm.
export const DEFAULT_GIFT_MAP = {
  // 1 xu → trượt vỏ chuối (thử thách nhỏ)
  'hoa hồng': 'banana', rose: 'banana',
  'kem ốc quế': 'banana', 'ice cream': 'banana',
  'nhịp trống mirwas': 'banana', mirwas: 'banana',
  'nhạc tự do': 'banana',
  'nhạc xưa': 'banana',
  'thả tim cho tôi': 'banana',
  'tiktok': 'banana',
  'đỉnh': 'banana',
  // 5 xu → trượt băng (thử thách vừa)
  'bing chilling': 'ice',
  'quả đào': 'ice', peach: 'ice',
  'phản ứng quá lố': 'ice',
  'trái bóng xoáy': 'ice',
  'bắn tim': 'ice', 'finger heart': 'ice',
  // 10 xu → đấm bay / dính lưới (thử thách lớn)
  'rosa': 'glove',
  'cỏ bốn lá': 'net', 'four-leaf clover': 'net', clover: 'net',
  // 20 xu → lăn dưa hấu / hồi phục (thử thách lớn)
  'nước hoa': 'melon', perfume: 'melon',
  'little kisses': 'heal',
  // 99 xu → bom chóng mặt (thử thách cực mạnh)
  'hạc giấy': 'dizzy', 'paper crane': 'dizzy',
  'gg': 'banana',
  'ok': 'ice',
}

// ─── Icon khớp với quà trên TikTok ──────────────────────────────────────────
// Hiện trong bảng chọn quà ở Admin (chạm vào 1 món quà để xem chi tiết kiểu
// bảng chọn quà TikTok) và trong nhật ký quà ở tab Kết nối. Quà nào chưa có
// trong bảng này thì hiện 🎁.
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
// Xu càng cao thử thách càng lớn (theo giá quà TikTok).
export function giftTier(coins) {
  if (coins == null) return ''
  if (coins <= 1) return 'Thử thách nhỏ'
  if (coins <= 5) return 'Thử thách vừa'
  if (coins <= 20) return 'Thử thách lớn'
  return 'Thử thách cực mạnh'
}

// ─── Sự kiện hỗn loạn ───────────────────────────────────────────────────────
export const CHAOS_EVENTS = [
  { id: 'banana_rain', name: 'Mưa Chuối',        icon: '🍌', desc: 'Vỏ chuối rơi khắp đường đua!' },
  { id: 'melon_storm', name: 'Bão Dưa Hấu',      icon: '🍉', desc: 'Dưa hấu khổng lồ lăn qua!' },
  { id: 'rocket_rush', name: 'Tên Lửa Đồng Loạt', icon: '🚀', desc: 'Tất cả cùng tăng tốc!' },
  { id: 'slippery',    name: 'Đường Trơn',       icon: '🧊', desc: 'Đường đua trơn như băng!' },
  { id: 'golden_rush', name: 'Cơn Mưa Vàng',     icon: '🪙', desc: 'Xu thưởng rơi đầy đường!' },
]
export const CHAOS_BY_ID = Object.fromEntries(CHAOS_EVENTS.map((e) => [e.id, e]))

// ─── Cài đặt mặc định (Admin sửa được) ─────────────────────────────────────
export const DEFAULT_SETTINGS = {
  raceDistance: 400,
  countdownSeconds: 3,
  attackCooldownSec: 5,      // cùng 1 thú không bị đánh 2 lần trong 5 giây
  immunitySec: 3,            // miễn nhiễm 3 giây sau khi bị đánh
  maxAttacksPerRacer: 3,     // tối đa 3 lần bị đánh / 1 cuộc đua
  globalAttackIntervalSec: 0.5, // tối đa 1 chiêu / 0,5 giây toàn cuộc đua (còn lại xếp hàng) — nhanh, gần như không trễ
  chaosMinSec: 40,
  chaosMaxSec: 60,
  likeBoostEvery: 100,       // mỗi 100 tim → tăng tốc ngẫu nhiên 1 thú
  durations: Object.fromEntries(ABILITIES.map((a) => [a.id, a.duration])),
  giftMap: { ...DEFAULT_GIFT_MAP },
  streamerId: '',
  soundOn: true,
}

export const BALANCE_NOTE =
  'Cân bằng: chiêu chỉ làm chậm tối đa vài giây, tốc độ không bao giờ tụt dưới 25% ' +
  'tốc độ gốc, mỗi thú chỉ bị đánh tối đa 3 lần / cuộc đua và luôn có 3 giây miễn nhiễm ' +
  'sau mỗi lần bị đánh — thắng thua vẫn do chạy nhanh hay chậm quyết định.'

// ─── Trạng thái cuộc đua ────────────────────────────────────────────────────
let uidCounter = 1
export function nextId(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${uidCounter++}` }

export function makeRacer({ lane, petId, nickname, userId, isBot }) {
  const pet = PET_TYPES.find((p) => p.id === petId) || PET_TYPES[lane % PET_TYPES.length]
  return {
    id: nextId('racer'), lane, petId: pet.id, petName: pet.name, color: pet.color,
    nickname, userId: userId || '', isBot: !!isBot,
    baseSpeed: pet.baseSpeed, wobble: pet.wobble,
    dist: 0, speed: 0, finished: false, place: 0, finishTime: 0,
    // Trạng thái hiệu ứng (thời điểm hết hạn, tính theo state.now)
    st: { slowUntil: 0, trappedUntil: 0, iceUntil: 0, dizzyUntil: 0, rocketUntil: 0,
          shieldUntil: 0, magnetUntil: 0, boostUntil: 0, immuneUntil: 0, slipUntil: 0 },
    shieldCharges: 0,
    attacksReceived: 0, lastAttackAt: -999,
    anim: 'run', animUntil: 0, // run | slip | spin | fly | dizzy | trapped | celebrate | cry
    coins: 0, lateral: 0,
  }
}

export function createRace(settings = DEFAULT_SETTINGS, racers = []) {
  return {
    phase: 'waiting', // waiting | countdown | racing | finished
    now: 0, countdown: 0, raceTime: 0, raceId: nextId('race'),
    distance: settings.raceDistance,
    racers, coins: [], effects: [], feed: [], floaters: [],
    chaos: { nextIn: randBetween(settings.chaosMinSec, settings.chaosMaxSec), active: null, activeUntil: 0 },
    likes: 0, likeBoostAt: 0, results: [], nextRaceIn: 0,
    settings: { ...settings },
    stats: { gifts: 0, attacks: 0, blocked: 0 },
  }
}

function randBetween(a, b) { return a + Math.random() * (b - a) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Tên bot duy nhất trong 1 cuộc đua: bốc không hoàn lại từ kho tên; hết tên
// thì thêm số làn (vd "Bé Bự 2") để feed luôn chỉ đúng 1 thú.
export function uniqueBotName(state, lane) {
  const used = new Set(state.racers.map((r) => r.nickname))
  const pool = BOT_NAMES.filter((n) => !used.has(`${n} (máy)`))
  if (pool.length) return `${pool[Math.floor(Math.random() * pool.length)]} (máy)`
  const base = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
  let suffix = (lane ?? state.racers.length) + 1
  let name = `${base} ${suffix} (máy)`
  while (used.has(name)) { suffix++; name = `${base} ${suffix} (máy)` }
  return name
}

// Lấp đầy làn trống bằng bot để cuộc đua luôn chạy được.
export function fillBots(state) {
  const usedPets = new Set(state.racers.map((r) => r.petId))
  let lane = 0
  while (state.racers.length < MAX_RACERS) {
    const pet = PET_TYPES.find((p) => !usedPets.has(p.id)) || PET_TYPES[lane % PET_TYPES.length]
    usedPets.add(pet.id)
    const laneIdx = state.racers.length
    state.racers.push(makeRacer({ lane: laneIdx, petId: pet.id, nickname: uniqueBotName(state, laneIdx), isBot: true }))
    lane++
  }
  state.racers.forEach((r, i) => { r.lane = i })
  return state.racers
}

// Người xem bình luận THAM GIA / JOIN → nhận 1 thú (tối đa 6).
export function joinRacer(state, nickname, userId) {
  if (state.racers.some((r) => r.userId && userId && r.userId === userId)) return { ok: false, reason: 'already' }
  if (state.racers.length >= MAX_RACERS) return { ok: false, reason: 'full' }
  const usedPets = new Set(state.racers.map((r) => r.petId))
  const pet = PET_TYPES.find((p) => !usedPets.has(p.id)) || PET_TYPES[0]
  const racer = makeRacer({ lane: state.racers.length, petId: pet.id, nickname, userId, isBot: false })
  state.racers.push(racer)
  pushFeed(state, 'join', `🏁 ${nickname} tham gia đua với ${pet.name}!`)
  return { ok: true, racer }
}

export function pushFeed(state, kind, text) {
  state.feed.push({ id: nextId('feed'), kind, text, at: state.now })
  if (state.feed.length > 40) state.feed.splice(0, state.feed.length - 40)
}
export function pushFloater(state, lane, text) {
  state.floaters.push({ id: nextId('fl'), lane, text, at: state.now })
  if (state.floaters.length > 12) state.floaters.shift()
}

// ─── Chọn mục tiêu ─────────────────────────────────────────────────────────
// Từ chữ kèm theo quà: "@Lan" hoặc số làn 1-6 hoặc tên thú. Không khớp → null.
export function parseTarget(text, racers) {
  if (!text) return null
  const t = String(text)
  const at = t.match(/@([^\s,;]+)/)
  if (at) {
    const name = at[1].toLowerCase()
    const hit = racers.find((r) => r.nickname.toLowerCase().includes(name) || (r.userId && r.userId.toLowerCase() === name))
    if (hit) return hit.id
  }
  const laneM = t.match(/(?:^|[\s#])(\d)(?:\s|$)/)
  if (laneM) {
    const lane = parseInt(laneM[1], 10) - 1
    const hit = racers.find((r) => r.lane === lane)
    if (hit) return hit.id
  }
  const low = t.toLowerCase()
  const byPet = racers.find((r) => low.includes(r.petName.toLowerCase()))
  if (byPet) return byPet.id
  return null
}

function eligibleOpponents(state, senderRacerId) {
  return state.racers.filter((r) => !r.finished && r.id !== senderRacerId)
}
export function pickRandomTarget(state, senderRacerId, rng = Math.random) {
  const list = eligibleOpponents(state, senderRacerId)
  if (!list.length) return null
  return list[Math.floor(rng() * list.length)].id
}

// ─── Tốc độ hiện tại của 1 thú (đã tính mọi hiệu ứng, không dưới 25% gốc) ──
export function currentSpeedMult(racer, now) {
  const st = racer.st
  if (now < st.trappedUntil) return 0 // lưới: đứng yên (tối đa 2,5s)
  let m = 1
  if (now < st.slowUntil) m *= 0.4   // chuối: -60%
  if (now < st.iceUntil) m *= 0.6    // băng: -40%
  if (now < st.dizzyUntil) m *= 0.5  // chóng mặt: -50%
  if (now < st.rocketUntil) m *= 1.8 // tên lửa: +80%
  if (now < st.boostUntil) m *= 1.5  // sự kiện tên lửa: +50%
  if (now < st.slipUntil) m *= 0.4
  return Math.max(0.25, m) // sàn cân bằng: không bao giờ bò chậm hơn 25%
}

// ─── Áp 1 chiêu ───────────────────────────────────────────────────────────
// Trả về { ok, blocked?: 'shield'|'immune'|'cooldown'|'max'|'not-racing'|'no-target', ... }
export function applyAbility(state, abilityId, sender = {}, targetId = null, opts = {}) {
  const now = opts.now ?? state.now
  const ability = ABILITY_BY_ID[abilityId]
  if (!ability) return { ok: false, blocked: 'unknown-ability' }
  if (state.phase !== 'racing') return { ok: false, blocked: 'not-racing' }
  const dur = (name) => state.settings.durations?.[name] ?? ABILITY_BY_ID[name].duration
  const senderRacer = state.racers.find((r) => r.userId && sender.userId && r.userId === sender.userId)
    || state.racers.find((r) => r.nickname === sender.nickname)
  const senderName = sender.nickname || 'Khán giả'

  // ── Buff: luôn rơi vào thú của người gửi (không có thú thì thú ngẫu nhiên) ──
  if (ability.kind === 'buff') {
    let target = senderRacer
    if (!target) {
      const pool = state.racers.filter((r) => !r.finished)
      target = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
    }
    if (!target) return { ok: false, blocked: 'no-target' }
    const st = target.st
    if (abilityId === 'shield') {
      st.shieldUntil = now + dur('shield')
      target.shieldCharges = 1
      pushFeed(state, 'shield', `🛡️ ${senderName} bật khiên cho ${target.nickname}!`)
      pushFloater(state, target.lane, '🛡️ CÓ KHIÊN!')
    } else if (abilityId === 'heal') {
      clearNegatives(target, now)
      pushFeed(state, 'heal', `🧪 ${senderName} hồi phục cho ${target.nickname}!`)
      pushFloater(state, target.lane, '🧪 KHỎE LẠI RỒI!')
    } else if (abilityId === 'rocket') {
      st.rocketUntil = now + dur('rocket')
      target.anim = 'celebrate'; target.animUntil = now + 1.2
      pushFeed(state, 'rocket', `🚀 ${senderName} bật tên lửa cho ${target.nickname}!`)
      pushFloater(state, target.lane, '🚀 BAY THÔI!')
    } else if (abilityId === 'magnet') {
      st.magnetUntil = now + dur('magnet')
      pushFeed(state, 'magnet', `🧲 ${senderName} bật nam châm vàng cho ${target.nickname}!`)
      pushFloater(state, target.lane, '🧲 HÚT XU!')
    }
    state.stats.gifts++
    return { ok: true, targetId: target.id, abilityId }
  }

  // ── Tấn công: cần mục tiêu là đối thủ (không bao giờ đánh thú của chính mình) ──
  let target = targetId ? state.racers.find((r) => r.id === targetId) : null
  if (target && target.id === senderRacer?.id) target = null // tự đánh mình → bỏ, chọn lại
  if (!target) {
    const tid = pickRandomTarget(state, senderRacer?.id)
    target = state.racers.find((r) => r.id === tid) || null
  }
  if (!target) return { ok: false, blocked: 'no-target' }

  // 1. Khiên chặn 1 đòn rồi vỡ
  if (target.shieldCharges > 0 && now < target.st.shieldUntil) {
    target.shieldCharges = 0
    target.st.shieldUntil = 0
    state.stats.blocked++
    pushFeed(state, 'blocked', `🛡️ Khiên của ${target.nickname} chặn đòn ${ability.name} của ${senderName}!`)
    pushFloater(state, target.lane, '🛡️ KHIÊN CHẶN!')
    state.effects.push({ id: nextId('fx'), kind: 'shieldBlock', targetId: target.id, t: 0, dur: 0.8 })
    return { ok: false, blocked: 'shield', targetId: target.id }
  }
  // 2. Miễn nhiễm 3 giây sau khi bị đánh
  if (now < target.st.immuneUntil) {
    state.stats.blocked++
    return { ok: false, blocked: 'immune', targetId: target.id }
  }
  // 3. Cùng 1 thú không bị đánh 2 lần trong 5 giây
  if (now - target.lastAttackAt < state.settings.attackCooldownSec) {
    state.stats.blocked++
    return { ok: false, blocked: 'cooldown', targetId: target.id }
  }
  // 4. Tối đa 3 lần bị đánh / 1 cuộc đua
  if (target.attacksReceived >= state.settings.maxAttacksPerRacer) {
    state.stats.blocked++
    return { ok: false, blocked: 'max', targetId: target.id }
  }

  // ── Đánh trúng: ghi nhận + miễn nhiễm sau đòn ──
  target.attacksReceived++
  target.lastAttackAt = now
  target.st.immuneUntil = now + state.settings.immunitySec
  const st = target.st
  if (abilityId === 'banana') {
    st.slowUntil = now + dur('banana'); st.slipUntil = now + dur('banana')
    target.anim = 'slip'; target.animUntil = now + 1.4
    state.effects.push({ id: nextId('fx'), kind: 'banana', targetId: target.id, t: 0, dur: 1.2 })
    pushFeed(state, 'attack', `🍌 ${senderName} ném chuối vào ${target.nickname}!`)
    pushFloater(state, target.lane, '🍌 BỊ THẢ CHUỐI!')
  } else if (abilityId === 'melon') {
    target.dist = Math.max(0, target.dist - 15)
    target.anim = 'fly'; target.animUntil = now + 1.0
    state.effects.push({ id: nextId('fx'), kind: 'melon', targetId: target.id, t: 0, dur: 1.4 })
    pushFeed(state, 'attack', `🍉 ${senderName} lăn dưa hấu hất ${target.nickname} lùi 15m!`)
    pushFloater(state, target.lane, '🍉 DƯA HẤU!')
  } else if (abilityId === 'net') {
    st.trappedUntil = now + dur('net')
    target.anim = 'trapped'; target.animUntil = now + dur('net')
    state.effects.push({ id: nextId('fx'), kind: 'net', targetId: target.id, t: 0, dur: dur('net') })
    pushFeed(state, 'attack', `🕸️ ${senderName} quăng lưới bắt ${target.nickname}!`)
    pushFloater(state, target.lane, '🕸️ DÍNH LƯỚI!')
  } else if (abilityId === 'glove') {
    target.dist = Math.max(0, target.dist - 10)
    target.anim = 'fly'; target.animUntil = now + 0.9
    state.effects.push({ id: nextId('fx'), kind: 'glove', targetId: target.id, t: 0, dur: 0.9 })
    pushFeed(state, 'attack', `🥊 ${senderName} đấm bay ${target.nickname} lùi 10m!`)
    pushFloater(state, target.lane, '🥊 BỊ ĐẤM!')
  } else if (abilityId === 'ice') {
    st.iceUntil = now + dur('ice')
    target.anim = 'slide'; target.animUntil = now + dur('ice')
    state.effects.push({ id: nextId('fx'), kind: 'ice', targetId: target.id, t: 0, dur: dur('ice') })
    pushFeed(state, 'attack', `🧊 ${senderName} đặt bẫy băng dưới chân ${target.nickname}!`)
    pushFloater(state, target.lane, '🧊 TRƠN QUÁ!')
  } else if (abilityId === 'dizzy') {
    st.dizzyUntil = now + dur('dizzy')
    target.anim = 'dizzy'; target.animUntil = now + dur('dizzy')
    state.effects.push({ id: nextId('fx'), kind: 'dizzy', targetId: target.id, t: 0, dur: dur('dizzy') })
    pushFeed(state, 'attack', `💫 ${senderName} ném bom chóng mặt vào ${target.nickname}!`)
    pushFloater(state, target.lane, '💫 CHÓNG MẶT!')
  }
  state.stats.attacks++
  state.stats.gifts++
  return { ok: true, targetId: target.id, abilityId }
}

export function clearNegatives(racer, now) {
  const st = racer.st
  st.slowUntil = 0; st.slipUntil = 0; st.trappedUntil = 0; st.iceUntil = 0; st.dizzyUntil = 0
  racer.anim = 'run'; racer.animUntil = 0
  return racer
}

// ─── Sự kiện hỗn loạn ───────────────────────────────────────────────────────
export function pickChaosEvent(rng = Math.random) {
  return CHAOS_EVENTS[Math.floor(rng() * CHAOS_EVENTS.length)].id
}

export function applyChaosEvent(state, eventId, now = state.now) {
  const ev = CHAOS_BY_ID[eventId]
  if (!ev) return { ok: false }
  const racers = state.racers.filter((r) => !r.finished)
  if (eventId === 'banana_rain') {
    for (const r of racers) { r.st.slowUntil = Math.max(r.st.slowUntil, now + 3); r.anim = 'slip'; r.animUntil = now + 1.2 }
    state.effects.push({ id: nextId('fx'), kind: 'bananaRain', t: 0, dur: 2 })
  } else if (eventId === 'melon_storm') {
    for (let i = 0; i < 3; i++) state.effects.push({ id: nextId('fx'), kind: 'melonStorm', t: 0, dur: 2.5, seed: i })
    for (const r of racers) { r.dist = Math.max(0, r.dist - 5); r.anim = 'fly'; r.animUntil = now + 0.8 }
  } else if (eventId === 'rocket_rush') {
    for (const r of racers) { r.st.boostUntil = now + 4; r.anim = 'celebrate'; r.animUntil = now + 1 }
  } else if (eventId === 'slippery') {
    for (const r of racers) { r.st.iceUntil = Math.max(r.st.iceUntil, now + 5); r.anim = 'slide'; r.animUntil = now + 1.5 }
  } else if (eventId === 'golden_rush') {
    const lead = Math.max(0, ...state.racers.map((r) => r.dist))
    for (let i = 0; i < 8; i++) spawnCoin(state, lead + 5 + i * 6 + Math.random() * 4)
  }
  state.chaos.active = eventId
  state.chaos.activeUntil = now + 5
  pushFeed(state, 'chaos', `${ev.icon} SỰ KIỆN: ${ev.name} — ${ev.desc}`)
  return { ok: true, eventId }
}

function spawnCoin(state, dist) {
  state.coins.push({ id: nextId('coin'), dist, lane: Math.floor(Math.random() * MAX_RACERS), taken: false, spin: Math.random() * 6 })
}

// ─── Vòng lặp chính (gọi mỗi khung hình với dt giây) ───────────────────────
export function tick(state, dt) {
  dt = clamp(dt, 0, 0.1)
  state.now += dt
  // Dọn chữ nổi + hiệu ứng hết hạn
  state.floaters = state.floaters.filter((f) => state.now - f.at < 2.2)
  state.effects = state.effects.filter((e) => { e.t += dt; return e.t < e.dur })
  if (state.chaos.active && state.now > state.chaos.activeUntil) state.chaos.active = null

  if (state.phase === 'countdown') {
    state.countdown -= dt
    if (state.countdown <= 0) { state.phase = 'racing'; pushFeed(state, 'info', '🏁 Xuất phát! Chạy thôi!') }
    return
  }
  if (state.phase === 'finished') {
    state.nextRaceIn -= dt
    return
  }
  if (state.phase !== 'racing') return

  state.raceTime += dt
  const now = state.now

  // Đồng hồ sự kiện hỗn loạn
  state.chaos.nextIn -= dt
  if (state.chaos.nextIn <= 0) {
    applyChaosEvent(state, pickChaosEvent(), now)
    state.chaos.nextIn = randBetween(state.settings.chaosMinSec, state.settings.chaosMaxSec)
  }

  // Rải xu thưởng dần
  if (Math.random() < dt * 0.25) {
    const lead = Math.max(0, ...state.racers.map((r) => r.dist))
    spawnCoin(state, lead + 15 + Math.random() * 25)
  }
  if (state.coins.length > 24) state.coins.splice(0, state.coins.length - 24)

  let finishedCount = 0
  for (const r of state.racers) {
    if (r.finished) { finishedCount++; continue }
    // Tốc độ: gốc × dao động thể lực (sin) × hệ số hiệu ứng
    const wobble = 1 + Math.sin(now * 0.9 + r.lane * 1.7) * 0.08 * r.wobble
    const mult = currentSpeedMult(r, now)
    r.speed = r.baseSpeed * wobble * mult
    r.dist += r.speed * dt
    // Chóng mặt / băng: lắc ngang
    if (now < r.st.dizzyUntil) r.lateral = Math.sin(now * 9 + r.lane) * 0.55
    else if (now < r.st.iceUntil) r.lateral = Math.sin(now * 3.5 + r.lane) * 0.35
    else r.lateral *= 0.9
    // Hút xu (nam châm): xu gần tự bay tới
    if (now < r.st.magnetUntil) {
      for (const c of state.coins) {
        if (!c.taken && c.lane === r.lane && Math.abs(c.dist - r.dist) < 12) c.dist += (r.dist - c.dist) * dt * 4
      }
    }
    // Nhặt xu: +2% tốc độ bùng 1 giây
    for (const c of state.coins) {
      if (!c.taken && c.lane === r.lane && Math.abs(c.dist - r.dist) < 1.2) {
        c.taken = true
        r.coins++
        r.st.boostUntil = Math.max(r.st.boostUntil, now + 1)
        pushFloater(state, r.lane, '🪙 +XU!')
      }
    }
    if (now >= r.animUntil && r.anim !== 'run') r.anim = 'run'
    // Về đích
    if (r.dist >= state.distance) {
      r.dist = state.distance
      r.finished = true
      r.finishTime = state.raceTime
      r.place = state.racers.filter((x) => x.finished).length
      r.anim = 'celebrate'; r.animUntil = now + 3
      const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : '🎉'
      pushFeed(state, 'finish', `${medal} ${r.nickname} về đích hạng ${r.place}!`)
      finishedCount++
    }
  }
  // Thú bị bỏ xa quá → khóc (vui thôi, không trừ điểm)
  const lead = Math.max(0, ...state.racers.map((r) => r.dist))
  for (const r of state.racers) {
    if (!r.finished && lead - r.dist > 60 && r.anim === 'run' && Math.random() < dt * 0.05) {
      r.anim = 'cry'; r.animUntil = now + 1.5
      pushFloater(state, r.lane, '😭 BỊ BỎ LẠI!')
    }
  }
  // Hết đua khi tất cả về đích (hoặc quá 180 giây thì chốt theo thứ tự)
  if ((finishedCount === state.racers.length && state.racers.length > 0) || state.raceTime > 180) {
    finishRace(state)
  }
}

// ─── Tiến thời gian thực ────────────────────────────────────────────────────
// tick() tự cắt dt > 0,1s nên gọi thẳng với dt lớn (tab nền bị bóp timer)
// sẽ làm đua chậm lại. advance() chia dt lớn thành bước ≤0,1s để cuộc đua
// tiến đúng theo thời gian thực dù tab ở nền.
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

export function finishRace(state) {
  state.phase = 'finished'
  state.nextRaceIn = 10
  // Xếp theo thời gian về đích (chưa về thì theo quãng đường), không xếp theo
  // dist vì mọi thú về đích đều dừng ở cùng 1 vạch.
  const ordered = [...state.racers].sort((a, b) =>
    (a.finishTime || 9999) - (b.finishTime || 9999) || b.dist - a.dist)
  ordered.forEach((r, i) => { r.place = i + 1 })
  state.results = ordered.map((r) => ({ id: r.id, nickname: r.nickname, petName: r.petName, place: r.place, isBot: r.isBot, coins: r.coins }))
  pushFeed(state, 'finish', `🏆 Hết cuộc đua! Vô địch: ${ordered[0]?.nickname || '—'} (${ordered[0]?.petName || ''})`)
}

// Mỗi màn phải tham gia lại: khi bắt đầu màn mới sau khi màn trước đã xong,
// xóa hết thú cũ. Người đăng ký chờ trong lúc đua (pending) vẫn được giữ
// lại sau bước này; người bình luận trong lúc chờ/đếm ngược thì vào thẳng.
// Màn đầu (waiting) thì không xóa — người vào trước khi bắt đầu vẫn được giữ.
export function clearRacersForNewRound(state) {
  if (state.phase === 'finished') state.racers.splice(0)
}

export function startRace(state) {
  if (state.racers.length < 2) fillBots(state)
  for (const r of state.racers) {
    r.dist = 0; r.speed = 0; r.finished = false; r.place = 0; r.finishTime = 0
    r.attacksReceived = 0; r.lastAttackAt = -999; r.anim = 'run'; r.animUntil = 0; r.coins = 0; r.lateral = 0
    r.st = { slowUntil: 0, trappedUntil: 0, iceUntil: 0, dizzyUntil: 0, rocketUntil: 0, shieldUntil: 0, magnetUntil: 0, boostUntil: 0, immuneUntil: 0, slipUntil: 0 }
    r.shieldCharges = 0
  }
  state.coins = []; state.effects = []; state.results = []
  state.phase = 'countdown'
  state.countdown = state.settings.countdownSeconds
  state.raceTime = 0
  state.chaos.nextIn = randBetween(state.settings.chaosMinSec, state.settings.chaosMaxSec)
  state.chaos.active = null
  pushFeed(state, 'info', '🏁 Chuẩn bị… 3 — 2 — 1!')
}

// ─── Gift Engine: chống trùng, xếp hàng, giới hạn tốc độ toàn cục ──────────
// Không bao giờ tự bịa event: chỉ xử lý event thật từ WebSocket / Admin thử.
export class GiftEngine {
  constructor(state, applyFn) {
    this.state = state
    this.applyFn = applyFn || ((abilityId, sender, targetId) => applyAbility(state, abilityId, sender, targetId))
    this.seen = new Set()
    this.seenOrder = []
    this.queue = []
    this.lastProcessedAt = -999
    this.droppedDuplicates = 0
    this.droppedUnmapped = 0
  }
  // Chuẩn hóa tên quà để so khớp bảng map (không phân biệt hoa/thường, khoảng trắng)
  static normGiftName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
  }
  resolveGift(giftName) {
    const map = this.state.settings.giftMap || {}
    const norm = GiftEngine.normGiftName(giftName)
    if (map[norm]) return map[norm]
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
    const abilityId = this.resolveGift(ev.giftName)
    if (!abilityId) { this.droppedUnmapped++; return { ok: false, reason: 'unmapped', giftName: ev.giftName } }
    const targetId = parseTarget(ev.text || '', this.state.racers)
    this.queue.push({ abilityId, sender: { nickname: ev.nickname, userId: ev.userId }, targetId, at: this.state.now })
    return { ok: true, queued: true, abilityId }
  }
  // Xử lý hàng đợi theo giới hạn toàn cục (tối đa 1 chiêu / globalAttackIntervalSec)
  process(now = this.state.now) {
    const interval = this.state.settings.globalAttackIntervalSec ?? 0.5
    if (!this.queue.length) return null
    if (now - this.lastProcessedAt < interval) return { ok: false, reason: 'rate-limited', queued: this.queue.length }
    const job = this.queue.shift()
    this.lastProcessedAt = now
    const res = this.applyFn(job.abilityId, job.sender, job.targetId)
    return { ...res, queued: this.queue.length }
  }
  get queueLength() { return this.queue.length }
}
