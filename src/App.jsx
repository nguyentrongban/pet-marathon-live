// ─── PET MARATHON LIVE · App.jsx ───────────────────────────────────────────
// Màn LIVE (/) — CHỈ hiển thị, không có Admin dính vào.
// Admin là trang riêng /admin, điều khiển màn này từ xa qua BroadcastChannel.

import { useEffect, useState } from 'react'
import RaceScene from './components/RaceScene'
import AdminPage from './AdminPage'
import { usePetMarathon } from './game/usePetMarathon'
import { WS_STATUS } from './game/wsClient'
import { CHAOS_BY_ID } from './game/engine'

const APP_VERSION = '1.0.0-render'

const PET_EMOJI = { cat: '🐱', dog: '🐶', rabbit: '🐰', beaver: '🦫', duck: '🦆', panda: '🐼' }
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function App() {
  const isAdmin = typeof window !== 'undefined'
    && window.location.pathname.replace(/\/$/, '') === '/admin'
  if (isAdmin) return <AdminPage />
  return <DisplayGame />
}

function DisplayGame() {
  const game = usePetMarathon()
  const { stateRef, snap, wsStatus, muted } = game
  const [guideOpen, setGuideOpen] = useState(false)
  const present = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('present') === '1'

  useEffect(() => { document.title = 'PET MARATHON LIVE — Đua thú cưng hỗn loạn!' }, [])

  const s = snap
  const connected = wsStatus === WS_STATUS.OPEN
  const racers = s?.racers || []
  const ordered = [...racers].sort((a, b) => b.dist - a.dist)
  const leader = ordered[0]
  const chaos = s?.chaos?.active ? CHAOS_BY_ID[s.chaos.active] : null
  const phase = s?.phase || 'waiting'
  const countdown = s ? Math.ceil(s.countdown) : 3

  return (
    <div className="pml-app" data-version={APP_VERSION}>
      <div className="pml-stage">
        <RaceScene liveRef={stateRef} />

        {/* ── Thanh trên ── */}
        <div className="pml-topbar">
          <div className="pml-logo">🐾 PET <b>MARATHON</b> <span className="pml-live">● LIVE</span></div>
          <div className="pml-top-actions">
            <span className={`pml-dot ${connected ? 'on' : ''}`} title={connected ? 'Đã nối TikTok LIVE' : 'Chưa nối TikTok'} />
            <button className="pml-iconbtn" onClick={game.toggleMute} aria-label="Bật/tắt tiếng">
              {muted ? '🔇' : '🔊'}
            </button>
            {!present && <button className="pml-helpbtn" onClick={() => setGuideOpen(!guideOpen)}>📖 Cách chơi</button>}
          </div>
        </div>

        {/* ── Bảng xếp hạng mini (theo sau nhóm dẫn đầu) ── */}
        {racers.length > 0 && phase !== 'finished' && (
          <div className="pml-standings">
            {ordered.map((r, i) => {
              const pct = Math.min(100, Math.round((r.dist / Math.max(1, s.distance)) * 100))
              return (
                <div key={r.id} className={`pml-row ${i === 0 ? 'lead' : ''}`}>
                  <span className="pml-row-rank">{i + 1}</span>
                  <span className="pml-row-pet">{PET_EMOJI[r.petId] || '🐾'}</span>
                  <span className="pml-row-name">{r.nickname}</span>
                  <span className="pml-row-bar"><i style={{ width: `${pct}%` }} /></span>
                  <span className="pml-row-pct">{pct}%</span>
                  <span className="pml-row-st">
                    {r.shield ? '🛡️' : ''}
                    {r.trapped ? '🕸️' : ''}
                    {r.rocket ? '🚀' : ''}
                    {r.slowed ? '🐌' : ''}
                    {r.immune ? '✨' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Chữ nổi (BỊ THẢ CHUỐI!...) theo làn ── */}
        <div className="pml-floaters">
          {(s?.floaters || []).map((f) => (
            <div key={f.id} className="pml-floater" style={{ top: `${8 + f.lane * 9}%` }}>{f.text}</div>
          ))}
        </div>

        {/* ── Banner sự kiện hỗn loạn ── */}
        {chaos && (
          <div className="pml-bigbanner" key={chaos.id + String(s?.chaos?.activeUntil)}>
            <div className="bb-text">{chaos.icon} {chaos.name.toUpperCase()}!</div>
            <div className="bb-sub">{chaos.desc}</div>
          </div>
        )}

        {/* ── Đếm ngược ── */}
        {phase === 'countdown' && (
          <div className="pml-countdown">{countdown > 0 ? countdown : 'GO!'}</div>
        )}

        {/* ── Tạm dừng ── */}
        {s?.paused && (
          <div className="pml-overlay">
            <div className="big-emoji">⏸</div>
            <h1>TẠM DỪNG</h1>
            <p>Streamer bình luận TIẾP để chơi tiếp</p>
          </div>
        )}

        {/* ── Chờ vào đua ── */}
        {phase === 'waiting' && !s?.paused && (
          <div className="pml-overlay rules" onClick={game.start}>
            <div className="pml-rules-card">
              <div className="pml-rules-title">🐾 PET MARATHON LIVE</div>
              <div className="pml-rules-tiles">
                <div className="pml-rules-tile pink"><span>💬</span><b>Bình luận THAM GIA</b><br />để nhận 1 thú đua</div>
                <div className="pml-rules-tile yellow"><span>🎁</span><b>Tặng quà</b><br />Hoa hồng 1 xu trượt chuối 🍌, quà càng nhiều xu chiêu càng mạnh</div>
                <div className="pml-rules-tile blue"><span>🛡️</span><b>Khiên &amp; thuốc</b><br />chặn đòn, hồi phục</div>
                <div className="pml-rules-tile green"><span>❤️</span><b>Thả tim</b><br />đủ 100 tim tăng tốc</div>
              </div>
              <div className="pml-rules-join">Bình luận THAM GIA để vào đua!</div>
              <div className="pml-overlay-hint">Chạm vào màn hình để bắt đầu cuộc đua</div>
              {s?.pendingJoins > 0 && <div className="pml-overlay-hint">⏳ {s.pendingJoins} bạn đang chờ cuộc sau</div>}
            </div>
          </div>
        )}

        {/* ── Bục vinh quang top 3 ── */}
        {phase === 'finished' && s?.results?.length > 0 && (
          <div className="pml-overlay podium">
            <div className="pml-podium-card">
              <div className="pml-podium-title">🏆 KẾT QUẢ CUỘC ĐUA</div>
              {s.results.slice(0, 3).map((r) => (
                <div key={r.id} className={`pml-podium-row place${r.place}`}>
                  <span className="pp-medal">{MEDAL[r.place] || '🎉'}</span>
                  <span className="pp-pet">{PET_EMOJI[s.racers.find((x) => x.id === r.id)?.petId] || '🐾'}</span>
                  <span className="pp-name">{r.nickname}</span>
                  <span className="pp-petname">{r.petName}</span>
                </div>
              ))}
              <div className="pml-podium-foot">Cuộc đua mới mở sau {Math.max(0, Math.ceil(s.nextRaceIn || 0))} giây…</div>
            </div>
          </div>
        )}

        {/* ── Hướng dẫn ── */}
        {guideOpen && (
          <div className="pml-guide">
            <button className="pml-guide-x" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn">✕</button>
            <h3>📖 CÁCH CHƠI</h3>
            <p>💬 Bình luận <b>THAM GIA</b> — nhận 1 thú đua (tối đa 6)</p>
            <p>🎁 Tặng quà — Hoa hồng 1 xu trượt chuối 🍌 · Kem 5 xu trượt băng 🧊 · Hạc giấy 99 xu chóng mặt 💫 · quà càng nhiều xu chiêu càng mạnh</p>
            <p>💋 Little Kisses 20 xu hồi phục cho thú của bạn · 🎯 Kèm <b>@tên</b> hoặc <b>số làn 1-6</b> để chọn mục tiêu, không kèm thì chọn ngẫu nhiên</p>
            <p>❤️ Đủ 100 tim — 1 thú ngẫu nhiên tăng tốc</p>
            <p>🛡️ Bị đánh xong được miễn nhiễm 3 giây, mỗi thú chỉ bị đánh tối đa 3 lần / cuộc đua</p>
          </div>
        )}

        {/* ── Feed trực tiếp ── */}
        <div className="pml-feed">
          {(s?.feed || []).slice(-5).map((f) => (
            <div key={f.id} className={`pml-feed-line ${f.kind}`}>{f.text}</div>
          ))}
        </div>

        {/* ── Thanh dưới: khoảng cách + tim + hàng đợi quà ── */}
        <div className="pml-bottombar">
          <span>🏁 {leader ? `${Math.round(leader.dist)}m / ${s?.distance || 400}m` : '—'}</span>
          <span>❤️ {s?.likes || 0}</span>
          {(s?.queueLength || 0) > 0 && <span>🎁 Đang chờ: {s.queueLength}</span>}
          {s?.chaos && !chaos && <span>🎲 Sự kiện sau ~{s.chaos.nextIn}s</span>}
          <span>{connected ? '🟢 Đã nối live' : '⚪ Chưa nối live'}</span>
        </div>
      </div>
    </div>
  )
}
