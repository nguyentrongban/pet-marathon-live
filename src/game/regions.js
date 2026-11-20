// ─── Vùng miền (tỉnh + nước) · regions.js ────────────────────────────────
// Một bảng chung cho đấu vùng miền: tỉnh thành Việt Nam (provinces.js) +
// quốc gia (countries.js). Bình luận tên tỉnh thì vào đội tỉnh đó, bình
// luận tên nước thì vào đội nước đó — 2 vùng có nhiều người bình luận
// nhất (mỗi người tính 1 lần) thành 2 đội kéo ở đầu mỗi màn.
// Tỉnh được ưu tiên trước nước khi so tên (tên tỉnh Việt ít trùng tên
// nước hơn; vd "Mỹ Tho" là Đồng Tháp, không phải nước Mỹ).
// regionInfo trả { code, name, short, flag, kind } — flag là '' với tỉnh,
// là emoji cờ với nước (🇺🇸 🇯🇵 🇰🇷...) để hiện cờ trên banner/BXH/tên đội.

import { PROVINCES, provinceInfo, detectProvince } from './provinces.js'
import { COUNTRIES, countryInfo, detectCountry } from './countries.js'

export { PROVINCES, COUNTRIES }

export function regionInfo(code) {
  if (!code) return null
  const key = String(code).toLowerCase()
  const p = provinceInfo(key)
  if (p) return { ...p, flag: '', kind: 'province' }
  const c = countryInfo(key)
  if (c) return { ...c, kind: 'country' }
  return null
}

// Vùng của 1 người: tên tỉnh/nước trong bình luận trước, rồi tên người.
// Trả mã vùng (mã tỉnh hoặc mã nước ISO 2 chữ) hoặc null.
export function detectRegion(text, nickname) {
  return detectProvince(text, nickname) || detectCountry(text, nickname) || null
}
