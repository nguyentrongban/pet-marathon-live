// ─── PET MARATHON LIVE · adapter.js ────────────────────────────────────────
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

function person(obj) {
  const outer = obj.__outer || obj
  const nickname = asText(pick(outer, ['nickname', 'displayName', 'display_name', 'username', 'userName', 'uniqueId', 'unique_id', 'userId', 'user_id', 'name']) || pick(obj, ['nickname', 'displayName', 'username', 'uniqueId', 'userId', 'name']) || 'Khán giả')
  const userId = asText(pick(outer, ['uniqueId', 'unique_id', 'userId', 'user_id', 'secUid', 'sec_uid', 'nickname', 'username']) || nickname)
  return { nickname, userId }
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
    const { nickname, userId } = person(obj)
    const outer = obj.__outer || obj
    const eventId = asText(pick(outer, ['eventId', 'event_id', 'id', 'msgId', 'messageId']) ?? pick(obj, ['eventId', 'id'])) || undefined
    if (kind === 'chat') {
      const comment = asText(pick(outer, ['comment', 'text', 'message', 'content']) ?? pick(obj, ['comment', 'text', 'message', 'content']))
      if (!comment) return { kind: 'unknown', reason: 'chat-no-text', raw: JSON.stringify(raw).slice(0, 200) }
      return { kind: 'chat', nickname, userId, comment, id: eventId }
    }
    if (kind === 'gift') {
      const giftName = asText(pick(outer, ['giftName', 'gift_name', 'name', 'gift']) ?? pick(obj, ['giftName', 'gift_name', 'name']) ?? 'Quà tặng')
      const value = Number(pick(outer, ['diamondCount', 'diamond_count', 'diamonds', 'value', 'coins', 'price', 'cost']) ?? pick(obj, ['diamondCount', 'diamonds', 'value', 'coins', 'price']) ?? 1) || 1
      const repeatCount = Number(pick(outer, ['repeatCount', 'repeat_count', 'count', 'repeatEnd']) ?? pick(obj, ['repeatCount', 'count']) ?? 1) || 1
      const text = asText(pick(outer, ['comment', 'text', 'message', 'content']) ?? pick(obj, ['comment', 'text', 'message']) ?? '')
      return { kind: 'gift', nickname, userId, giftName, value, repeatCount, text, id: eventId }
    }
    if (kind === 'like') {
      const likeCount = Number(pick(outer, ['likeCount', 'like_count', 'count']) ?? pick(obj, ['likeCount', 'count']) ?? 1) || 1
      const total = Number(pick(outer, ['totalLikeCount', 'total_like_count', 'totalLikes', 'total_likes', 'total']) ?? pick(obj, ['totalLikeCount', 'totalLikes', 'total'])) || null
      return { kind: 'like', nickname, userId, likeCount, total, id: eventId }
    }
    return { kind, nickname, userId, id: eventId }
  } catch (e) {
    return { kind: 'unknown', reason: 'parse-error: ' + e.message, raw: asText(rawInput).slice(0, 200) }
  }
}

// ─── Lệnh từ bình luận ─────────────────────────────────────────────────────
// THAM GIA / JOIN → vào đua · DỪNG / TIẾP / +30S → chỉ streamer (hook kiểm tra ID)
export function parseCommand(comment) {
  if (!comment) return null
  const text = String(comment).trim()
  if (!text) return null
  const norm = text.toUpperCase()
  const first = norm.split(/[\s,.!?:;]+/).filter(Boolean)[0] || ''
  if (['THAMGIA', 'THAM', 'JOIN', 'VÀO', 'VAO', 'CHƠI', 'CHOI', 'ĐUA', 'DUA'].includes(first)
    || norm.startsWith('THAM GIA') || norm.startsWith('THAMGIA')) return { cmd: 'join' }
  if (['START', 'BẮTĐẦU', 'BẮT', 'ĐẦU'].includes(first) || norm.startsWith('BẮT ĐẦU') || norm.startsWith('BAT DAU')) return { cmd: 'start' }
  if (['DỪNG', 'DUNG', 'PAUSE', 'STOP', 'TẠM', 'TAM'].includes(first)) return { cmd: 'pause' }
  if (['TIẾP', 'TIEP', 'RESUME', 'TIẾPTỤC', 'TIEPTUC', 'CHẠY', 'CHAY'].includes(first)) return { cmd: 'resume' }
  const add = norm.match(/^\+(\d+)\s*S$/)
  if (add) return { cmd: 'addTime', seconds: parseInt(add[1], 10) }
  return null
}
