// ─── KÉO CO LIVE · sound.js ────────────────────────────────────────────────
// Âm thanh tổng hợp bằng WebAudio — không dùng file âm thanh nào.
// Tiếng kéo, bụp, té bùn, kèn thắng... đều vẽ bằng sóng dao động.

export class SoundEngine {
  constructor() {
    this.ctx = null
    this.enabled = true
    this.master = null
  }

  ensure() {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return null
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.35
        this.master.connect(this.ctx.destination)
      } catch { return null }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  tone({ freq = 440, freqEnd = null, dur = 0.15, type = 'sine', vol = 0.5, delay = 0 }) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  noise({ dur = 0.2, vol = 0.3, delay = 0, lowpass = 1200 }) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const t0 = ctx.currentTime + delay
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(filter).connect(g).connect(this.master)
    src.start(t0)
  }

  // ── Từng hiệu ứng ──
  pull() { // kéo nhẹ: bụp ngắn
    this.tone({ freq: 220, freqEnd: 140, dur: 0.12, type: 'triangle', vol: 0.45 })
    this.noise({ dur: 0.08, vol: 0.15, lowpass: 900 })
  }
  bigPull() { // kéo mạnh: gầm + bụp lớn
    this.tone({ freq: 160, freqEnd: 320, dur: 0.25, type: 'sawtooth', vol: 0.3 })
    this.tone({ freq: 110, freqEnd: 60, dur: 0.2, type: 'triangle', vol: 0.6, delay: 0.05 })
    this.noise({ dur: 0.15, vol: 0.25, lowpass: 1200 })
  }
  splash() { // té bùn: bõm + xì xì
    this.tone({ freq: 300, freqEnd: 70, dur: 0.35, type: 'sine', vol: 0.55 })
    this.noise({ dur: 0.4, vol: 0.3, lowpass: 700 })
  }
  cheer() { // reo hò khi thắng: kèn vui
    ;[523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.4, delay: i * 0.12 }))
  }
  fanfare() { this.cheer() }
  countdown() { this.tone({ freq: 660, dur: 0.12, type: 'square', vol: 0.3 }) }
  go() { this.tone({ freq: 880, dur: 0.3, type: 'square', vol: 0.35 }); this.tone({ freq: 1320, dur: 0.3, type: 'sine', vol: 0.3, delay: 0.05 }) }
  coin() { this.tone({ freq: 988, dur: 0.08, type: 'sine', vol: 0.35 }); this.tone({ freq: 1319, dur: 0.18, type: 'sine', vol: 0.35, delay: 0.07 }) }
  comeback() { // còi báo "cơ hội cuối"
    this.tone({ freq: 784, dur: 0.15, type: 'square', vol: 0.3 })
    this.tone({ freq: 1046, dur: 0.2, type: 'square', vol: 0.3, delay: 0.15 })
  }

  playForPull(effect) {
    if (effect >= 25) this.bigPull()
    else this.pull()
  }
}
