// ─── KÉO CO LIVE · AdminPage.jsx ───────────────────────────────────────────
// Trang điều khiển riêng /admin — 5 tab, điều khiển màn hiển thị từ xa qua
// BroadcastChannel (mở 2 tab cùng trình duyệt). Không chứa logic game.

import { useEffect, useRef, useState } from 'react'
import { onSyncMessage, postCmd, postSnapshotReq } from './game/sync'
import { BALANCE_NOTE, DEFAULT_SETTINGS, TEAMS, giftIcon, giftPrice, giftTier } from './game/engine'

const TABS = [
  { id: 'tug', label: '🪢 Kéo co' },
  { id: 'gifts', label: '🎁 Quà & Lực kéo' },
  { id: 'test', label: '🎲 Kiểm thử' },
  { id: 'connect', label: '🔗 Kết nối' },
  { id: 'settings', label: '⚙️ Cài đặt' },
]

const PHASE_LABEL = {
  waiting: 'Đang chờ chọn đội',
  countdown: 'Đang đếm ngược',
  pulling: 'Đang kéo co',
  roundEnd: 'Vừa xong 1 màn',
  matchEnd: 'Vừa xong 1 trận',
}

function loadWs() {
  try { return JSON.parse(localStorage.getItem('pml-ws-v1') || '{}') } catch { return {} }
}

