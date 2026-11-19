// ─── KÉO CO LIVE · adapter.js ────────────────────────────────────────
// Chuẩn hóa event TikTok LIVE từ connector về 1 định dạng duy nhất.
// Chấp nhận nhiều dạng: { type: 'chat'|'gift'|'like', ... },
// { event: 'CHAT', data: {...} }, mảng event, lồng data/payload,
// snake_case / camelCase, hoa/thường lẫn lộn. Event lạ → null/kèm lý do.

const pick = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
    const lower = Object.keys(obj).find((key) => key.toLowerCase() === k.toLowerCase())
    if (lower && obj[lower] !== undefined && obj[lower] !== null && obj[lower] !== '') return obj[lower]
  }
  return undefined
}
const asText = (v) => (v === undefined || v === null ? '' : String(v))

function unwrap(raw) {
  if (!raw || typeof raw !== 'object') return raw
  for (const k of ['data', 'payload', 'body', 'event_data']) {
    if (raw[k] && typeof raw[k] === 'object') return { ...raw[k], __outer: raw }
  }
  return raw
}

function detectKind(obj) {
  const outer = obj.__outer || obj
  const has = (keys) => pick(obj, keys) !== undefined || pick(outer, keys) !== undefined
  const raw = asText(pick(obj, ['type', 'event', 'kind', 'action', 'name']) ?? pick(outer, ['type', 'event', 'kind', 'action', 'name'])).toLowerCase()
  if (/(^|_)chat$|message|comment/.test(raw)) return 'chat'
  if (/gift|present|donat/.test(raw)) return 'gift'
  if (/like|heart/.test(raw)) return 'like'
  if (/follow/.test(raw)) return 'follow'
  if (/join|enter|member/.test(raw)) return 'join'
  if (/share/.test(raw)) return 'share'
  if (has(['giftName', 'gift_name', 'diamondCount', 'giftId', 'gift_id'])) return 'gift'
  if (has(['likeCount', 'totalLikeCount', 'totalLikes'])) return 'like'
  if (has(['comment', 'text', 'message', 'content'])) return 'chat'
  return null
}

const AVATAR_KEYS = [
  'profilePictureUrl', 'profile_picture_url', 'profilePic', 'profile_pic',
  'avatar', 'avatarUrl', 'avatar_url', 'profilePicture', 'profile_picture',
  'imageUrl', 'image_url', 'picUrl', 'pic_url', 'photoUrl', 'photo_url',
]
function pickAvatar(obj) {
  if (!obj || typeof obj !== 'object') return ''
  // Ảnh đại diện thường nằm trực tiếp hoặc lồng trong user / userInfo / author.
  return asText(pickNested(obj, AVATAR_KEYS))
}

function pickNested(obj, keys) {
  const direct = pick(obj, keys)
  if (direct !== undefined) return direct
  // Thông tin người dùng đôi khi nằm lồng trong user / userInfo / author.
  for (const k of ['user', 'userInfo', 'user_info', 'author', 'sender', 'profile']) {
    const nested = obj?.[k] || obj?.__outer?.[k]
    if (nested && typeof nested === 'object') {
      const v = pick(nested, keys)
      if (v !== undefined) return v
    }
  }
  return undefined
}

function person(obj) {
  const outer = obj.__outer || obj
  const nickname = asText(pickNested(outer, ['nickname', 'displayName', 'display_name', 'username', 'userName', 'uniqueId', 'unique_id', 'userId', 'user_id', 'name']) || pickNested(obj, ['nickname', 'displayName', 'username', 'uniqueId', 'userId', 'name']) || 'Khán giả')
  const userId = asText(pickNested(outer, ['uniqueId', 'unique_id', 'userId', 'user_id', 'secUid', 'sec_uid', 'nickname', 'username']) || nickname)
  // Ảnh đại diện TikTok (nếu connector gửi kèm) — không có thì để trống,
  // màn 3D sẽ vẽ vòng tròn chữ cái đầu tên thay thế.
  const avatar = pickAvatar(outer) || pickAvatar(obj)
  return { nickname, userId, avatar }
}

