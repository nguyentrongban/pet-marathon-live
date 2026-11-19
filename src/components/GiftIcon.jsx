// ─── GiftIcon.jsx ────────────────────────────────────────────────────────
// Sticker cho hiệu ứng tặng quà: mỗi món quà TikTok hiện icon ĐÚNG món
// quà đó — CHỈ dùng ảnh thật của TikTok (public/gifts/*.webp, ảnh gốc
// TikTok, nền trong suốt), KHÔNG dùng icon bên ngoài (Lucide...). Món
// nào chưa có ảnh đúng tên thì hiện ảnh thật của món cùng bậc lực kéo
// (theo power) để lúc nào cũng là icon quà TikTok thật.
// Giá xu đã xác nhận: Hoa hồng 1, Quả đào 5, Cỏ bốn lá 10, Nước hoa 20,
// Hạc giấy 99 (khớp bảng giá quà TikTok + beetgames.com).
const GIFT_IMAGES = [
  { keys: ['hoa hồng', 'rose'], src: '/gifts/rose.webp', power: 1 },
  { keys: ['quả đào', 'peach'], src: '/gifts/peach.webp', power: 5 },
  { keys: ['cỏ bốn lá', 'shamrock'], src: '/gifts/shamrock.webp', power: 10 },
  { keys: ['nước hoa', 'perfume'], src: '/gifts/perfume.webp', power: 25 },
  { keys: ['hạc giấy', 'paper crane'], src: '/gifts/paper_crane.webp', power: 100 },
]

export function giftImageSrc(giftName) {
  const name = String(giftName || '').toLowerCase().trim()
  if (!name) return null
  for (const entry of GIFT_IMAGES) {
    if (entry.keys.some((k) => name.includes(k))) return entry.src
  }
  return null
}

// Món quà lạ (không có ảnh đúng tên): lấy ảnh thật của món cùng bậc lực
// kéo gần nhất để hiệu ứng lúc nào cũng hiện icon quà TikTok thật.
export function giftImageForPower(power) {
  const p = Number(power) || 0
  if (p <= 1) return '/gifts/rose.webp'
  if (p <= 5) return '/gifts/peach.webp'
  if (p <= 10) return '/gifts/shamrock.webp'
  if (p <= 25) return '/gifts/perfume.webp'
  return '/gifts/paper_crane.webp'
}

export default function GiftIcon({ gift, power, size = 20, className = '' }) {
  // Có ảnh thật đúng tên → hiện ảnh thật; không có → ảnh thật cùng bậc
  // lực kéo; không có cả tên lẫn power → ảnh Hoa hồng (quà TikTok 1 xu)
  // làm ảnh chung. Không bao giờ dùng icon bên ngoài.
  const imgSrc = giftImageSrc(gift) || (power != null ? giftImageForPower(power) : null) || '/gifts/rose.webp'
  // width/height là attribute (không phải inline style) để CSS class như
  // .fw-gift-ic (vòng vàng 84px) vẫn ghi đè được khi cần.
  return (
    <img
      src={imgSrc}
      alt={String(gift || 'quà')}
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
      className={className}
    />
  )
}
