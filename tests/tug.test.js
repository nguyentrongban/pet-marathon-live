// ─── KÉO CO LIVE · tests/tug.test.js ───────────────────────────────────────
// Test logic thuần (không cần framework): chạy bằng `node tests/tug.test.js`
// hoặc `npm test`. Mỗi test là 1 hàm assert, in PASS/FAIL rồi tổng kết.
// LUẬT v2: thành viên = +1 lực kéo liên tục · quà = bùng lực (99 xu = 100,
// bằng 100 người, tắt dần) · tim = +lực kéo (cả phòng đủ 100 tim → +10 lực
// cho đội của người thả tim đó, tối đa +60 lực/màn).
import assert from 'node:assert'
import { createSeqTracker, normalizeEvent, parseCommand } from '../src/game/adapter.js'
import { detectProvince, provinceInfo, provinceRank } from '../src/game/provinces.js'
import { detectCountry, countryInfo } from '../src/game/countries.js'
import { detectRegion, regionInfo } from '../src/game/regions.js'
import { MUSIC_TRACKS, MusicEngine } from '../src/game/music.js'
import { FPT_COOLDOWN_MS, VOICE_IDS, VOICE_OPTIONS, VoiceEngine, voiceTextBxh, voiceTextFinal, voiceTextGift, voiceTextLikes, voiceTextMatchWin, voiceTextRoundStart, voiceTextRoundWin } from '../src/game/voice.js'
import {
  DEFAULT_SETTINGS, GiftEngine, MEMBER_TYPES, TEAMS, advance, applyLikes,
  applyPull, clearBxh, createMatch, endRound, findMember, giftBoost, giftPrice, giftTier,
  giftTeam, joinProvince, joinTeam, migrateGiftMap, parseTeamJoin, pushToast, startMatch, startRound,
  syncProvinceTeams, teamLabel, provinceLeader, teamStrength, tick, topGifters, topLikers, topProvinces, topProvincesByComments, visibleMembers,
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
function crowdMatch(aCount, bCount) {
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } })
  for (let i = 0; i < aCount; i++) joinTeam(s, 'A', `A${i}`, `a${i}`)
  for (let i = 0; i < bCount; i++) joinTeam(s, 'B', `B${i}`, `b${i}`)
  startMatch(s)
  s.phase = 'pulling'
  s.roundTimeLeft = 45
  s.now = 10
  return s
}
function step(s, sec) { const n = Math.ceil(sec / 0.05); for (let i = 0; i < n; i++) tick(s, 0.05) }
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// ── 1. Thành viên = lực kéo liên tục ───────────────────────────────────────
test('mỗi người vào đội là +1 lực kéo liên tục', () => {
  const s = freshMatch()
  assert.equal(teamStrength(s, 'A'), 1, '1 người = sức mạnh 1')
  joinTeam(s, 'A', 'Hoa', 'hoa')
  joinTeam(s, 'A', 'Mai', 'mai')
  assert.equal(teamStrength(s, 'A'), 3, '3 người = sức mạnh 3')
  assert.equal(teamStrength(s, 'B'), 1)
})

test('đội đông người kéo thắng đội ít người (không cần quà)', () => {
  const s = crowdMatch(10, 1)
  step(s, 15) // dây chậm (0,08/giây) nên 10 đấu 1 cần ~12 giây mới tới vạch thắng
  assert.equal(s.phase, 'roundEnd', 'đội 10 người phải thắng màn')
  assert.equal(s.roundWinner, 'A')
  assert.equal(s.teams.A.roundWins, 1)
})

test('không ai kéo thì dây đứng yên ở giữa (2 đội ngang nhau)', () => {
  const s = freshMatch()
  step(s, 5)
  assert.ok(approx(s.rope, 0), `2 đội 1-1 thì dây ở giữa, được ${s.rope}`)
})

// ── 2. Quà = bùng lực, 99 xu = 100 người ───────────────────────────────────
test('hạc giấy 99 xu = 100 lực, tối đa 100/món', () => {
  assert.equal(giftBoost(100), 100)
  assert.equal(giftBoost(150), 100, 'vượt 100 thì cắt còn 100')
  assert.equal(giftBoost(1), 1)
  assert.equal(giftBoost(25), 25)
})

test('quà tặng bùng lực rồi tắt dần sau vài giây', () => {
  const s = freshMatch()
  const r = applyPull(s, 'A', 100, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.ok, true)
  assert.equal(r.effect, 100)
  assert.equal(s.teams.A.boost, 100)
  assert.equal(s.teams.A.pullRate, 101, '1 người + 100 bùng = sức mạnh 101')
  assert.ok(approx(s.rope, 0), 'quà không nhảy dây ngay — dây chạy theo tốc độ')
  // Tặng luôn cho B để dây cân bằng (không ai chạm vạch thắng 0,5 giữa chừng)
  // thì mới đo được bùng tắt dần đủ 5 giây.
  applyPull(s, 'B', 100, { nickname: 'Nam', userId: 'nam' })
  step(s, 5)
  const b = s.teams.A.boost
  assert.ok(b < 40 && b > 30, `sau 5s bùng phải còn ~37, được ${b}`)
})

test('1 món quà 100 lực kéo ngang 100 người', () => {
  const s = crowdMatch(100, 1)
  applyPull(s, 'B', 100, { nickname: 'B0', userId: 'b0' })
  assert.equal(s.teams.B.pullRate, 101, '1 người + 100 bùng = 101, ngang 100 người')
  assert.equal(s.teams.A.pullRate, 100)
  step(s, 0.5)
  assert.ok(Math.abs(s.rope) < 0.05, `2 đội ngang sức thì dây gần như đứng yên, được ${s.rope}`)
})

test('quà to bùng lên rồi tắt, đội đông thắng về lâu dài', () => {
  const s = crowdMatch(100, 1)
  applyPull(s, 'B', 100, { nickname: 'B0', userId: 'b0' })
  let guard = 0
  while (s.phase === 'pulling' && guard++ < 100) step(s, 1)
  assert.equal(s.phase, 'roundEnd', 'hết bùng thì đội đông phải thắng màn')
  assert.equal(s.roundWinner, 'A')
  assert.equal(s.teams.A.roundWins, 1)
})

test('tặng liên tục mới thắng màn', () => {
  const s = freshMatch()
  let guard = 0
  while (s.phase === 'pulling' && guard++ < 100) {
    applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' })
    step(s, 0.25)
  }
  assert.equal(s.phase, 'roundEnd', 'kéo liên tục phải thắng màn')
  assert.equal(s.roundWinner, 'A')
  assert.equal(s.teams.A.roundWins, 1)
})

// ── 3. Cơ hội cuối ×2 + giờ chót ×2 ────────────────────────────────────────
test('đội đang thua quá 0,55 được nhân đôi lực kéo', () => {
  const s = freshMatch()
  s.rope = -0.7 // Đội Đỏ đang thua sâu
  const r = applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.ok, true)
  assert.equal(r.comeback, true)
  assert.equal(r.effect, 2, '1 lực ×2 = 2')
  assert.equal(s.teams.A.boost, 2)
  // Đội đang thắng thì không nhân đôi.
  const s2 = freshMatch()
  s2.rope = 0.3
  const r2 = applyPull(s2, 'A', 1, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r2.comeback, false)
  assert.equal(r2.effect, 1)
})

test('10 giây cuối quà tặng ×2 (giờ chót)', () => {
  const s = freshMatch()
  s.roundTimeLeft = 5
  tick(s, 0.1)
  assert.equal(s.finalTime, true, 'còn 5s phải vào giờ chót')
  const r = applyPull(s, 'A', 10, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.final, true)
  assert.equal(r.effect, 20, '10 lực ×2 giờ chót = 20')
  const s2 = freshMatch()
  s2.roundTimeLeft = 20
  const r2 = applyPull(s2, 'A', 10, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r2.final, false)
  assert.equal(r2.effect, 10)
  // Cơ hội cuối + giờ chót cộng dồn: 10 ×2 ×2 = 40.
  const s3 = freshMatch()
  s3.rope = -0.7
  s3.roundTimeLeft = 5
  const r3 = applyPull(s3, 'A', 10, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r3.effect, 40)
  assert.equal(r3.comeback, true)
  assert.equal(r3.final, true)
})

// ── 4. Lật kèo: 1 món quà mạnh hơn cả đội kia ──────────────────────────────
test('1 món quà mạnh hơn số người đội kia thì lật kèo', () => {
  const s = freshMatch() // B có 1 người
  const r = applyPull(s, 'A', 10, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r.flip, true, '10 lực > 1 người đội Xanh → lật kèo')
  assert.ok(s.effects.some((e) => e.kind === 'flip'), 'phải có hiệu ứng lật kèo')
  const s2 = crowdMatch(1, 20) // B có 20 người
  const r2 = applyPull(s2, 'A', 10, { nickname: 'Lan', userId: 'lan' })
  assert.equal(r2.flip, false, '10 lực < 20 người → không lật kèo')
})

// ── 5. Dây tự trôi về giữa ─────────────────────────────────────────────────
test('dây tự trôi nhẹ về giữa khi không ai kéo', () => {
  const s = freshMatch()
  s.rope = 0.5
  step(s, 10)
  assert.ok(s.rope < 0.45 && s.rope > 0.35, `10 giây phải trôi về ~0,41, được ${s.rope}`)
})

