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

const MEMBER_EMOJI = { soldier: '💂', player: '🥷', michelle: '👩', casual: '👱‍♀️', casual2: '👩‍🦰', soldierB: '👨‍🦱' }

function Stars({ n, total = 2 }) {
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
  // Hiệu ứng mới nhất: toast (ai vào xem, 2 giây) + quà tặng (hộp quà mở /
  // pháo hoa). Chỉ hiện 1 cái mỗi loại để không che màn hình.
  const toastFx = (s?.effects || []).filter((e) => e.kind === 'toast').pop()
  const giftFx = (s?.effects || []).filter((e) => e.kind === 'gift').pop()
  const bxh = s?.bxh || { gifters: [], likers: [] }
  const hasBxh = (bxh.gifters?.length || 0) > 0 || (bxh.likers?.length || 0) > 0

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
            <span className="pt-pets">{TEAMS.A.members.map((p) => MEMBER_EMOJI[p]).join('')}</span>
            <Stars n={teamA?.roundWins || 0} total={s?.settings?.winsToMatch || 2} />
            <span className="pt-count">👥 {s?.teamCounts?.A || 0} · 💪 {Math.round(teamA?.pullRate || 0)}</span>
          </div>
          <div className="pml-vs">
            <span className="pml-round">MÀN {s?.round || 1}</span>
            <span className="pml-timer">{phase === 'pulling' ? `${roundTimeLeft}s` : phase === 'countdown' ? '…' : '—'}</span>
          </div>
          <div className={`pml-team blue ${rope < -0.3 ? 'leading' : ''}`}>
            <span className="pt-emoji">🔵</span>
            <span className="pt-name">Đội Xanh</span>
            <span className="pt-pets">{TEAMS.B.members.map((p) => MEMBER_EMOJI[p]).join('')}</span>
            <Stars n={teamB?.roundWins || 0} total={s?.settings?.winsToMatch || 2} />
            <span className="pt-count">👥 {s?.teamCounts?.B || 0} · 💪 {Math.round(teamB?.pullRate || 0)}</span>
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
            {s?.finalTime && phase === 'pulling' && (
              <div className="rm-comeback">⏰ GIỜ CHÓT: quà tặng ×2 lực kéo!</div>
            )}
            {s?.luckyStar && phase === 'countdown' && (
              <div className="rm-lucky">⭐ {TEAMS[s.luckyStar.team].name} có ngôi sao may mắn — bắt đầu lệch về phía mình!</div>
            )}
          </div>
        )}

        {/* ── Đếm ngược ── */}
        {phase === 'countdown' && (
          <div className="pml-countdown">{countdown > 0 ? countdown : 'KÉO!'}</div>
        )}

        {/* ── Lật kèo: 1 món quà mạnh hơn cả đội kia — hiện to giữa màn hình ── */}
        {phase === 'pulling' && (s?.effects || []).some((e) => e.kind === 'flip') && (
          <div className="pml-flip">🌊 LẬT KÈO! {(s.effects.find((e) => e.kind === 'flip') || {}).sender || 'Ai đó'} 1 món quà cân cả đội kia!</div>
        )}

        {/* ── Tim cộng giờ: +10s hiện nhỏ dưới đồng hồ ── */}
        {phase === 'pulling' && (s?.effects || []).some((e) => e.kind === 'time') && (
          <div className="pml-timeflash">❤️ +10s kéo co!</div>
        )}

        {/* ── Ai vào xem / theo dõi / chia sẻ: hiện 2 giây rồi mất ── */}
        {toastFx && (
          <div className="pml-toast" key={toastFx.id}>{toastFx.text}</div>
        )}

        {/* ── Hiệu ứng tặng quà (đỉnh của chóp) ──
             Quà nhỏ: hộp quà mở ra + hiện tên người tặng.
             Quà to (≥25 lực): nổ pháo hoa + tên người tặng hiện nổi bật. */}
        {giftFx && !giftFx.big && (
          <div className="pml-gift" key={giftFx.id}>
            <div className="pml-gift-box">
              <span className="pml-gift-emoji">🎁</span>
              <span className="pml-gift-spark">✨</span>
            </div>
            <div className="pml-gift-name">{giftFx.sender}</div>
            <div className="pml-gift-sub">tặng {giftFx.gift || 'quà'} · 💪 {Math.round(giftFx.power)} lực kéo</div>
          </div>
        )}
        {giftFx && giftFx.big && (
          <div className="pml-fireworks" key={giftFx.id}>
            <span className="fw-burst fw-1" />
            <span className="fw-burst fw-2" />
            <span className="fw-burst fw-3" />
            <span className="fw-burst fw-4" />
            <span className="fw-burst fw-5" />
            <div className="pml-fireworks-name">
              <div className="fw-crown">🎆 {giftFx.icon || '🎁'}</div>
              <div className="fw-name">{giftFx.sender}</div>
              <div className="fw-sub">tặng {giftFx.gift || 'quà to'} · 💪 {Math.round(giftFx.power)} lực kéo!</div>
            </div>
          </div>
        )}

        {/* ── BXH nhỏ ở góc trái dưới: ai tặng quà / thả tim nhiều nhất ──
             Lưu lại qua các màn/trận + tải lại trang (chỉ xóa khi bấm Xóa BXH ở Admin). */}
        {hasBxh && (
          <div className="pml-bxh">
            <div className="pml-bxh-title">🏆 BXH</div>
            {(bxh.gifters?.length || 0) > 0 && (
              <div className="pml-bxh-sec">
                <div className="pml-bxh-head">🎁 Tặng quà nhiều nhất</div>
                {bxh.gifters.map((g, i) => (
                  <div className="pml-bxh-row" key={`g${i}`}>
                    <span className="pml-bxh-rank">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
                    <span className="pml-bxh-name">{g.nickname}</span>
                    <span className="pml-bxh-val">💪 {Math.round(g.power)}</span>
                  </div>
                ))}
              </div>
            )}
            {(bxh.likers?.length || 0) > 0 && (
              <div className="pml-bxh-sec">
                <div className="pml-bxh-head">❤️ Thả tim nhiều nhất</div>
                {bxh.likers.map((g, i) => (
                  <div className="pml-bxh-row" key={`l${i}`}>
                    <span className="pml-bxh-rank">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
                    <span className="pml-bxh-name">{g.nickname}</span>
                    <span className="pml-bxh-val">❤️ {g.likes}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tạm dừng: dải nhỏ ở dưới, không che sân ── */}
        {s?.paused && (
          <div className="pml-result-banner">⏸ Tạm dừng — bình luận TIẾP để chơi tiếp</div>
        )}

        {/* ── Chờ chọn đội: thẻ nhỏ ở dưới, chạm đâu cũng bắt đầu ── */}
        {phase === 'waiting' && !s?.paused && (
          <>
            <div className="pml-wait-tap" onClick={game.start} />
            <div className="pml-wait-card" onClick={game.start}>
              <div className="pml-wait-line">💬 <b>A</b> = Đội Đỏ 🔴 · <b>B</b> = Đội Xanh 🔵 · 🎁 Quà để kéo · ❤️ 100 tim = +10s kéo</div>
              <div className="pml-wait-go">👉 Chạm màn hình để bắt đầu kéo co!</div>
              {s?.pendingJoins > 0 && <div className="pml-wait-sub">⏳ {s.pendingJoins} bạn đang chờ vào đội</div>}
            </div>
          </>
        )}

        {/* ── Thắng màn / hòa: dải nhỏ ở dưới, sân 3D vẫn thấy rõ ── */}
        {phase === 'roundEnd' && s?.roundWinner && (
          <div className="pml-result-banner">
            {TEAMS[s.roundWinner].emoji} {TEAMS[s.roundWinner].name} thắng màn {s.round}! · 🔴 {teamA?.roundWins || 0} — {teamB?.roundWins || 0} 🔵 · Màn {s.round + 1} sau {Math.max(0, Math.ceil(s.nextRoundIn || 0))}s…
          </div>
        )}
        {phase === 'roundEnd' && !s?.roundWinner && (
          <div className="pml-result-banner">
            🤝 Màn {s?.round} hòa! · Màn {s.round + 1} sau {Math.max(0, Math.ceil(s.nextRoundIn || 0))}s…
          </div>
        )}

        {/* ── Vô địch trận: dải nhỏ ở dưới ── */}
        {phase === 'matchEnd' && s?.matchWinner && (
          <div className="pml-result-banner champion">
            🏆 {TEAMS[s.matchWinner].name.toUpperCase()} VÔ ĐỊCH! · 🔴 {teamA?.roundWins || 0} — {teamB?.roundWins || 0} 🔵 · 🎁 {s?.stats?.gifts || 0} quà{(s?.streak?.[s.matchWinner] || 0) > 1 ? ` · 🔥 Thắng ${s.streak[s.matchWinner]} trận liên tiếp!` : ''} · Trận mới sau {Math.max(0, Math.ceil(s.matchEndIn || 0))}s…
          </div>
        )}

        {/* ── Hướng dẫn ── */}
        {guideOpen && (
          <div className="pml-guide">
            <button className="pml-guide-x" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn">✕</button>
            <h3>📖 CÁCH CHƠI</h3>
            <p>💬 Bình luận <b>A</b> — vào Đội Đỏ 🔴 · <b>B</b> — vào Đội Xanh 🔵 (hoặc bình luận tên người: Anh Hùng/Miyo/Mia = Đỏ, Lan/Hương/Bình = Xanh). Mỗi người vào đội là <b>+1 lực kéo liên tục</b> — đội đông người kéo mạnh hơn!</p>
            <p>🎁 Tặng quà — quà là cú bùng sức mạnh: hoa hồng 1 xu = 1 lực · hạc giấy 99 xu = <b>100 lực, bằng 100 người!</b> Quà to có thể kéo ngang cả đội đông.</p>
            <p>❤️ Thả tim — <b>1 người thả đủ 100 tim thì màn kéo dài thêm 10 giây</b> (tối đa +60 giây). Tim không kéo dây, chỉ thêm giờ!</p>
            <p>⚡ Đội đang thua quá nửa đường được nhân đôi lực kéo (cơ hội cuối). <b>10 giây cuối: quà tặng ×2!</b></p>
            <p>🏆 Thắng 2 màn trước thì vô địch trận (best of 3 — tối đa 3 màn, 2–1 là vô địch). Đội thắng màn được ngôi sao may mắn ở màn sau!</p>
          </div>
        )}

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