export function normalizeEvent(rawInput) {
  try {
    let raw = rawInput
    if (typeof raw === 'string') {
      const t = raw.trim()
      if (!t) return null
      try { raw = JSON.parse(t) } catch { return { kind: 'unknown', reason: 'not-json', raw: t.slice(0, 200) } }
    }
    if (Array.isArray(raw)) return raw.flatMap((item) => {
      const n = normalizeEvent(item)
      return n ? [n] : []
    })
    if (!raw || typeof raw !== 'object') return { kind: 'unknown', reason: 'not-object', raw: asText(raw).slice(0, 200) }
    const t = asText(pick(raw, ['type', 'event', 'kind'])).toLowerCase()
    if (['ping', 'pong', 'welcome', 'connected', 'hello', 'heartbeat'].includes(t)) return { kind: 'system', system: t }
    const obj = unwrap(raw)
    const kind = detectKind(obj)
    if (!kind) return { kind: 'unknown', reason: 'unrecognized', raw: JSON.stringify(raw).slice(0, 300) }
    const { nickname, userId, avatar } = person(obj)
    const outer = obj.__outer || obj
    const eventId = asText(pick(outer, ['eventId', 'event_id', 'id', 'msgId', 'messageId']) ?? pick(obj, ['eventId', 'id'])) || undefined
    if (kind === 'chat') {
      const comment = asText(pick(outer, ['comment', 'text', 'message', 'content']) ?? pick(obj, ['comment', 'text', 'message', 'content']))
      if (!comment) return { kind: 'unknown', reason: 'chat-no-text', raw: JSON.stringify(raw).slice(0, 200) }
      return { kind: 'chat', nickname, userId, avatar, comment, id: eventId }
    }
    if (kind === 'gift') {
      const giftName = asText(pick(outer, ['giftName', 'gift_name', 'name', 'gift']) ?? pick(obj, ['giftName', 'gift_name', 'name']) ?? 'Quà tặng')
      const value = Number(pick(outer, ['diamondCount', 'diamond_count', 'diamonds', 'value', 'coins', 'price', 'cost']) ?? pick(obj, ['diamondCount', 'diamonds', 'value', 'coins', 'price']) ?? 1) || 1
      const repeatCount = Number(pick(outer, ['repeatCount', 'repeat_count', 'count', 'repeatEnd']) ?? pick(obj, ['repeatCount', 'count']) ?? 1) || 1
      const text = asText(pick(outer, ['comment', 'text', 'message', 'content']) ?? pick(obj, ['comment', 'text', 'message']) ?? '')
      return { kind: 'gift', nickname, userId, avatar, giftName, value, repeatCount, text, id: eventId }
    }
    if (kind === 'like') {
      const likeCount = Number(pick(outer, ['likeCount', 'like_count', 'count']) ?? pick(obj, ['likeCount', 'count']) ?? 1) || 1
      const total = Number(pick(outer, ['totalLikeCount', 'total_like_count', 'totalLikes', 'total_likes', 'total']) ?? pick(obj, ['totalLikeCount', 'totalLikes', 'total'])) || null
      return { kind: 'like', nickname, userId, avatar, likeCount, total, id: eventId }
    }
    return { kind, nickname, userId, avatar, id: eventId }
  } catch (e) {
    return { kind: 'unknown', reason: 'parse-error: ' + e.message, raw: asText(rawInput).slice(0, 200) }
  }
}

// ─── Bắt kịp sau khi rớt mạng ─────────────────────────────────────────────
// Connector đánh số thứ tự (seq) cho mỗi event và giữ lại 5 phút gần nhất.
// Game ghi nhớ các seq đã nhận để bỏ qua event trùng khi nhận lại —
// live và catch-up đều đi qua đây nên 1 event không bao giờ tính 2 lần.
export function createSeqTracker(limit = 1000) {
  const seen = new Set()
  return {
    // Trả về true nếu seq này đã nhận rồi (bỏ qua), false nếu mới (ghi nhận).
    seen(seq) {
      if (typeof seq !== 'number') return false
      if (seen.has(seq)) return true
      seen.add(seq)
      while (seen.size > limit) seen.delete(seen.values().next().value)
      return false
    },
  }
}

// ─── Lệnh từ bình luận ─────────────────────────────────────────────────────
// A / ĐỎ → vào Đội Đỏ · B / XANH → vào Đội Xanh · tên thú → đội của thú đó
// THAM GIA / JOIN → vào đội đang ít người hơn · BẮT ĐẦU / DỪNG / TIẾP / +30S
// → chỉ streamer (hook kiểm tra ID).
import { parseTeamJoin } from './engine.js'

export function parseCommand(comment) {
  if (!comment) return null
  const text = String(comment).trim()
  if (!text) return null
  const team = parseTeamJoin(text)
  if (team === 'A' || team === 'B') return { cmd: 'joinTeam', teamId: team }
  if (team === 'balance') return { cmd: 'join' }
  const norm = text.toUpperCase()
  // Bỏ dấu @ ở đầu từ đầu tiên: "@Batdau" vẫn tính là BẮT ĐẦU.
  const first = (norm.split(/[\s,.!?:;]+/).filter(Boolean)[0] || '').replace(/^@+/, '')
  if (['START', 'BẮTĐẦU', 'BẮT', 'ĐẦU'].includes(first) || norm.startsWith('BẮT ĐẦU') || norm.startsWith('BAT DAU')) return { cmd: 'start' }
  if (['DỪNG', 'DUNG', 'PAUSE', 'STOP', 'TẠM', 'TAM'].includes(first)) return { cmd: 'pause' }
  if (['TIẾP', 'TIEP', 'RESUME', 'TIẾPTỤC', 'TIEPTUC', 'CHẠY', 'CHAY'].includes(first)) return { cmd: 'resume' }
  const add = norm.match(/^\+(\d+)\s*S$/)
  if (add) return { cmd: 'addTime', seconds: parseInt(add[1], 10) }
  return null
}