// ── 6. Hết giờ ─────────────────────────────────────────────────────────────
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

// ── 7. Thả tim = +lực kéo (cộng dồn CẢ PHÒNG) ───────────────────────────
test('cả phòng đủ 100 tim thì +10 lực kéo cho đội của người thả tim', () => {
  const s = freshMatch()
  s.rope = 0.4
  const n = applyLikes(s, 'lan', 100) // Lan ở đội A
  assert.equal(n, 1)
  assert.ok(approx(s.teams.A.boost, 10), `đội A phải +10 lực, được ${s.teams.A.boost}`)
  assert.equal(s.likePowerAdded, 10)
  assert.equal(s.likes, 100)
  assert.ok(approx(s.roundTimeLeft, 45), 'tim không cộng giờ nữa')
  assert.ok(approx(s.rope, 0.4), 'tim không đẩy dây ngay (chỉ +lực, dây chạy theo lực)')
  const n2 = applyLikes(s, 'lan', 250)
  assert.equal(n2, 2, '250 tim = 2 lần +10 lực, còn dư 50')
  assert.ok(approx(s.teams.A.boost, 30))
  assert.equal(s.likePowerAdded, 30)
  assert.equal(s.likes, 350)
  const n3 = applyLikes(s, 'lan', 50)
  assert.equal(n3, 1, '50 dư + 50 mới = đủ 100 → +10 lực nữa')
  assert.ok(approx(s.teams.A.boost, 40))
})

test('tim cộng dồn cả phòng: 60 + 60 của 2 người cũng đủ 100', () => {
  const s = freshMatch()
  assert.equal(applyLikes(s, 'lan', 60), 0, 'mới 60 tim → chưa đủ')
  assert.equal(applyLikes(s, 'minh', 60), 1, '60+60=120 → đủ 100, +10 lực cho đội B (Minh thả), còn dư 20')
  assert.ok(approx(s.teams.B.boost, 10), 'đội B phải +10 lực vì Minh ở đội B')
  assert.equal(s.likes, 120, 'tổng tim vẫn đếm')
  assert.equal(applyLikes(s, 'lan', 80), 1, '20 dư + 80 = đủ 100 → +10 lực cho đội A nữa')
  assert.ok(approx(s.teams.A.boost, 10))
})

test('tim cộng tối đa +60 lực kéo / màn', () => {
  const s = freshMatch()
  const n = applyLikes(s, 'lan', 1000)
  assert.equal(n, 6, '1000 tim = 10 lần nhưng cắt ở +60 lực (6 lần)')
  assert.equal(s.likePowerAdded, 60)
  assert.ok(approx(s.teams.A.boost, 60))
  assert.equal(applyLikes(s, 'lan', 500), 0, 'đủ +60 lực rồi thì tim nữa cũng không cộng')
})

test('tim ngoài lúc kéo không cộng lực (nhưng vẫn đếm tổng)', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } })
  startMatch(s) // đang đếm ngược, chưa kéo
  assert.equal(s.phase, 'countdown')
  assert.equal(applyLikes(s, 'user1', 100), 0)
  assert.equal(s.likes, 100)
  assert.ok(approx(s.roundTimeLeft, 45), 'chưa kéo thì không cộng lực')
})

// ── 8. Vào đội ─────────────────────────────────────────────────────────────
test('bình luận A/B/tên người/THAM GIA vào đúng đội', () => {
  assert.equal(parseTeamJoin('A'), 'A')
  assert.equal(parseTeamJoin('B'), 'B')
  assert.equal(parseTeamJoin('ĐỘI XANH'), 'B')
  assert.equal(parseTeamJoin('đội đỏ'), 'A')
  assert.equal(parseTeamJoin('Miyo'), 'A')
  assert.equal(parseTeamJoin('Anh Hùng'), 'A')
  assert.equal(parseTeamJoin('Mia'), 'A')
  assert.equal(parseTeamJoin('Lan'), 'B')
  assert.equal(parseTeamJoin('Hương'), 'B')
  assert.equal(parseTeamJoin('Bình'), 'B')
  assert.equal(parseTeamJoin('THAM GIA'), 'balance')
  assert.equal(parseTeamJoin('@A'), 'A')
  assert.equal(parseTeamJoin('cho em hỏi'), null, 'câu thường không được nhận nhầm là vào đội')
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

// ── 9. Quà kéo cho đội nào ─────────────────────────────────────────────────
// ── 6b. Nhân vật khán giả: tên + avatar trên đầu, mới nhất hiện ra ──────
test('vào đội lưu avatar + lúc vào để 3D hiện nhân vật của người đó', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS })
  const r = joinTeam(s, 'A', 'Lan', 'lan', 'https://cdn.example.com/lan.jpg')
  assert.equal(r.ok, true)
  assert.equal(r.member.avatar, 'https://cdn.example.com/lan.jpg')
  assert.equal(typeof r.member.joinedAt, 'number')
  assert.equal(teamStrength(s, 'A'), 1, '1 nhân vật = +1 lực kéo')
})
test('chỉ 3 người mới nhất/đội hiện ra trên sân (còn lại vẫn tính lực)', () => {
  const s = crowdMatch(5, 0)
  const vis = visibleMembers(s, 'A', 3)
  assert.equal(vis.length, 3)
  assert.deepEqual(vis.map((m) => m.nickname), ['A2', 'A3', 'A4'], 'mới nhất 3 người')
  assert.equal(teamStrength(s, 'A'), 5, 'cả 5 người đều tính lực kéo')
  assert.equal(visibleMembers(s, 'A', 3).length, 3)
  assert.equal(visibleMembers(s, 'B', 3).length, 0, 'đội trống thì không có ai')
})
test('adapter lấy ảnh đại diện từ event (trực tiếp + lồng trong user)', () => {
  const direct = normalizeEvent({ type: 'chat', comment: 'A', nickname: 'Lan', uniqueId: 'lan', profilePictureUrl: 'https://cdn.example.com/a.jpg' })
  assert.equal(direct.kind, 'chat')
  assert.equal(direct.avatar, 'https://cdn.example.com/a.jpg')
  const nested = normalizeEvent({ type: 'chat', comment: 'B', user: { nickname: 'Minh', uniqueId: 'minh', profilePictureUrl: 'https://cdn.example.com/b.jpg' } })
  assert.equal(nested.kind, 'chat')
  assert.equal(nested.nickname, 'Minh')
  assert.equal(nested.avatar, 'https://cdn.example.com/b.jpg')
  const none = normalizeEvent({ type: 'chat', comment: 'A', nickname: 'Hoa', uniqueId: 'hoa' })
  assert.equal(none.avatar, '', 'không có ảnh thì để trống (3D vẽ vòng tròn chữ cái)')
})
test('quà của thành viên kéo cho đội mình, người lạ kéo cho đội thua', () => {
  const s = freshMatch()
  s.rope = 0.3 // Xanh đang thua
  assert.equal(giftTeam(s, 'lan', ''), 'A', 'Lan ở đội Đỏ → kéo Đỏ')
  assert.equal(giftTeam(s, 'nguoi-la', ''), 'B', 'người lạ → kéo cho đội thua (Xanh)')
  assert.equal(giftTeam(s, 'nguoi-la', 'A'), 'A', 'chữ kèm "A" ưu tiên hơn đội thua')
  assert.equal(giftTeam(s, 'lan', 'B'), 'B', 'chữ kèm "B" thắng cả đội của người tặng')
})

// ── 10. GiftEngine: hàng đợi, chống trùng, quà lạ, giữ quà trước giờ G ────
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

