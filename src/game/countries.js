// ─── Quốc gia · countries.js ──────────────────────────────────────────────
// Người nước ngoài xem live: bình luận tên nước mình ("USA", "Japan",
// "Hàn Quốc"...) thì tự vào đội nước đó, hiện cờ tương ứng trên chỗ kéo
// co như tỉnh thành (banner 3D + BXH + tên đội). Nước đấu chung 1 bảng
// với tỉnh thành: 2 vùng (tỉnh hoặc nước) có nhiều người bình luận nhất
// thành 2 đội kéo ở đầu mỗi màn.
// Tên nước ghi bằng tiếng Việt (tên hiển thị) + alias tiếng Anh để người
// nước ngoài gõ tên nước mình bằng tiếng Anh cũng nhận. Mã nước là mã ISO
// 2 chữ (us, jp, kr...) — không trùng mã tỉnh (tỉnh toàn mã 3 chữ trở
// lên) nên dùng chung 1 bảng vùng miền được.
// Alias 1 từ trùng tên người (Mỹ, Đức, Pháp, Nga...) thì chấp nhận như
// tên mascot (Lan/Hương): ai bình luận đúng tên đó thì tính là ủng hộ
// nước đó — giống như bình luận "Lan" là vào đội B vậy.

const C = (code, name, short, flag, aliases) => ({
  code, name, short, flag,
  match: aliases.map((a) => a.split(' ')),
})

export const COUNTRIES = [
  C('us', 'Mỹ', 'MỸ', '🇺🇸', ['USA', 'MY', 'HOA KY', 'UNITED STATES', 'AMERICA']),
  C('jp', 'Nhật Bản', 'NHẬT BẢN', '🇯🇵', ['JAPAN', 'NHAT BAN', 'NHAT']),
  C('kr', 'Hàn Quốc', 'HÀN QUỐC', '🇰🇷', ['KOREA', 'HAN QUOC', 'SOUTH KOREA', 'HAN']),
  C('cn', 'Trung Quốc', 'TRUNG QUỐC', '🇨🇳', ['CHINA', 'TRUNG QUOC', 'TRUNG']),
  C('th', 'Thái Lan', 'THÁI LAN', '🇹🇭', ['THAILAND', 'THAI LAN', 'THAI']),
  C('tw', 'Đài Loan', 'ĐÀI LOAN', '🇹🇼', ['TAIWAN', 'DAI LOAN', 'DAI']),
  C('sg', 'Singapore', 'SINGAPORE', '🇸🇬', ['SINGAPORE', 'SING']),
  C('my', 'Malaysia', 'MALAYSIA', '🇲🇾', ['MALAYSIA', 'MA LAI', 'MA LAY SIA']),
  C('id', 'Indonesia', 'INDONESIA', '🇮🇩', ['INDONESIA', 'INDO']),
  C('ph', 'Philippines', 'PHILIPPINES', '🇵🇭', ['PHILIPPINES', 'PHI LIP PIN', 'PHILIPPIN']),
  C('vn', 'Việt Nam', 'VIỆT NAM', '🇻🇳', ['VIETNAM', 'VIET NAM']),
  C('in', 'Ấn Độ', 'ẤN ĐỘ', '🇮🇳', ['INDIA', 'AN DO']),
  C('au', 'Úc', 'ÚC', '🇦🇺', ['AUSTRALIA', 'UC']),
  C('ca', 'Canada', 'CANADA', '🇨🇦', ['CANADA']),
  C('gb', 'Anh', 'ANH', '🇬🇧', ['ENGLAND', 'UNITED KINGDOM', 'UK', 'BRITAIN', 'ANH QUOC']),
  C('fr', 'Pháp', 'PHÁP', '🇫🇷', ['FRANCE', 'PHAP']),
  C('de', 'Đức', 'ĐỨC', '🇩🇪', ['GERMANY', 'DUC']),
  C('ru', 'Nga', 'NGA', '🇷🇺', ['RUSSIA', 'NGA']),
  C('br', 'Brazil', 'BRAZIL', '🇧🇷', ['BRAZIL', 'BRA XIN', 'BRAXIN']),
  C('mx', 'Mexico', 'MEXICO', '🇲🇽', ['MEXICO', 'ME HI CO', 'MEHICO']),
  C('es', 'Tây Ban Nha', 'TÂY BAN NHA', '🇪🇸', ['SPAIN', 'TAY BAN NHA']),
  C('it', 'Ý', 'Ý', '🇮🇹', ['ITALY', 'ITALIA']),
  C('nl', 'Hà Lan', 'HÀ LAN', '🇳🇱', ['NETHERLANDS', 'HA LAN', 'HOLLAND']),
  C('tr', 'Thổ Nhĩ Kỳ', 'THỔ NHĨ KỲ', '🇹🇷', ['TURKEY', 'THO NHI KY', 'TURKIYE']),
  C('ae', 'UAE', 'UAE', '🇦🇪', ['UAE', 'DUBAI', 'ARAP']),
  C('sa', 'Ả Rập Xê Út', 'Ả RẬP XÊ ÚT', '🇸🇦', ['SAUDI ARABIA', 'A RAP XE UT', 'SAUDI']),
  C('eg', 'Ai Cập', 'AI CẬP', '🇪🇬', ['EGYPT', 'AI CAP']),
  C('za', 'Nam Phi', 'NAM PHI', '🇿🇦', ['SOUTH AFRICA', 'NAM PHI']),
  C('nz', 'New Zealand', 'NEW ZEALAND', '🇳🇿', ['NEW ZEALAND', 'TAN TAY LAN', 'NEWZEALAND']),
  C('la', 'Lào', 'LÀO', '🇱🇦', ['LAOS', 'LAO']),
  C('kh', 'Campuchia', 'CAMPUCHIA', '🇰🇭', ['CAMBODIA', 'CAMPUCHIA', 'KHMER']),
  C('mm', 'Myanmar', 'MYANMAR', '🇲🇲', ['MYANMAR', 'MIEN DIEN', 'BURMA']),
  C('hk', 'Hồng Kông', 'HỒNG KÔNG', '🇭🇰', ['HONG KONG', 'HONGKONG']),
]

const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]))

export function countryInfo(code) {
  if (!code) return null
  const c = BY_CODE[String(code).toLowerCase()]
  return c ? { code: c.code, name: c.name, short: c.short, flag: c.flag } : null
}

// Tách bình luận thành các từ (bỏ dấu, viết hoa) để so tên nước.
function tokensOf(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
}
// Tên nước có khớp 1 cụm từ liên tiếp trong bình luận không.
function containsSeq(tokens, seq) {
  if (!seq.length || seq.length > tokens.length) return false
  for (let i = 0; i <= tokens.length - seq.length; i++) {
    let ok = true
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) { ok = false; break }
    if (ok) return true
  }
  return false
}
function countryInText(text) {
  const tokens = tokensOf(text)
  if (!tokens.length) return null
  for (const c of COUNTRIES) {
    for (const seq of c.match) if (containsSeq(tokens, seq)) return c.code
  }
  return null
}

// Nước của 1 người: tên nước trong bình luận trước, rồi tên trong tên người.
export function detectCountry(text, nickname) {
  return countryInText(text) || countryInText(nickname) || null
}
