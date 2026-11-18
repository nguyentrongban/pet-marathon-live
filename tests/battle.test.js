// ─── PET MARATHON LIVE · tests/battle.test.js ──────────────────────────────
// Test logic thuần (không cần framework): chạy bằng `node tests/battle.test.js`
// hoặc `npm test`. Mỗi test là 1 hàm assert, in PASS/FAIL rồi tổng kết.
import assert from 'node:assert'
import {
  ABILITIES, BOT_NAMES, CHAOS_EVENTS, DEFAULT_SETTINGS, GiftEngine, PET_TYPES, advance,
  applyAbility, applyChaosEvent, clearNegatives, createRace, currentSpeedMult, fillBots,
  giftPrice, giftTier, joinRacer, makeRacer, parseTarget, pickChaosEvent, startRace, tick, uniqueBotName,
} from '../src/game/engine.js'

let pass = 0, fail = 0
const results = []
function test(name, fn) {
  try { fn(); pass++; results.push(`  ✅ ${name}`) }
  catch (e) { fail++; results.push(`  ❌ ${name}\n     → ${e.message}`) }
}
function freshRace() {
  const s = createRace({ ...DEFAULT_SETTINGS, durations: { ...DEFAULT_SETTINGS.durations } })
  s.racers.push(makeRacer({ lane: 0, petId: 'cat', nickname: 'Lan', userId: 'lan' }))
  s.racers.push(makeRacer({ lane: 1, petId: 'dog', nickname: 'Minh', userId: 'minh' }))
  s.racers.push(makeRacer({ lane: 2, petId: 'rabbit', nickname: 'Bé Bự (máy)', isBot: true }))
  startRace(s)
  s.phase = 'racing' // bỏ qua đếm ngược cho test
  s.now = 10
  return s
}
function step(s, sec) { const n = Math.ceil(sec / 0.05); for (let i = 0; i < n; i++) tick(s, 0.05) }

// ── 1. Chuối: chậm 3 giây + miễn nhiễm chặn đòn thứ hai ───────────────────
test('chuối làm chậm 60% trong 3 giây', () => {
  const s = freshRace()
  const target = s.racers[0]
  const r = applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(r.ok, true)
  assert.ok(currentSpeedMult(target, s.now) <= 0.45, 'tốc độ phải giảm mạnh sau khi bị chuối')
  step(s, 3.5)
  assert.ok(currentSpeedMult(target, s.now) >= 0.9, 'hết 3 giây phải chạy lại bình thường')
})

test('miễn nhiễm 3 giây chặn đòn thứ hai', () => {
  const s = freshRace()
  const target = s.racers[0]
  assert.equal(applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id).ok, true)
  const second = applyAbility(s, 'glove', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(second.ok, false)
  assert.equal(second.blocked, 'immune')
  step(s, 3.2) // hết miễn nhiễm nhưng vẫn trong cooldown 5s
  const third = applyAbility(s, 'glove', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(third.blocked, 'cooldown')
  step(s, 2.5) // tổng 5,7s > cooldown
  assert.equal(applyAbility(s, 'glove', { nickname: 'Minh', userId: 'minh' }, target.id).ok, true)
})

// ── 2. Khiên chặn 1 đòn rồi vỡ ─────────────────────────────────────────────
test('khiên chặn 1 đòn rồi vỡ, đòn sau đánh trúng', () => {
  const s = freshRace()
  const target = s.racers[0]
  assert.equal(applyAbility(s, 'shield', { nickname: 'Lan', userId: 'lan' }, target.id).ok, true)
  assert.equal(target.shieldCharges, 1)
  const blocked = applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.blocked, 'shield')
  assert.equal(target.shieldCharges, 0, 'khiên phải vỡ sau khi chặn')
  assert.ok(currentSpeedMult(target, s.now) >= 0.9, 'bị chặn thì không được chậm lại')
  const hit = applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(hit.ok, true, 'khiên vỡ rồi thì đòn sau phải trúng')
})

