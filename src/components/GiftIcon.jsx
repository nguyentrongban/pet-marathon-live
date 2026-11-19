// ─── GiftIcon.jsx ────────────────────────────────────────────────────────
// Sticker cho hiệu ứng tặng quà: mỗi món quà TikTok hiện 1 icon Lucide
// phù hợp với chính món quà đó (hoa hồng = hoa, hạc giấy = chim, kem =
// ốc quế...), có animation CSS (nảy/lấp lánh) thay cho emoji 🎁 chung
// chung. Dùng chung cho hiệu ứng quà nhỏ/to + BXH.

import {
  Apple, Bird, Bomb, Cake, Candy, Car, Cat, Cherry, Citrus, Clover,
  Coffee, Crown, CupSoda, FlaskConical, Flower2, Gift, Hand, Heart,
  IceCreamCone, Magnet, Music, Network, PartyPopper, PawPrint, Rocket,
  Shield, Sparkles, SprayCan, Star, ThumbsUp, Volleyball, Zap,
} from 'lucide-react'

// Tên quà (đã chuẩn hoá về chữ thường, khớp GiftEngine.normGiftName)
// → component Lucide. Khớp 1 phần: 'hoa hồng' chứa 'hoa' vẫn ra Flower2.
const GIFT_LUCIDE = [
  { keys: ['hoa hồng', 'rosa', 'hoa'], icon: Flower2 },
  { keys: ['hạc giấy', 'paper crane', 'hạc'], icon: Bird },
  { keys: ['kem ốc quế', 'ice cream', 'kem', 'bing chilling'], icon: IceCreamCone },
  { keys: ['nước hoa', 'perfume'], icon: SprayCan },
  { keys: ['quả đào', 'peach', 'đào'], icon: Apple },
  { keys: ['cỏ bốn lá', 'four-leaf clover', 'clover', 'cỏ'], icon: Clover },
  { keys: ['dưa hấu', 'watermelon', 'dưa'], icon: Citrus },
  { keys: ['tên lửa', 'rocket'], icon: Rocket },
  { keys: ['khiên', 'shield'], icon: Shield },
  { keys: ['bom'], icon: Bomb },
  { keys: ['xe hơi', 'car', 'xe'], icon: Car },
  { keys: ['kẹo', 'candy'], icon: Candy },
  { keys: ['trà sữa'], icon: CupSoda },
  { keys: ['cà phê', 'coffee'], icon: Coffee },
  { keys: ['mèo'], icon: Cat },
  { keys: ['gấu'], icon: PawPrint },
  { keys: ['bánh kem', 'bánh', 'cake'], icon: Cake },
  { keys: ['bóng bay', 'balloon'], icon: PartyPopper },
  { keys: ['little kisses', 'thả tim cho tôi', 'bắn tim', 'finger heart', 'tim'], icon: Heart },
  { keys: ['ngôi sao', 'star', 'sao'], icon: Star },
  { keys: ['vương miện', 'crown'], icon: Crown },
  { keys: ['găng tay', 'boxing', 'găng'], icon: Hand },
  { keys: ['lưới'], icon: Network },
  { keys: ['thuốc', 'potion'], icon: FlaskConical },
  { keys: ['nam châm', 'magnet'], icon: Magnet },
  { keys: ['nhịp trống mirwas', 'mirwas', 'nhạc tự do', 'nhạc xưa', 'tiktok'], icon: Music },
  { keys: ['trái bóng xoáy'], icon: Volleyball },
  { keys: ['phản ứng quá lố'], icon: Zap },
  { keys: ['ok'], icon: ThumbsUp },
  { keys: ['đỉnh', 'gg'], icon: Sparkles },
  { keys: ['cherry', 'anh đào'], icon: Cherry },
]

export function giftLucideComponent(giftName) {
  const name = String(giftName || '').toLowerCase().trim()
  if (!name) return Gift
  for (const entry of GIFT_LUCIDE) {
    if (entry.keys.some((k) => name.includes(k))) return entry.icon
  }
  return Gift
}

export default function GiftIcon({ gift, size = 20, className = '', strokeWidth = 2 }) {
  const Icon = giftLucideComponent(gift)
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />
}
