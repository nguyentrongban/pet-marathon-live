// ─── PET MARATHON LIVE · supabase.js ───────────────────────────────────────
// Đọc bảng xếp hạng từ Supabase qua REST (không cần thư viện nặng).
// Cấu hình qua env VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — KHÔNG hardcode
// key trong code. Chưa có env → trả { configured: false }, game chạy local,
// Admin hiện câu tiếng Việt dễ hiểu, không crash, không hiện lỗi thô.

const URL = import.meta.env?.VITE_SUPABASE_URL || ''
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

export function supabaseConfigured() {
  return Boolean(URL && KEY)
}

export async function fetchLeaderboard(limit = 10) {
  if (!supabaseConfigured()) return { configured: false, rows: [] }
  try {
    const res = await fetch(
      `${URL.replace(/\/$/, '')}/rest/v1/leaderboard?select=*&order=wins.desc,total_races.desc&limit=${limit}`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
    )
    if (!res.ok) return { configured: true, rows: [], error: true }
    const rows = await res.json()
    return { configured: true, rows: Array.isArray(rows) ? rows : [] }
  } catch {
    return { configured: true, rows: [], error: true }
  }
}

// Ghi kết quả đua: ưu tiên gọi API backend (server/) — hàm này chỉ là đường
// dự phòng khi Admin muốn ghi trực tiếp. Không có env thì không làm gì.
export async function logRaceResult() {
  return { configured: supabaseConfigured(), saved: false }
}