test('bảng quà cũ (chiêu dạng chữ + lực cũ) được đổi sang lực kéo mới', () => {
  assert.deepEqual(migrateGiftMap({ 'hoa hong': 'banana', 'hac giay': 'dizzy', 'rosa': 6 }), {
    'hoa hong': 1, 'hac giay': 100, rosa: 10,
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
  assert.equal(giftTier(10), 'Kéo mạnh')
  assert.equal(giftTier(20), 'Kéo rất mạnh')
  assert.equal(giftTier(99), 'Kéo cực mạnh')
})

// ── 11. Lệnh bình luận ──────────────────────────────────────────────────────
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

// ── 12. Trận: thắng 2 màn (best of 3), ngôi sao may mắn, chuỗi thắng ──────
test('thắng 2 màn trước thì vô địch trận (best of 3) + chuỗi thắng tăng', () => {
  const s = freshMatch()
  s.teams.A.roundWins = 1
  endRound(s, 'A')
  assert.equal(s.phase, 'matchEnd')
  assert.equal(s.matchWinner, 'A')
  assert.equal(s.teams.A.roundWins, 2)
  assert.equal(s.streak.A, 1, 'thắng trận đầu → chuỗi 1')
  assert.equal(s.streak.B, 0)
  // Trận sau thắng nữa → chuỗi 2 (chuỗi giữ qua trận).
  startMatch(s)
  s.teams.A.roundWins = 1
  endRound(s, 'A')
  assert.equal(s.streak.A, 2, 'thắng 2 trận liên tiếp → chuỗi 2')
  // Đội Xanh thắng thì chuỗi Đỏ về 0.
  startMatch(s)
  s.teams.B.roundWins = 1
  endRound(s, 'B')
  assert.equal(s.streak.A, 0)
  assert.equal(s.streak.B, 1)
})

test('best of 3: 2–1 là Đỏ thắng, 1–1 thì chưa xong (màn 3 quyết định)', () => {
  const s = freshMatch()
  // Màn 1: Đỏ thắng → 1–0, chưa vô địch.
  endRound(s, 'A')
  assert.equal(s.phase, 'roundEnd', '1–0 thì chưa vô địch')
  assert.equal(s.matchWinner, null)
  assert.equal(s.teams.A.roundWins, 1)
  // Màn 2: Xanh thắng → 1–1, chưa vô địch (màn 3 quyết định).
  s.round = 2
  endRound(s, 'B')
  assert.equal(s.phase, 'roundEnd', '1–1 thì chưa vô địch')
  assert.equal(s.teams.B.roundWins, 1)
  assert.equal(s.matchWinner, null)
  // Màn 3: Đỏ thắng → 2–1, Đỏ vô địch.
  s.round = 3
  endRound(s, 'A')
  assert.equal(s.phase, 'matchEnd', '2–1 thì Đỏ vô địch')
  assert.equal(s.matchWinner, 'A')
  assert.equal(s.teams.A.roundWins, 2)
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

test('đủ 2 đội, đủ 6 người', () => {
  assert.equal(TEAMS.A.members.length, 3)
  assert.equal(TEAMS.B.members.length, 3)
  assert.equal(MEMBER_TYPES.length, 6)
  assert.equal(new Set([...TEAMS.A.members, ...TEAMS.B.members]).size, 6)
})

// ── 13. Tiến thời gian thực: tab nền (dt lớn) vẫn đúng giờ ────────────────
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
  step(s, 10.5)
  // Hết 10 giây nghỉ thì VỀ CHỜ (không tự sang màn sau nữa) — streamer
  // xem đủ người rồi ấn bắt đầu mới sang màn sau.
  assert.equal(s.phase, 'waiting', 'hết 10 giây nghỉ thì về chờ, chờ streamer ấn bắt đầu')
  assert.equal(s.round, 1, 'chưa ấn thì vẫn là màn 1')
  assert.equal(s.waitingNextRound, true, 'đang chờ bắt đầu màn sau')
})

// ── 14. BXH: ai tặng quà / thả tim nhiều nhất — lưu lại cả phiên ───────────
test('BXH quà: ghi tổng lực kéo từng người, xếp top 3 đúng thứ tự', () => {
  const s = freshMatch()
  applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' }, 'hoa hồng')
  applyPull(s, 'A', 25, { nickname: 'Hoa', userId: 'hoa' }, 'nước hoa')
  applyPull(s, 'B', 10, { nickname: 'Minh', userId: 'minh' }, 'rosa')
  applyPull(s, 'A', 100, { nickname: 'Hoa', userId: 'hoa' }, 'hạc giấy')
  const top = topGifters(s, 3)
  assert.equal(top.length, 3, '3 người tặng thì top 3 đủ 3')
  assert.equal(top[0].nickname, 'Hoa', 'Hoa tặng 125 lực phải đứng đầu')
  assert.equal(top[0].power, 125)
  assert.equal(top[0].count, 2, 'Hoa tặng 2 món')
  assert.equal(top[1].nickname, 'Minh')
  assert.equal(top[2].nickname, 'Lan')
})

test('BXH quà: người chưa vào đội vẫn được ghi (tặng quà là lên BXH)', () => {
  const s = freshMatch()
  applyPull(s, 'A', 10, { nickname: 'Người lạ', userId: 'la' }, 'rosa')
  const top = topGifters(s, 3)
  assert.equal(top.length, 1)
  assert.equal(top[0].nickname, 'Người lạ')
  assert.equal(top[0].power, 10)
})

test('BXH tim: ghi tổng tim từng người (cả khi chưa vào màn kéo)', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS, giftMap: { ...DEFAULT_SETTINGS.giftMap } })
  applyLikes(s, 'lan', 30, 'Lan') // chưa vào màn kéo: không +lực nhưng vẫn đếm tổng
  assert.equal(s.likes, 30)
  const top0 = topLikers(s, 3)
  assert.equal(top0[0].nickname, 'Lan')
  assert.equal(top0[0].likes, 30)
  startMatch(s)
  s.phase = 'pulling'
  s.roundTimeLeft = 45
  applyLikes(s, 'minh', 250, 'Minh')
  applyLikes(s, 'lan', 80, 'Lan')
  const top = topLikers(s, 3)
  assert.equal(top[0].nickname, 'Minh', 'Minh 250 tim phải đứng đầu')
  assert.equal(top[0].likes, 250)
  assert.equal(top[1].nickname, 'Lan')
  assert.equal(top[1].likes, 110, 'Lan 30 + 80 = 110 tim')
})

test('BXH giữ lại qua màn mới + trận mới (chỉ xóa khi bấm Xóa BXH)', () => {
  const s = freshMatch()
  applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa' }, 'rosa')
  applyLikes(s, 'lan', 50, 'Lan')
  startMatch(s) // trận mới: BXH không được xóa
  assert.equal(topGifters(s, 3)[0].nickname, 'Hoa')
  assert.equal(topLikers(s, 3)[0].nickname, 'Lan')
  clearBxh(s)
  assert.equal(topGifters(s, 3).length, 0, 'xóa BXH thì hết')
  assert.equal(topLikers(s, 3).length, 0)
})

test('hết trận (3 màn) thì đội tỉnh reset về trống, BXH vẫn giữ', () => {
  const s = freshMatch()
  // 2 tỉnh vào đấu ở màn 1
  joinProvince(s, 'hanoi', 'Lan', 'lan')
  joinProvince(s, 'hcm', 'Hoa', 'hoa')
  startRound(s) // syncProvinceTeams: 2 tỉnh thành 2 đội
  assert.ok(s.provinceTeams.A && s.provinceTeams.B, 'màn 1 phải có 2 tỉnh đấu')
  assert.deepEqual([s.provinceTeams.A, s.provinceTeams.B].sort(), ['hanoi', 'hcm'].sort())
  // Có quà để BXH tỉnh có số liệu (bỏ qua đếm ngược như freshMatch)
  s.phase = 'pulling'
  applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa' }, 'rosa')
  // Trận mới: đội tỉnh về trống (bảng trống), BXH giữ nguyên
  startMatch(s)
  assert.deepEqual(s.provinceTeams, { A: null, B: null }, 'trận mới phải về bảng trống')
  assert.deepEqual(s.provinceUsers, {}, 'người ủng hộ tỉnh cũ không dính lại trận sau')
  assert.equal(topGifters(s, 3)[0].nickname, 'Hoa', 'BXH quà vẫn giữ qua trận mới')
  assert.equal(topProvinces(s, 3).length, 1, 'BXH tỉnh vẫn giữ qua trận mới')
})

// ── 15. Hiệu ứng tặng quà: nhỏ = hộp quà mở, to = pháo hoa ─────────────────
test('quà nhỏ (<25 lực) hiện hiệu ứng hộp quà, quà to (≥25) hiện pháo hoa', () => {
  const s = freshMatch()
  applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' }, 'hoa hồng')
  let fx = s.effects.filter((e) => e.kind === 'gift').pop()
  assert.ok(fx, 'quà nhỏ cũng phải có hiệu ứng gift')
  assert.equal(fx.big, false, '1 lực là quà nhỏ')
  assert.equal(fx.sender, 'Lan')
  assert.equal(fx.gift, 'hoa hồng')
  assert.equal(fx.dur, 2, 'quà nhỏ hiện 2 giây')
  applyPull(s, 'B', 100, { nickname: 'Minh', userId: 'minh' }, 'hạc giấy')
  fx = s.effects.filter((e) => e.kind === 'gift').pop()
  assert.equal(fx.big, true, '100 lực là quà to')
  assert.equal(fx.sender, 'Minh')
  assert.equal(fx.dur, 3.5, 'quà to hiện 3,5 giây (pháo hoa)')
})

test('lượt kéo thử (opts.gift=false) không hiện hiệu ứng quà và không lên BXH', () => {
  const s = freshMatch()
  applyPull(s, 'A', 25, { nickname: 'Admin thử', userId: 'admin' }, '', { gift: false })
  assert.equal(s.effects.filter((e) => e.kind === 'gift').length, 0, 'kéo thử không phải quà nên không hiện hiệu ứng')
  assert.equal(topGifters(s, 3).length, 0, 'kéo thử không phải quà nên không lên BXH')
})

test('quà đi qua GiftEngine vẫn mang tên quà sang hiệu ứng', () => {
  const s = freshMatch()
  const eng = new GiftEngine(s)
  eng.receive({ id: 'g1', giftName: 'hạc giấy', nickname: 'Hoa', userId: 'hoa', text: 'A' })
  const res = eng.process(s.now + 1)
  assert.ok(res.ok, 'quà phải được xử lý')
  const fx = s.effects.filter((e) => e.kind === 'gift').pop()
  assert.ok(fx, 'phải có hiệu ứng gift')
  assert.equal(fx.gift, 'hạc giấy', 'hiệu ứng phải mang đúng tên quà')
  assert.equal(fx.big, true, 'hạc giấy 100 lực là quà to')
})

