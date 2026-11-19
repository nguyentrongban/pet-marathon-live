// ─── KÉO CO LIVE · voice.js ────────────────────────────────────────────────
// Giọng đọc bình luận: tặng quà / thắng màn / BXH — đọc bằng giọng FPT.AI
// (Ban Mai nữ miền Bắc mặc định, đổi được trong Admin), hết lượt miễn phí
// hoặc lỗi mạng thì TỰ CHUYỂN sang giọng máy miễn phí trên điện thoại
// (speechSynthesis, tiếng Việt) rồi thử lại FPT.AI sau 5 phút.
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
  constructor({ apiBase = '', voice = 'banmai', enabled = true, onModeChange = null } = {}) {
    this.apiBase = String(apiBase || '').replace(/\/$/, '')
    this.voice = VOICE_IDS.has(voice) ? voice : 'banmai'
    this.enabled = enabled !== false
    this.onModeChange = typeof onModeChange === 'function' ? onModeChange : null
    this.queue = []
    this.speaking = false
    this.audio = null
    // Chế độ đang dùng: 'fpt' (giọng FPT.AI) hay 'device' (giọng máy miễn
    // phí). Chưa có địa chỉ API thì mặc định giọng máy (không gọi FPT.AI).
    this.mode = this.apiBase ? 'fpt' : 'device'
    this.fptCooldownUntil = 0
    this.lastSpokenText = ''
    this.lastSpokenAt = 0
    this._warmedUp = false
  }

  getMode() { return this.mode }

  setEnabled(on) {
    this.enabled = on !== false
    if (!this.enabled) this.stop()
  }

  setVoice(id) { if (VOICE_IDS.has(id)) this.voice = id }

  unlock() {
    // Đánh thức giọng máy để lần đọc đầu không bị trễ (iPhone tải giọng chậm).
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices()
        // iPhone: chỉ gọi getVoices() thì chưa đủ — phải gọi speak() 1 lần
        // trong lúc chạm thì lần đọc sau mới có tiếng. Đọc 1 câu câm (âm
        // lượng 0) để mở khóa mà không phát ra tiếng.
        if (!this._warmedUp) {
          this._warmedUp = true
          const u = new SpeechSynthesisUtterance('a')
          u.lang = 'vi-VN'
          u.volume = 0
          window.speechSynthesis.speak(u)
        }
      }
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
    // Thử FPT.AI trước (trừ khi đang trong 5 phút nghỉ sau lỗi/hết lượt,
    // hoặc câu này chỉ định đọc bằng giọng máy).
    if (!item.deviceOnly && (this.mode === 'fpt' || Date.now() >= this.fptCooldownUntil)) {
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

  speakDevice(text) {
    return new Promise((resolve) => {
      try {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
        if (!synth) return resolve(false)
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = 'vi-VN'
        utter.rate = 1
        // Ưu tiên giọng tiếng Việt có sẵn trên máy (iPhone có sẵn giọng Việt).
        const voices = synth.getVoices ? synth.getVoices() : []
        const vi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('vi'))
        if (vi) utter.voice = vi
        let done = false
        const finish = (ok) => {
          if (done) return
          done = true
          clearTimeout(timeoutId)
          resolve(ok)
        }
        utter.onend = () => finish(true)
        utter.onerror = () => finish(false)
        // iPhone hay bị kẹt 1 câu đọc cũ (nói dở rồi dừng, câu sau không
        // đọc được nữa) — hủy hết câu đang chờ trước khi đọc câu mới.
        try { synth.cancel() } catch { /* ignore */ }
        synth.speak(utter)
        // An toàn: quá 30 giây chưa xong thì dừng (tránh kẹt hàng đợi).
        const timeoutId = setTimeout(() => {
          try { synth.cancel() } catch { /* ignore */ }
          finish(false)
        }, 30000)
      } catch { resolve(false) }
    })
  }
}
