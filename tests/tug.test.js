// ─── KÉO CO LIVE · tests/tug.test.js ───────────────────────────────────────
// Test logic thuần (không cần framework): chạy bằng `node tests/tug.test.js`
// hoặc `npm test`. Mỗi test là 1 hàm assert, in PASS/FAIL rồi tổng kết.
import assert from 'node:assert'
import { createSeqTracker, parseCommand } from '../src/game/adapter.js'
import {
  DEFAULT_SETTINGS, GiftEngine, PET_TYPES, TEAMS, advance, applyLikeBoost,
  applyPull, createMatch, endRound, findMember, giftPrice, giftTier, giftTeam,
  joinTeam, migrateGiftMap, parseTeamJoin, pullEffect, startMatch, startRound, tick,
} from '../src/game/engine.js'

let pass = 0, fail = 0
const results = []
function test(name, fn) {
  try { fn(); pass++; results.push(`  ✅ ${name}`) }
  catch (e) { fail++; results.push(`  ❌ ${name}\n     → ${e.message}`) }
}
function freshMatch() {
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } })
  joinTeam(s, 'A', 'Lan', 'lan')
  joinTeam(s, 'B', 'Minh', 'minh')
  startMatch(s)
  s.phase = 'pulling' // bỏ qua đếm ngược cho test
  s.roundTimeLeft = 45
  s.now = 10
  return s
}
function step(s, sec) { const n = Math.ceil(sec / 0.05); for (let i = 0; i < n; i++) tick(s, 0.05) }
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// ── 1. Quà = lực kéo ───────────────────────────────────────────────────────
test('hoa hồng 1 xu kéo dây 0,02 về phía đội tặng', () => {
  const s = freshMatch()
  const r = applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.ok, true)
  assert.ok(approx(s.rope, 0.02), `dây phải ở 0,02, được ${s.rope}`)
  assert.equal(s.teams.A.totalPull, 1)
})

test('hạc giấy 99 xu kéo mạnh nhưng không thắng 1 nốt', () => {
  const s = freshMatch()
  assert.equal(pullEffect(30), 20, 'lực 30 phải giảm còn 20 (giới hạn 1 món)')
  const r = applyPull(s, 'A', 30, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.ok, true)
  assert.ok(approx(s.rope, 0.4), `1 hạc giấy kéo 0,4, được ${s.rope}`)
  assert.equal(s.phase, 'pulling', '1 món quà không được thắng màn ngay')
  applyPull(s, 'A', 30, { nickname: 'Lan', userId: 'lan' })
  assert.ok(approx(s.rope, 0.8), `2 hạc giấy kéo 0,8, được ${s.rope}`)
  assert.equal(s.phase, 'pulling')
  applyPull(s, 'A', 30, { nickname: 'Lan', userId: 'lan' })
  // Vượt vạch 0,9 → tick mới chốt thắng (kiểm tra ở test thắng màn).
  assert.ok(s.rope >= 0.9)
})

test('tặng liên tục mới thắng màn, dây không tự thắng', () => {
  const s = freshMatch()
  step(s, 20)
  assert.ok(approx(s.rope, 0), `không ai kéo thì dây ở giữa, được ${s.rope}`)
  let guard = 0
  while (s.phase === 'pulling' && guard++ < 100) {
    applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' })
    step(s, 0.25)
  }
  assert.equal(s.phase, 'roundEnd', 'kéo liên tục phải thắng màn')
  assert.equal(s.roundWinner, 'A')
  assert.equal(s.teams.A.roundWins, 1)
})

// ── 2. Cơ hội cuối ×2 ──────────────────────────────────────────────────────
test('đội đang thua quá 0,55 được nhân đôi lực kéo', () => {
  const s = freshMatch()
  s.rope = -0.7 // Đội Đỏ đang thua sâu
  const r = applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.ok, true)
  assert.equal(r.comeback, true)
  assert.ok(approx(s.rope, -0.66), `nhân đôi: dây phải lên -0,66, được ${s.rope}`)
  // Đội đang thắng thì không nhân đôi.
  const s2 = freshMatch()
  s2.rope = 0.3
  const r2 = applyPull(s2, 'A', 1, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r2.comeback, false)
  assert.ok(approx(s2.rope, 0.32))
})

