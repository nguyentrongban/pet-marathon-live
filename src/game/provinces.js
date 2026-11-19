// ─── Tỉnh thành Việt Nam · provinces.js ────────────────────────────────────
// Tinh thần quê hương: quà tặng được tính theo tỉnh/thành của người tặng,
// tỉnh dẫn đầu được thưởng thêm lực kéo (×1,5) để khán giả tặng quà đưa
// tỉnh mình lên số 1 rồi giữ vị trí đó.
// TikTok KHÔNG gửi kèm tỉnh của người tặng trong event, nên game lấy tỉnh
// từ 2 chỗ:
//  · tên tỉnh/thành trong bình luận / tên người tặng ("Hà Nội", "Sài Gòn"...)
//  · tên tỉnh người đó đã bình luận trước đó (nhớ theo userId trong phiên)
// Danh sách 34 tỉnh/thành sau sáp nhập 2025, kèm tên cũ + tên thành phố
// quen thuộc làm alias (ai bình luận "Bình Dương" thì tính cho TP.HCM,
// "Nha Trang" tính cho Khánh Hòa...) để ai cũng tìm được quê mình.

const P = (code, name, short, aliases) => ({
  code, name, short,
  match: aliases.map((a) => a.split(' ')),
})

export const PROVINCES = [
  P('hanoi', 'Hà Nội', 'HÀ NỘI', ['HA NOI', 'HN']),
  P('hcm', 'TP. Hồ Chí Minh', 'TP.HCM', ['HO CHI MINH', 'SAI GON', 'TPHCM', 'HCM', 'SG', 'THANH PHO HO CHI MINH', 'BINH DUONG', 'BA RIA', 'VUNG TAU', 'BA RIA VUNG TAU']),
  P('haiphong', 'Hải Phòng', 'HẢI PHÒNG', ['HAI PHONG', 'HAI DUONG', 'HP']),
  P('danang', 'Đà Nẵng', 'ĐÀ NẴNG', ['DA NANG', 'QUANG NAM', 'HOI AN']),
  P('cantho', 'Cần Thơ', 'CẦN THƠ', ['CAN THO', 'SOC TRANG', 'HAU GIANG']),
  P('hue', 'Huế', 'HUẾ', ['HUE', 'THUA THIEN HUE']),
  P('laichau', 'Lai Châu', 'LAI CHÂU', ['LAI CHAU']),
  P('dienbien', 'Điện Biên', 'ĐIỆN BIÊN', ['DIEN BIEN']),
  P('sonla', 'Sơn La', 'SƠN LA', ['SON LA']),
  P('langson', 'Lạng Sơn', 'LẠNG SƠN', ['LANG SON']),
  P('quangninh', 'Quảng Ninh', 'QUẢNG NINH', ['QUANG NINH', 'HA LONG']),
  P('thanhhoa', 'Thanh Hóa', 'THANH HÓA', ['THANH HOA']),
  P('nghean', 'Nghệ An', 'NGHỆ AN', ['NGHE AN']),
  P('hatinh', 'Hà Tĩnh', 'HÀ TĨNH', ['HA TINH']),
  P('quangtri', 'Quảng Trị', 'QUẢNG TRỊ', ['QUANG TRI', 'QUANG BINH', 'DONG HOI']),
  P('quangngai', 'Quảng Ngãi', 'QUẢNG NGÃI', ['QUANG NGAI', 'KON TUM']),
  P('gialai', 'Gia Lai', 'GIA LAI', ['GIA LAI', 'BINH DINH', 'QUY NHON']),
  P('daklak', 'Đắk Lắk', 'ĐẮK LẮK', ['DAK LAK', 'BUON MA THUOT']),
  P('khanhhoa', 'Khánh Hòa', 'KHÁNH HÒA', ['KHANH HOA', 'NINH THUAN', 'NHA TRANG', 'PHAN RANG']),
  P('lamdong', 'Lâm Đồng', 'LÂM ĐỒNG', ['LAM DONG', 'DAK NONG', 'BINH THUAN', 'DA LAT', 'PHAN THIET']),
  P('dongnai', 'Đồng Nai', 'ĐỒNG NAI', ['DONG NAI', 'BINH PHUOC']),
  P('tayninh', 'Tây Ninh', 'TÂY NINH', ['TAY NINH', 'LONG AN']),
  P('vinhlong', 'Vĩnh Long', 'VĨNH LONG', ['VINH LONG', 'BEN TRE', 'TRA VINH']),
  P('dongthap', 'Đồng Tháp', 'ĐỒNG THÁP', ['DONG THAP', 'TIEN GIANG', 'MY THO']),
  P('camau', 'Cà Mau', 'CÀ MAU', ['CA MAU', 'BAC LIEU']),
  P('angiang', 'An Giang', 'AN GIANG', ['AN GIANG', 'KIEN GIANG', 'PHU QUOC', 'RACH GIA']),
  P('laocai', 'Lào Cai', 'LÀO CAI', ['LAO CAI', 'YEN BAI', 'SA PA']),
  P('thainguyen', 'Thái Nguyên', 'THÁI NGUYÊN', ['THAI NGUYEN', 'BAC KAN']),
  P('phutho', 'Phú Thọ', 'PHÚ THỌ', ['PHU THO', 'HOA BINH', 'VINH PHUC']),
  P('bacninh', 'Bắc Ninh', 'BẮC NINH', ['BAC NINH', 'BAC GIANG']),
  P('hungyen', 'Hưng Yên', 'HƯNG YÊN', ['HUNG YEN', 'THAI BINH']),
  P('ninhbinh', 'Ninh Bình', 'NINH BÌNH', ['NINH BINH', 'HA NAM', 'NAM DINH']),
  P('tuyenquang', 'Tuyên Quang', 'TUYÊN QUANG', ['TUYEN QUANG', 'HA GIANG']),
  P('caobang', 'Cao Bằng', 'CAO BẰNG', ['CAO BANG']),
]

const BY_CODE = Object.fromEntries(PROVINCES.map((p) => [p.code, p]))

export function provinceInfo(code) {
  if (!code) return null
  const p = BY_CODE[String(code).toLowerCase()]
  return p ? { code: p.code, name: p.name, short: p.short } : null
}

// Tách bình luận thành các từ (bỏ dấu, viết hoa) để so tên tỉnh.
function tokensOf(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
}
// Tên tỉnh có khớp 1 cụm từ liên tiếp trong bình luận không ("HA NOI CO
// LEN" chứa "HA NOI" → Hà Nội). So theo cụm từ nên "Vĩnh Long" không
// nhận nhầm thành Nghệ An (chỉ có chữ "Vinh" đứng một mình).
function containsSeq(tokens, seq) {
  if (!seq.length || seq.length > tokens.length) return false
  for (let i = 0; i <= tokens.length - seq.length; i++) {
    let ok = true
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) { ok = false; break }
    if (ok) return true
  }
  return false
}
function provinceInText(text) {
  const tokens = tokensOf(text)
  if (!tokens.length) return null
  for (const p of PROVINCES) {
    for (const seq of p.match) if (containsSeq(tokens, seq)) return p.code
  }
  return null
}

// Tỉnh của 1 người: tên tỉnh trong bình luận trước, rồi tên trong tên người.
export function detectProvince(text, nickname) {
  return provinceInText(text) || provinceInText(nickname) || null
}