// ── 15b. Camera quà: MỌI quà thật đều quay cận, quà to thì đẹp hơn ──────
test('quà to thật (≥25) thì đặt giftCam cho đội được tặng, cờ big=true', () => {
  const s = freshMatch()
  assert.equal(s.giftCam, null, 'ban đầu không quay cận')
  const r = applyPull(s, 'A', 25, { nickname: 'Lan', userId: 'lan' }, 'Nước hoa')
  assert.equal(r.ok, true)
  assert.deepEqual(s.giftCam, { teamId: 'A', at: 10, big: true }, 'ghi đội A + lúc tặng (state.now) + quà to')
})

test('quà nhỏ thật (1 xu) cũng quay cận, cờ big=false', () => {
  const s = freshMatch()
  applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' }, 'Hoa hồng')
  assert.deepEqual(s.giftCam, { teamId: 'A', at: 10, big: false }, 'quà 1 xu cũng quay cận (không phải quà to)')
  applyPull(s, 'B', 10, { nickname: 'Minh', userId: 'minh' }, 'Cỏ bốn lá')
  assert.deepEqual(s.giftCam, { teamId: 'B', at: 10, big: false }, 'đội khác thì quay đội mới')
})

test('quà thử (Admin/demo, gift:false) thì không quay cận', () => {
  const s = freshMatch()
  applyPull(s, 'B', 100, { nickname: 'Bạn Thử', userId: 'test' }, 'Hạc giấy', { gift: false })
  assert.equal(s.giftCam, null)
})

test('cùng đội đang quay cận mà có quà mới thì không quay lại từ đầu', () => {
  const s = freshMatch()
  applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' }, 'Hoa hồng')
  s.now = 11
  applyPull(s, 'A', 5, { nickname: 'Hoa', userId: 'hoa' }, 'Quả đào')
  assert.deepEqual(s.giftCam, { teamId: 'A', at: 10, big: false }, 'giữ nguyên lúc bắt đầu quay, không reset')
})

test('đang quay cận quà nhỏ mà có quà to cùng đội thì nâng lên quà to, không reset', () => {
  const s = freshMatch()
  applyPull(s, 'A', 1, { nickname: 'Lan', userId: 'lan' }, 'Hoa hồng')
  s.now = 11
  applyPull(s, 'A', 100, { nickname: 'Minh', userId: 'minh' }, 'Hạc giấy')
  assert.deepEqual(s.giftCam, { teamId: 'A', at: 10, big: true }, 'nâng big=true để thêm bùn dính ống kính, giữ nguyên at')
})

test('quà to sau (đội khác) thì ghi đè đội/lúc tặng mới', () => {
  const s = freshMatch()
  applyPull(s, 'A', 25, { nickname: 'Lan', userId: 'lan' }, 'Nước hoa')
  s.now = 20
  applyPull(s, 'B', 100, { nickname: 'Minh', userId: 'minh' }, 'Hạc giấy')
  assert.deepEqual(s.giftCam, { teamId: 'B', at: 20, big: true })
})

// ── 16. Toast: ai vào xem / theo dõi / chia sẻ hiện 2 giây rồi mất ────────
test('toast vào xem: hiện 2 giây, ai vào sau thì đổi chữ (không xếp chồng)', () => {
  const s = freshMatch()
  pushToast(s, '👋 Lan vừa vào xem!')
  let fx = s.effects.filter((e) => e.kind === 'toast')
  assert.equal(fx.length, 1, 'chỉ 1 toast')
  assert.equal(fx[0].dur, 2, 'toast hiện 2 giây')
  pushToast(s, '👋 Minh vừa vào xem!')
  fx = s.effects.filter((e) => e.kind === 'toast')
  assert.equal(fx.length, 1, 'toast sau không xếp chồng, chỉ đổi chữ')
  assert.equal(fx[0].text, '👋 Minh vừa vào xem!')
  step(s, 2.5)
  assert.equal(s.effects.filter((e) => e.kind === 'toast').length, 0, 'quá 2 giây thì toast mất')
})

// ── 17. Tỉnh thành VN: quà tính theo tỉnh, tỉnh dẫn đầu ×1,5 lực kéo ───
test('tên tỉnh trong bình luận/tên → đúng mã tỉnh', () => {
  assert.equal(detectProvince('Hà Nội cố lên!', ''), 'hanoi', 'tên tỉnh trong câu dài vẫn nhận')
  assert.equal(detectProvince('Sài Gòn vô địch', ''), 'hcm', 'Sài Gòn → TP.HCM')
  assert.equal(detectProvince('SG', ''), 'hcm', 'viết tắt SG → TP.HCM')
  assert.equal(detectProvince('Đà Nẵng', ''), 'danang')
  assert.equal(detectProvince('', 'Lan Hà Nội'), 'hanoi', 'tên tỉnh trong TÊN người tặng cũng tính')
  assert.equal(detectProvince('hello', 'Lan'), null)
  assert.equal(detectProvince('in love', ''), null, 'câu thường không nhận nhầm thành tỉnh')
})

test('tên cũ + tên thành phố quen thuộc làm alias cho tỉnh mới (sáp nhập 2025)', () => {
  assert.equal(detectProvince('Bình Dương', ''), 'hcm', 'Bình Dương giờ thuộc TP.HCM')
  assert.equal(detectProvince('Nha Trang', ''), 'khanhhoa', 'Nha Trang → Khánh Hòa')
  assert.equal(detectProvince('Đà Lạt', ''), 'lamdong', 'Đà Lạt → Lâm Đồng')
  assert.equal(detectProvince('Quảng Nam', ''), 'danang', 'Quảng Nam giờ thuộc Đà Nẵng')
  assert.equal(detectProvince('Bình Định', ''), 'gialai', 'Bình Định giờ thuộc Gia Lai')
  assert.equal(detectProvince('Thái Bình', ''), 'hungyen', 'Thái Bình giờ thuộc Hưng Yên')
  assert.equal(detectProvince('Vĩnh Long', ''), 'vinhlong', 'Vĩnh Long không nhận nhầm thành Nghệ An')
  assert.equal(provinceInfo('hanoi').name, 'Hà Nội')
  assert.equal(provinceInfo('hcm').name, 'TP. Hồ Chí Minh')
  assert.equal(provinceInfo('hcm').short, 'TP.HCM')
  assert.equal(provinceInfo('xx'), null)
})

test('BXH tỉnh thành: quà tính theo tỉnh, xếp top 3 đúng thứ tự + có tên', () => {
  const s = freshMatch()
  applyPull(s, 'A', 10, { nickname: 'An', userId: 'an', province: 'hcm' }, 'rosa')
  applyPull(s, 'A', 100, { nickname: 'Hoa', userId: 'hoa', province: 'hanoi' }, 'hạc giấy')
  applyPull(s, 'B', 25, { nickname: 'Min', userId: 'min', province: 'danang' }, 'nước hoa')
  const top = topProvinces(s, 3)
  assert.equal(top.length, 3)
  assert.equal(top[0].code, 'hanoi', 'Hà Nội 100 lực phải đứng đầu')
  assert.equal(top[0].power, 100)
  assert.equal(top[0].name, 'Hà Nội')
  assert.equal(top[1].code, 'danang')
  assert.equal(top[2].code, 'hcm')
  assert.equal(provinceLeader(s).code, 'hanoi', 'tỉnh dẫn đầu là Hà Nội')
})

test('tỉnh dẫn đầu: quà của tỉnh đó ×1,5, tỉnh khác không được thưởng', () => {
  const s = freshMatch()
  // Món đầu (chưa có tỉnh dẫn đầu) không được thưởng.
  const r1 = applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa', province: 'hanoi' }, 'rosa')
  assert.equal(r1.effect, 10, 'chưa có tỉnh dẫn đầu thì không thưởng')
  assert.equal(r1.provinceBonus, false)
  // Hà Nội đã dẫn đầu → quà tiếp của Hà Nội ×1,5.
  const r2 = applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa', province: 'hanoi' }, 'rosa')
  assert.equal(r2.effect, 15, 'quà của tỉnh dẫn đầu ×1,5')
  assert.equal(r2.provinceBonus, true)
  assert.equal(r2.province, 'hanoi')
  // Quà của tỉnh khác không được thưởng.
  const r3 = applyPull(s, 'B', 10, { nickname: 'An', userId: 'an', province: 'hcm' }, 'rosa')
  assert.equal(r3.effect, 10, 'quà của tỉnh không dẫn đầu không được thưởng')
  assert.equal(r3.provinceBonus, false)
  // BXH tỉnh thành ghi lực CUỐI CÙNG (đã nhân hệ số) nên Hà Nội củng cố vị trí.
  assert.equal(topProvinces(s, 3)[0].code, 'hanoi')
  assert.equal(topProvinces(s, 3)[0].power, 25, 'Hà Nội 10 + 15 = 25')
  assert.equal(topProvinces(s, 3)[1].power, 10, 'TP.HCM 10')
})

// ── 17b. Quốc gia: người nước ngoài bình luận tên nước → vào đội nước đó ─
test('tên nước trong bình luận/tên → đúng mã nước + cờ', () => {
  assert.equal(detectCountry('USA go!', ''), 'us', 'USA → Mỹ')
  assert.equal(detectCountry('Japan fighting', ''), 'jp', 'Japan → Nhật Bản')
  assert.equal(detectCountry('Hàn Quốc cố lên!', ''), 'kr', 'Hàn Quốc → Hàn Quốc')
  assert.equal(detectCountry('Mỹ vô địch', ''), 'us', 'Mỹ → USA')
  assert.equal(detectCountry('Việt Nam', ''), 'vn', 'Việt Nam → nước VN')
  assert.equal(detectCountry('', 'John from Thailand'), 'th', 'tên nước trong TÊN người cũng tính')
  assert.equal(detectCountry('hello', 'Lan'), null)
  assert.equal(countryInfo('us').name, 'Mỹ')
  assert.equal(countryInfo('us').flag, '🇺🇸')
  assert.equal(countryInfo('jp').short, 'NHẬT BẢN')
  assert.equal(countryInfo('xx'), null)
})

