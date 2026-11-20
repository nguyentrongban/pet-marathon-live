// ─── Nhạc nền · music.js ───────────────────────────────────────────────────
// Nhạc nền miễn phí (Pixabay Content License — dùng thương mại được, không
// cần ghi nguồn) cho live kéo co: 6 bài dài (tổng ~22 phút), tự chạy hết
// bài này sang bài khác rồi lặp lại. Dùng thẻ <audio> (file MP3 trong
// public/music/, đã nén 128kbps cho nhẹ). iOS chỉ cho phát nhạc sau 1 lần
// chạm màn hình, nên nhạc bắt đầu khi người xem chạm lần đầu (cùng lúc mở
// khóa âm thanh hiệu ứng) hoặc khi bấm nút nhạc. Bật/tắt + âm lượng + bài
// đang phát được lưu localStorage để tải lại trang vẫn nhớ.
// Nguồn: Pixabay (track Dance Music/Aurec, Phonk/Krasnoshchok, Tech
// House/Aurec, Upbeat/ViacheslavStarostin, Synthwave/alex-morgan,
// Lofi/Sub_Clair). Lưu ý: các track này có nhãn "Content ID Registered"
// trên Pixabay — phát trên YouTube có thể bị nhận claim, còn phát trên
// TikTok LIVE thì không sao (TikTok tự xử lý bản quyền nhạc nền live).

export const MUSIC_TRACKS = [
  { id: 'dance', title: 'Dance Music', artist: 'Aurec', file: '/music/dance-music.mp3', dur: '2:53' },
  { id: 'phonk', title: 'Phonk', artist: 'Krasnoshchok', file: '/music/phonk.mp3', dur: '5:00' },
  { id: 'techhouse', title: 'Tech House', artist: 'Aurec', file: '/music/tech-house.mp3', dur: '3:32' },
  { id: 'upbeat', title: 'Upbeat', artist: 'ViacheslavStarostin', file: '/music/upbeat.mp3', dur: '3:40' },
  { id: 'synthwave', title: 'Synthwave Neon Drive', artist: 'alex-morgan', file: '/music/synthwave.mp3', dur: '3:33' },
  { id: 'lofi', title: 'Lofi', artist: 'Sub_Clair', file: '/music/lofi.mp3', dur: '3:34' },
]

const MUSIC_KEY = 'pml-music-v1'

export class MusicEngine {
  constructor({ onChange } = {}) {
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null
    this.tracks = MUSIC_TRACKS
    this.index = 0
    this.playing = false
    this.enabled = true
    this.volume = 0.4
    this.onChange = onChange || (() => {})
    if (this.audio) {
      this.audio.volume = this.volume
      this.audio.preload = 'metadata'
      this.audio.addEventListener('ended', () => this.next(true))
      this.audio.addEventListener('error', () => this.next(true))
    }
    try {
      const saved = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null')
      if (saved) {
        this.enabled = saved.enabled !== false
        if (typeof saved.volume === 'number') this.volume = Math.min(1, Math.max(0, saved.volume))
        if (typeof saved.index === 'number') this.index = Math.min(Math.max(0, saved.index), this.tracks.length - 1)
        if (this.audio) this.audio.volume = this.volume
      }
    } catch { /* localStorage lỗi thì dùng mặc định */ }
  }

  save() {
    try { localStorage.setItem(MUSIC_KEY, JSON.stringify({ enabled: this.enabled, volume: this.volume, index: this.index })) } catch {}
  }

  current() { return this.tracks[this.index] }

  state() {
    return { playing: this.playing, enabled: this.enabled, volume: this.volume, index: this.index, track: this.current() }
  }

  load(i) {
    this.index = ((i % this.tracks.length) + this.tracks.length) % this.tracks.length
    if (this.audio) {
      this.audio.src = this.tracks[this.index].file
      this.audio.load()
    }
    this.save()
  }

  play() {
    if (!this.audio || !this.enabled) return false
    if (!this.audio.src) this.load(this.index)
    const p = this.audio.play()
    if (p && p.then) {
      p.then(() => { this.playing = true; this.onChange(this.state()) })
        .catch(() => { this.playing = false })
    } else {
      this.playing = true
      this.onChange(this.state())
    }
    return true
  }

  pause() {
    if (this.audio) this.audio.pause()
    this.playing = false
    this.onChange(this.state())
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
    return this.playing
  }

  // Qua bài sau. auto=true: hết bài tự chuyển (giữ trạng thái đang phát).
  next(auto = false) {
    const wasPlaying = this.playing
    this.load(this.index + 1)
    if (wasPlaying || auto) this.play()
    this.onChange(this.state())
  }

  setEnabled(on) {
    this.enabled = !!on
    if (!this.enabled) this.pause()
    else this.play()
    this.save()
    this.onChange(this.state())
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0))
    if (this.audio) this.audio.volume = this.volume
    this.save()
    this.onChange(this.state())
  }

  // iOS: gọi sau 1 lần chạm màn hình để nhạc được phép phát.
  unlock() {
    if (this.enabled && !this.playing) this.play()
  }
}
