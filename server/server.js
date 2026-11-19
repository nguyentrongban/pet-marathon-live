// ─── KÉO CO LIVE · server/server.js ──────────────────────────────────
// API tối giản chạy trên Render Web Service (Node, không cần thư viện ngoài):
//   GET  /health       — kiểm tra sống
//   POST /match-result — nhận kết quả 1 trận kéo co, kiểm tra rồi ghi Supabase
//   GET  /leaderboard  — top người thắng nhiều nhất
// Supabase là TÙY CHỌN: chưa có SUPABASE_URL / SUPABASE_SERVICE_KEY thì API
// vẫn chạy, chỉ lưu tạm trong bộ nhớ của service (mất khi service khởi động
// lại) và trả saved:false — game không bao giờ crash vì thiếu cấu hình.

const http = require('node:http')

const PORT = process.env.PORT || 3000
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const supabaseOn = Boolean(SUPABASE_URL && SUPABASE_KEY)

// Lưu tạm trong bộ nhớ khi chưa nối Supabase
const memoryResults = []
const memoryGifts = []

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 200_000) req.destroy()
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try { resolve(JSON.parse(data)) } catch { reject(new Error('JSON không hợp lệ')) }
    })
    req.on('error', reject)
  })
}

async function supabaseInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`Ghi bảng ${table} thất bại (mã ${res.status})`)
}

async function supabaseSelect(view) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}?select=*&order=wins.desc,total_races.desc&limit=10`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Đọc bảng thất bại (mã ${res.status})`)
  return res.json()
}

function validResult(body) {
  if (!body || typeof body !== 'object') return 'Dữ liệu gửi lên không đúng dạng'
  if (!body.matchId || typeof body.matchId !== 'string') return 'Thiếu mã trận đấu'
  if (!body.winnerTeam || (body.winnerTeam !== 'A' && body.winnerTeam !== 'B')) return 'Thiếu đội thắng'
  if (!body.score || typeof body.score.A !== 'number' || typeof body.score.B !== 'number') return 'Thiếu tỉ số trận'
  return null
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  if (req.method === 'OPTIONS') return sendJson(res, 204, {})

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, service: 'pet-marathon-live-api', supabase: supabaseOn, time: new Date().toISOString() })
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendJson(res, 200, { ok: true, service: 'pet-marathon-live-api', endpoints: ['GET /health', 'POST /match-result', 'GET /leaderboard'] })
  }

  if (req.method === 'POST' && url.pathname === '/match-result') {
    let body
    try { body = await readBody(req) } catch { return sendJson(res, 400, { ok: false, error: 'Dữ liệu gửi lên không đọc được' }) }
    const err = validResult(body)
    if (err) return sendJson(res, 400, { ok: false, error: err })
    const row = {
      match_id: body.matchId,
      winner_team: body.winnerTeam,
      score_a: body.score.A,
      score_b: body.score.B,
      total_gifts: typeof body.gifts === 'number' ? body.gifts : 0,
    }
    memoryResults.push(row)
    if (memoryResults.length > 200) memoryResults.shift()
    if (supabaseOn) {
      try {
        await supabaseInsert('match_results', [row])
        return sendJson(res, 200, { ok: true, saved: true, matchId: body.matchId })
      } catch (e) {
        // Ghi mạng lỗi thì vẫn nhận kết quả (đã lưu tạm), báo rõ để Admin biết
        return sendJson(res, 200, { ok: true, saved: false, matchId: body.matchId, note: 'Đã nhận nhưng chưa lưu lên bảng xếp hạng: ' + e.message })
      }
    }
    return sendJson(res, 200, { ok: true, saved: false, matchId: body.matchId, note: 'Chưa nối bảng xếp hạng nên chỉ lưu tạm trên service.' })
  }

  if (req.method === 'GET' && url.pathname === '/leaderboard') {
    if (supabaseOn) {
      try {
        const rows = await supabaseSelect('leaderboard')
        return sendJson(res, 200, { ok: true, source: 'supabase', rows })
      } catch (e) {
        return sendJson(res, 200, { ok: true, source: 'memory', rows: aggregate(memoryResults), note: 'Tạm tính từ bộ nhớ: ' + e.message })
      }
    }
    return sendJson(res, 200, { ok: true, source: 'memory', rows: aggregate(memoryResults) })
  }

  return sendJson(res, 404, { ok: false, error: 'Không tìm thấy đường dẫn này' })
})

function aggregate(rows) {
  const map = new Map()
  for (const r of rows) {
    const name = r.winner_team === 'A' ? 'Đội Đỏ' : 'Đội Xanh'
    const cur = map.get(name) || { winner_nickname: name, wins: 0, total_races: 0 }
    cur.wins += 1
    cur.total_races += 1
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => b.wins - a.wins).slice(0, 10)
}

server.listen(PORT, () => {
  console.log(`pet-marathon-live-api đang chạy ở cổng ${PORT} (supabase: ${supabaseOn ? 'đã nối' : 'chưa nối — chạy chế độ lưu tạm'})`)
})