export default function AdminPage() {
  const [tab, setTab] = useState('tug')
  const [snap, setSnap] = useState(null)
  const [wsUrl, setWsUrl] = useState(() => loadWs().wsUrl || '')
  const [wsKey, setWsKey] = useState(() => loadWs().key || '')
  const [showDiag, setShowDiag] = useState(false)
  const [notice, setNotice] = useState('')
  const [displayAlive, setDisplayAlive] = useState(false)
  const snapRef = useRef(null)
  const seenAtRef = useRef(0)

  useEffect(() => { snapRef.current = snap }, [snap])

  useEffect(() => {
    document.title = 'KÉO CO LIVE — Bảng điều khiển'
    postSnapshotReq() // xin snapshot đầy đủ ngay khi mở Admin
    const off = onSyncMessage((msg) => {
      if (!msg) return
      if (msg.type === 'state') {
        setSnap(msg)
        seenAtRef.current = Date.now()
        setDisplayAlive(true)
      } else if (msg.type === 'hello' || msg.type === 'heartbeat') {
        // Màn hiển thị vừa tải / còn sống: đánh dấu + xin snapshot nếu chưa có
        seenAtRef.current = Date.now()
        setDisplayAlive(true)
        if (!snapRef.current) postSnapshotReq()
      }
    })
    // Mở lại tab Admin / quay lại tab = nối lại: xin snapshot mới
    const onRefocus = () => postSnapshotReq()
    window.addEventListener('focus', onRefocus)
    document.addEventListener('visibilitychange', onRefocus)
    // Quá 6 giây không nghe nhịp tim thì coi như mất màn hiển thị
    const watch = setInterval(() => {
      if (Date.now() - seenAtRef.current > 6000) setDisplayAlive(false)
    }, 2000)
    return () => {
      off()
      window.removeEventListener('focus', onRefocus)
      document.removeEventListener('visibilitychange', onRefocus)
      clearInterval(watch)
    }
  }, [])

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(''), 3000) }
  const settings = snap?.settings || DEFAULT_SETTINGS
  const connected = snap?.wsStatus === 'open'
  const teamA = snap?.teams?.A
  const teamB = snap?.teams?.B
  const rope = snap?.rope ?? 0

  const updateSettings = (patch) => {
    postCmd({ cmd: 'settings', settings: patch })
    flash('Đã lưu — màn hiển thị cập nhật ngay.')
  }

  return (
    <div className="pml-admin">
      <header className="pml-admin-head">
        <h1>🪢 KÉO CO LIVE <span>— Bảng điều khiển</span></h1>
        <div className="pml-admin-status">
          <span className={`pml-dot ${connected ? 'on' : ''}`} />
          {connected ? 'Đã nối live' : displayAlive ? 'Màn hiển thị đang chạy — chưa nối live' : 'Chưa thấy màn hiển thị — mở tab game (/) cùng trình duyệt này'}
        </div>
      </header>
      {notice && <div className="pml-admin-notice">{notice}</div>}

      <nav className="pml-admin-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      {/* ── TAB 1: KÉO CO ── */}
      {tab === 'tug' && (
        <section className="pml-admin-sec">
          <h2>🪢 Trận kéo co</h2>
          <p>Trạng thái: <b>{PHASE_LABEL[snap?.phase] || '—'}</b>
            {snap?.paused ? ' · ⏸ Đang tạm dừng' : ''} · Màn {snap?.round || 1} · ❤️ {snap?.likes || 0} tim · 🎁 {snap?.queueLength || 0} quà đang chờ</p>
          <p>Tỉ số màn: <b>🔴 {teamA?.roundWins || 0} — {teamB?.roundWins || 0} 🔵</b>
            {' · '}Dây đang ở: <b>{rope > 0.05 ? 'lệch về Đỏ' : rope < -0.05 ? 'lệch về Xanh' : 'giữa'}</b>
            {snap?.phase === 'pulling' ? ` · còn ${Math.max(0, Math.ceil(snap.roundTimeLeft || 0))} giây` : ''}</p>
          <div className="pml-admin-btns">
            <button onClick={() => postCmd({ cmd: 'start' })}>▶️ Bắt đầu trận / màn sau</button>
            <button onClick={() => postCmd({ cmd: 'pause' })}>⏸ Tạm dừng</button>
            <button onClick={() => postCmd({ cmd: 'resume' })}>▶️ Chơi tiếp</button>
            <button onClick={() => postCmd({ cmd: 'reset' })}>🔄 Trận mới (xóa tỉ số)</button>
          </div>
          <h3>🔴 {TEAMS.A.name} — {TEAMS.A.members.map((p) => ({ soldier: '💂', player: '🥷', michelle: '👩' })[p]).join('')} ({teamA?.members?.length || 0} người · 💪 {Math.round(teamA?.pullRate || 0)} lực) · tổng lực kéo {Math.round(teamA?.totalPull || 0)}</h3>
          {(teamA?.members?.length || 0) === 0 && <p>Chưa có ai — khán giả bình luận A để vào đội Đỏ.</p>}
          <ul className="pml-admin-list">
            {(teamA?.members || []).map((m) => (
              <li key={m.nickname + m.userId}>{m.nickname} · {m.gifts || 0} quà · {Math.round(m.pulls || 0)} lực kéo</li>
            ))}
          </ul>
          <h3>🔵 {TEAMS.B.name} — {TEAMS.B.members.map((p) => ({ casual: '👱‍♀️', casual2: '👩‍🦰', soldierB: '👨‍🦱' })[p]).join('')} ({teamB?.members?.length || 0} người · 💪 {Math.round(teamB?.pullRate || 0)} lực) · tổng lực kéo {Math.round(teamB?.totalPull || 0)}</h3>
          {(teamB?.members?.length || 0) === 0 && <p>Chưa có ai — khán giả bình luận B để vào đội Xanh.</p>}
          <ul className="pml-admin-list">
            {(teamB?.members || []).map((m) => (
              <li key={m.nickname + m.userId}>{m.nickname} · {m.gifts || 0} quà · {Math.round(m.pulls || 0)} lực kéo</li>
            ))}
          </ul>
          <p className="pml-admin-note">{BALANCE_NOTE}</p>
          {(snap?.streak?.A || snap?.streak?.B) > 0 && (
            <p>🔥 Chuỗi thắng trận liên tiếp: 🔴 {snap?.streak?.A || 0} — {snap?.streak?.B || 0} 🔵</p>
          )}
          <h3>🏆 BXH — ai tặng quà / thả tim nhiều nhất (lưu lại cả phiên)</h3>
          {(!snap?.bxh?.gifters?.length && !snap?.bxh?.likers?.length) && <p>Chưa có ai tặng quà hay thả tim — BXH hiện khi có người tặng/thả tim, bảng nhỏ ở góc trái màn hình hiển thị.</p>}
          {(snap?.bxh?.gifters?.length || 0) > 0 && (
            <ul className="pml-admin-list">
              {snap.bxh.gifters.map((g, i) => (
                <li key={`g${i}`}>🎁 #{i + 1} {g.nickname} · 💪 {Math.round(g.power)} lực · {g.count || 0} quà{g.coins ? ` · 🪙 ${g.coins} xu` : ''}</li>
              ))}
            </ul>
          )}
          {(snap?.bxh?.likers?.length || 0) > 0 && (
            <ul className="pml-admin-list">
              {snap.bxh.likers.map((g, i) => (
                <li key={`l${i}`}>❤️ #{i + 1} {g.nickname} · {g.likes} tim</li>
              ))}
            </ul>
          )}
          <div className="pml-admin-btns">
            <button onClick={() => { postCmd({ cmd: 'resetBxh' }); flash('Đã xóa BXH — bắt đầu lại từ đầu.') }}>🗑️ Xóa BXH (live mới / ngày mới)</button>
          </div>
        </section>
      )}

      {/* ── TAB 2: QUÀ & LỰC KÉO ── */}
      {tab === 'gifts' && (
        <section className="pml-admin-sec">
          <h2>🎁 Quà tặng → Lực kéo</h2>
          <p className="pml-admin-note">Quà thật trên TikTok, chỉ lấy quà dưới 100 xu — quà là cú bùng sức mạnh, 1 món quà to bằng cả đám đông (1 xu = 1 lực, 5 xu = 5, 10 xu = 10, 20 xu = 25, 99 xu = 100). Chạm vào một món quà để mở bảng chi tiết của nó — giống bảng chọn quà trên TikTok. Quà nào không có trong bảng sẽ bị bỏ qua (không tự đoán).</p>
          <GiftMapEditor giftMap={settings.giftMap || {}} onSave={(giftMap) => updateSettings({ giftMap })} onTest={(gift) => { postCmd({ cmd: 'simGift', giftName: gift, nickname: 'Bạn Thử', userId: 'test', text: '' }); flash('Đã gửi thử quà lên màn hiển thị.') }} />
          <h3>⚖️ Giới hạn cân bằng</h3>
          <div className="pml-admin-grid">
            <label className="pml-admin-field">1 màn kéo tối đa (giây)
              <input type="number" min="15" max="180" defaultValue={settings.roundSeconds} onBlur={(e) => updateSettings({ roundSeconds: Math.max(15, Number(e.target.value) || 45) })} />
            </label>
            <label className="pml-admin-field">Thắng bao nhiêu màn thì vô địch trận
              <input type="number" min="1" max="7" defaultValue={settings.winsToMatch} onBlur={(e) => updateSettings({ winsToMatch: Math.max(1, Number(e.target.value) || 2) })} />
            </label>
            <label className="pml-admin-field">Lượt kéo toàn trận: cách nhau ít nhất (giây)
              <input type="number" min="0" max="5" step="0.5" defaultValue={settings.globalPullIntervalSec} onBlur={(e) => updateSettings({ globalPullIntervalSec: Math.max(0, Number(e.target.value) || 0.5) })} />
            </label>
            <label className="pml-admin-field">Tim: 1 người thả đủ bao nhiêu tim thì +thời gian
              <input type="number" min="10" max="1000" defaultValue={settings.likeTimeEvery} onBlur={(e) => updateSettings({ likeTimeEvery: Math.max(10, Number(e.target.value) || 100) })} />
            </label>
            <label className="pml-admin-field">Mỗi lần đủ tim thì +bao nhiêu giây kéo
              <input type="number" min="1" max="60" defaultValue={settings.likeTimeSeconds} onBlur={(e) => updateSettings({ likeTimeSeconds: Math.max(1, Number(e.target.value) || 10) })} />
            </label>
            <label className="pml-admin-field">Tối đa +bao nhiêu giây / màn (do tim)
              <input type="number" min="0" max="300" defaultValue={settings.likeTimeMaxBonus} onBlur={(e) => updateSettings({ likeTimeMaxBonus: Math.max(0, Number(e.target.value) || 60) })} />
            </label>
            <label className="pml-admin-field">Giờ chót: bắt đầu khi còn (giây)
              <input type="number" min="0" max="30" defaultValue={settings.finalSeconds} onBlur={(e) => updateSettings({ finalSeconds: Math.max(0, Number(e.target.value) || 10) })} />
            </label>
            <label className="pml-admin-field">Giờ chót: quà tặng nhân mấy lần lực kéo
              <input type="number" min="1" max="5" step="0.5" defaultValue={settings.finalGiftMult} onBlur={(e) => updateSettings({ finalGiftMult: Math.max(1, Number(e.target.value) || 2) })} />
            </label>
            <label className="pml-admin-field">Tốc độ dây tối đa (khi 1 đội áp đảo hoàn toàn)
              <input type="number" min="0.02" max="0.5" step="0.01" defaultValue={settings.ropeSpeed} onBlur={(e) => updateSettings({ ropeSpeed: Math.max(0.02, Number(e.target.value) || 0.12) })} />
            </label>
            <label className="pml-admin-field">Cơ hội cuối: đội thua quá (0–1) thì nhân đôi lực kéo
              <input type="number" min="0.1" max="0.95" step="0.05" defaultValue={settings.comebackAt} onBlur={(e) => updateSettings({ comebackAt: Math.min(0.95, Math.max(0.1, Number(e.target.value) || 0.55)) })} />
            </label>
            <label className="pml-admin-field">Cơ hội cuối: nhân mấy lần lực kéo
              <input type="number" min="1" max="5" step="0.5" defaultValue={settings.comebackMult} onBlur={(e) => updateSettings({ comebackMult: Math.max(1, Number(e.target.value) || 2) })} />
            </label>
          </div>
          <p className="pml-admin-note">{BALANCE_NOTE}</p>
        </section>
      )}

      {/* ── TAB 3: KIỂM THỬ ── */}
      {tab === 'test' && (
        <section className="pml-admin-sec">
          <h2>🎲 Kiểm thử (không cần live thật)</h2>
          <p className="pml-admin-note">Bấm để giả lập kéo / quà ngay trên màn hiển thị. Chỉ dùng để thử — không phải quà thật từ khán giả.</p>
          <TestPanel phase={snap?.phase} giftMap={settings.giftMap || {}} onDone={() => flash('Đã gửi thử lên màn hiển thị.')} />
          <h3>💬 Giả bình luận / tim</h3>
          <div className="pml-admin-btns">
            <button onClick={() => postCmd({ cmd: 'simChat', nickname: 'Bạn Thử', userId: 'test1', text: 'A' })}>💬 Giả: A (vào Đội Đỏ)</button>
            <button onClick={() => postCmd({ cmd: 'simChat', nickname: 'Bạn Thử 2', userId: 'test2', text: 'B' })}>💬 Giả: B (vào Đội Xanh)</button>
            <button onClick={() => postCmd({ cmd: 'simChat', nickname: 'Bạn Thử', userId: 'test1', text: 'THAM GIA' })}>💬 Giả: THAM GIA</button>
            <button onClick={() => postCmd({ cmd: 'simLike', count: 100 })}>❤️ Giả: +100 tim</button>
            <button onClick={() => postCmd({ cmd: 'simLike', count: 10 })}>🤍 Giả: +10 tim</button>
          </div>
        </section>
      )}

      {/* ── TAB 4: KẾT NỐI ── */}
      {tab === 'connect' && (
        <section className="pml-admin-sec">
          <h2>🔗 Kết nối TikTok LIVE</h2>
          <p className="pml-admin-note">Game nối với bộ nghe live qua địa chỉ WebSocket. Địa chỉ và mã chỉ lưu trên trình duyệt này, không gửi đi đâu khác.</p>
          <label className="pml-admin-field">Địa chỉ kết nối (dạng wss://…/ws)
            <input type="text" value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="vd: ten-app.onrender.com/ws" />
          </label>
          <label className="pml-admin-field">Mã truy cập
            <input type="password" value={wsKey} onChange={(e) => setWsKey(e.target.value)} placeholder="Mã do bộ nghe live cấp" />
          </label>
          <div className="pml-admin-btns">
            <button onClick={() => { postCmd({ cmd: 'connect', wsUrl, key: wsKey }); flash('Đang nối… xem trạng thái ở đầu trang.') }}>🔌 Nối ngay</button>
            <button onClick={() => postCmd({ cmd: 'disconnect' })}>🔌 Ngắt nối</button>
          </div>
          <p>Trạng thái: <b>{snap?.wsStatus || 'chưa nối'}</b>{snap?.wsDetail ? ` — ${snap.wsDetail}` : ''}</p>
          <h3>📋 Event gần đây</h3>
          {(snap?.wsLog?.length || 0) === 0 && <p className="pml-admin-note">Chưa có event nào. Khi live chạy, quà / bình luận / tim sẽ hiện ở đây.</p>}
          <ul className="pml-admin-list mono">
            {(snap?.wsLog || []).map((l, i) => <li key={i}><span className="dim">{l.at}</span> {l.line}</li>)}
          </ul>
          <button className="pml-admin-link" onClick={() => setShowDiag(!showDiag)}>
            {showDiag ? '▾ Ẩn nhật ký chẩn đoán' : '▸ Hiện nhật ký chẩn đoán'}
          </button>
          {showDiag && (
            <pre className="pml-admin-diag">{JSON.stringify({
              trangThai: snap?.wsStatus, chiTiet: snap?.wsDetail,
              giaiDoan: snap?.phase, man: snap?.round,
              day: snap?.rope, tiSo: `${teamA?.roundWins || 0}-${teamB?.roundWins || 0}`,
              hangDoiQua: snap?.queueLength, thongKe: snap?.stats,
            }, null, 2)}</pre>
          )}
        </section>
      )}

      {/* ── TAB 5: CÀI ĐẶT ── */}
      {tab === 'settings' && (
        <section className="pml-admin-sec">
          <h2>⚙️ Cài đặt</h2>
          <div className="pml-admin-grid">
            <label className="pml-admin-field">ID TikTok của streamer (để dùng lệnh DỪNG / TIẾP / +30S)
              <input type="text" defaultValue={settings.streamerId || ''} placeholder="vd: ten_tiktok_cua_ban" onBlur={(e) => updateSettings({ streamerId: e.target.value.trim() })} />
            </label>
          </div>
          <label className="pml-admin-check">
            <input type="checkbox" checked={settings.soundOn !== false} onChange={(e) => updateSettings({ soundOn: e.target.checked })} />
            {' '}Bật âm thanh vui (tổng hợp, không cần file nhạc)
          </label>
          <p className="pml-admin-note">
            API lưu kết quả:{' '}{import.meta.env?.VITE_API_URL ? 'đã gắn địa chỉ.' : 'chưa gắn — kết quả trận chỉ hiện trên màn hình, không lưu lên mạng.'}
          </p>
          <p className="pml-admin-note">Mẹo trình chiếu: mở màn hiển thị với <code>?present=1</code> để ẩn nút hướng dẫn (vd: /?present=1).</p>
        </section>
      )}
    </div>
  )
}

