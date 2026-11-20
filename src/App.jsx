// ─── KÉO CO LIVE · App.jsx ────────────────────────────────────────────────
// Màn LIVE (/) — CHỈ hiển thị, không có Admin dính vào.
// Admin là trang riêng /admin, điều khiển màn này từ xa qua BroadcastChannel.

import { useEffect, useState } from 'react'
import {
  BookOpen, Cable, ChevronDown, ChevronUp, Flag, Flame, Gift, Hand, Handshake, Heart,
  Hourglass, MapPin, MessageCircle, Mic, Package, Pause, Shield, Sparkles, Star, Timer, Trophy,
  User, Users, Volume2, VolumeX, Waves, X, Zap,
} from 'lucide-react'
import TugScene from './components/TugScene'
import GiftIcon from './components/GiftIcon'
import AdminPage from './AdminPage'
import { useTugOfWar } from './game/useTugOfWar'
import { WS_STATUS } from './game/wsClient'
import { TEAMS } from './game/engine'
import { provinceRank } from './game/provinces'
import { regionInfo } from './game/regions'

const APP_VERSION = '2.0.0-tug'

// Icon Lucide cho từng người mẫu (hiện ở bảng tỉ số thay cho emoji mặt).
const MEMBER_ICON = { soldier: 'shield', player: 'zap', michelle: 'user', casual: 'user', casual2: 'user', soldierB: 'shield' }
function MemberIcons({ members }) {
  return (
    <span className="pt-pets">
      {members.map((p, i) => (
        MEMBER_ICON[p] === 'shield'
          ? <Shield key={i} size={14} className="pt-pet" />
          : MEMBER_ICON[p] === 'zap'
            ? <Zap key={i} size={14} className="pt-pet" />
            : <User key={i} size={14} className="pt-pet" />
      ))}
    </span>
  )
}

// Chấm màu đội (CSS) thay cho emoji 🔴🔵.
function TeamDot({ team }) {
  return <span className={`pt-dot ${team === 'A' ? 'red' : 'blue'}`} />
}

