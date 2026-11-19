# 🪢 KÉO CO LIVE

Game kéo co 2 đội tương tác trên TikTok LIVE — **đội nào kéo dây qua vạch thì thắng màn**.
Khán giả bình luận **A** (Đội Đỏ 🔴) hoặc **B** (Đội Xanh 🔵) để chọn đội, tặng quà để kéo
dây về phía đội mình (hoa hồng 1 xu kéo nhẹ, hạc giấy 99 xu kéo cực mạnh), thả tim đủ 100
thì tiếp sức cho đội đang thua. Đội thua quá nửa đường được nhân đôi lực kéo (cơ hội cuối)
nên màn nào cũng có thể lật kèo. Thắng 3 màn trước thì vô địch trận.

## Stack thực tế đã dùng

| Phần | Công nghệ |
|---|---|
| Game (web) | React 19 + Vite + **Three.js** (sân kéo co 3D, hố bùn, thú khối vuông Kenney Cube Pets, không ảnh ngoài) |
| Âm thanh | WebAudio tổng hợp (còi trượt, boing, leng keng…) — không file nhạc |
| Backend API | Node tối giản (`server/`, không thư viện ngoài) — `GET /health`, `POST /match-result`, `GET /leaderboard` |
| TikTok LIVE | Connector Node.js hiện tại (repo riêng, theo mẫu `tick-tock-connector`), game nối qua WebSocket `wss://<app>.onrender.com/ws?key=` — **không dựng lại connector** |
| Realtime | WebSocket + BroadcastChannel (màn hiển thị ↔ Admin, 2 tab cùng trình duyệt) |
| Database | Chưa dùng — kết quả trận chỉ lưu tạm trong bộ nhớ API khi chưa nối Supabase |
| Redis | Không cần |
| Ảnh | Không cần — vẽ bằng code; Cloudinary chỉ khi thật sự cần (chưa dùng) |
| Deploy | **Tất cả trên Render** (không dùng Vercel): Static Site cho game + Web Service cho API, khai báo đủ trong `render.yaml` |

## Chạy local

```bash
npm install
npm run dev        # game ở http://localhost:5174  (màn hiển thị /)
                   # Admin ở http://localhost:5174/admin (mở tab riêng)
npm test           # test logic kéo co: node tests/tug.test.js
npm run build      # build ra dist/
```

API local (tùy chọn):

```bash
cd server && node server.js   # http://localhost:3000/health
```

Biến môi trường (đều **tùy chọn** — không có thì game vẫn chạy đủ tính năng ở chế độ local):

```bash
cp .env.example .env
# VITE_API_URL=https://pet-marathon-live-api.onrender.com
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=...
```

## Deploy lên Render (Blueprint)

1. Push repo này lên GitHub.
2. Render Dashboard → **New → Blueprint** → chọn repo.
3. Render tạo 2 dịch vụ từ `render.yaml`:
   - **Static Site** `pet-marathon-live` — build `npm install && npm run build`, publish `dist`,
     rewrite SPA `/* → /index.html` để `/admin` chạy được.
   - **Web Service** `pet-marathon-live-api` — `node server.js` (thư mục `server/`).
