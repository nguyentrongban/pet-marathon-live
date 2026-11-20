// ─── KÉO CO LIVE · voice.js ────────────────────────────────────────────────
// Giọng đọc bình luận: tặng quà / thắng màn / BXH — đọc bằng GIỌNG MÁY miễn
// phí trên điện thoại (speechSynthesis, tiếng Việt). Giọng AI FPT.AI (Ban
// Mai) ĐANG TẮT theo yêu cầu của tấn (23:47) — code FPT.AI vẫn còn nguyên,
// bật lại bằng cách truyền useFpt: true cho VoiceEngine.
// Hàng đợi có ưu tiên: thắng trận > quà to / BXH > quà nhỏ; đầy thì bỏ
// câu ưu tiên thấp nhất. Không bao giờ đọc chồng lên nhau.

export const VOICE_OPTIONS = [
  { id: 'banmai', label: 'Ban Mai — nữ, miền Bắc' },
  { id: 'leminh', label: 'Lê Minh — nam, miền Bắc' },
  { id: 'lannhi', label: 'Lan Nhi — nữ, miền Nam' },
  { id: 'hatieumai', label: 'Hà Tiểu Mai — nữ, miền Nam' },
  { id: 'ngoclam', label: 'Ngọc Lam — nữ, miền Trung (Huế)' },
  { id: 'thuminh', label: 'Thu Minh — nữ, miền Nam' },
]
export const VOICE_IDS = new Set(VOICE_OPTIONS.map((v) => v.id))
// Hết lượt / lỗi FPT.AI → dùng giọng máy 5 phút rồi thử lại (hết lượt theo
// tháng thì vẫn lỗi, vẫn giọng máy; sang tháng mới hoặc nạp thêm lượt thì
// tự nối lại FPT.AI mà không cần bấm gì).
export const FPT_COOLDOWN_MS = 5 * 60 * 1000
export const VOICE_MAX_QUEUE = 3

const PRI = { low: 0, normal: 1, high: 2 }

// ─── Câu đọc (tiếng Việt, ngắn, FPT.AI đọc số thành chữ: 100 → một trăm) ──
export function voiceTextGift({ sender, giftName, effect, teamName, flip }) {
  const name = sender || 'Khán giả'
  const gift = giftName || 'quà'
  if (flip) return `Lật kèo! ${name} tặng ${gift}, cộng ${Math.round(effect)} lực kéo cho ${teamName}!`
  if (effect >= 25) return `${name} tặng ${gift}, cộng ${Math.round(effect)} lực kéo cho ${teamName}!`
  return `${name} tặng ${gift}!`
}
export function voiceTextRoundWin(teamName, round) { return `${teamName} thắng màn ${round}!` }
export function voiceTextMatchWin(teamName) { return `${teamName} vô địch trận đấu!` }
export function voiceTextRoundStart(round, labelA, labelB) { return `Màn ${round} bắt đầu! ${labelA} đấu với ${labelB}!` }
export function voiceTextFinal() { return 'Giờ chót! Mười giây cuối, quà tặng nhân đôi!' }
export function voiceTextLikes(seconds) { return `Đủ một trăm tim, cộng thêm ${seconds} giây!` }
export function voiceTextBxh(province, gifter) {
  const parts = []
  if (province) parts.push(`${province.name} dẫn đầu với ${Math.round(province.power)} lực`)
  if (gifter) parts.push(`${gifter.nickname} tặng nhiều nhất, ${Math.round(gifter.power)} lực`)
  if (!parts.length) return ''
  return `Bảng xếp hạng: ${parts.join('. ')}.`
}

export class VoiceEngine {
  constructor({ apiBase = '', voice = 'banmai', enabled = true, onModeChange = null, useFpt = false } = {}) {
    this.apiBase = String(apiBase || '').replace(/\/$/, '')
    this.voice = VOICE_IDS.has(voice) ? voice : 'banmai'
    this.enabled = enabled !== false
    this.onModeChange = typeof onModeChange === 'function' ? onModeChange : null
    this.queue = []
    this.speaking = false
    this.audio = null
    // Giọng AI FPT.AI TẮT mặc định (theo yêu cầu của tấn 23:47 — chỉ dùng
    // giọng máy trên điện thoại). Muốn bật lại Ban Mai thì truyền
    // useFpt: true. Chế độ đang dùng: 'fpt' hay 'device' (giọng máy).
    this.useFpt = useFpt === true
    this.mode = (this.useFpt && this.apiBase) ? 'fpt' : 'device'
    this.fptCooldownUntil = 0
    this.lastSpokenText = ''
    this.lastSpokenAt = 0
  }