// ─── Bảng chọn quà kiểu TikTok ───
// Lưới quà: mỗi món hiện đúng icon quà TikTok + tên + lực kéo. Chạm vào 1 món
// quà sẽ mở bảng chi tiết của món đó (icon lớn, tên, lực kéo, thử tặng, xóa).
function GiftMapEditor({ giftMap, onSave, onTest }) {
  const [selected, setSelected] = useState(null)
  const [newGift, setNewGift] = useState('')
  const [newPower, setNewPower] = useState(1)
  const entries = Object.entries(giftMap)
  const sel = selected != null && giftMap[selected] != null ? selected : null
  const selPower = sel ? giftMap[sel] : null

  const rename = (oldName, newName) => {
    const name = String(newName || '').trim().toLowerCase()
    if (!name || name === oldName) return
    const next = { ...giftMap }
    const power = next[oldName]
    delete next[oldName]
    next[name] = power
    onSave(next)
    setSelected(name)
  }
  const setPower = (gift, power) => onSave({ ...giftMap, [gift]: Math.max(0, Number(power) || 0) })
  const removeGift = (gift) => {
    const next = { ...giftMap }
    delete next[gift]
    onSave(next)
    setSelected(null)
  }
  const addGift = () => {
    const name = newGift.trim().toLowerCase()
    if (!name) return
    onSave({ ...giftMap, [name]: Math.max(0, Number(newPower) || 0) })
    setNewGift('')
    setSelected(name)
  }

  return (
    <div>
      <div className="pml-gift-grid">
        {entries.map(([gift, power]) => {
          const price = giftPrice(gift)
          return (
            <button key={gift} className={`pml-gift-tile ${sel === gift ? 'active' : ''}`} onClick={() => setSelected(sel === gift ? null : gift)}>
              <span className="gi">{giftIcon(gift)}</span>
              <span className="gn">{gift}</span>
              {price != null && <span className="gp">🪙 {price} xu</span>}
              <span className="ga">💪 {power} lực kéo</span>
            </button>
          )
        })}
      </div>
      {sel && selPower != null && (
        <div className="pml-gift-sheet">
          <div className="gs-top">
            <span className="gs-icon">{giftIcon(sel)}</span>
            <div>
              <div className="gs-name">{sel}</div>
              <div className="gs-ability">💪 {selPower} lực kéo</div>
              {giftPrice(sel) != null && <div className="gs-price">🪙 {giftPrice(sel)} xu — {giftTier(giftPrice(sel))}</div>}
            </div>
            <button className="gs-x" onClick={() => setSelected(null)}>✕</button>
          </div>
          <p className="gs-desc">Tặng quà này là kéo dây {selPower} lực về phía đội của người tặng. Quà càng nhiều xu thì lực kéo càng lớn.</p>
          <label className="pml-admin-field">Tên quà
            <input key={sel} defaultValue={sel} onBlur={(e) => rename(sel, e.target.value)} />
          </label>
          <label className="pml-admin-field">Lực kéo khi tặng quà này
            <input type="number" min="0" max="100" key={`p-${sel}`} defaultValue={selPower} onBlur={(e) => setPower(sel, e.target.value)} />
          </label>
          <div className="pml-admin-btns">
            <button onClick={() => onTest(sel)}>🎁 Thử tặng quà này</button>
            <button onClick={() => removeGift(sel)}>✕ Xóa quà này</button>
          </div>
        </div>
      )}
      <div className="pml-admin-addrow">
        <span style={{ fontSize: 26, alignSelf: 'center' }}>{giftIcon(newGift)}</span>
        <input value={newGift} onChange={(e) => setNewGift(e.target.value)} placeholder="Tên quà mới, vd: Bánh" />
        <input type="number" min="0" max="100" value={newPower} onChange={(e) => setNewPower(e.target.value)} placeholder="Lực kéo" style={{ maxWidth: 90 }} />
        <button onClick={addGift}>➕ Thêm</button>
      </div>
      <button className="pml-admin-link" onClick={() => { onSave({ ...DEFAULT_SETTINGS.giftMap }); setSelected(null) }}>
        ↩ Khôi phục bảng mặc định
      </button>
    </div>
  )
}

