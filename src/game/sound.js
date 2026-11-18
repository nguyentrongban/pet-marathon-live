// ─── PET MARATHON LIVE · sound.js ──────────────────────────────────────────
// Âm thanh tổng hợp bằng WebAudio — không dùng file âm thanh nào.
// Còi trượt, boing, bụp, vù, leng keng... đều vẽ bằng sóng dao động.

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
  slip() { // trượt chuối: còi trượt xuống + bụp
    this.tone({ freq: 900, freqEnd: 180, dur: 0.5, type: 'sine', vol: 0.5 })
    this.tone({ freq: 140, freqEnd: 60, dur: 0.18, type: 'triangle', vol: 0.6, delay: 0.45 })
  }
  boing() { this.tone({ freq: 180, freqEnd: 620, dur: 0.28, type: 'sine', vol: 0.5 }) }
  pop() { this.tone({ freq: 500, freqEnd: 900, dur: 0.08, type: 'square', vol: 0.25 }) }
  thud() { this.tone({ freq: 110, freqEnd: 45, dur: 0.2, type: 'triangle', vol: 0.7 }); this.noise({ dur: 0.12, vol: 0.25 }) }
  whoosh() { this.noise({ dur: 0.35, vol: 0.35, lowpass: 2500 }) }
  sparkle() { // leng keng lên cao
    ;[880, 1174, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.3, delay: i * 0.07 }))
  }
  coin() { this.tone({ freq: 988, dur: 0.08, type: 'sine', vol: 0.35 }); this.tone({ freq: 1319, dur: 0.18, type: 'sine', vol: 0.35, delay: 0.07 }) }
  freeze() { this.tone({ freq: 1200, freqEnd: 2400, dur: 0.4, type: 'sine', vol: 0.25 }) }
  dizzy() { this.tone({ freq: 600, freqEnd: 300, dur: 0.5, type: 'sine', vol: 0.3 }); this.tone({ freq: 450, freqEnd: 220, dur: 0.5, type: 'sine', vol: 0.25, delay: 0.1 }) }
  rocket() { this.noise({ dur: 0.6, vol: 0.4, lowpass: 3000 }); this.tone({ freq: 200, freqEnd: 900, dur: 0.5, type: 'sawtooth', vol: 0.2 }) }
  shield() { this.tone({ freq: 520, dur: 0.12, type: 'sine', vol: 0.35 }); this.tone({ freq: 780, dur: 0.2, type: 'sine', vol: 0.35, delay: 0.1 }) }
  heal() { ;[523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.3, delay: i * 0.06 })) }
  fanfare() { // về đích / thắng
    ;[523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.4, delay: i * 0.12 }))
  }
  countdown() { this.tone({ freq: 660, dur: 0.12, type: 'square', vol: 0.3 }) }
  go() { this.tone({ freq: 880, dur: 0.3, type: 'square', vol: 0.35 }); this.tone({ freq: 1320, dur: 0.3, type: 'sine', vol: 0.3, delay: 0.05 }) }
  chaos() { // sự kiện hỗn loạn: kèn vui
    ;[392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.15, type: 'square', vol: 0.25, delay: i * 0.08 }))
  }

  playForAbility(abilityId) {
    const map = {
      banana: 'slip', melon: 'thud', net: 'pop', glove: 'boing',
      ice: 'freeze', dizzy: 'dizzy', rocket: 'rocket', shield: 'shield',
      heal: 'heal', magnet: 'sparkle',
    }
    const fn = map[abilityId]
    if (fn && this[fn]) this[fn]()
  }
  playForChaos() { this.chaos() }
}
