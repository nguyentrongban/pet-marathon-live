// ─── Cờ các quốc gia · countries.js ────────────────────────────────────────
// Tinh thần dân tộc: quà tặng được tính theo nước của người tặng, nước dẫn
// đầu được thưởng thêm lực kéo (×1,5) để khán giả tặng quà đưa nước mình
// lên số 1 rồi giữ vị trí đó.
// TikTok KHÔNG gửi kèm nước của người tặng trong event, nên game lấy nước
// từ 2 chỗ:
//  · cờ emoji (🇻🇳) hoặc mã nước (VN) trong bình luận / tên người tặng
//  · mã nước người đó đã bình luận trước đó (nhớ theo userId trong phiên)

export const COUNTRIES = {
  VN: { flag: '🇻🇳', name: 'Việt Nam' },
  US: { flag: '🇺🇸', name: 'Mỹ' },
  KR: { flag: '🇰🇷', name: 'Hàn Quốc' },
  JP: { flag: '🇯🇵', name: 'Nhật Bản' },
  TH: { flag: '🇹🇭', name: 'Thái Lan' },
  ID: { flag: '🇮🇩', name: 'Indonesia' },
  MY: { flag: '🇲🇾', name: 'Malaysia' },
  SG: { flag: '🇸🇬', name: 'Singapore' },
  PH: { flag: '🇵🇭', name: 'Philippines' },
  TW: { flag: '🇹🇼', name: 'Đài Loan' },
  CN: { flag: '🇨🇳', name: 'Trung Quốc' },
  HK: { flag: '🇭🇰', name: 'Hồng Kông' },
  IN: { flag: '🇮🇳', name: 'Ấn Độ' },
  AU: { flag: '🇦🇺', name: 'Úc' },
  CA: { flag: '🇨🇦', name: 'Canada' },
  GB: { flag: '🇬🇧', name: 'Anh' },
  FR: { flag: '🇫🇷', name: 'Pháp' },
  DE: { flag: '🇩🇪', name: 'Đức' },
  IT: { flag: '🇮🇹', name: 'Ý' },
  ES: { flag: '🇪🇸', name: 'Tây Ban Nha' },
  NL: { flag: '🇳🇱', name: 'Hà Lan' },
  SE: { flag: '🇸🇪', name: 'Thụy Điển' },
  NO: { flag: '🇳🇴', name: 'Na Uy' },
  FI: { flag: '🇫🇮', name: 'Phần Lan' },
  DK: { flag: '🇩🇰', name: 'Đan Mạch' },
  PL: { flag: '🇵🇱', name: 'Ba Lan' },
  UA: { flag: '🇺🇦', name: 'Ukraine' },
  RU: { flag: '🇷🇺', name: 'Nga' },
  TR: { flag: '🇹🇷', name: 'Thổ Nhĩ Kỳ' },
  AE: { flag: '🇦🇪', name: 'UAE' },
  SA: { flag: '🇸🇦', name: 'Ả Rập Xê Út' },
  IL: { flag: '🇮🇱', name: 'Israel' },
  BR: { flag: '🇧🇷', name: 'Brazil' },
  MX: { flag: '🇲🇽', name: 'Mexico' },
  AR: { flag: '🇦🇷', name: 'Argentina' },
  NZ: { flag: '🇳🇿', name: 'New Zealand' },
  ZA: { flag: '🇿🇦', name: 'Nam Phi' },
  NG: { flag: '🇳🇬', name: 'Nigeria' },
  EG: { flag: '🇪🇬', name: 'Ai Cập' },
  KZ: { flag: '🇰🇿', name: 'Kazakhstan' },
  MN: { flag: '🇲🇳', name: 'Mông Cổ' },
  LA: { flag: '🇱🇦', name: 'Lào' },
  KH: { flag: '🇰🇭', name: 'Campuchia' },
  MM: { flag: '🇲🇲', name: 'Myanmar' },
  BN: { flag: '🇧🇳', name: 'Brunei' },
}

export function countryInfo(code) {
  if (!code) return null
  const c = COUNTRIES[String(code).toUpperCase()]
  return c ? { code: String(code).toUpperCase(), flag: c.flag, name: c.name } : null
}

export function flagFor(code) {
  return countryInfo(code)?.flag || '🌍'
}

// Cờ emoji là cặp "regional indicator" (🇻🇳 = U+1F1FB U+1F1F3) → mã nước VN.
const RI_BASE = 0x1F1E6
export function flagEmojiToCode(text) {
  if (!text) return null
  const m = String(text).match(/[\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}]/u)
  if (!m) return null
  const code = [...m[0]].map((ch) => String.fromCharCode(65 + (ch.codePointAt(0) - RI_BASE))).join('')
  return COUNTRIES[code] ? code : null
}

// Mã nước gõ tay (VN, US...) — chỉ tính khi BÌNH LUẬN CHỈ CÓ ĐÚNG MÃ ĐÓ.
// (Bình luận dài hơn thì không tính: "in love" mà nhận thành Ấn Độ thì
// oan, còn cờ emoji thì nhận trong câu dài vẫn an toàn vì cờ không nhầm.)
export function codeTokenToCode(text) {
  if (!text) return null
  const flat = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').trim()
  return COUNTRIES[flat] ? flat : null
}

// Nước của 1 người: cờ emoji trong bình luận/tên trước, rồi mã nước gõ tay
// trong bình luận. (Mã nước trong TÊN không tính — tên "In Love" mà nhận
// thành Ấn Độ thì oan; cờ trong tên thì tính vì cờ không nhầm được.)
export function detectCountry(text, nickname) {
  return flagEmojiToCode(text) || flagEmojiToCode(nickname) || codeTokenToCode(text) || null
}