// ── 3. Thuốc xóa hết hiệu ứng xấu ──────────────────────────────────────────
test('thuốc hồi phục xóa hết hiệu ứng xấu', () => {
  const s = freshRace()
  const target = s.racers[0]
  applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
  step(s, 3.2) // hết miễn nhiễm
  step(s, 2.5) // hết cooldown
  applyAbility(s, 'ice', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.ok(currentSpeedMult(target, s.now) < 0.7, 'đang bị chậm trước khi uống thuốc')
  const healed = applyAbility(s, 'heal', { nickname: 'Lan', userId: 'lan' }, target.id)
  assert.equal(healed.ok, true)
  assert.ok(currentSpeedMult(target, s.now) >= 0.99, 'uống thuốc xong phải chạy bình thường')
  assert.equal(target.st.trappedUntil, 0)
  assert.equal(target.st.dizzyUntil, 0)
})

// ── 4. Cooldown + tối đa 3 lần bị đánh / cuộc đua ──────────────────────────
test('cùng 1 thú không bị đánh quá 3 lần trong 1 cuộc đua', () => {
  const s = freshRace()
  const target = s.racers[0]
  for (let i = 0; i < 3; i++) {
    const r = applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
    assert.equal(r.ok, true, `lần đánh thứ ${i + 1} phải trúng`)
    assert.equal(target.attacksReceived, i + 1)
    step(s, 6) // qua cả miễn nhiễm lẫn cooldown
  }
  const fourth = applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(fourth.ok, false)
  assert.equal(fourth.blocked, 'max')
  assert.ok(currentSpeedMult(target, s.now) >= 0.9, 'vượt giới hạn thì không được chậm thêm')
})

test('lưới bẫy đứng yên nhưng tối đa 2,5 giây', () => {
  const s = freshRace()
  const target = s.racers[0]
  assert.equal(applyAbility(s, 'net', { nickname: 'Minh', userId: 'minh' }, target.id).ok, true)
  assert.equal(currentSpeedMult(target, s.now), 0)
  step(s, 3)
  assert.ok(currentSpeedMult(target, s.now) > 0.9, 'hết lưới phải chạy lại được')
})

// ── 5. Giới hạn toàn cục: xếp hàng, 1 chiêu / 1,5 giây ────────────────────
test('giới hạn toàn cục xếp hàng các chiêu đến dồn dập', () => {
  const s = freshRace()
  const eng = new GiftEngine(s)
  eng.receive({ id: 'e1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  // Món thứ 2 phải là buff (heal) để không bị miễn nhiễm chặn — test này chỉ
  // kiểm tra hàng đợi + giới hạn 1,5 giây, không kiểm tra miễn nhiễm.
  eng.receive({ id: 'e2', giftName: 'little kisses', nickname: 'B', userId: 'b' })
  eng.receive({ id: 'e3', giftName: 'Hạc giấy', nickname: 'C', userId: 'c' })
  assert.equal(eng.queueLength, 3)
  const first = eng.process(10)
  assert.equal(first.ok, true)
  assert.equal(eng.queueLength, 2)
  const tooSoon = eng.process(10.5)
  assert.equal(tooSoon.reason, 'rate-limited')
  assert.equal(eng.queueLength, 2, 'chưa đủ 1,5 giây thì hàng đợi phải còn nguyên')
  const second = eng.process(11.6)
  assert.equal(second.ok, true)
  assert.equal(eng.queueLength, 1)
})

// ── 6. Chống trùng lặp event id ────────────────────────────────────────────
test('trùng event id bị loại, chỉ xử lý 1 lần', () => {
  const s = freshRace()
  const eng = new GiftEngine(s)
  const a = eng.receive({ id: 'dup-1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  const b = eng.receive({ id: 'dup-1', giftName: 'Hoa hồng', nickname: 'A', userId: 'a' })
  assert.equal(a.ok, true)
  assert.equal(b.ok, false)
  assert.equal(b.reason, 'duplicate')
  assert.equal(eng.droppedDuplicates, 1)
  assert.equal(eng.queueLength, 1)
})

// ── 7. Bảng map quà + mục tiêu mặc định ───────────────────────────────────
test('map quà theo tên đã cấu hình, quà lạ bị bỏ qua', () => {
  const s = freshRace()
  const eng = new GiftEngine(s)
  assert.equal(eng.resolveGift('Hoa Hồng'), 'banana')
  assert.equal(eng.resolveGift('HOA HỒNG'), 'banana')
  assert.equal(eng.resolveGift('Kem'), 'banana') // Kem ốc quế 1 xu = trượt chuối
  assert.equal(eng.resolveGift('Hạc giấy'), 'dizzy') // 99 xu = thử thách cực mạnh
  assert.equal(eng.resolveGift('Rosa'), 'glove') // 10 xu = đấm bay
  assert.equal(eng.resolveGift('Cỏ bốn lá'), 'net') // 10 xu = dính lưới
  assert.equal(eng.resolveGift('little kisses'), 'heal') // 20 xu = hồi phục
  assert.equal(eng.resolveGift('Quà lạ hoắc'), null)
  const unmapped = eng.receive({ id: 'u1', giftName: 'Quà lạ hoắc', nickname: 'A', userId: 'a' })
  assert.equal(unmapped.ok, false)
  assert.equal(unmapped.reason, 'unmapped')
  assert.equal(eng.queueLength, 0)
})

test('giá xu quà TikTok + bậc thử thách theo xu', () => {
  assert.equal(giftPrice('Hoa hồng'), 1)
  assert.equal(giftPrice('Rosa'), 10)
  assert.equal(giftPrice('Hạc giấy'), 99)
  assert.equal(giftPrice('Quà lạ hoắc'), null)
  assert.equal(giftTier(1), 'Thử thách nhỏ')
  assert.equal(giftTier(5), 'Thử thách vừa')
  assert.equal(giftTier(20), 'Thử thách lớn')
  assert.equal(giftTier(99), 'Thử thách cực mạnh')
})

test('không chọn mục tiêu → đánh đối thủ ngẫu nhiên, không đánh thú của mình', () => {
  const s = freshRace()
  const sender = s.racers[0]
  for (let i = 0; i < 20; i++) {
    const r = applyAbility(s, 'banana', { nickname: 'Lan', userId: 'lan' }, null)
    if (r.ok) assert.notEqual(r.targetId, sender.id, 'không được tự đánh thú của mình')
    step(s, 6)
    // reset số lần bị đánh để lặp lại được
    for (const x of s.racers) { x.attacksReceived = 0; x.st.immuneUntil = 0; x.lastAttackAt = -999 }
  }
})

test('nhắm mục tiêu bằng @tên và số làn', () => {
  const s = freshRace()
  assert.equal(parseTarget('CHUỐI @Minh', s.racers), s.racers[1].id)
  assert.equal(parseTarget('ném 2', s.racers), s.racers[1].id)
  assert.equal(parseTarget('cho Thỏ Trắng', s.racers), s.racers[2].id)
  assert.equal(parseTarget('không có mục tiêu', s.racers), null)
})

test('buff luôn rơi vào thú của người gửi', () => {
  const s = freshRace()
  const r = applyAbility(s, 'rocket', { nickname: 'Lan', userId: 'lan' }, null)
  assert.equal(r.ok, true)
  assert.equal(r.targetId, s.racers[0].id)
  assert.ok(currentSpeedMult(s.racers[0], s.now) > 1.5, 'tên lửa phải tăng tốc mạnh')
})

// ── 8. Sự kiện hỗn loạn hợp lệ ─────────────────────────────────────────────
test('sự kiện hỗn loạn luôn là 1 trong 5 sự kiện hợp lệ', () => {
  const valid = new Set(CHAOS_EVENTS.map((e) => e.id))
  const seen = new Set()
  for (let i = 0; i < 200; i++) {
    const id = pickChaosEvent()
    assert.ok(valid.has(id), `sự kiện lạ: ${id}`)
    seen.add(id)
  }
  assert.equal(seen.size, 5, '200 lần quay phải gặp đủ 5 sự kiện')
  const s = freshRace()
  for (const ev of CHAOS_EVENTS) {
    const r = applyChaosEvent(s, ev.id, s.now)
    assert.equal(r.ok, true, `áp sự kiện ${ev.id} phải thành công`)
  }
  assert.equal(applyChaosEvent(s, 'khong-co', s.now).ok, false)
})

// ── 9. Cân bằng: tốc độ không tụt dưới 25%, đua vẫn về đích ───────────────
test('tốc độ không bao giờ tụt dưới 25% tốc độ gốc', () => {
  const s = freshRace()
  const target = s.racers[0]
  applyAbility(s, 'banana', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.ok(currentSpeedMult(target, s.now) >= 0.25)
  const r2 = s.racers[1]
  applyAbility(s, 'ice', { nickname: 'Lan', userId: 'lan' }, r2.id)
  assert.ok(currentSpeedMult(r2, s.now) >= 0.25)
})

test('cuộc đua chạy đến cùng và có bục top 3', () => {
  const s = createRace({ ...DEFAULT_SETTINGS, raceDistance: 30, durations: { ...DEFAULT_SETTINGS.durations } })
  fillBots(s)
  assert.equal(s.racers.length, 6, 'phải đủ 6 thú (bot lấp đầy)')
  startRace(s)
  let guard = 0
  while (s.phase !== 'finished' && guard++ < 2000) tick(s, 0.05)
  assert.equal(s.phase, 'finished')
  assert.equal(s.results.length, 6)
  assert.equal(s.results[0].place, 1)
  assert.equal(s.results[2].place, 3)
})

test('người xem tham gia được, tối đa 6 thú', () => {
  const s = createRace({ ...DEFAULT_SETTINGS })
  for (let i = 0; i < 6; i++) assert.equal(joinRacer(s, `Bạn ${i}`, `u${i}`).ok, true)
  assert.equal(joinRacer(s, 'Bạn thừa', 'u7').ok, false)
  assert.equal(joinRacer(s, 'Bạn 0', 'u0').ok, false, 'cùng 1 người không tham gia 2 lần')
  assert.equal(joinRacer(s, 'Bạn 0', 'u0').reason, 'already')
})

test('dưa hấu và găng tay hất lùi đúng khoảng cách', () => {
  const s = freshRace()
  const target = s.racers[0]
  target.dist = 100
  applyAbility(s, 'melon', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(target.dist, 85)
  // Hết miễn nhiễm + cooldown bằng cách tua trạng thái (không tua tick để khỏi chạy thêm)
  target.st.immuneUntil = 0; target.lastAttackAt = -999
  applyAbility(s, 'glove', { nickname: 'Minh', userId: 'minh' }, target.id)
  assert.equal(target.dist, 75)
})

test('clearNegatives xóa sạch trạng thái xấu', () => {
  const r = makeRacer({ lane: 0, petId: 'cat', nickname: 'T', userId: 't' })
  r.st.slowUntil = 99; r.st.trappedUntil = 99; r.st.dizzyUntil = 99; r.st.iceUntil = 99
  clearNegatives(r, 10)
  assert.equal(r.st.slowUntil, 0)
  assert.equal(r.st.trappedUntil, 0)
  assert.equal(r.st.dizzyUntil, 0)
  assert.equal(r.st.iceUntil, 0)
})

test('bot lấp đầy luôn có tên duy nhất, không trùng nhau', () => {
  for (let i = 0; i < 50; i++) {
    const s = createRace({ ...DEFAULT_SETTINGS })
    fillBots(s)
    assert.equal(s.racers.length, 6)
    const names = s.racers.map((r) => r.nickname)
    assert.equal(new Set(names).size, 6, `lần ${i}: tên bot trùng nhau: ${names.join(', ')}`)
  }
  // Có sẵn 1 bot trùng tên trong kho thì bot mới vẫn không trùng
  const s = createRace({ ...DEFAULT_SETTINGS })
  s.racers.push(makeRacer({ lane: 0, petId: 'cat', nickname: 'Bé Bự (máy)', userId: 'x', isBot: true }))
  fillBots(s)
  const names = s.racers.map((r) => r.nickname)
  assert.equal(new Set(names).size, 6, `tên bot trùng nhau: ${names.join(', ')}`)
})

test('hết tên trong kho thì thêm số làn vẫn duy nhất', () => {
  const s = createRace({ ...DEFAULT_SETTINGS })
  BOT_NAMES.forEach((n, i) => {
    s.racers.push(makeRacer({ lane: i, petId: PET_TYPES[i].id, nickname: `${n} (máy)`, userId: `b${i}`, isBot: true }))
  })
  const name = uniqueBotName(s, 0)
  assert.ok(!s.racers.some((r) => r.nickname === name), `tên ${name} đã có rồi`)
  assert.ok(/\d/.test(name), `hết tên phải thêm số làn: ${name}`)
})

test('tiến thời gian thực: tab nền (dt lớn) vẫn đua đúng giờ', () => {
  const s = createRace({ ...DEFAULT_SETTINGS, raceDistance: 400, durations: { ...DEFAULT_SETTINGS.durations } })
  fillBots(s)
  startRace(s)
  s.phase = 'racing' // bỏ qua đếm ngược
  const d0 = s.racers[0].dist
  advance(s, 1.0) // 1 giây "tab nền" trong 1 lần gọi duy nhất
  assert.ok(s.raceTime >= 0.99 && s.raceTime <= 1.01, `raceTime phải ~1s, được ${s.raceTime}`)
  assert.ok(s.racers[0].dist > d0 + 5, '1 giây phải chạy được vài mét')
  // Đếm ngược cũng chạy hết với dt lớn
  const s2 = createRace({ ...DEFAULT_SETTINGS, raceDistance: 400, durations: { ...DEFAULT_SETTINGS.durations } })
  fillBots(s2)
  startRace(s2)
  assert.equal(s2.phase, 'countdown')
  advance(s2, 3.5)
  assert.equal(s2.phase, 'racing', 'đếm ngược 3s phải xong dù chỉ gọi 1 lần với dt=3,5')
})

test('đủ 10 chiêu, đủ 6 loại thú', () => {
  assert.equal(ABILITIES.length, 10)
  assert.equal(new Set(ABILITIES.map((a) => a.id)).size, 10)
  assert.equal(CHAOS_EVENTS.length, 5)
})

console.log('\n🐾 PET MARATHON LIVE — test logic hệ chiêu hỗn loạn')
for (const line of results) console.log(line)
console.log(`\n${pass} đậu · ${fail} rớt · tổng ${pass + fail}`)
if (fail > 0) process.exit(1)