// ── 3. Dây tự trôi về giữa ─────────────────────────────────────────────────
test('dây tự trôi về giữa khi không ai kéo', () => {
  const s = freshMatch()
  s.rope = 0.5
  step(s, 10)
  assert.ok(s.rope < 0.4 && s.rope > 0.25, `10 giây phải trôi về ~0,335, được ${s.rope}`)
})

// ── 4. Hết giờ ─────────────────────────────────────────────────────────────
test('hết giờ: đội dẫn trước thắng, dây ở giữa thì hòa', () => {
  const s = freshMatch()
  s.rope = 0.3
  s.roundTimeLeft = 1
  step(s, 1.5)
  assert.equal(s.phase, 'roundEnd')
  assert.equal(s.roundWinner, 'A')
  const s2 = freshMatch()
  s2.rope = 0.02
  s2.roundTimeLeft = 1
  step(s2, 1.5)
  assert.equal(s2.phase, 'roundEnd')
  assert.equal(s2.roundWinner, null, 'dây gần giữa thì hòa')
})

// ── 5. Thả tim tiếp sức đội thua ───────────────────────────────────────────
test('đủ 100 tim tiếp sức cho đội đang thua', () => {
  const s = freshMatch()
  s.rope = 0.4 // Xanh đang thua
  const n = applyLikeBoost(s, 100)
  assert.equal(n, 1)
  assert.ok(approx(s.rope, 0.34), `tiếp sức 0,06 về phía Xanh, được ${s.rope}`)
  assert.equal(s.likes, 100)
  const n2 = applyLikeBoost(s, 250)
  assert.equal(n2, 2, '250 tim = 2 lần tiếp sức')
  assert.ok(approx(s.rope, 0.22))
  assert.equal(s.likes, 350)
  // Dây ở giữa thì tim không đẩy đi đâu.
  const s2 = freshMatch()
  s2.rope = 0
  assert.equal(applyLikeBoost(s2, 100), 0)
})

// ── 6. Vào đội ─────────────────────────────────────────────────────────────
test('bình luận A/B/tên thú/THAM GIA vào đúng đội', () => {
  assert.equal(parseTeamJoin('A'), 'A')
  assert.equal(parseTeamJoin('B'), 'B')
  assert.equal(parseTeamJoin('ĐỘI XANH'), 'B')
  assert.equal(parseTeamJoin('đội đỏ'), 'A')
  assert.equal(parseTeamJoin('Mèo'), 'A')
  assert.equal(parseTeamJoin('Chó'), 'A')
  assert.equal(parseTeamJoin('Hải Ly'), 'B')
  assert.equal(parseTeamJoin('Vịt'), 'B')
  assert.equal(parseTeamJoin('Gấu'), 'B')
  assert.equal(parseTeamJoin('THAM GIA'), 'balance')
  assert.equal(parseTeamJoin('@A'), 'A')
  assert.equal(parseTeamJoin('cho em hỏi'), null, '"cho em hỏi" không được nhận nhầm là Chó')
  assert.equal(parseTeamJoin('hello mọi người'), null)
})

test('vào đội: 1 người chỉ 1 đội, THAM GIA vào đội ít người hơn', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS })
  assert.equal(joinTeam(s, 'A', 'Lan', 'lan').ok, true)
  assert.equal(joinTeam(s, 'B', 'Lan', 'lan').ok, false, 'đã ở đội Đỏ thì không vào thêm đội Xanh')
  assert.equal(joinTeam(s, 'A', 'Lan', 'lan').reason, 'already')
  assert.equal(joinTeam(s, 'balance', 'Minh', 'minh').teamId, 'B', 'đội Xanh ít người hơn nên Minh vào Xanh')
  assert.equal(findMember(s, 'lan').teamId, 'A')
  assert.equal(findMember(s, 'minh').teamId, 'B')
})