  getMode() { return this.mode }

  setEnabled(on) {
    this.enabled = on !== false
    if (!this.enabled) this.stop()
  }

  setVoice(id) { if (VOICE_IDS.has(id)) this.voice = id }

  unlock() {
    // Đánh thức giọng máy để lần đọc đầu không bị trễ (iPhone tải giọng chậm).
    // Chỉ gọi getVoices() — KHÔNG đọc câu câm mở khóa nữa: câu câm đó có thể
    // kẹt trong hàng đợi giọng máy rồi làm câu thật sau đó không đọc được.
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.getVoices()
    } catch { /* ignore */ }
  }

  stop() {
    this.queue = []
    try { this.audio?.pause() } catch { /* ignore */ }
    this.audio = null
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    } catch { /* ignore */ }
    this.speaking = false
  }

  // force=true: đọc kể cả khi đang tắt (dùng cho nút "Thử giọng đọc" trong
  // Admin — streamer bấm để kiểm tra giọng thì phải nghe thấy).
  // deviceOnly=true: đọc thẳng bằng giọng máy, không gọi FPT.AI (phản hồi
  // ngay — dùng để thử xem điện thoại có đọc được không, không chờ mạng).
  speak(text, priority = 'normal', force = false, deviceOnly = false) {
    if (!this.enabled && !force) return false
    const t = String(text || '').trim()
    if (!t) return false
    // Câu y hệt vừa đọc trong 3 giây thì bỏ (tránh đọc lặp do event trùng).
    const now = Date.now()
    if (t === this.lastSpokenText && now - this.lastSpokenAt < 3000) return false
    const p = PRI[priority] ?? 1
    if (this.queue.length >= VOICE_MAX_QUEUE) {
      // Hàng đợi đầy: bỏ câu ưu tiên thấp nhất (quà nhỏ nhường chỗ cho thắng/quà to).
      let dropIdx = 0
      for (let i = 1; i < this.queue.length; i++) {
        if (this.queue[i].priority < this.queue[dropIdx].priority) dropIdx = i
      }
      if (p <= this.queue[dropIdx].priority) return false
      this.queue.splice(dropIdx, 1)
    }
    this.queue.push({ text: t, priority: p, deviceOnly: !!deviceOnly })
    this.pump()
    return true
  }

  // Thử giọng máy trực tiếp (không qua FPT.AI, không chờ mạng): dùng cho
  // nút thử giọng trên màn hiển thị — bấm là đọc ngay.
  speakDeviceTest(text) {
    return this.speak(text, 'high', true, true)
  }

  pump() {
    if (this.speaking || !this.queue.length) return
    // Lấy câu ưu tiên cao nhất (cùng ưu tiên thì đọc theo thứ tự vào trước).
    let idx = 0
    for (let i = 1; i < this.queue.length; i++) {
      if (this.queue[i].priority > this.queue[idx].priority) idx = i
    }
    const item = this.queue.splice(idx, 1)[0]
    this.speaking = true
    this.lastSpokenText = item.text
    this.lastSpokenAt = Date.now()
    this.playItem(item).catch(() => {}).finally(() => {
      this.speaking = false
      this.pump()
    })
  }

  async playItem(item) {
    // Giọng AI FPT.AI đang TẮT (useFpt=false) → đi thẳng giọng máy. Khi nào
    // bật lại useFpt thì mới thử FPT.AI trước (trừ khi đang trong 5 phút
    // nghỉ sau lỗi/hết lượt, hoặc câu này chỉ định đọc bằng giọng máy).
    if (this.useFpt && !item.deviceOnly && (this.mode === 'fpt' || Date.now() >= this.fptCooldownUntil)) {
      const url = await this.fetchFptAudio(item.text)
      if (url) {
        const played = await this.playAudio(url)
        if (played) { this.setMode('fpt'); return }
      }
      // FPT.AI lỗi / hết lượt: chuyển giọng máy 5 phút rồi thử lại sau.
      this.fptCooldownUntil = Date.now() + FPT_COOLDOWN_MS
      this.setMode('device', 'fpt-failed')
    }
    await this.speakDevice(item.text)
  }

  setMode(mode, reason) {
    if (this.mode === mode) return
    this.mode = mode
    try { this.onModeChange?.(mode, reason || '') } catch { /* ignore */ }
  }

  async fetchFptAudio(text) {
    if (!this.apiBase) return null
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const res = await fetch(`${this.apiBase}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: this.voice }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json().catch(() => ({}))
      return data && data.ok && data.url ? data.url : null
    } catch { return null }
  }

  playAudio(url) {
    return new Promise((resolve) => {
      try {
        const AudioCtor = typeof window !== 'undefined' ? window.Audio : null
        if (!AudioCtor) return resolve(false)
        const audio = new AudioCtor()
        this.audio = audio
        let done = false
        const finish = (ok) => {
          if (done) return
          done = true
          clearTimeout(timeoutId)
          audio.onended = null
          audio.onerror = null
          if (this.audio === audio) this.audio = null
          resolve(ok)
        }
        audio.onended = () => finish(true)
        audio.onerror = () => finish(false)
        audio.src = url
        const p = audio.play()
        if (p && typeof p.catch === 'function') p.catch(() => finish(false))
        // An toàn: quá 30 giây chưa xong thì dừng (tránh kẹt hàng đợi).
        const timeoutId = setTimeout(() => {
          try { audio.pause() } catch { /* ignore */ }
          finish(false)
        }, 30000)
      } catch { resolve(false) }
    })
  }

  // Thông tin giọng máy trên thiết bị (để chẩn đoán: máy có giọng nào không,
  // có giọng tiếng Việt không). Trả { count, hasVi, viName }.
  getVoiceInfo() {
    try {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
      if (!synth) return { count: 0, hasVi: false, viName: '' }
      const voices = synth.getVoices ? synth.getVoices() : []
      const vi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('vi'))
      return { count: voices.length, hasVi: !!vi, viName: vi ? (vi.name || 'tiếng Việt') : '' }
    } catch { return { count: 0, hasVi: false, viName: '' } }
  }

  async speakDevice(text) {
    try {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
      if (!synth) return false
      // iPhone: getVoices() ban đầu trả về rỗng (giọng chưa tải xong) — gọi
      // speak() lúc này là mất tiếng luôn. Đợi giọng tải xong (tối đa 2s)
      // rồi mới đọc.
      let voices = synth.getVoices ? synth.getVoices() : []
      if (!voices.length) {
        voices = await new Promise((resolve) => {
          let done = false
          const finish = () => {
            if (done) return
            done = true
            try {
              if (synth.removeEventListener) synth.removeEventListener('voiceschanged', onChange)
              else synth.onvoiceschanged = null
            } catch { /* ignore */ }
            resolve(synth.getVoices ? synth.getVoices() : [])
          }
          const onChange = () => finish()
          try {
            if (synth.addEventListener) synth.addEventListener('voiceschanged', onChange)
            else synth.onvoiceschanged = onChange
          } catch { /* ignore */ }
          setTimeout(finish, 2000)
        })
      }
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1
      // Chỉ đặt lang/voice tiếng Việt khi máy THẬT SỰ có giọng Việt. Nếu máy
      // chưa có giọng Việt mà vẫn đặt lang='vi-VN' thì iPhone sẽ nuốt luôn
      // câu đọc (không đọc, không báo lỗi) — đây là lỗi khiến máy im lặng
      // hoàn toàn. Không có giọng Việt thì đọc bằng giọng mặc định của máy
      // (nghe được, chỉ là phát âm chưa chuẩn).
      const vi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('vi'))
      if (vi) { utter.lang = vi.lang || 'vi-VN'; utter.voice = vi }
      // Nếu còn 1 câu kẹt trong máy (nói dở rồi dừng) thì hủy nó trước,
      // không thì câu mới xếp sau câu kẹt và không bao giờ đọc. Hủy xong
      // chờ 100ms rồi mới đọc (iPhone: hủy rồi đọc ngay là câu mới bị nuốt).
      if (synth.speaking || synth.pending) {
        try { synth.cancel() } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 100))
      }
      return await new Promise((resolve) => {
        let done = false
        let timeoutId = null
        const finish = (ok) => {
          if (done) return
          done = true
          clearTimeout(timeoutId)
          resolve(ok)
        }
        utter.onend = () => finish(true)
        utter.onerror = () => finish(false)
        synth.speak(utter)
        // An toàn: quá 30 giây chưa xong thì dừng (tránh kẹt hàng đợi).
        timeoutId = setTimeout(() => {
          try { synth.cancel() } catch { /* ignore */ }
          finish(false)
        }, 30000)
      })
    } catch { return false }
  }
}
