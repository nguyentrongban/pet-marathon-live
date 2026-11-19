// ─── KÉO CO LIVE · App.jsx ────────────────────────────────────────────────
// Màn LIVE (/) — CHỈ hiển thị, không có Admin dính vào.
// Admin là trang riêng /admin, điều khiển màn này từ xa qua BroadcastChannel.

import { useEffect, useState } from 'react'
import TugScene from './components/TugScene'
import AdminPage from './AdminPage'
import { useTugOfWar } from './game/useTugOfWar'
import { WS_STATUS } from './game/wsClient'
import { TEAMS } from './game/engine'

const APP_VERSION = '2.0.0-tug'

const PET_EMOJI = { cat: '🐱', dog: '🐶', rabbit: '🐰', beaver: '🦫', duck: '🦆', panda: '🐼' }

function Stars({ n, total = 3 }) {
  return <span className="pml-stars">{Array.from({ length: total }, (_, i) => (i < n ? '⭐' : '☆')).join('')}</span>
}

export default function App() {
  const isAdmin = typeof window !== 'undefined'
    && window.location.pathname.replace(/\/$/, '') === '/admin'
  if (isAdmin) return <AdminPage />
  return <DisplayGame />
}

function DisplayGame() {
  const game = useTugOfWar()
  const { stateRef, snap, wsStatus, muted } = game
  const [guideOpen, setGuideOpen] = useState(false)
  const present = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('present') === '1'

  useEffect(() => { document.title = 'KÉO CO LIVE — Đại chiến kéo co TikTok!' }, [])

  const s = snap
  const connected = wsStatus === WS_STATUS.OPEN
  const phase = s?.phase || 'waiting'
  const countdown = s ? Math.ceil(s.countdown) : 3
  const rope = s?.rope ?? 0
  const teamA = s?.teams?.A
  const teamB = s?.teams?.B
  const comebackTeam = rope > 0.55 ? 'B' : rope < -0.55 ? 'A' : null
  const roundTimeLeft = s ? Math.max(0, Math.ceil(s.roundTimeLeft || 0)) : 0
  const floaters = s?.floaters || []

  return (
    <div className="pml-app" data-version={APP_VERSION}>
      <div className="pml-stage">
        <TugScene liveRef={stateRef} />

        {/* ── Thanh trên ── */}
        <div className="pml-topbar">
          <div className="pml-logo">🪢 KÉO CO <span className="pml-live">● LIVE</span></div>
          <div className="pml-top-actions">
            <span className={`pml-dot ${connected ? 'on' : ''}`} title={connected ? 'Đã nối TikTok LIVE' : 'Chưa nối TikTok'} />
            <button className="pml-iconbtn" onClick={game.toggleMute} aria-label="Bật/tắt tiếng">
              {muted ? '🔇' : '🔊'}
            </button>
            {!present && <button className="pml-helpbtn" onClick={() => setGuideOpen(!guideOpen)}>📖 Cách chơi</button>}
          </div>
        </div>

        {/* ── Bảng tỉ số 2 đội ── */}
        <div className="pml-score">
          <div className={`pml-team red ${rope > 0.3 ? 'leading' : ''}`}>
            <span className="pt-emoji">🔴</span>
            <span className="pt-name">Đội Đỏ</span>
            <span className="pt-pets">{TEAMS.A.pets.map((p) => PET_EMOJI[p]).join('')}</span>
            <Stars n={teamA?.roundWins || 0} />
            <span className="pt-count">👥 {s?.teamCounts?.A || 0}</span>
          </div>
          <div className="pml-vs">
            <span className="pml-round">MÀN {s?.round || 1}</span>
            <span className="pml-timer">{phase === 'pulling' ? `${roundTimeLeft}s` : phase === 'countdown' ? '…' : '—'}</span>
          </div>
          <div className={`pml-team blue ${rope < -0.3 ? 'leading' : ''}`}>
            <span className="pt-emoji">🔵</span>
            <span className="pt-name">Đội Xanh</span>
            <span className="pt-pets">{TEAMS.B.pets.map((p) => PET_EMOJI[p]).join('')}</span>
            <Stars n={teamB?.roundWins || 0} />
            <span className="pt-count">👥 {s?.teamCounts?.B || 0}</span>
          </div>
        </div>

        {/* ── Thước dây: cờ trượt theo lực kéo ── */}
        {(phase === 'pulling' || phase === 'countdown' || phase === 'roundEnd') && (
          <div className="pml-rope-meter">
            <div className="rm-track">
              <div className="rm-zone red" />
              <div className="rm-zone blue" />
              <div className="rm-center" />
              <div className="rm-flag" style={{ left: `${50 - rope * 48}%` }}>🚩</div>
            </div>
            <div className="rm-labels"><span>🔴 Đỏ thắng</span><span>Xanh thắng 🔵</span></div>
            {comebackTeam && phase === 'pulling' && (
              <div className="rm-comeback">⚡ CƠ HỘI CUỐI: {TEAMS[comebackTeam].name} kéo ×2!</div>
            )}
            {s?.luckyStar && phase === 'countdown' && (
              <div className="rm-lucky">⭐ {TEAMS[s.luckyStar.team].name} có ngôi sao may mắn — bắt đầu lệch về phía mình!</div>
            )}
          </div>
        )}

        {/* ── Chữ nổi (KÉO CỰC MẠNH!...) theo đội ── */}
        <div className="pml-floaters">
          {floaters.map((f, i) => {
            const sameSide = floaters.slice(0, i).filter((x) => x.team === f.team).length
            return (
              <div
                key={f.id}
                className={`pml-floater ${f.team === 'A' ? 'left' : 'right'}`}
                style={{ top: `${30 + sameSide * 7}%` }}
              >{f.text}</div>
            )
          })}
        </div>

        {/* ── Đếm ngược ── */}
        {phase === 'countdown' && (
          <div className="pml-countdown">{countdown > 0 ? countdown : 'KÉO!'}</div>
        )}

        {/* ── Tạm dừng ── */}
        {s?.paused && (
          <div className="pml-overlay">
            <div className="big-emoji">⏸</div>
            <h1>TẠM DỪNG</h1>
            <p>Streamer bình luận TIẾP để chơi tiếp</p>
          </div>
        )}

        {/* ── Chờ chọn đội ── */}
        {phase === 'waiting' && !s?.paused && (
          <div className="pml-overlay rules" onClick={game.start}>
            <div className="pml-rules-card">
              <div className="pml-rules-title">🪢 KÉO CO LIVE</div>
              <div className="pml-rules-tiles">
                <div className="pml-rules-tile pink"><span>💬</span><b>Bình luận A hoặc B</b><br />A = Đội Đỏ 🔴 · B = Đội Xanh 🔵</div>
                <div className="pml-rules-tile yellow"><span>🎁</span><b>Tặng quà để kéo</b><br />Hoa hồng 1 xu kéo nhẹ, hạc giấy 99 xu kéo cực mạnh</div>
                <div className="pml-rules-tile blue"><span>⚡</span><b>Cơ hội cuối ×2</b><br />Đội đang thua được nhân đôi lực kéo</div>
                <div className="pml-rules-tile green"><span>❤️</span><b>Thả tim</b><br />Đủ 100 tim tiếp sức cho đội đang thua</div>
              </div>
              <div className="pml-rules-join">Bình luận A hoặc B để chọn đội!</div>
              <div className="pml-overlay-hint">Chạm vào màn hình để bắt đầu trận kéo co</div>
              {s?.pendingJoins > 0 && <div className="pml-overlay-hint">⏳ {s.pendingJoins} bạn đang chờ vào đội</div>}
            </div>
          </div>
        )}

        {/* ── Thắng màn ── */}
        {phase === 'roundEnd' && s?.roundWinner && (
          <div className="pml-overlay winner">
            <div className="pml-winner-card">
              <div className="pml-winner-emoji">{TEAMS[s.roundWinner].emoji}</div>
              <div className="pml-winner-title">{TEAMS[s.roundWinner].name.toUpperCase()} THẮNG MÀN {s.round}!</div>
              <div className="pml-winner-score">
                🔴 {teamA?.roundWins || 0} — {teamB?.roundWins || 0} 🔵
              </div>
              <div className="pml-winner-sub">Đội thua bị kéo xuống hố bùn! 😂</div>
              <div className="pml-podium-foot">Màn {s.round + 1} mở sau {Math.max(0, Math.ceil(s.nextRoundIn || 0))} giây…</div>
            </div>
          </div>
        )}
        {phase === 'roundEnd' && !s?.roundWinner && (
          <div className="pml-overlay winner">
            <div className="pml-winner-card">
              <div className="pml-winner-emoji">🤝</div>
              <div className="pml-winner-title">MÀN {s?.round} HÒA!</div>
              <div className="pml-winner-sub">Không đội nào kéo qua vạch — đấu lại màn sau!</div>
              <div className="pml-podium-foot">Màn {s.round + 1} mở sau {Math.max(0, Math.ceil(s.nextRoundIn || 0))} giây…</div>
            </div>
          </div>
        )}

        {/* ── Vô địch trận ── */}
        {phase === 'matchEnd' && s?.matchWinner && (
          <div className="pml-overlay champion">
            <div className="pml-winner-card">
              <div className="pml-winner-emoji">🏆</div>
              <div className="pml-winner-title">{TEAMS[s.matchWinner].name.toUpperCase()} VÔ ĐỊCH!</div>
              <div className="pml-winner-score">
                🔴 {teamA?.roundWins || 0} — {teamB?.roundWins || 0} 🔵
              </div>
              <div className="pml-winner-sub">🎁 Tổng {s?.stats?.gifts || 0} món quà đã tặng trong trận này!</div>
              <div className="pml-podium-foot">Trận mới mở sau {Math.max(0, Math.ceil(s.matchEndIn || 0))} giây…</div>
            </div>
          </div>
        )}

        {/* ── Hướng dẫn ── */}
        {guideOpen && (
          <div className="pml-guide">
            <button className="pml-guide-x" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn">✕</button>
            <h3>📖 CÁCH CHƠI</h3>
            <p>💬 Bình luận <b>A</b> — vào Đội Đỏ 🔴 · <b>B</b> — vào Đội Xanh 🔵 (hoặc bình luận tên thú: Mèo/Chó/Thỏ = Đỏ, Hải Ly/Vịt/Gấu = Xanh)</p>
            <p>🎁 Tặng quà — quà của đội nào thì kéo dây về phía đội đó. Hoa hồng 1 xu kéo nhẹ · Hạc giấy 99 xu kéo cực mạnh</p>
            <p>⚡ Đội đang thua quá nửa đường được nhân đôi lực kéo (cơ hội cuối) — màn nào cũng có thể lật kèo</p>
            <p>❤️ Đủ 100 tim — tiếp sức cho đội đang thua</p>
            <p>🏆 Thắng 3 màn trước thì vô địch trận. Đội thắng màn được ngôi sao may mắn ở màn sau!</p>
          </div>
        )}

        {/* ── Feed trực tiếp ── */}
        <div className="pml-feed">
          {(s?.feed || []).slice(-5).map((f) => (
            <div key={f.id} className={`pml-feed-line ${f.kind}`}>{f.text}</div>
          ))}
        </div>

        {/* ── Thanh dưới ── */}
        <div className="pml-bottombar">
          <span>🪢 Màn {s?.round || 1}</span>
          <span>❤️ {s?.likes || 0}</span>
          {(s?.queueLength || 0) > 0 && <span>🎁 Đang chờ: {s.queueLength}</span>}
          <span>{connected ? '🟢 Đã nối live' : '⚪ Chưa nối live'}</span>
        </div>
      </div>
    </div>
  )
}