// ── 7. Quà kéo cho đội nào ─────────────────────────────────────────────────
test('quà của thành viên kéo cho đội mình, người lạ kéo cho đội thua', () => {
  const s = freshMatch()
  s.rope = 0.3 // Xanh đang thua
  assert.equal(giftTeam(s, 'lan', ''), 'A', 'Lan ở đội Đỏ → kéo Đỏ')
  assert.equal(giftTeam(s, 'nguoi-la', ''), 'B', 'người lạ → kéo cho đội thua (Xanh)')
  assert.equal(giftTeam(s, 'nguoi-la', 'A'), 'A', 'chữ kèm "A" ưu tiên hơn đội thua')
  assert.equal(giftTeam(s, 'lan', 'B'), 'B', 'chữ kèm "B" thắng cả đội của người tặng')
})

// ── 8. GiftEngine: hàng đợi, chống trùng, quà lạ, giữ quà trước giờ G ─────
test('giới hạn toàn cục xếp hàng các lượt kéo đến dồn dập', () => {
  const s = freshMatch()
  const eng = new GiftEngine(s)
  eng.receive({ id: 'e1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  eng.receive({ id: 'e2', giftName: 'Hạc giấy', nickname: 'B', userId: 'b' })
  eng.receive({ id: 'e3', giftName: 'Rosa', nickname: 'C', userId: 'c' })
  assert.equal(eng.queueLength, 3)
  const first = eng.process(10)
  assert.equal(first.ok, true)
  assert.equal(eng.queueLength, 2)
  const tooSoon = eng.process(10.2)
  assert.equal(tooSoon.reason, 'rate-limited')
  assert.equal(eng.queueLength, 2, 'chưa đủ 0,5 giây thì hàng đợi phải còn nguyên')
  const second = eng.process(10.6)
  assert.equal(second.ok, true)
  assert.equal(eng.queueLength, 1)
})

test('trùng event id bị loại, chỉ xử lý 1 lần', () => {
  const s = freshMatch()
  const eng = new GiftEngine(s)
  const a = eng.receive({ id: 'dup-1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  const b = eng.receive({ id: 'dup-1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  assert.equal(a.ok, true)
  assert.equal(b.ok, false)
  assert.equal(b.reason, 'duplicate')
  assert.equal(eng.droppedDuplicates, 1)
  assert.equal(eng.queueLength, 1)
})

test('quà lạ bị bỏ qua, quà tặng trước giờ G vẫn tính khi vào màn', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } })
  const eng = new GiftEngine(s)
  const unmapped = eng.receive({ id: 'u1', giftName: 'Quà lạ hoắc', nickname: 'A', userId: 'a' })
  assert.equal(unmapped.ok, false)
  assert.equal(unmapped.reason, 'unmapped')
  assert.equal(eng.queueLength, 0)
  // Đang chờ (chưa kéo): quà vẫn xếp hàng, không mất.
  const r = eng.receive({ id: 'e1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  assert.equal(r.ok, true)
  const held = eng.process(10)
  assert.equal(held.reason, 'not-pulling')
  assert.equal(eng.queueLength, 1, 'chưa vào màn thì quà phải còn trong hàng đợi')
  // Vào màn rồi thì xử lý được.
  s.phase = 'pulling'
  const done = eng.process(10)
  assert.equal(done.ok, true)
  assert.equal(eng.queueLength, 0)
})

test('bảng quà cũ (chiêu dạng chữ) được đổi sang lực kéo', () => {
  assert.deepEqual(migrateGiftMap({ 'hoa hong': 'banana', 'hac giay': 'dizzy', 'rosa': 6 }), {
    'hoa hong': 1, 'hac giay': 30, rosa: 6,
  })
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { 'hoa hong': 'banana' } })
  const eng = new GiftEngine(s)
  assert.equal(eng.resolveGift('Hoa Hồng'), 1)
  assert.equal(eng.resolveGift('Quà lạ hoắc'), null)
})

test('giá xu quà TikTok + bậc kéo theo xu', () => {
  assert.equal(giftPrice('Hoa hồng'), 1)
  assert.equal(giftPrice('Rosa'), 10)
  assert.equal(giftPrice('Hạc giấy'), 99)
  assert.equal(giftPrice('Quà lạ hoắc'), null)
  assert.equal(giftTier(1), 'Kéo nhẹ')
  assert.equal(giftTier(5), 'Kéo vừa')
  assert.equal(giftTier(20), 'Kéo mạnh')
  assert.equal(giftTier(99), 'Kéo cực mạnh')
})