test('detectRegion: tỉnh ưu tiên trước nước; nước nhận khi không có tỉnh', () => {
  assert.equal(detectRegion('Hà Nội cố lên!', ''), 'hanoi', 'tỉnh được ưu tiên')
  assert.equal(detectRegion('Mỹ Tho quê tôi', ''), 'dongthap', 'Mỹ Tho là Đồng Tháp, không phải nước Mỹ')
  assert.equal(detectRegion('USA!', ''), 'us')
  assert.equal(detectRegion('Japan', ''), 'jp')
  assert.equal(detectRegion('hello', ''), null)
  assert.equal(regionInfo('hanoi').kind, 'province')
  assert.equal(regionInfo('hanoi').flag, '')
  assert.equal(regionInfo('us').kind, 'country')
  assert.equal(regionInfo('us').flag, '🇺🇸')
  assert.equal(regionInfo('xx'), null)
})

test('bình luận tên nước → vào đội nước đó, 2 nước đông nhất thành 2 đội', () => {
  const s = freshMatch()
  joinProvince(s, 'us', 'John', 'john1')
  joinProvince(s, 'us', 'Mike', 'mike1')
  joinProvince(s, 'jp', 'Yuki', 'yuki1')
  joinProvince(s, 'kr', 'Minjun', 'minjun1')
  assert.equal(s.provinceUsers['john1'].province, 'us')
  assert.equal(s.teams.A.members.length, 1, 'chưa chọn đội thì người nước ngoài chỉ là challenger, chưa vào đội')
  syncProvinceTeams(s)
  assert.deepEqual([s.provinceTeams.A, s.provinceTeams.B].sort(), ['jp', 'us'].sort(), 'Mỹ (2 người) + Nhật (1 người) là 2 đội đấu')
  assert.equal(s.teams.A.members.length, 3, 'John + Mike (Mỹ) vào đội A cùng Lan (giữ nguyên)')
  assert.equal(teamLabel(s, 'A'), '🇺🇸 Mỹ', 'tên đội nước kèm cờ')
  assert.equal(teamLabel(s, 'B'), '🇯🇵 Nhật Bản')
})

test('BXH vùng miền: quà nước ngoài tính cho nước đó, có cờ + hạng', () => {
  const s = freshMatch()
  applyPull(s, 'A', 100, { nickname: 'John', userId: 'john1', province: 'us' }, 'hạc giấy')
  applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa', province: 'hanoi' }, 'rosa')
  const top = topProvinces(s, 3)
  assert.equal(top[0].code, 'us', 'Mỹ 100 lực đứng đầu')
  assert.equal(top[0].flag, '🇺🇸', 'BXH nước có cờ')
  assert.equal(top[0].name, 'Mỹ')
  assert.equal(top[1].code, 'hanoi')
  assert.equal(top[1].flag, '', 'tỉnh không có cờ')
  assert.equal(provinceLeader(s).code, 'us', 'nước dẫn đầu cũng được ×1,5')
  const r = applyPull(s, 'B', 10, { nickname: 'Mike', userId: 'mike1', province: 'us' }, 'rosa')
  assert.equal(r.effect, 15, 'quà của nước dẫn đầu ×1,5')
  assert.equal(r.provinceBonus, true)
})

test('hiệu ứng quà mang theo tên tỉnh + Xóa BXH xóa luôn BXH tỉnh thành', () => {
  const s = freshMatch()
  applyPull(s, 'A', 1, { nickname: 'Hoa', userId: 'hoa', province: 'hanoi' }, 'hoa hồng')
  let fx = s.effects.filter((e) => e.kind === 'gift').pop()
  assert.equal(fx.province, 'hanoi', 'hiệu ứng quà phải mang mã tỉnh để hiện tên tỉnh')
  assert.equal(fx.provinceBonus, false, 'món đầu chưa có tỉnh dẫn đầu')
  applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa', province: 'hanoi' }, 'rosa')
  fx = s.effects.filter((e) => e.kind === 'gift').pop()
  assert.equal(fx.provinceBonus, true, 'quà của tỉnh dẫn đầu thì hiệu ứng đánh dấu thưởng')
  // Nhớ tỉnh theo người: quà sau không kèm tỉnh vẫn tính cho Hà Nội.
  const r = applyPull(s, 'A', 10, { nickname: 'Hoa', userId: 'hoa' }, 'rosa')
  assert.equal(r.province, 'hanoi', 'đã chọn tỉnh rồi thì quà sau tự tính cho tỉnh đó')
  assert.equal(r.provinceBonus, true)
  clearBxh(s)
  assert.equal(topProvinces(s, 3).length, 0, 'xóa BXH thì BXH tỉnh thành cũng hết')
  assert.equal(provinceLeader(s), null)
})

test('quà qua GiftEngine vẫn mang tỉnh sang hiệu ứng + BXH; kéo thử thì không', () => {
  const s = freshMatch()
  const eng = new GiftEngine(s)
  eng.receive({ id: 'g1', giftName: 'hạc giấy', nickname: 'Hoa', userId: 'hoa', text: 'A', province: 'danang' })
  const res = eng.process(s.now + 1)
  assert.ok(res.ok, 'quà phải được xử lý')
  assert.equal(res.province, 'danang', 'quà qua hàng đợi vẫn mang tỉnh')
  const fx = s.effects.filter((e) => e.kind === 'gift').pop()
  assert.equal(fx.province, 'danang', 'hiệu ứng quà mang tên Đà Nẵng')
  assert.equal(topProvinces(s, 3)[0].code, 'danang')
  // Kéo thử (không phải quà) không được tính cho tỉnh nào.
  applyPull(s, 'A', 25, { nickname: 'Admin thử', userId: 'admin', province: 'hanoi' }, '', { gift: false })
  assert.equal(topProvinces(s, 3).length, 1, 'kéo thử không lên BXH tỉnh thành')
})

// ── 18. Đấu tỉnh thành: cmt tỉnh là vào đội, top 2 tỉnh đông nhất đấu ───
test('bình luận tỉnh → tự vào đội tỉnh đó (chưa đủ 2 tỉnh thì làm challenger)', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS })
  // Chưa có đội tỉnh nào (chưa đủ 2 tỉnh) → vào làm challenger, chưa có đội.
  const r1 = joinProvince(s, 'hanoi', 'Lan', 'lan')
  assert.equal(r1.ok, true)
  assert.equal(r1.challenger, true, '1 tỉnh thì chưa thành đội, làm challenger')
  assert.equal(r1.teamId, null)
  assert.equal(s.userProvince.lan, 'hanoi')
  assert.equal(findMember(s, 'lan'), null, 'challenger chưa vào đội nào')
  // Đủ 2 tỉnh → 2 tỉnh đó thành 2 đội, người vào đội tỉnh mình.
  joinProvince(s, 'hcm', 'Hoa', 'hoa')
  joinProvince(s, 'danang', 'Nam', 'nam')
  // Chưa sync (chưa bắt đầu màn) nên đội vẫn chưa chọn — sync ở đầu màn.
  assert.equal(s.provinceTeams.A, null, 'chưa bắt đầu màn thì chưa chọn đội')
  const picked = syncProvinceTeams(s)
  assert.equal(picked.A, 'hanoi', 'Hà Nội (1 người) đứng đầu')
  assert.equal(picked.B, 'hcm', 'TP.HCM đứng thứ 2')
  assert.equal(findMember(s, 'lan').teamId, 'A', 'Lan (Hà Nội) vào đội A')
  assert.equal(findMember(s, 'hoa').teamId, 'B', 'Hoa (TP.HCM) vào đội B')
  assert.equal(findMember(s, 'nam'), null, 'Nam (Đà Nẵng, hạng 3) vẫn là challenger')
})

test('top 2 tỉnh theo SỐ NGƯỜI bình luận (mỗi người tính 1 lần, chống spam)', () => {
  const s = createMatch({ ...DEFAULT_SETTINGS })
  // 1 người bình luận 3 lần vẫn chỉ tính 1 (joinProvince ghi đè, không cộng dồn).
  joinProvince(s, 'hanoi', 'Lan', 'lan')
  joinProvince(s, 'hanoi', 'Lan', 'lan')
  joinProvince(s, 'hanoi', 'Lan', 'lan')
  joinProvince(s, 'hcm', 'Hoa', 'hoa')
  joinProvince(s, 'hcm', 'Minh', 'minh')
  joinProvince(s, 'danang', 'Nam', 'nam')
  const top = topProvincesByComments(s, 2)
  assert.equal(top.length, 2)
  assert.equal(top[0].code, 'hcm', 'TP.HCM 2 người phải đứng đầu')
  assert.equal(top[0].count, 2)
  assert.equal(top[1].code, 'hanoi', 'Hà Nội 1 người đứng thứ 2')
  assert.equal(top[1].count, 1, '1 người bình luận 3 lần vẫn chỉ tính 1')
})