// ─── Panel kiểm thử kéo ───
const POWER_CHOICES = [1, 5, 10, 25, 100]
function TestPanel({ phase, giftMap, onDone }) {
  const [teamId, setTeamId] = useState('A')
  const [power, setPower] = useState(6)
  const [sender, setSender] = useState('Bạn Thử')
  const pulling = phase === 'pulling'
  return (
    <div>
      {!pulling && <p className="pml-admin-note">Lực kéo chỉ có tác dụng khi đang kéo co — bấm “Bắt đầu trận / màn sau” ở tab Kéo co trước.</p>}
      <h4>🪢 Chọn đội kéo</h4>
      <div className="pml-admin-btns">
        <button className={teamId === 'A' ? 'active' : ''} onClick={() => setTeamId('A')}>🔴 Đội Đỏ</button>
        <button className={teamId === 'B' ? 'active' : ''} onClick={() => setTeamId('B')}>🔵 Đội Xanh</button>
      </div>
      <h4>💪 Lực kéo</h4>
      <div className="pml-admin-btns">
        {POWER_CHOICES.map((p) => (
          <button key={p} className={power === p ? 'active' : ''} onClick={() => setPower(p)}>{p} lực</button>
        ))}
      </div>
      <label className="pml-admin-field">Người gửi (tên hiển thị)
        <input value={sender} onChange={(e) => setSender(e.target.value)} />
      </label>
      <div className="pml-admin-btns">
        <button disabled={!pulling} onClick={() => { postCmd({ cmd: 'inject', teamId, power, sender }); onDone() }}>
          💪 Thử kéo {power} lực cho {teamId === 'A' ? 'Đội Đỏ' : 'Đội Xanh'}
        </button>
        <button disabled={!pulling} onClick={() => {
          const giftName = Object.entries(giftMap).find(([, v]) => v === power)?.[0] || 'Hoa hồng'
          postCmd({ cmd: 'simGift', giftName, nickname: sender, userId: 'test', text: teamId })
          onDone()
        }}>
          🎁 Thử qua đường quà (kèm chống trùng + xếp hàng)
        </button>
      </div>
    </div>
  )
}
