// ─── PET MARATHON LIVE · AdminPage.jsx ─────────────────────────────────────
// Trang điều khiển riêng /admin — 5 tab, điều khiển màn hiển thị từ xa qua
// BroadcastChannel (mở 2 tab cùng trình duyệt). Không chứa logic game.

import { useEffect, useRef, useState } from 'react'
import { onSyncMessage, postCmd, postSnapshotReq } from './game/sync'
import { ABILITIES, BALANCE_NOTE, CHAOS_EVENTS, DEFAULT_SETTINGS } from './game/engine'
import { fetchLeaderboard, supabaseConfigured } from './game/supabase'

const TABS = [
  { id: 'race', label: '🏁 Đua' },
  { id: 'gifts', label: '🎁 Quà & Chiêu' },
  { id: 'test', label: '🎲 Kiểm thử' },
  { id: 'connect', label: '🔗 Kết nối' },
  { id: 'settings', label: '⚙️ Cài đặt' },
]

function loadWs() {
  try { return JSON.parse(localStorage.getItem('pml-ws-v1') || '{}') } catch { return {} }
}

export default function AdminPage() {
  const [tab, setTab] = useState('race')
  const [snap, setSnap] = useState(null)
  const [wsUrl, setWsUrl] = useState(() => loadWs().wsUrl || '')
  const [wsKey, setWsKey] = useState(() => loadWs().key || '')
  const [showDiag, setShowDiag] = useState(false)
  const [leaderboard, setLeaderboard] = useState({ configured: false, rows: [] })
  const [notice, setNotice] = useState('')
  const [displayAlive, setDisplayAlive] = useState(false)
  const snapRef = useRef(null)
  const seenAtRef = useRef(0)

  useEffect(() => { snapRef.current = snap }, [snap])

  useEffect(() => {
    document.title = 'PET MARATHON LIVE — Bảng điều khiển'
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

  useEffect(() => {
    if (tab === 'race') fetchLeaderboard(10).then(setLeaderboard)
  }, [tab])

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(''), 3000) }
  const settings = snap?.settings || DEFAULT_SETTINGS
  const racers = snap?.racers || []
  const connected = snap?.wsStatus === 'open'

  const updateSettings = (patch) => {
    postCmd({ cmd: 'settings', settings: patch })
    flash('Đã lưu — màn hiển thị cập nhật ngay.')
  }

  return (
    <div className="pml-admin">
      <header className="pml-admin-head">
        <h1>🐾 PET MARATHON LIVE <span>— Bảng điều khiển</span></h1>
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

      {/* ── TAB 1: ĐUA ── */}
      {tab === 'race' && (
        <section className="pml-admin-sec">
          <h2>🏁 Cuộc đua</h2>
          <p>Trạng thái: <b>{snap?.phase === 'waiting' ? 'Đang chờ người chơi' : snap?.phase === 'countdown' ? 'Đang đếm ngược' : snap?.phase === 'racing' ? 'Đang đua' : snap?.phase === 'finished' ? 'Đã về đích' : '—'}</b>
            {snap?.paused ? ' · ⏸ Đang tạm dừng' : ''} · ❤️ {snap?.likes || 0} tim · 🎁 {snap?.queueLength || 0} quà đang chờ</p>
          <div className="pml-admin-btns">
            <button onClick={() => postCmd({ cmd: 'start' })}>▶️ Bắt đầu đua</button>
            <button onClick={() => postCmd({ cmd: 'pause' })}>⏸ Tạm dừng</button>
            <button onClick={() => postCmd({ cmd: 'resume' })}>▶️ Chơi tiếp</button>
            <button onClick={() => postCmd({ cmd: 'reset' })}>🔄 Đua lại từ đầu</button>
            <button onClick={() => postCmd({ cmd: 'addBot' })}>🤖 Thêm thú máy</button>
            <button onClick={() => postCmd({ cmd: 'removeBot' })}>➖ Bớt thú máy</button>
          </div>
          <h3>Thú đang đua ({racers.length}/6)</h3>
          {racers.length === 0 && <p>Chưa có thú nào — người xem bình luận THAM GIA, hoặc bấm Bắt đầu để máy lấp đầy.</p>}
          <ul className="pml-admin-list">
            {racers.map((r) => (
              <li key={r.id}>
                <b>Làn {r.lane + 1}</b> — {r.petName} · {r.nickname} {r.isBot ? '(máy)' : ''}
                {' · '}{Math.round(r.dist)}m {r.finished ? `· về hạng ${r.place}` : ''}
              </li>
            ))}
          </ul>
          {snap?.results?.length > 0 && (
            <>
              <h3>Kết quả cuộc vừa rồi</h3>
              <ol className="pml-admin-list">
                {snap.results.map((r) => <li key={r.id}>Hạng {r.place} — {r.nickname} ({r.petName})</li>)}
              </ol>
            </>
          )}
          <h3>🏆 Bảng xếp hạng thắng nhiều nhất</h3>
          {!supabaseConfigured() && !leaderboard.configured && (
            <p className="pml-admin-note">Bảng xếp hạng chưa nối — game vẫn chạy bình thường, chỉ chưa lưu được thành tích lên mạng. Cần gắn địa chỉ Supabase ở phần Cài đặt thì bảng này mới hiện.</p>
          )}
          {leaderboard.configured && leaderboard.rows.length === 0 && (
            <p className="pml-admin-note">Đã nối bảng xếp hạng nhưng chưa có ai thắng cuộc nào.</p>
          )}
          {leaderboard.rows.length > 0 && (
            <ol className="pml-admin-list">
              {leaderboard.rows.map((row, i) => (
                <li key={row.winner_nickname || i}>{row.winner_nickname} — {row.wins} lần thắng · {row.total_races} cuộc đua</li>
              ))}
            </ol>
          )}
          <p className="pml-admin-note">{BALANCE_NOTE}</p>
        </section>
      )}

      {/* ── TAB 2: QUÀ & CHIÊU ── */}
      {tab === 'gifts' && (
        <section className="pml-admin-sec">
          <h2>🎁 Quà tặng → Chiêu</h2>
          <p className="pml-admin-note">Tên quà khán giả tặng sẽ kích hoạt chiêu tương ứng. Sửa tên quà cho khớp với quà trên live của bạn. Quà nào không có trong bảng sẽ bị bỏ qua (không tự đoán).</p>
          <GiftMapEditor giftMap={settings.giftMap || {}} onSave={(giftMap) => updateSettings({ giftMap })} />
          <h3>⏱ Thời gian mỗi chiêu (giây)</h3>
          <div className="pml-admin-grid">
            {ABILITIES.filter((a) => a.duration > 0).map((a) => (
              <label key={a.id} className="pml-admin-field">
                {a.icon} {a.name}
                <input
                  type="number" min="0" max="30" step="0.5"
                  defaultValue={settings.durations?.[a.id] ?? a.duration}
                  onBlur={(e) => updateSettings({ durations: { [a.id]: Math.max(0, Number(e.target.value) || 0) } })}
                />
              </label>
            ))}
          </div>
          <h3>⚖️ Giới hạn cân bằng</h3>
          <div className="pml-admin-grid">
            <label className="pml-admin-field">Miễn nhiễm sau khi bị đánh (giây)
              <input type="number" min="0" max="10" defaultValue={settings.immunitySec} onBlur={(e) => updateSettings({ immunitySec: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="pml-admin-field">Cùng 1 thú, cách nhau ít nhất (giây) mới bị đánh lại
              <input type="number" min="0" max="15" defaultValue={settings.attackCooldownSec} onBlur={(e) => updateSettings({ attackCooldownSec: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="pml-admin-field">Tối đa số lần bị đánh / 1 thú / 1 cuộc đua
              <input type="number" min="1" max="10" defaultValue={settings.maxAttacksPerRacer} onBlur={(e) => updateSettings({ maxAttacksPerRacer: Math.max(1, Number(e.target.value) || 3) })} />
            </label>
            <label className="pml-admin-field">Chiêu toàn cuộc đua: cách nhau ít nhất (giây)
              <input type="number" min="0" max="5" step="0.5" defaultValue={settings.globalAttackIntervalSec} onBlur={(e) => updateSettings({ globalAttackIntervalSec: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
          </div>
          <p className="pml-admin-note">{BALANCE_NOTE}</p>
        </section>
      )}

      {/* ── TAB 3: KIỂM THỬ ── */}
      {tab === 'test' && (
        <section className="pml-admin-sec">
          <h2>🎲 Kiểm thử (không cần live thật)</h2>
          <p className="pml-admin-note">Bấm để giả lập quà / chiêu ngay trên màn hiển thị. Chỉ dùng để thử — không phải quà thật từ khán giả.</p>
          <TestPanel racers={racers} phase={snap?.phase} onDone={() => flash('Đã gửi thử lên màn hiển thị.')} />
          <h3>🎲 Sự kiện hỗn loạn</h3>
          <div className="pml-admin-btns">
            {CHAOS_EVENTS.map((e) => (
              <button key={e.id} onClick={() => { postCmd({ cmd: 'chaos', eventId: e.id }); flash(`Đã kích hoạt: ${e.name}`) }}>{e.icon} {e.name}</button>
            ))}
          </div>
          <h3>💬 Giả bình luận / tim</h3>
          <div className="pml-admin-btns">
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
              soThu: racers.length, giaiDoan: snap?.phase,
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
            <label className="pml-admin-field">Độ dài đường đua (mét)
              <input type="number" min="50" max="1000" defaultValue={settings.raceDistance} onBlur={(e) => updateSettings({ raceDistance: Math.max(50, Number(e.target.value) || 400) })} />
            </label>
            <label className="pml-admin-field">Sự kiện hỗn loạn: nhanh nhất (giây)
              <input type="number" min="10" max="300" defaultValue={settings.chaosMinSec} onBlur={(e) => updateSettings({ chaosMinSec: Math.max(10, Number(e.target.value) || 40) })} />
            </label>
            <label className="pml-admin-field">Sự kiện hỗn loạn: chậm nhất (giây)
              <input type="number" min="10" max="300" defaultValue={settings.chaosMaxSec} onBlur={(e) => updateSettings({ chaosMaxSec: Math.max(10, Number(e.target.value) || 60) })} />
            </label>
            <label className="pml-admin-field">Số tim để tăng tốc 1 thú ngẫu nhiên
              <input type="number" min="10" max="1000" defaultValue={settings.likeBoostEvery} onBlur={(e) => updateSettings({ likeBoostEvery: Math.max(10, Number(e.target.value) || 100) })} />
            </label>
            <label className="pml-admin-field">ID TikTok của streamer (để dùng lệnh DỪNG / TIẾP / +30S)
              <input type="text" defaultValue={settings.streamerId || ''} placeholder="vd: ten_tiktok_cua_ban" onBlur={(e) => updateSettings({ streamerId: e.target.value.trim() })} />
            </label>
          </div>
          <label className="pml-admin-check">
            <input type="checkbox" checked={settings.soundOn !== false} onChange={(e) => updateSettings({ soundOn: e.target.checked })} />
            {' '}Bật âm thanh vui (tổng hợp, không cần file nhạc)
          </label>
          <p className="pml-admin-note">
            API lưu kết quả:{' '}{import.meta.env?.VITE_API_URL ? 'đã gắn địa chỉ.' : 'chưa gắn — kết quả đua chỉ hiện trên màn hình, không lưu lên mạng.'}
            {' '}Bảng xếp hạng:{' '}{supabaseConfigured() ? 'đã nối.' : 'chưa nối — cần gắn địa chỉ Supabase thì mới hiện.'}
          </p>
          <p className="pml-admin-note">Mẹo trình chiếu: mở màn hiển thị với <code>?present=1</code> để ẩn nút hướng dẫn (vd: /?present=1).</p>
        </section>
      )}
    </div>
  )
}

// ─── Bảng sửa map quà ───
function GiftMapEditor({ giftMap, onSave }) {
  const [rows, setRows] = useState(() => Object.entries(giftMap).map(([gift, ability]) => ({ gift, ability })))
  const [newGift, setNewGift] = useState('')
  const [newAbility, setNewAbility] = useState('banana')

  const save = (next) => { setRows(next); onSave(Object.fromEntries(next.map((r) => [r.gift.trim().toLowerCase(), r.ability]))) }
  return (
    <div>
      <table className="pml-admin-table">
        <thead><tr><th>Tên quà</th><th>Chiêu</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input value={r.gift} onChange={(e) => { const next = [...rows]; next[i] = { ...r, gift: e.target.value }; setRows(next) }} onBlur={() => save(rows)} /></td>
              <td>
                <select value={r.ability} onChange={(e) => { const next = [...rows]; next[i] = { ...r, ability: e.target.value }; save(next) }}>
                  {ABILITIES.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </td>
              <td><button onClick={() => save(rows.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pml-admin-addrow">
        <input value={newGift} onChange={(e) => setNewGift(e.target.value)} placeholder="Tên quà mới, vd: Bóng bay" />
        <select value={newAbility} onChange={(e) => setNewAbility(e.target.value)}>
          {ABILITIES.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </select>
        <button onClick={() => {
          if (!newGift.trim()) return
          save([...rows, { gift: newGift.trim(), ability: newAbility }])
          setNewGift('')
        }}>➕ Thêm</button>
      </div>
      <button className="pml-admin-link" onClick={() => save(Object.entries(DEFAULT_SETTINGS.giftMap).map(([gift, ability]) => ({ gift, ability })))}>
        ↩ Khôi phục bảng mặc định
      </button>
    </div>
  )
}

// ─── Panel kiểm thử chiêu ───
function TestPanel({ racers, phase, onDone }) {
  const [ability, setAbility] = useState('banana')
  const [targetId, setTargetId] = useState('')
  const [sender, setSender] = useState('Bạn Thử')
  const racing = phase === 'racing'
  return (
    <div>
      {!racing && <p className="pml-admin-note">Chiêu chỉ có tác dụng khi đang đua — bấm “Bắt đầu đua” ở tab Đua trước.</p>}
      <div className="pml-admin-abilities">
        {ABILITIES.map((a) => (
          <button key={a.id} className={ability === a.id ? 'active' : ''} onClick={() => setAbility(a.id)} title={a.desc}>
            {a.icon} {a.name}
          </button>
        ))}
      </div>
      <p className="pml-admin-note">{ABILITIES.find((a) => a.id === ability)?.desc}</p>
      <h4>🎯 Chọn mục tiêu {ABILITIES.find((a) => a.id === ability)?.kind === 'buff' ? '(chiêu tăng sức luôn vào thú của người gửi)' : '(để trống = chọn đối thủ ngẫu nhiên)'}</h4>
      <div className="pml-admin-targets">
        <label><input type="radio" name="tgt" checked={targetId === ''} onChange={() => setTargetId('')} /> Ngẫu nhiên</label>
        {racers.map((r) => (
          <label key={r.id}>
            <input type="radio" name="tgt" checked={targetId === r.id} onChange={() => setTargetId(r.id)} />
            Làn {r.lane + 1} — {r.petName} ({r.nickname})
          </label>
        ))}
      </div>
      <label className="pml-admin-field">Người gửi (tên hiển thị)
        <input value={sender} onChange={(e) => setSender(e.target.value)} />
      </label>
      <div className="pml-admin-btns">
        <button disabled={!racing} onClick={() => { postCmd({ cmd: 'inject', abilityId: ability, sender, targetId: targetId || null }); onDone() }}>
          💥 Thử chiêu này
        </button>
        <button disabled={!racing} onClick={() => {
          const giftName = Object.entries(DEFAULT_SETTINGS.giftMap).find(([, v]) => v === ability)?.[0] || 'Hoa hồng'
          postCmd({ cmd: 'simGift', giftName, nickname: sender, userId: 'test', text: targetId ? `@${racers.find((r) => r.id === targetId)?.nickname || ''}` : '' })
          onDone()
        }}>
          🎁 Thử qua đường quà (kèm chống trùng + xếp hàng)
        </button>
      </div>
    </div>
  )
}