function Stars({ n, total = 2 }) {
  return (
    <span className="pml-stars">
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} size={15} className={i < n ? 'star-on' : 'star-off'} fill={i < n ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
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
  // BXH mặc định THU GỌN (chỉ 2 dòng: tỉnh dẫn đầu + người tặng nhiều nhất)
  // để không che sân 3D; bấm vào tiêu đề BXH để mở rộng xem đủ top 3.
  const [bxhOpen, setBxhOpen] = useState(false)
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
  const giftProvince = giftFx?.province ? regionInfo(giftFx.province) : null
  // Bùn dính ống kính (quà to): camera quay cận quà to thì bùn bắn dính lên
  // ống kính cho thật — hiện lúc quà to vừa tặng, mờ dần trong ~4 giây.
  // Opacity tính theo tuổi giftCam (snapshot cập nhật mỗi ~200ms) để mờ dần
  // mượt mà, không dùng animation mờ dần ở container (dễ kẹt opacity).
  const giftCamAge = s?.giftCam ? (s.now ?? 0) - s.giftCam.at : 99
  const mudLens = s?.giftCam?.big && giftCamAge >= 0 && giftCamAge < 4
  const mudOpacity = mudLens ? (giftCamAge < 3 ? 1 : Math.max(0, 4 - giftCamAge)) : 0
  const bxh = s?.bxh || { gifters: [], likers: [] }
  const provinces = bxh.provinces || []
  const hasBxh = (bxh.gifters?.length || 0) > 0 || (bxh.likers?.length || 0) > 0 || provinces.length > 0
  // Đấu vùng miền: tên đội = tên vùng (tỉnh/nước) đang đấu (nước kèm cờ),
  // chưa có vùng thì Đội Đỏ/Xanh.
  const teamLabel = (teamId) => {
    const code = s?.provinceTeams?.[teamId]
    if (code) {
      const info = regionInfo(code)
      if (info) return info.flag ? `${info.flag} ${info.name}` : info.name
    }
    return TEAMS[teamId].name
  }
  const teamShort = (teamId) => {
    const code = s?.provinceTeams?.[teamId]
    if (code) {
      const info = regionInfo(code)
      if (info) return info.flag ? `${info.flag} ${info.short}` : info.short
    }
    return TEAMS[teamId].name
  }

  return (
    <div className="pml-app" data-version={APP_VERSION}>
      <div className="pml-stage">
        <TugScene liveRef={stateRef} />

        {/* ── Thanh trên ── */}
        <div className="pml-topbar">
          <div className="pml-logo"><Cable size={20} className="pml-logo-ic" /> KÉO CO <span className="pml-live">● LIVE</span></div>
          <div className="pml-top-actions">
            <span className={`pml-dot ${connected ? 'on' : ''}`} title={connected ? 'Đã nối TikTok LIVE' : 'Chưa nối TikTok'} />
            <button className="pml-iconbtn" onClick={game.toggleMute} aria-label="Bật/tắt tiếng">
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            {/* Thử giọng đọc ngay trên tab màn hình này: bấm là đọc liền bằng
                giọng máy (không chờ FPT.AI). Bấm thử trong Admin thì tab màn
                hình không có cử chỉ chạm nên iPhone chặn, nghe không thấy. */}
            <button className="pml-iconbtn" onClick={game.testVoice} aria-label="Thử giọng đọc" title="Thử giọng đọc">
              <Mic size={20} />
            </button>
            {!present && <button className="pml-helpbtn" onClick={() => setGuideOpen(!guideOpen)}><BookOpen size={15} /> Cách chơi</button>}
          </div>
        </div>

        {/* ── Bảng tỉ số 2 đội ── */}
        <div className="pml-score">
          <div className={`pml-team red ${rope > 0.3 ? 'leading' : ''}`}>
            <TeamDot team="A" />
            <span className="pt-name">{teamLabel('A')}</span>
            <MemberIcons members={TEAMS.A.members} />
            <Stars n={teamA?.roundWins || 0} total={s?.settings?.winsToMatch || 2} />
            <span className="pt-count"><Users size={14} /> {s?.teamCounts?.A || 0} · <Zap size={14} /> {Math.round(teamA?.pullRate || 0)}</span>
          </div>
          <div className="pml-vs">
            <span className="pml-round">MÀN {s?.round || 1}</span>
            <span className="pml-timer">{phase === 'pulling' ? `${roundTimeLeft}s` : phase === 'countdown' ? '…' : '—'}</span>
          </div>
          <div className={`pml-team blue ${rope < -0.3 ? 'leading' : ''}`}>
            <TeamDot team="B" />
            <span className="pt-name">{teamLabel('B')}</span>
            <MemberIcons members={TEAMS.B.members} />
            <Stars n={teamB?.roundWins || 0} total={s?.settings?.winsToMatch || 2} />
            <span className="pt-count"><Users size={14} /> {s?.teamCounts?.B || 0} · <Zap size={14} /> {Math.round(teamB?.pullRate || 0)}</span>
          </div>
        </div>

        {/* ── Thước dây: cờ trượt theo lực kéo ── */}
        {(phase === 'pulling' || phase === 'countdown' || phase === 'roundEnd') && (
          <div className="pml-rope-meter">
            <div className="rm-track">
              <div className="rm-zone red" />
              <div className="rm-zone blue" />
              <div className="rm-center" />
              {/* Vạch thắng: cờ chạm tới vạch này là thắng màn ngay (không chờ hết giờ). */}
              <div className="rm-winmark" style={{ left: `${50 - (s?.settings?.winLine || 0.5) * 48}%` }} />
              <div className="rm-winmark" style={{ left: `${50 + (s?.settings?.winLine || 0.5) * 48}%` }} />
              <div className="rm-flag" style={{ left: `${50 - rope * 48}%` }}><Flag size={16} fill="currentColor" /></div>
            </div>
            <div className="rm-labels"><span><TeamDot team="A" /> {teamShort('A')} thắng</span><span>{teamShort('B')} thắng <TeamDot team="B" /></span></div>
            {comebackTeam && phase === 'pulling' && (
              <div className="rm-comeback"><Zap size={15} /> CƠ HỘI CUỐI: {teamLabel(comebackTeam)} kéo ×2!</div>
            )}
            {s?.finalTime && phase === 'pulling' && (
              <div className="rm-comeback"><Timer size={15} /> GIỜ CHÓT: quà tặng ×2 lực kéo!</div>
            )}
            {s?.luckyStar && phase === 'countdown' && (
              <div className="rm-lucky"><Star size={15} fill="currentColor" /> {teamLabel(s.luckyStar.team)} có ngôi sao may mắn — bắt đầu lệch về phía mình!</div>
            )}
          </div>
        )}

        {/* ── Đếm ngược ── */}
        {phase === 'countdown' && (
          <div className="pml-countdown">{countdown > 0 ? countdown : 'KÉO!'}</div>
        )}

        {/* ── Lật kèo: 1 món quà mạnh hơn cả đội kia — hiện to giữa màn hình ── */}
        {phase === 'pulling' && (s?.effects || []).some((e) => e.kind === 'flip') && (
          <div className="pml-flip"><Waves size={22} /> LẬT KÈO! {(s.effects.find((e) => e.kind === 'flip') || {}).sender || 'Ai đó'} 1 món quà cân cả đội kia!</div>
        )}

        {/* ── Tim cộng giờ: +10s hiện nhỏ dưới đồng hồ ── */}
        {phase === 'pulling' && (s?.effects || []).some((e) => e.kind === 'time') && (
          <div className="pml-timeflash"><Heart size={15} fill="currentColor" /> +10s kéo co!</div>
        )}

        {/* ── Ai vào xem / theo dõi / chia sẻ: hiện 2 giây rồi mất ── */}
        {toastFx && (
          <div className="pml-toast" key={toastFx.id}>{toastFx.text}</div>
        )}

        {/* ── Hiệu ứng tặng quà (đỉnh của chóp) ──
             Quà nhỏ: sticker đúng món quà (hoa hồng = hoa, hạc giấy = chim...)
             nảy lên + hiện tên người tặng.
             Quà to (≥25 lực): sticker to + nổ pháo hoa + tên người tặng nổi bật. */}
        {giftFx && !giftFx.big && (
          <div className="pml-gift" key={giftFx.id}>
            <div className="pml-gift-box">
              <span className="pml-gift-sticker"><GiftIcon gift={giftFx.gift} power={giftFx.power} size={64} /></span>
              <span className="pml-gift-spark"><Sparkles size={22} /></span>
            </div>
            <div className="pml-gift-name">{giftFx.sender}</div>
            <div className="pml-gift-sub">tặng {giftFx.gift || 'quà'} · <Zap size={13} /> {Math.round(giftFx.power)} lực kéo</div>
            {giftProvince && <div className="pml-gift-province"><MapPin size={15} /> {giftProvince.flag ? `${giftProvince.flag} ` : ''}{giftProvince.name}{giftFx.provinceBonus ? ' · Vùng dẫn đầu ×1,5!' : ''}</div>}
          </div>
        )}
        {giftFx && giftFx.big && (
          <div className="pml-fireworks" key={giftFx.id}>
            {/* Thùng tiếp tế Free Fire: quà to thì thùng tiếp tế thả dù rơi xuống
                góc phải dưới (không che nhân vật/bảng điểm giữa màn), đáp
                xuống thì nắp bật mở + sáng vàng rồi mờ dần cho gọn. */}
            <div className="pml-airdrop">
              <div className="pml-airdrop-chute" />
              <div className="pml-airdrop-crate">
                <div className="pml-airdrop-lid" />
                <Package size={20} />
              </div>
              <div className="pml-airdrop-glow" />
            </div>
            <span className="fw-burst fw-1" />
            <span className="fw-burst fw-2" />
            <span className="fw-burst fw-3" />
            <span className="fw-burst fw-4" />
            <span className="fw-burst fw-5" />
            <div className="pml-fireworks-name">
              <div className="fw-crown"><Sparkles size={26} /> <GiftIcon gift={giftFx.gift} power={giftFx.power} size={56} className="fw-gift-ic" /></div>
              <div className="fw-name">{giftFx.sender}</div>
              <div className="fw-sub">tặng {giftFx.gift || 'quà to'} · <Zap size={14} /> {Math.round(giftFx.power)} lực kéo!</div>
              {giftProvince && <div className="fw-province"><MapPin size={15} /> {giftProvince.flag ? `${giftProvince.flag} ` : ''}{giftProvince.name}{giftFx.provinceBonus ? ' · Vùng dẫn đầu ×1,5!' : ''}</div>}
            </div>
          </div>
        )}

        {/* ── Bùn dính ống kính (quà to) ──
             Quà to thì camera quay cận + bùn bắn dính lên ống kính cho thật:
             vệt bùn to ở góc + giọt bùn nhỏ văng quanh, hơi mờ (bùn dính
             sát ống kính nên nhòe), mờ dần trong ~4 giây rồi hết. */}
        {mudLens && (
          <div className="pml-mudlens" style={{ opacity: mudOpacity }}>
            <div className="pml-mudlens-vignette" />
            <span className="pml-mudblob pml-mud-1" />
            <span className="pml-mudblob pml-mud-2" />
            <span className="pml-mudblob pml-mud-3" />
            <span className="pml-mudblob pml-mud-4" />
            <span className="pml-mudblob pml-mud-5" />
            <span className="pml-muddrop pml-mud-d1" />
            <span className="pml-muddrop pml-mud-d2" />
            <span className="pml-muddrop pml-mud-d3" />
            <span className="pml-muddrop pml-mud-d4" />
            <span className="pml-muddrop pml-mud-d5" />
            <span className="pml-muddrop pml-mud-d6" />
            <span className="pml-muddrop pml-mud-d7" />
            <span className="pml-muddrop pml-mud-d8" />
            <span className="pml-muddrop pml-mud-d9" />
            <span className="pml-muddrop pml-mud-d10" />
          </div>
        )}

        {/* ── BOOYAH! (Free Fire): thắng màn/trận thì hiện to giữa màn hình ──
             Hiện 3 giây đầu của màn nghỉ (React gỡ khi hết 3s, không dùng
             animation mờ dần ở container để tránh kẹt opacity trên máy yếu). */}
        {((phase === 'roundEnd' && s?.roundWinner && (s.nextRoundIn || 0) > 5) || (phase === 'matchEnd' && s?.matchWinner && (s.matchEndIn || 0) > 12)) && (
          <div className="pml-booyah">
            <div className="pml-booyah-word">BOOYAH!</div>
            <div className="pml-booyah-sub">
              {phase === 'matchEnd'
                ? <><Trophy size={18} /> {teamLabel(s.matchWinner)} VÔ ĐỊCH!</>
                : <><TeamDot team={s.roundWinner} /> {teamLabel(s.roundWinner)} thắng màn {s.round}!</>}
            </div>
          </div>
        )}

        {/* ── BXH nhỏ ở góc trái dưới: ai tặng quà / thả tim nhiều nhất ──
             Lưu lại qua các màn/trận + tải lại trang (chỉ xóa khi bấm Xóa BXH ở Admin). */}
        {/* ── Góc trái dưới: BXH (thu gọn mặc định, bấm để mở) + bảng giá quà ── */}
        <div className="pml-bl-stack">
          {hasBxh && (
            <div className="pml-bxh">
              <button className="pml-bxh-title" type="button" onClick={() => setBxhOpen((v) => !v)}>
                <Trophy size={15} /> BXH {bxhOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {bxhOpen ? (
                <>
                  {(bxh.gifters?.length || 0) > 0 && (
                    <div className="pml-bxh-sec">
                      <div className="pml-bxh-head"><Gift size={13} /> Tặng quà nhiều nhất</div>
                      {bxh.gifters.map((g, i) => (
                        <div className="pml-bxh-row" key={`g${i}`}>
                          <span className={`pml-bxh-rank r${i + 1}`}>{i + 1}</span>
                          <span className="pml-bxh-name">{g.nickname}</span>
                          <span className="pml-bxh-val"><Zap size={12} /> {Math.round(g.power)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(bxh.likers?.length || 0) > 0 && (
                    <div className="pml-bxh-sec">
                      <div className="pml-bxh-head"><Heart size={13} fill="currentColor" /> Thả tim nhiều nhất</div>
                      {bxh.likers.map((g, i) => (
                        <div className="pml-bxh-row" key={`l${i}`}>
                          <span className={`pml-bxh-rank r${i + 1}`}>{i + 1}</span>
                          <span className="pml-bxh-name">{g.nickname}</span>
                          <span className="pml-bxh-val"><Heart size={12} fill="currentColor" /> {g.likes}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {provinces.length > 0 && (
                    <div className="pml-bxh-sec">
                      <div className="pml-bxh-head"><MapPin size={13} /> Tỉnh / Quốc gia dẫn đầu</div>
                      {provinces.map((c, i) => {
                        const rank = provinceRank(c.power)
                        return (
                          <div className="pml-bxh-row" key={`c${i}`}>
                            <span className={`pml-bxh-rank r${i + 1}`}>{i + 1}</span>
                            <span className="pml-bxh-name">{c.flag ? `${c.flag} ` : ''}{c.short || c.name}</span>
                            <span className="pml-bxh-rankbadge" style={{ background: rank.color }}>{rank.name}</span>
                            <span className="pml-bxh-val">{Math.round(c.power)}</span>
                          </div>
                        )
                      })}
                      <div className="pml-bxh-leader">{provinces[0].flag ? `${provinces[0].flag} ` : '📍 '}{provinces[0].name} dẫn đầu — quà của {provinces[0].name} mạnh hơn ×1,5!</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="pml-bxh-mini">
                  {provinces.length > 0 && (
                    <div className="pml-bxh-minirow"><MapPin size={12} /> {provinces[0].flag ? `${provinces[0].flag} ` : ''}{provinces[0].short || provinces[0].name} dẫn đầu · {Math.round(provinces[0].power)} lực</div>
                  )}
                  {(bxh.gifters?.length || 0) > 0 && (
                    <div className="pml-bxh-minirow"><Gift size={12} /> {bxh.gifters[0].nickname} · {Math.round(bxh.gifters[0].power)} lực</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bảng giá quà góc phải dưới (chỗ này đang trống): kiểu ô quà
             của TikTok — chỉ icon thật + lực kéo, ít chữ cho đỡ rối. Tên
             + giá xu đã xác nhận: Hoa hồng 1, Quả đào 5, Cỏ bốn lá 10,
             Nước hoa 20, Hạc giấy 99. */}
        <div className="pml-gift-legend">
          <span className="pml-gl-item"><GiftIcon gift="hoa hồng" size={22} /><b>+1</b></span>
          <span className="pml-gl-item"><GiftIcon gift="quả đào" size={22} /><b>+5</b></span>
          <span className="pml-gl-item"><GiftIcon gift="cỏ bốn lá" size={22} /><b>+10</b></span>
          <span className="pml-gl-item"><GiftIcon gift="nước hoa" size={22} /><b>+25</b></span>
          <span className="pml-gl-item"><GiftIcon gift="hạc giấy" size={22} /><b>+100</b></span>
        </div>

        {/* ── Tạm dừng: dải nhỏ ở dưới, không che sân ── */}
        {s?.paused && (
          <div className="pml-result-banner"><Pause size={15} /> Tạm dừng — bình luận TIẾP để chơi tiếp</div>
        )}

        {/* ── Chờ chọn đội: thẻ nhỏ ở dưới, chạm đâu cũng bắt đầu ── */}
        {phase === 'waiting' && !s?.paused && (
          <>
            <div className="pml-wait-tap" onClick={game.start} />
            <div className="pml-wait-card" onClick={game.start}>
              <div className="pml-wait-line"><MessageCircle size={14} /> <b>A</b> = đội bên trái <TeamDot team="A" /> · <b>B</b> = đội bên phải <TeamDot team="B" /> · <Gift size={14} /> Quà để kéo · <Heart size={14} fill="currentColor" /> 100 tim = +10s kéo</div>
              <div className="pml-wait-line"><MapPin size={14} /> Bình luận tên tỉnh của bạn (Hà Nội, Sài Gòn, Đà Nẵng...) để vào đội tỉnh đó — 2 tỉnh có nhiều người bình luận nhất sẽ kéo nhau!</div>
              <div className="pml-wait-go"><Hand size={16} /> Chạm màn hình để bắt đầu kéo co!</div>
              {s?.pendingJoins > 0 && <div className="pml-wait-sub"><Hourglass size={13} /> {s.pendingJoins} bạn đang chờ vào đội</div>}
            </div>
          </>
        )}

        {/* ── Thắng màn / hòa: dải nhỏ ở dưới, sân 3D vẫn thấy rõ ── */}
        {phase === 'roundEnd' && s?.roundWinner && (
          <div className="pml-result-banner">
            <TeamDot team={s.roundWinner} /> {teamLabel(s.roundWinner)} thắng màn {s.round}! · <TeamDot team="A" /> {teamA?.roundWins || 0} — {teamB?.roundWins || 0} <TeamDot team="B" /> · Màn {s.round + 1} sau {Math.max(0, Math.ceil(s.nextRoundIn || 0))}s…
          </div>
        )}
        {phase === 'roundEnd' && !s?.roundWinner && (
          <div className="pml-result-banner">
            <Handshake size={15} /> Màn {s?.round} hòa! · Màn {s.round + 1} sau {Math.max(0, Math.ceil(s.nextRoundIn || 0))}s…
          </div>
        )}

        {/* ── Vô địch trận: dải nhỏ ở dưới ── */}
        {phase === 'matchEnd' && s?.matchWinner && (
          <div className="pml-result-banner champion">
            <Trophy size={15} /> {teamLabel(s.matchWinner).toUpperCase()} VÔ ĐỊCH! · <TeamDot team="A" /> {teamA?.roundWins || 0} — {teamB?.roundWins || 0} <TeamDot team="B" /> · <Gift size={14} /> {s?.stats?.gifts || 0} quà{(s?.streak?.[s.matchWinner] || 0) > 1 ? <> · <Flame size={14} /> Thắng {s.streak[s.matchWinner]} trận liên tiếp!</> : ''} · Trận mới sau {Math.max(0, Math.ceil(s.matchEndIn || 0))}s…
          </div>
        )}

        {/* ── Hướng dẫn ── */}
        {guideOpen && (
          <div className="pml-guide">
            <button className="pml-guide-x" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn"><X size={18} /></button>
            <h3><BookOpen size={17} /> CÁCH CHƠI</h3>
            <p><MessageCircle size={14} /> Bình luận <b>tên tỉnh của bạn</b> (Hà Nội, Sài Gòn, Đà Nẵng...) — tự vào đội tỉnh đó luôn! <b>2 tỉnh có nhiều người bình luận nhất sẽ thành 2 đội kéo nhau</b> ở mỗi màn (màn sau chọn lại 2 tỉnh đông nhất). Mỗi người vào đội là <b>+1 lực kéo liên tục</b> — tỉnh đông người kéo mạnh hơn! (Bình luận <b>A</b>/<b>B</b> để vào đội bên trái/phải, hoặc tên người: Anh Hùng/Miyo/Mia = trái, Lan/Hương/Bình = phải.)</p>
            <p><Gift size={14} /> Tặng quà — quà là cú bùng sức mạnh: hoa hồng 1 xu = 1 lực · hạc giấy 99 xu = <b>100 lực, bằng 100 người!</b> Quà to có thể kéo ngang cả đội đông. Quà to (≥25 lực) thì có <b>thùng tiếp tế thả dù</b> rơi xuống!</p>
            <p><MapPin size={14} /> Tỉnh thành — quà tặng được tính cho tỉnh của người tặng, tỉnh dẫn đầu BXH quà được thưởng <b>×1,5 lực kéo</b>. Tỉnh còn có <b>hạng Free Fire</b> theo tổng lực quà: Đồng → Bạc → Vàng → Bạch Kim → Kim Cương → Huyền Thoại → Đại Kiện Tướng — tặng quà để đưa tỉnh mình lên hạng cao!</p>
            <p><Heart size={14} fill="currentColor" /> Thả tim — <b>1 người thả đủ 100 tim thì màn kéo dài thêm 10 giây</b> (tối đa +60 giây). Tim không kéo dây, chỉ thêm giờ!</p>
            <p><Zap size={14} /> Đội đang thua quá nửa đường được nhân đôi lực kéo (cơ hội cuối). <b>10 giây cuối: quà tặng ×2!</b></p>
            <p><Trophy size={14} /> Thắng 2 màn trước thì vô địch trận (best of 3 — tối đa 3 màn, 2–1 là vô địch). Đội thắng màn được ngôi sao may mắn ở màn sau!</p>
          </div>
        )}

        {/* ── Thanh dưới ── */}
        <div className="pml-bottombar">
          <span><Cable size={14} /> Màn {s?.round || 1}</span>
          <span><Heart size={14} fill="currentColor" /> {s?.likes || 0}</span>
          {(s?.queueLength || 0) > 0 && <span><Gift size={14} /> Đang chờ: {s.queueLength}</span>}
          <span>{connected ? <><span className="pml-dot on sm" /> Đã nối live</> : <><span className="pml-dot sm" /> Chưa nối live</>}</span>
        </div>
      </div>
    </div>
  )
}