test('đổi tỉnh: rời đội cũ, vào đội tỉnh mới; màn sau chọn lại top 2', () => {
  const s = freshMatch()
  // freshMatch có sẵn Lan (A) + Minh (B) vào bằng joinTeam (không có tỉnh).
  joinProvince(s, 'hanoi', 'Lan', 'lan2')
  joinProvince(s, 'hcm', 'Hoa', 'hoa2')
  joinProvince(s, 'hanoi', 'Minh', 'minh2')
  syncProvinceTeams(s)
  assert.equal(s.provinceTeams.A, 'hanoi')
  assert.equal(s.provinceTeams.B, 'hcm')
  assert.equal(teamLabel(s, 'A'), 'Hà Nội', 'tên đội A hiện tên tỉnh')
  assert.equal(teamLabel(s, 'B'), 'TP. Hồ Chí Minh')
  // Lan (không tỉnh, vào bằng joinTeam) vẫn giữ đội A; Minh (không tỉnh) giữ đội B.
  assert.equal(findMember(s, 'lan').teamId, 'A', 'người không có tỉnh giữ nguyên đội')
  assert.equal(findMember(s, 'minh').teamId, 'B')
  // Đà Nẵng vượt lên: thêm 3 người Đà Nẵng → màn sau Đà Nẵng thay TP.HCM.
  joinProvince(s, 'danang', 'Nam', 'nam2')
  joinProvince(s, 'danang', 'An', 'an2')
  joinProvince(s, 'danang', 'Binh', 'binh2')
  syncProvinceTeams(s)
  assert.equal(s.provinceTeams.A, 'danang', 'Đà Nẵng 3 người vượt lên đứng đầu')
  assert.equal(s.provinceTeams.B, 'hanoi', 'Hà Nội 2 người xuống thứ 2')
  assert.equal(findMember(s, 'hoa2'), null, 'Hoa (TP.HCM, rớt top 2) thành challenger')
  assert.equal(findMember(s, 'nam2').teamId, 'A', 'Nam (Đà Nẵng) vào đội A màn sau')
  // Thắng màn thì chúc mừng tên tỉnh.
  s.phase = 'pulling'
  endRound(s, 'A')
  assert.ok(s.feed.some((f) => f.text.includes('Đà Nẵng') && f.text.includes('thắng màn')), 'thắng màn phải chúc mừng tên tỉnh')
})

test('quà của người ủng hộ tỉnh challenger vẫn tính cho tỉnh + kéo cho đội yếu', () => {
  const s = freshMatch()
  joinProvince(s, 'hanoi', 'Lan', 'lan2')
  joinProvince(s, 'hcm', 'Hoa', 'hoa2')
  joinProvince(s, 'danang', 'Nam', 'nam2')
  syncProvinceTeams(s)
  assert.equal(s.provinceTeams.A, 'hanoi')
  assert.equal(s.provinceTeams.B, 'hcm')
  // Nam (Đà Nẵng, challenger) tặng quà: vẫn tính cho Đà Nẵng (BXH tỉnh).
  const r = applyPull(s, giftTeam(s, 'nam2', ''), 25, { nickname: 'Nam', userId: 'nam2', province: 'danang' }, 'nước hoa')
  assert.equal(r.ok, true)
  assert.equal(r.province, 'danang', 'quà của challenger vẫn mang tỉnh')
  assert.equal(topProvinces(s, 3)[0].code, 'danang', 'quà challenger vẫn lên BXH tỉnh')
  assert.equal(r.teamId, giftTeam(s, 'nam2', ''), 'quà challenger kéo cho đội (theo luật giftTeam)')
})

test('hạng Free Fire cho tỉnh theo tổng lực quà (Đồng → Đại Kiện Tướng)', () => {
  assert.equal(provinceRank(0).name, 'Đồng')
  assert.equal(provinceRank(9).name, 'Đồng')
  assert.equal(provinceRank(10).name, 'Bạc')
  assert.equal(provinceRank(24).name, 'Bạc')
  assert.equal(provinceRank(25).name, 'Vàng')
  assert.equal(provinceRank(49).name, 'Vàng')
  assert.equal(provinceRank(50).name, 'Bạch Kim')
  assert.equal(provinceRank(99).name, 'Bạch Kim')
  assert.equal(provinceRank(100).name, 'Kim Cương')
  assert.equal(provinceRank(249).name, 'Kim Cương')
  assert.equal(provinceRank(250).name, 'Huyền Thoại')
  assert.equal(provinceRank(499).name, 'Huyền Thoại')
  assert.equal(provinceRank(500).name, 'Đại Kiện Tướng')
  assert.equal(provinceRank(9999).name, 'Đại Kiện Tướng')
  assert.equal(provinceRank(100).color, '#4dabf7', 'Kim Cương màu xanh dương')
  assert.equal(provinceRank(500).color, '#ff6b6b', 'Đại Kiện Tướng màu đỏ')
})

test('Xóa BXH thì xóa luôn người ủng hộ tỉnh + đội tỉnh (bắt đầu live mới)', () => {
  const s = freshMatch()
  joinProvince(s, 'hanoi', 'Lan', 'lan2')
  joinProvince(s, 'hcm', 'Hoa', 'hoa2')
  syncProvinceTeams(s)
  assert.equal(s.provinceTeams.A, 'hanoi')
  clearBxh(s)
  assert.equal(Object.keys(s.provinceUsers).length, 0, 'xóa BXH thì xóa người ủng hộ tỉnh')
  assert.equal(s.provinceTeams.A, null, 'xóa BXH thì xóa đội tỉnh')
  assert.equal(Object.keys(s.userProvince).length, 0)
})


test('câu đọc quà: quà to đủ câu, quà nhỏ ngắn, lật kèo đọc câu lật kèo', () => {
  assert.equal(voiceTextGift({ sender: 'Bạn Tặng Thử', giftName: 'hạc giấy', effect: 100, teamName: 'Hà Nội', flip: false }), 'Bạn Tặng Thử tặng hạc giấy, cộng 100 lực kéo cho Hà Nội!')
  assert.equal(voiceTextGift({ sender: 'Bạn Tặng Thử', giftName: 'hoa hồng', effect: 1, teamName: 'Hà Nội', flip: false }), 'Bạn Tặng Thử tặng hoa hồng!')
  assert.equal(voiceTextGift({ sender: 'Bạn Tặng Thử', giftName: 'hạc giấy', effect: 100, teamName: 'Hà Nội', flip: true }), 'Lật kèo! Bạn Tặng Thử tặng hạc giấy, cộng 100 lực kéo cho Hà Nội!')
})

test('câu đọc thắng / đầu màn / giờ chót / tim / BXH', () => {
  assert.equal(voiceTextRoundWin('Hà Nội', 2), 'Hà Nội thắng màn 2!')
  assert.equal(voiceTextMatchWin('TP. Hồ Chí Minh'), 'TP. Hồ Chí Minh vô địch trận đấu!')
  assert.equal(voiceTextRoundStart(1, 'Hà Nội', 'TP. Hồ Chí Minh'), 'Màn 1 bắt đầu! Hà Nội đấu với TP. Hồ Chí Minh!')
  assert.equal(voiceTextFinal(), 'Giờ chót! Mười giây cuối, quà tặng nhân đôi!')
  assert.equal(voiceTextLikes(10), 'Đủ một trăm tim, cộng thêm 10 lực kéo!')
  assert.equal(voiceTextBxh({ name: 'Hà Nội', power: 153 }, { nickname: 'Bạn Tặng Thử', power: 100 }), 'Bảng xếp hạng: Hà Nội dẫn đầu với 153 lực. Bạn Tặng Thử tặng nhiều nhất, 100 lực.')
  assert.equal(voiceTextBxh({ name: 'Hà Nội', power: 153 }, null), 'Bảng xếp hạng: Hà Nội dẫn đầu với 153 lực.')
  assert.equal(voiceTextBxh(null, null), '')
})

test('giọng mặc định là banmai (nữ miền Bắc), có đủ giọng 3 miền', () => {
  assert.equal(DEFAULT_SETTINGS.voice, 'banmai')
  assert.equal(DEFAULT_SETTINGS.voiceOn, true)
  assert.ok(VOICE_IDS.has('banmai') && VOICE_IDS.has('leminh') && VOICE_IDS.has('lannhi') && VOICE_IDS.has('ngoclam'))
  assert.equal(VOICE_OPTIONS.length, 6)
})

test('process() trả kèm tên quà + người tặng + lực để đọc giọng', () => {
  const s = freshMatch()
  const eng = new GiftEngine(s)
  eng.receive({ id: 'v1', giftName: 'Hạc giấy', nickname: 'Bạn Tặng Thử', userId: 'g1', text: 'A' })
  const done = eng.process(10)
  assert.equal(done.ok, true)
  assert.equal(done.giftName, 'Hạc giấy')
  assert.equal(done.sender.nickname, 'Bạn Tặng Thử')
  assert.equal(done.power, 100)
  assert.equal(done.effect, 100)
})

