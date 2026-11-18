// ─── PET MARATHON LIVE · wsClient.js ───────────────────────────────────────
// WebSocket tới connector TikTok LIVE, tự kết nối lại khi rớt.
// URL dạng: wss://<app>.onrender.com/ws?key=<ACCESS_CODE>
// Không hardcode: URL + mã do streamer nhập trong Admin, chỉ lưu localStorage.

export const WS_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  OPEN: 'open',
  RECONNECTING: 'reconnecting',
  CLOSED: 'closed',
  ERROR: 'error',
}

export function buildWsUrl(baseUrl, accessCode) {
  let url = String(baseUrl || '').trim()
  if (!url) throw new Error('Chưa nhập địa chỉ kết nối')
  if (!/^wss?:\/\//i.test(url)) {
    url = 'wss://' + url.replace(/^\/+/, '')
  }
  try {
    const u = new URL(url)
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)
    if (!isLocal && u.protocol !== 'wss:') {
      u.protocol = 'wss:'
      url = u.toString()
    }
  } catch { /* để WebSocket báo lỗi URL */ }
  if (accessCode) {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}key=${encodeURIComponent(accessCode)}`
  }
  return url
}

export class TikTokWS {
  constructor({ onEvent, onStatus, onRaw }) {
    this.onEvent = onEvent
    this.onStatus = onStatus
    this.onRaw = onRaw
    this.ws = null
    this.wantOpen = false
    this.url = ''
    this.code = ''
    this.attempt = 0
    this.timer = null
    this.status = WS_STATUS.IDLE
  }

  setStatus(s, detail) {
    this.status = s
    this.onStatus?.(s, detail)
  }

  connect(baseUrl, accessCode) {
    this.disconnect(true)
    let url
    try { url = buildWsUrl(baseUrl, accessCode) } catch (e) {
      this.setStatus(WS_STATUS.ERROR, e.message)
      return
    }
    this.url = baseUrl
    this.code = accessCode
    this.wantOpen = true
    this.attempt = 0
    this.openSocket(url)
  }

  openSocket(url) {
    this.setStatus(this.attempt === 0 ? WS_STATUS.CONNECTING : WS_STATUS.RECONNECTING,
      this.attempt === 0 ? 'Đang kết nối…' : `Đang nối lại (lần ${this.attempt})…`)
    let ws
    try { ws = new WebSocket(url) } catch (e) {
      this.setStatus(WS_STATUS.ERROR, 'Địa chỉ kết nối không hợp lệ')
      this.scheduleReconnect()
      return
    }
    this.ws = ws
    ws.onopen = () => {
      this.attempt = 0
      this.setStatus(WS_STATUS.OPEN, 'Đã nối TikTok LIVE')
    }
    ws.onmessage = (ev) => {
      this.onRaw?.(ev.data)
      this.onEvent?.(ev.data)
    }
    ws.onerror = () => {
      if (this.ws === ws && this.status !== WS_STATUS.OPEN) {
        this.setStatus(WS_STATUS.ERROR, 'Không nối được — kiểm tra lại địa chỉ và mã truy cập')
      }
    }
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.ws = null
      if (!this.wantOpen) { this.setStatus(WS_STATUS.CLOSED, 'Đã ngắt kết nối'); return }
      this.setStatus(WS_STATUS.RECONNECTING, `Mất kết nối (mã ${ev.code || '?'}) — sẽ tự nối lại…`)
      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    if (!this.wantOpen) return
    this.attempt += 1
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt, 5))
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (!this.wantOpen) return
      try { this.openSocket(buildWsUrl(this.url, this.code)) } catch { /* thử lại ở vòng sau */ }
    }, delay)
  }

  disconnect(silent = false) {
    this.wantOpen = false
    clearTimeout(this.timer)
    if (this.ws) { try { this.ws.close() } catch { /* ignore */ } this.ws = null }
    if (!silent) this.setStatus(WS_STATUS.CLOSED, 'Đã ngắt kết nối')
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)) } catch { /* ignore */ }
    }
  }
}
