// ─── PET MARATHON LIVE · sync.js ───────────────────────────────────────────
// Đồng bộ giữa 2 tab cùng trình duyệt qua BroadcastChannel:
// - Màn hiển thị (/) là "chủ": giữ state game + nối TikTok WS, phát state.
// - Trang Admin (/admin) là "điều khiển từ xa": gửi lệnh, nhận state về hiển thị.
// Không cần server, không cần tài khoản. Mở 2 tab trên CÙNG trình duyệt là chạy.

const CHANNEL = 'pml-sync-v1'

let channel = null
function getChannel() {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null
  if (!channel) {
    try { channel = new BroadcastChannel(CHANNEL) } catch { return null }
  }
  return channel
}

// Lệnh Admin -> màn hiển thị
export function postCmd(cmd) {
  const ch = getChannel()
  if (ch) ch.postMessage({ type: 'cmd', ...cmd })
}

// State màn hiển thị -> Admin
export function postState(snapshot) {
  const ch = getChannel()
  if (ch) ch.postMessage({ type: 'state', ...snapshot })
}

// Màn hiển thị -> Admin: chào khi vừa tải + nhịp tim để Admin biết màn còn sống
export function postHello() {
  const ch = getChannel()
  if (ch) ch.postMessage({ type: 'hello', at: Date.now() })
}
export function postHeartbeat(meta = {}) {
  const ch = getChannel()
  if (ch) ch.postMessage({ type: 'heartbeat', at: Date.now(), ...meta })
}

// Admin -> màn hiển thị: xin snapshot đầy đủ (khi vừa mở Admin / nối lại)
export function postSnapshotReq() {
  const ch = getChannel()
  if (ch) ch.postMessage({ type: 'cmd', cmd: 'snapshotReq' })
}

export function onSyncMessage(cb) {
  const ch = getChannel()
  if (!ch) return () => {}
  const handler = (ev) => cb(ev.data)
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}

export function syncSupported() {
  return typeof window !== 'undefined' && 'BroadcastChannel' in window
}