test('hàng đợi giọng đọc: đầy thì bỏ câu ưu tiên thấp, quà nhỏ không chen được', () => {
  const v = new VoiceEngine({ apiBase: '' }) // giọng máy, không gọi mạng
  assert.equal(v.speak('câu đang đọc', 'normal'), true) // đang đọc → speaking=true
  assert.equal(v.speak('quà nhỏ 1', 'low'), true)
  assert.equal(v.speak('quà nhỏ 2', 'low'), true)
  assert.equal(v.speak('quà nhỏ 3', 'low'), true)
  assert.equal(v.queue.length, 3, 'hàng đợi tối đa 3')
  assert.equal(v.speak('quà nhỏ 4', 'low'), false, 'quà nhỏ không chen khi hàng đợi đầy toàn câu thấp')
  assert.equal(v.speak('Hà Nội thắng màn 1!', 'high'), true, 'câu thắng (ưu tiên cao) được chen vào')
  assert.equal(v.queue.length, 3)
  assert.ok(v.queue.some((q) => q.text === 'Hà Nội thắng màn 1!'))
  assert.equal(v.queue.filter((q) => q.text.startsWith('quà nhỏ')).length, 2, '1 câu quà nhỏ bị bỏ để nhường chỗ')
  v.stop()
})

test('tắt giọng đọc thì speak() không làm gì', () => {
  const v = new VoiceEngine({ apiBase: '', enabled: false })
  assert.equal(v.speak('xin chào', 'high'), false)
  assert.equal(v.queue.length, 0)
})

test('nút Thử giọng đọc: force=true thì đọc kể cả khi đang tắt', () => {
  const v = new VoiceEngine({ apiBase: '', enabled: false })
  assert.equal(v.speak('Hà Nội đang dẫn đầu, thử giọng đọc bình luận!', 'high', true), true)
  assert.equal(v.queue.length, 0, 'câu thử được đọc ngay, không nằm chờ trong hàng đợi')
  v.stop()
})

test('unlock() không lỗi khi không có window (chạy test node)', () => {
  const v = new VoiceEngine({ apiBase: '' })
  v.unlock()
  assert.equal(v.getMode(), 'device', 'không có API thì mặc định giọng máy')
})

test('câu y hệt vừa đọc trong 3 giây thì không đọc lặp', () => {
  const v = new VoiceEngine({ apiBase: '' })
  v.speak('Hà Nội thắng màn 1!', 'high')
  assert.equal(v.speak('Hà Nội thắng màn 1!', 'high'), false, 'trùng câu vừa đọc thì bỏ')
  v.stop()
})

// ─── Test bất đồng bộ: FPT.AI lỗi → giọng máy, hết 5 phút thử lại ─────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitIdle(v, ms = 3000) {
  const t0 = Date.now()
  while (v.speaking || v.queue.length) {
    if (Date.now() - t0 > ms) throw new Error('giọng đọc kẹt quá lâu')
    await sleep(10)
  }
}
// Giả lập trình duyệt cho VoiceEngine: Audio phát xong ngay + giọng máy ghi câu đọc.
function mockBrowser() {
  const spoken = []
  globalThis.window = {
    Audio: class {
      constructor() { this.src = '' }
      play() {
        setTimeout(() => { if (this.onended) this.onended() }, 0)
        return Promise.resolve()
      }
      pause() {}
    },
    speechSynthesis: {
      getVoices: () => [{ lang: 'vi-VN', name: 'Tiếng Việt' }],
      speak(u) { spoken.push(u.text); setTimeout(() => { if (u.onend) u.onend() }, 0) },
      cancel() {},
    },
  }
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.rate = 1 } }
  return spoken
}
function unmockBrowser() { delete globalThis.window; delete globalThis.SpeechSynthesisUtterance }

async function asyncTest(name, fn) {
  try { await fn(); pass++; results.push(`  ✅ ${name}`) }
  catch (e) { fail++; results.push(`  ❌ ${name}\n     → ${e.message}`) }
}

await asyncTest('FPT.AI lỗi (hết lượt) → tự chuyển giọng máy miễn phí, vẫn đọc được', async () => {
  const spoken = mockBrowser()
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: false, error: 'fpt-error' }) })
  try {
    const modes = []
    const v = new VoiceEngine({ apiBase: 'https://api.test', useFpt: true, onModeChange: (m) => modes.push(m) })
    assert.equal(v.getMode(), 'fpt')
    // Các engine ở test đồng bộ trước đó còn chạy ngầm — câu của chúng chỉ
    // đọc khi tới lượt await đầu tiên (sau khi mock được gắn), nên không
    // đếm tuyệt đối mà kiểm tra câu quà có được đọc không.
    v.speak('Bạn Tặng Thử tặng hạc giấy, cộng 100 lực kéo cho Hà Nội!', 'normal')
    await waitIdle(v)
    assert.equal(v.getMode(), 'device', 'lỗi FPT.AI thì chuyển sang giọng máy')
    assert.deepEqual(modes, ['device'])
    assert.ok(spoken.some((t) => t.includes('hạc giấy')), 'giọng máy vẫn đọc câu đó')
    assert.ok(v.fptCooldownUntil > Date.now(), 'đặt 5 phút nghỉ trước khi thử lại FPT.AI')
    assert.equal(FPT_COOLDOWN_MS, 5 * 60 * 1000)
    // Trong 5 phút nghỉ thì không gọi FPT.AI nữa (đi thẳng giọng máy).
    // Tới đây các câu rò rỉ đã đọc xong nên đếm tăng thêm là chính xác.
    const before2 = spoken.length
    let fetchCalls = 0
    globalThis.fetch = async () => { fetchCalls++; return { ok: true, json: async () => ({ ok: true, url: 'https://x/y.mp3' }) } }
    v.speak('Hà Nội thắng màn 1!', 'high')
    await waitIdle(v)
    assert.equal(fetchCalls, 0, 'đang trong 5 phút nghỉ thì không gọi FPT.AI')
    assert.equal(spoken.length, before2 + 1)
  } finally {
    globalThis.fetch = origFetch
    unmockBrowser()
  }
})

await asyncTest('hết 5 phút nghỉ thì thử lại FPT.AI, được thì nối lại giọng FPT.AI', async () => {
  const spoken = mockBrowser()
  const origFetch = globalThis.fetch
  try {
    const modes = []
    const v = new VoiceEngine({ apiBase: 'https://api.test', useFpt: true, onModeChange: (m) => modes.push(m) })
    // Giả vờ vừa lỗi xong: đang ở giọng máy, 5 phút nghỉ đã hết.
    v.mode = 'device'
    v.fptCooldownUntil = Date.now() - 1
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, url: 'https://x/y.mp3' }) })
    v.speak('Hà Nội thắng màn 1!', 'high')
    await waitIdle(v)
    assert.equal(v.getMode(), 'fpt', 'FPT.AI chạy lại được thì nối lại')
    assert.deepEqual(modes, ['fpt'])
    assert.equal(spoken.length, 0, 'dùng FPT.AI thì không đọc bằng giọng máy')
  } finally {
    globalThis.fetch = origFetch
    unmockBrowser()
  }
})

await asyncTest('thử giọng máy trực tiếp: deviceOnly thì bỏ qua FPT.AI, đọc ngay bằng giọng máy', async () => {
  const spoken = mockBrowser()
  const origFetch = globalThis.fetch
  try {
    let fetchCalls = 0
    globalThis.fetch = async () => { fetchCalls++; throw new Error('no network') }
    const v = new VoiceEngine({ apiBase: 'https://api.test', enabled: false })
    assert.equal(v.speakDeviceTest('thử giọng máy trực tiếp'), true)
    await waitIdle(v)
    assert.equal(fetchCalls, 0, 'thử giọng máy thì không gọi FPT.AI')
    assert.ok(spoken.some((t) => t.includes('thử giọng máy trực tiếp')), 'đọc ngay bằng giọng máy')
  } finally {
    globalThis.fetch = origFetch
    unmockBrowser()
  }
})

await asyncTest('mặc định TẮT giọng AI FPT: chỉ dùng giọng máy, không gọi mạng', async () => {
  const spoken = mockBrowser()
  const origFetch = globalThis.fetch
  try {
    let fetchCalls = 0
    globalThis.fetch = async () => { fetchCalls++; throw new Error('no network') }
    const v = new VoiceEngine({ apiBase: 'https://api.test' })
    assert.equal(v.getMode(), 'device', 'mặc định là giọng máy (FPT.AI tắt)')
    v.speak('Hà Nội đang dẫn đầu!', 'high')
    await waitIdle(v)
    assert.equal(fetchCalls, 0, 'không gọi FPT.AI khi đã tắt')
    assert.ok(spoken.some((t) => t.includes('Hà Nội đang dẫn đầu')), 'đọc bằng giọng máy')
  } finally {
    globalThis.fetch = origFetch
    unmockBrowser()
  }
})

await asyncTest('không có giọng Việt thì không đặt lang vi-VN (iPhone sẽ nuốt câu đọc)', async () => {
  const utterances = []
  globalThis.window = {
    Audio: class { constructor() { this.src = '' } play() { return Promise.resolve() } pause() {} },
    speechSynthesis: {
      getVoices: () => [{ lang: 'en-US', name: 'Samantha' }],
      speak(u) { utterances.push(u); setTimeout(() => { if (u.onend) u.onend() }, 0) },
      cancel() {},
    },
  }
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.rate = 1 } }
  const origFetch = globalThis.fetch
  try {
    const v = new VoiceEngine({ apiBase: 'https://api.test' })
    const info = v.getVoiceInfo()
    assert.equal(info.count, 1, 'máy có 1 giọng')
    assert.equal(info.hasVi, false, 'không có giọng Việt')
    v.speak('Kiểm tra giọng mặc định!', 'high')
    await waitIdle(v)
    const mine = utterances.find((u) => u.text.includes('Kiểm tra giọng mặc định'))
    assert.ok(mine, 'phải đọc câu thử')
    assert.notEqual(mine.lang, 'vi-VN', 'không có giọng Việt thì không được đặt lang vi-VN')
    assert.equal(mine.voice, undefined, 'không có giọng Việt thì không gán voice')
  } finally {
    globalThis.fetch = origFetch
    unmockBrowser()
  }
})