// ── 9. Lệnh bình luận ───────────────────────────────────────────────────────
test('lệnh bình luận: A/B vào đội, BẮT ĐẦU/DỪNG/+30S', () => {
  assert.deepEqual(parseCommand('A'), { cmd: 'joinTeam', teamId: 'A' })
  assert.deepEqual(parseCommand('B'), { cmd: 'joinTeam', teamId: 'B' })
  assert.deepEqual(parseCommand('ĐỘI XANH'), { cmd: 'joinTeam', teamId: 'B' })
  assert.deepEqual(parseCommand('THAM GIA'), { cmd: 'join' })
  assert.deepEqual(parseCommand('@Thamgia'), { cmd: 'join' })
  assert.deepEqual(parseCommand('BẮT ĐẦU'), { cmd: 'start' })
  assert.deepEqual(parseCommand('DỪNG'), { cmd: 'pause' })
  assert.deepEqual(parseCommand('TIẾP'), { cmd: 'resume' })
  assert.deepEqual(parseCommand('+30S'), { cmd: 'addTime', seconds: 30 })
  assert.equal(parseCommand('hello mọi người'), null)
  assert.equal(parseCommand('cho em hỏi'), null)
})

test('bộ nhớ seq: event trùng chỉ tính 1 lần (bắt kịp sau rớt mạng)', () => {
  const t = createSeqTracker(3)
  assert.equal(t.seen(1), false)
  assert.equal(t.seen(1), true)
  assert.equal(t.seen(2), false)
  assert.equal(t.seen('x'), false)
  assert.equal(t.seen(3), false)
  assert.equal(t.seen(4), false)
  // Quá giới hạn 3: seq cũ nhất (1) bị quên, nhận lại thì tính là mới.
  assert.equal(t.seen(1), false)
  assert.equal(t.seen(4), true)
})

// ── 10. Trận: thắng 3 màn, ngôi sao may mắn ────────────────────────────────
test('thắng 3 màn trước thì vô địch trận', () => {
  const s = freshMatch()
  s.teams.A.roundWins = 2
  endRound(s, 'A')
  assert.equal(s.phase, 'matchEnd')
  assert.equal(s.matchWinner, 'A')
  assert.equal(s.teams.A.roundWins, 3)
})

test('đội thắng màn được ngôi sao may mắn ở màn sau', () => {
  const s = freshMatch()
  endRound(s, 'B')
  assert.equal(s.phase, 'roundEnd')
  assert.deepEqual(s.luckyStar, { team: 'B' })
  s.round++
  startRound(s)
  assert.ok(approx(s.rope, -0.12), `màn sau dây bắt đầu lệch -0,12 về Xanh, được ${s.rope}`)
})

test('đủ 2 đội, đủ 6 thú', () => {
  assert.equal(TEAMS.A.pets.length, 3)
  assert.equal(TEAMS.B.pets.length, 3)
  assert.equal(PET_TYPES.length, 6)
  assert.equal(new Set([...TEAMS.A.pets, ...TEAMS.B.pets]).size, 6)
})

// ── 11. Tiến thời gian thực: tab nền (dt lớn) vẫn đúng giờ ────────────────
test('đếm ngược + hết giờ màn chạy đúng với dt lớn', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } })
  startMatch(s)
  assert.equal(s.phase, 'countdown')
  advance(s, 3.5)
  assert.equal(s.phase, 'pulling', 'đếm ngược 3s phải xong dù chỉ gọi 1 lần với dt=3,5')
  // advance() cắt dt > 5s (tab ngủ dài) nên tua 45 giây bằng step().
  step(s, 46)
  assert.equal(s.phase, 'roundEnd', 'hết 45 giây phải xong màn')
  assert.equal(s.roundWinner, null, 'không ai kéo thì hòa')
  step(s, 8.5)
  assert.equal(s.phase, 'countdown', 'hết 8 giây nghỉ phải sang màn sau')
  assert.equal(s.round, 2)
})

console.log('\n🪢 KÉO CO LIVE — test logic kéo co')
for (const line of results) console.log(line)
console.log(`\n${pass} đậu · ${fail} rớt · tổng ${pass + fail}`)
if (fail > 0) process.exit(1)