4. Điền env trên Render (mục **Environment**, từng dịch vụ):
   - Static Site: `VITE_API_URL` (địa chỉ API, vd `https://pet-marathon-live-api.onrender.com`),
     `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nếu muốn bảng xếp hạng).
   - API: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (nếu muốn lưu kết quả lên Supabase).
   - **Không có env thì cả hai vẫn chạy** — API lưu tạm trong bộ nhớ, game chạy local.
5. Chạy migration Supabase: dán `supabase/migrations/001_pet_marathon.sql` vào SQL Editor rồi Run.

## Cách chơi (màn hiển thị)

- **Vào đua:** bình luận `THAM GIA` / `JOIN` (tối đa 6 thú; thiếu người thì thú máy lấp đầy).
- **Tặng quà:** quà trong bảng map sẽ kích hoạt chiêu. Kèm `@tên` hoặc số làn `1-6` để chọn
  mục tiêu (vd: `CHUỐI @Lan`, `CHUỐI 2`) — không kèm thì chọn đối thủ ngẫu nhiên.
- **Thả tim:** đủ 100 tim → 1 thú ngẫu nhiên tăng tốc.
- **Streamer:** bình luận `DỪNG` / `TIẾP` / `+30S` (chỉ tài khoản streamer đã nhập trong Admin → Cài đặt).
- **Trình chiếu:** mở `/?present=1` để ẩn nút hướng dẫn.

## 10 chiêu

| Chiêu | Tác dụng |
|---|---|
| 🍌 Vỏ Chuối | Trượt ngã sấp mặt, chậm 60% trong 3s |
| 🍉 Dưa Hấu Khổng Lồ | Hất mục tiêu lùi ~15m |
| 🕸️ Lưới Đánh Cá | Bẫy đứng yên 2,5s |
| 🥊 Găng Tay Boxing | Đấm bay lùi ~10m |
| 🧊 Bẫy Băng | Trượt lung tung, chậm 40% trong 3s |
| 💫 Bom Chóng Mặt | Chạy vòng tròn, chậm 50% trong 3s |
| 🚀 Tên Lửa Mini | Thú của người gửi +80% tốc độ trong 3s |
| 🛡️ Khiên Bảo Vệ | Chặn 1 đòn, tồn tại 10s |
| 🧪 Thuốc Hồi Phục | Xóa hết hiệu ứng xấu ngay lập tức |
| 🧲 Nam Châm Vàng | Hút xu thưởng gần đó trong 5s |

Xu thưởng trên đường đua: chạy qua được +tốc độ bùng 1 giây.

## Cân bằng (logic thật, không phải trang trí)

- Miễn nhiễm **3 giây** sau mỗi lần bị đánh; cùng 1 thú không bị đánh 2 lần trong **5 giây**.
- Mỗi thú chỉ bị đánh tối đa **3 lần / cuộc đua**; chiêu toàn cuộc đua tối đa **1 chiêu / 1,5 giây** (quà đến dồn thì xếp hàng).
- Tốc độ không bao giờ tụt dưới **25%** tốc độ gốc; lưới chỉ đứng yên tối đa **2,5 giây**.
- Thắng thua vẫn do chạy nhanh hay chậm quyết định — xem ghi chú “Cân bằng” trong Admin.

## Sự kiện hỗn loạn (ngẫu nhiên mỗi 40–60 giây)

🍌 Mưa Chuối · 🍉 Bão Dưa Hấu · 🚀 Tên Lửa Đồng Loạt · 🧊 Đường Trơn · 🪙 Cơn Mưa Vàng —
kèm banner lớn + âm thanh.

## Admin — 5 tab (`/admin`)

1. **🏁 Đua** — bắt đầu / tạm dừng / đua lại, thêm-bớt thú máy, kết quả, bảng xếp hạng.
2. **🎁 Quà & Chiêu** — bảng map quà → chiêu (sửa tên quà, thêm/xóa), thời gian từng chiêu,
   miễn nhiễm / cooldown / giới hạn bị đánh / giới hạn toàn cục.
3. **🎲 Kiểm thử** — thử bất kỳ chiêu nào với bộ chọn mục tiêu, kích hoạt sự kiện hỗn loạn,
   giả bình luận THAM GIA / giả tim. (Chỉ để thử — không phải quà thật.)
4. **🔗 Kết nối** — nhập địa chỉ WebSocket + mã truy cập (chỉ lưu trên trình duyệt),
   trạng thái nối, nhật ký event, nhật ký chẩn đoán thu gọn.
5. **⚙️ Cài đặt** — độ dài đường đua, khoảng thời gian sự kiện, mốc tim, ID TikTok streamer,
   bật/tắt âm thanh.

## Gift Engine (chống gian lận / chống trùng)

- Bảng map quà cấu hình được trong Admin (mặc định: Hoa hồng → Chuối, Kem → Băng…);
  quà lạ không có trong bảng bị bỏ qua, không tự đoán.
- Chống trùng lặp theo event id (giữ tối đa 1000 id gần nhất).
- Hàng đợi: quà đến dồn dập được xử lý lần lượt theo giới hạn toàn cục.
- Không có nối live thì **không có event quà nào** — chỉ Admin bấm thử mới kích hoạt chiêu.
  Game không bao giờ tự bịa event quà.

## Cấu trúc repo

```
pet-marathon-live/
├── render.yaml                  # Blueprint Render: Static Site (game) + Web Service (API)
├── src/
│   ├── App.jsx                  # Màn hiển thị (/) — không có Admin dính vào
│   ├── AdminPage.jsx            # Trang /admin — 5 tab
│   ├── main.jsx  index.css
│   ├── components/RaceScene.jsx # Đường đua 3D Three.js + thú chibi + hiệu ứng chiêu
│   └── game/
│       ├── engine.js            # Logic thuần: đua, 10 chiêu, cân bằng, sự kiện, GiftEngine
│       ├── adapter.js           # Chuẩn hóa event TikTok (nhiều dạng) + lệnh bình luận
│       ├── wsClient.js          # TikTokWS: WebSocket tự nối lại
│       ├── usePetMarathon.js    # Hook chủ: vòng lặp, WS, đồng bộ Admin, báo cáo kết quả
│       ├── sound.js             # Âm thanh tổng hợp WebAudio
│       ├── sync.js              # BroadcastChannel màn hiển thị ↔ Admin
│       └── supabase.js          # Đọc bảng xếp hạng Supabase qua env (tùy chọn)
├── server/                      # API Node tối giản cho Render Web Service
│   ├── server.js  package.json
├── supabase/migrations/001_pet_marathon.sql
└── tests/battle.test.js         # Test logic (node, không framework)
```

## Test

```bash
npm test   # 19 test: chuối + miễn nhiễm, khiên, thuốc, cooldown + giới hạn 3 lần,
           # lưới 2,5s, giới hạn toàn cục + xếp hàng, chống trùng, map quà,
           # chọn mục tiêu, buff về đúng thú, sự kiện hỗn loạn, sàn tốc độ 25%,
           # đua về đích + bục top 3, tham gia tối đa 6, hất lùi đúng mét
```