// ─── Nhạc nền: playlist 6 bài, tự chạy nối nhau, lưu cài đặt ──────────────
// Giả lập Audio + localStorage cho MusicEngine (Node không có 2 thứ này).
function mockMusicBrowser() {
  const store = {}
  globalThis.Audio = class {
    constructor() { this.src = ''; this.volume = 1; this.preload = ''; this._listeners = {} }
    addEventListener(ev, fn) { (this._listeners[ev] ||= []).push(fn) }
    load() {}
    play() { return Promise.resolve() }
    pause() {}
    _emit(ev) { (this._listeners[ev] || []).forEach((fn) => fn()) }
  }
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }
  return store
}
function unmockMusicBrowser() { delete globalThis.Audio; delete globalThis.localStorage }

await asyncTest('nhạc nền: 6 bài dài, phát → qua bài → hết danh sách thì lặp lại', async () => {
  mockMusicBrowser()
  try {
    assert.equal(MUSIC_TRACKS.length, 6, '6 bài nhạc nền')
    assert.ok(MUSIC_TRACKS.every((t) => t.file.startsWith('/music/') && t.file.endsWith('.mp3')), 'file MP3 trong /music/')
    assert.ok(MUSIC_TRACKS.every((t) => t.dur && t.title && t.artist), 'mỗi bài có tên + ca sĩ + thời lượng')
    const m = new MusicEngine()
    assert.equal(m.current().id, 'dance', 'bài đầu là Dance Music')
    assert.equal(m.playing, false, 'chưa phát lúc mới tạo')
    m.play()
    await sleep(0)
    assert.equal(m.playing, true, 'play() thì đang phát')
    m.next()
    assert.equal(m.current().id, 'phonk', 'qua bài sau là Phonk')
    assert.equal(m.playing, true, 'qua bài thì vẫn phát')
    m.next(); m.next(); m.next(); m.next()
    assert.equal(m.current().id, 'lofi', 'đi hết 5 bài thì tới Lofi')
    m.next()
    assert.equal(m.current().id, 'dance', 'hết danh sách thì quay lại bài đầu')
    m.pause()
    assert.equal(m.playing, false, 'pause() thì dừng')
  } finally { unmockMusicBrowser() }
})

await asyncTest('nhạc nền: hết bài tự chuyển bài sau; tắt nhạc thì dừng; âm lượng kẹp 0-1', async () => {
  mockMusicBrowser()
  try {
    const m = new MusicEngine()
    m.play()
    await sleep(0)
    // Hết bài (sự kiện ended) thì tự qua bài sau.
    m.audio._emit('ended')
    assert.equal(m.current().id, 'phonk', 'hết bài thì tự qua bài sau')
    assert.equal(m.playing, true, 'tự chuyển thì vẫn phát')
    // Âm lượng kẹp trong 0-1.
    m.setVolume(2)
    assert.equal(m.volume, 1, 'âm lượng >1 thì kẹp về 1')
    m.setVolume(-1)
    assert.equal(m.volume, 0, 'âm lượng <0 thì kẹp về 0')
    m.setVolume(0.5)
    assert.equal(m.volume, 0.5)
    assert.equal(m.audio.volume, 0.5, 'âm lượng áp vào thẻ audio')
    // Tắt nhạc thì dừng phát.
    m.setEnabled(false)
    assert.equal(m.enabled, false)
    assert.equal(m.playing, false, 'tắt nhạc thì dừng')
    // Bật lại thì phát tiếp.
    m.setEnabled(true)
    await sleep(0)
    assert.equal(m.playing, true, 'bật lại thì phát')
    // Cài đặt được lưu localStorage.
    const saved = JSON.parse(globalThis.localStorage.getItem('pml-music-v1'))
    assert.equal(saved.enabled, true)
    assert.equal(saved.volume, 0.5)
    assert.equal(saved.index, 1, 'đang ở bài Phonk (index 1)')
    // Engine mới đọc lại cài đặt đã lưu.
    const m2 = new MusicEngine()
    assert.equal(m2.volume, 0.5, 'mở lại vẫn nhớ âm lượng')
    assert.equal(m2.index, 1, 'mở lại vẫn nhớ bài đang phát')
  } finally { unmockMusicBrowser() }
})


// ─── Cờ dừng đúng vạch thắng ──────────────────────────────────────────────
// Dây chạy theo vận tốc nên 1 nhịp có thể vọt qua vạch thắng 1 tí, cờ sẽ
// lệch khỏi gạch vàng trên thước. Khi thắng bằng dây, kẹp dây về đúng
// ±winLine để cờ nằm đúng vạch khi màn kết thúc.
test('thắng bằng dây thì cờ dừng đúng vạch thắng (không vượt quá)', () => {
  const s = crowdMatch(20, 1) // A mạnh hơn hẳn → dây chạy nhanh về phía A
  s.rope = 0.69 // sát vạch thắng 0,7
  step(s, 0.5) // đủ để dây chạm vạch
  assert.equal(s.phase, 'roundEnd', 'chạm vạch thắng thì hết màn')
  assert.equal(s.roundWinner, 'A', 'đội A thắng')
  assert.equal(s.rope, 0.7, 'dây kẹp đúng vạch thắng 0,7, không vượt quá')
  // Phía đội B cũng vậy (dây âm).
  const t = crowdMatch(1, 20)
  t.rope = -0.69
  step(t, 0.5)
  assert.equal(t.phase, 'roundEnd')
  assert.equal(t.roundWinner, 'B')
  assert.equal(t.rope, -0.7, 'dây kẹp đúng vạch thắng -0,7 phía B')
})


// ─── Bắt đầu từng màn bằng tay (streamer ấn) ─────────────────────────────
// Hết màn/trận thì KHÔNG tự chạy tiếp — về chờ, hiện bảng hướng dẫn, chờ
// streamer xem đủ người rồi ấn bắt đầu. Ấn bắt đầu = doStart trong
// useTugOfWar (round++ + startRound nếu đang chờ màn sau, startMatch nếu
// chờ trận mới); ở đây kiểm tra phần engine (tick → chờ) + mô phỏng phần
// bắt đầu bằng chính hàm engine mà doStart gọi.
test('hết màn thì về chờ (không tự sang màn sau), ấn bắt đầu mới sang màn 2', () => {
  const s = freshMatch()
  assert.equal(s.phase, 'pulling')
  endRound(s, 'A')
  assert.equal(s.phase, 'roundEnd', 'thắng màn 1 thì vào roundEnd')
  assert.equal(s.teams.A.roundWins, 1)
  step(s, 11) // hết 10s ăn mừng/té bùn
  assert.equal(s.phase, 'waiting', 'hết roundEnd thì về chờ, không tự sang màn sau')
  assert.equal(s.waitingNextRound, true, 'đang chờ bắt đầu màn sau của trận đang đấu')
  assert.equal(s.round, 1, 'chưa ấn thì vẫn là màn 1')
  // Mô phỏng streamer ấn bắt đầu (doStart): round++ + startRound.
  s.round++
  startRound(s)
  assert.equal(s.phase, 'countdown', 'ấn bắt đầu thì đếm ngược màn 2')
  assert.equal(s.round, 2, 'sang màn 2')
  assert.equal(s.waitingNextRound, false, 'đã bắt đầu thì hết chờ')
})

test('hết trận thì về chờ (không tự bắt đầu trận mới)', () => {
  const s = freshMatch()
  endRound(s, 'A') // thắng màn 1 (1-0)
  step(s, 11) // về chờ màn 2
  s.round++
  startRound(s)
  s.phase = 'pulling'
  endRound(s, 'A') // thắng màn 2 (2-0) → vô địch trận
  assert.equal(s.phase, 'matchEnd', 'thắng 2 màn thì hết trận')
  assert.equal(s.matchWinner, 'A')
  step(s, 16) // hết 15s chờ hết trận
  assert.equal(s.phase, 'waiting', 'hết matchEnd thì về chờ, không tự bắt đầu trận mới')
  assert.equal(s.waitingNextRound, false, 'đang chờ bắt đầu trận mới')
  assert.equal(s.teams.A.roundWins, 2, 'tỉ số trận cũ vẫn giữ nguyên khi chờ')
  // Mô phỏng streamer ấn bắt đầu trận mới (doStart → startMatch).
  startMatch(s)
  assert.equal(s.round, 1, 'trận mới bắt đầu từ màn 1')
  assert.equal(s.teams.A.roundWins, 0, 'trận mới reset tỉ số')
  assert.equal(s.phase, 'countdown')
})


console.log('\n🪢 KÉO CO LIVE — test logic kéo co (luật v2: số đông vs quà, tim = giờ)')
for (const line of results) console.log(line)
console.log(`\n${pass} đậu · ${fail} rớt · tổng ${pass + fail}`)
if (fail > 0) process.exit(1)
