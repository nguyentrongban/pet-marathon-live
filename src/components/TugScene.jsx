// ─── KÉO CO LIVE · TugScene.jsx ────────────────────────────────────────────
// Sân kéo co 3D bằng Three.js: 6 NGƯỜI THẬT kéo 1 sợi dây qua hố bùn.
// Nhân vật: Mixamo (Soldier / Kachujin / Michelle) + Quaternius Casual_Female,
// đều miễn phí, không cần ghi nguồn. Animation kéo được tạo dáng bằng code
// trên xương (ngửa người, 2 tay nắm dây, chân trụ) vì clip "Pulling A Rope"
// của Mixamo cần đăng nhập mới tải được.
// Sân 3D toàn bộ (KHÔNG dùng ảnh thật): trời Sky shader + mây 3D, đất
// địa hình lồi lõm + màu lá theo đỉnh, cây rừng + bụi + cỏ 3D (3dassets.dev
// CC0), đồi xa + hàng rào gỗ 3D, gió đung đưa cỏ/cây/mây, bóng đổ.
// Đọc trực tiếp state engine qua liveRef mỗi khung hình nên chuyển động mượt
// mà không cần React render lại.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { clone as cloneModel } from 'three/addons/utils/SkeletonUtils.js'
import { TEAMS, visibleMembers } from '../game/engine'
import { regionInfo } from '../game/regions'

// 6 người kéo — mỗi đội 3 người. Slot (team + vị trí) mới là khóa, vì 2 slot
// có thể dùng chung 1 file model (Hương là bản đổi màu áo của Lan, Bình là
// bản đổi màu giáp của Anh Hùng).
const HUMAN_SLOTS = {
  A: [
    { id: 'soldier', file: 'soldier', url: '/characters/Soldier.glb' },
    { id: 'player', file: 'player', url: '/characters/player.glb' },
    { id: 'michelle', file: 'michelle', url: '/characters/Michelle.glb' },
  ],
  B: [
    { id: 'casual', file: 'casual', url: '/characters/Casual_Female.glb' },
    { id: 'casual2', file: 'casual', url: '/characters/Casual_Female.glb', variant: 'casual2' },
    { id: 'soldierB', file: 'soldier', url: '/characters/Soldier.glb', variant: 'soldierB' },
  ],
}
// Vị trí 3 người mỗi đội dọc theo dây (dây chạy theo trục X, hố bùn ở giữa).
// Cả đội đứng THÀNH HÀNG dọc dây (z ≈ 0, đúng chỗ dây chạy qua) như kéo
// co thật — mỗi người nắm dây ngay trước mặt mình, không đứng lệch dây.
// Người mẫu đứng XA hố bùn (mức chính giữa) để màn kéo lâu, gay cấn:
// 4,0 / 5,3 / 6,6 thay vì 2,0 / 3,3 / 4,6 cũ (người đầu đứng NGAY TRONG
// hố bùn bán kính 3,4 nên nhìn như đã thua từ đầu). Khán giả vào đội chen
// vào các khe 4,65 / 5,95 / 7,05. Dây dài 17m (±8,5) vẫn đủ chỗ.
const TEAM_SPOTS = {
  A: [{ x: -4.0, z: 0.12 }, { x: -5.3, z: -0.12 }, { x: -6.6, z: 0.06 }],
  B: [{ x: 4.0, z: -0.12 }, { x: 5.3, z: 0.12 }, { x: 6.6, z: -0.06 }],
}
// Chỗ đứng của khán giả vào đội (mới vào gần nhất, tối đa 3 người/đội hiện
// ra — còn lại chỉ tính lực kéo, xem số người ở bảng tỉ số).
const VIEWER_SPOTS = {
  A: [{ x: -4.65, z: -0.15 }, { x: -5.95, z: 0.15 }, { x: -7.05, z: -0.1 }],
  B: [{ x: 4.65, z: 0.15 }, { x: 5.95, z: -0.15 }, { x: 7.05, z: 0.1 }],
}
const VIEWER_CAP = 3
const ROPE_Y = 1.0
const ROPE_RANGE = 3.8 // dây thắng ở |rope| = 0,9 → cờ vượt mép hố bùn (3,2)
const HUMAN_HEIGHT = 1.75 // mọi nhân vật được co về cùng chiều cao này
// Chiều cao thật của mỗi model (đo bằng Box3 trên file gốc — Box3 trên bản
// clone của SkeletonUtils không đáng tin vì bounding box của skinned mesh
// phụ thuộc xương, lúc clone xương chưa cập nhật nên đo ra ~0).
const BASE_HEIGHT = { soldier: 1.83, player: 2.08, michelle: 1.66, casual: 1.8 }
// Hướng mặt gốc của mỗi file: Soldier quay lưng về +Z, 3 file còn lại quay
// mặt về +Z (đo bằng ảnh chụp thử). Dấu này để xoay cho đúng hướng dây.
const FACE_SIGN = { soldier: -1, player: 1, michelle: 1, casual: 1 }
// Model Mixamo quay mặt +Z; đội Đỏ nhìn về +X (xoay +90°), đội Xanh về -X.
const MODEL_FACE_Y = { A: Math.PI / 2, B: -Math.PI / 2 }

// Tên xương theo 2 rig (Mixamo dùng tiền tố mixamorig:, Quaternius dùng tên trần).
const BONE_MAP = {
  mixamo: {
    hips: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2',
    neck: 'Neck', head: 'Head',
    lArm: 'LeftArm', lFore: 'LeftForeArm', rArm: 'RightArm', rFore: 'RightForeArm',
    lUpLeg: 'LeftUpLeg', lLeg: 'LeftLeg', rUpLeg: 'RightUpLeg', rLeg: 'RightLeg',
  },
  casual: {
    hips: 'Hips', spine: 'Abdomen', spine1: 'Torso',
    neck: 'Neck', head: 'Head',
    lArm: 'UpperArmL', lFore: 'LowerArmL', rArm: 'UpperArmR', rFore: 'LowerArmR',
    lUpLeg: 'UpperLegL', lLeg: 'LowerLegL', rUpLeg: 'UpperLegR', rLeg: 'LowerLegR',
  },
}

// Dáng kéo dây (radian, trong không gian local của từng xương): ngửa người ra
// sau, 2 tay hạ xuống nắm dây ở ngang hông (dây cao 1,0m), 1 chân trước
// 1 chân sau trụ vững. Tay phải CHẠM dây: cánh tay chỉ xoay vừa đủ để bàn
// tay tới đúng độ cao dây (rotation.x ≈ -0,65, tay chúc xuống trước ~50°),
// xoay quá (-1,25 như trước) thì tay giơ ngang ngực, lơ lửng trên dây.
// Hai tay nắm so le dọc dây (tay phải xa hơn tay trái một chút) và khép vào
// giữa (z) để cả 2 tay đều ôm lấy dây, không dang ra 2 bên.
// Chú ý dấu: rotation.x ÂM mới đưa tay/chân về phía trước (+Z, hướng dây);
// dương là ngửa ra sau/lên trên. Đầu gối chỉ gập 1 chiều (cẳng chân ngửa ra
// sau so với đùi): chân trước gập gối (cẳng chân +0,45 để bàn chân chạm đất),
// chân sau duỗi thẳng (cẳng chân +0,10) — dấu âm là gối gập ngược, sai.
// CÁCH ÁP DỤNG — CỘNG GÓC (delta), KHÔNG lerp về góc tuyệt đối: xương
// Mixamo có tư thế gốc xoay sẵn ~90-180° (file gốc nằm ngang, nút
// 'Character' xoay -90° để dựng đứng) nên góc Euler-x lúc nghỉ của hông là
// -87°, của đùi là ~170°; lerp Euler-x về số nhỏ (-0,16 / 0,40) sẽ lộn cả
// người nhào xuống (đã dính 2026-11-19). Cộng thêm đúng góc dáng kéo vào
// góc hiện tại của clip thì chỉ xoay thêm chừng đó, bất kể tư thế gốc.
// (Mixer ghi đè góc xương mỗi khung hình nên cộng delta không tích lũy.)
// Cũng vì vậy mà KHÔNG hạ hips.position.y: trục Y local của hông là trục
// ngang trong khung gốc (chiều cao thật nằm ở trục Z, ~106cm), hạ Y chỉ xê
// hông sang ngang 0,8mm, vô nghĩa.
const PULL_POSE = {
  hips: { x: -0.10 },
  spine: { x: -0.08 }, spine1: { x: -0.06 }, spine2: { x: -0.04 },
  // Tay: CHẠM DÂY mới đúng chuẩn — đã đo bằng trang chẩn đoán tay
  // (test-arms.html, xem trước mặt). rotation.x ÂM mới đưa tay về phía
  // trước; phải -1,2 (69°) thì tay mới vươn hẳn ra trước, -0,65 cũ chỉ
  // nghiêng 37° nên tay vẫn chìa sang 2 bên, nhìn như để sau lưng.
  // z = +0,5 (CÙNG dấu 2 tay — xương tay trái/phải Mixamo cùng hướng
  // trục local, đừng đảo dấu) hạ tay xuống ngang dây; cẳng tay gập -0,6
  // để 2 bàn tay chụm lại nắm dây.
  lArm: { x: -1.2, z: 0.5 }, rArm: { x: -1.2, z: 0.5 },
  lFore: { x: -0.6 }, rFore: { x: -0.6 },
  lUpLeg: { x: 0.40 }, rUpLeg: { x: -0.45 },
  lLeg: { x: 0.10 }, rLeg: { x: 0.45 },
  head: { x: -0.12 },
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts })
}

// ── Texture dây thừng gai (vẽ bằng canvas, không cần tải file ngoài) ──
// Dây thừng thật làm từ 3 sợi xoắn lại: trên mặt dây hiện các dải chéo
// (sợi xoắn) xen kẽ sáng/tối + xơ gai lấm tấm. 1 ô texture = 1 bước xoắn
// (~0,6m) quanh hết chu vi dây; lặp lại dọc theo dây. Dùng làm map màu
// và bumpMap (nổi gờ sợi) để dây nhìn giống thừng thật cả lúc quay cận.
function makeRopeTexture() {
  const W = 256, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  // Nền gai: tông nâu vàng nhạt xen kẽ cho sợi đay.
  g.fillStyle = '#c2a06b'
  g.fillRect(0, 0, W, H)
  // 3 sợi xoắn: mỗi sợi là 1 dải chéo chạy từ góc trên-trái xuống dưới-phải,
  // lặp 3 lần quanh chu vi. Vẽ 2 lần (dịch W) để nối liền khi texture lặp.
  const strand = (dx) => {
    for (let i = -1; i <= 3; i++) {
      const x0 = dx + i * (W / 3)
      // Thân sợi: sáng ở giữa, tối dần về 2 mép (tạo cảm giác sợi tròn).
      const grad = g.createLinearGradient(x0, 0, x0 + W / 3, 0)
      grad.addColorStop(0, '#8a6b3d')
      grad.addColorStop(0.25, '#d9bc85')
      grad.addColorStop(0.55, '#c8a869')
      grad.addColorStop(0.85, '#9a7a45')
      grad.addColorStop(1, '#7d5f31')
      g.fillStyle = grad
      g.beginPath()
      g.moveTo(x0, 0)
      g.lineTo(x0 + W / 3, 0)
      g.lineTo(x0 + W / 3 + H * 0.45, H)
      g.lineTo(x0 + H * 0.45, H)
      g.closePath()
      g.fill()
      // Rãnh tối giữa 2 sợi (chỗ sợi xoắn vào nhau).
      g.strokeStyle = 'rgba(70,48,20,0.85)'
      g.lineWidth = 7
      g.beginPath()
      g.moveTo(x0, 0)
      g.lineTo(x0 + H * 0.45, H)
      g.stroke()
      // Gờ sáng trên đỉnh sợi.
      g.strokeStyle = 'rgba(240,220,170,0.55)'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(x0 + W / 6, 0)
      g.lineTo(x0 + W / 6 + H * 0.45, H)
      g.stroke()
    }
  }
  strand(0)
  // Xơ gai: hàng trăm sợi xơ ngắn, mảnh, nghiêng theo chiều xoắn.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const len = 3 + Math.random() * 7
    const a = 0.5 + (Math.random() - 0.5) * 0.35 // nghiêng theo chiều xoắn
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(90,62,28,0.35)' : 'rgba(232,205,150,0.35)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Vệt bùn dính trên người khi ngã xuống hố: 4 đốm bùn gắn vào nhóm nhân
// vật (xoay theo người khi ngã), lúc đầu thu nhỏ bằng 0, chạm bùn thì nở
// dần ra như bùn văng lên dính vào áo/quần/tóc.
const mudSpotGeo = new THREE.SphereGeometry(1, 8, 6)
mudSpotGeo.scale(1, 0.4, 1) // dẹt như vệt bùn bết vào người
const mudSpotMat = new THREE.MeshLambertMaterial({ color: 0x4a2c12 })
function makeMudSpots(group, slotIdx) {
  const spots = []
  const defs = [
    { p: [0.12, 1.15, 0.18], r: 0.17 },
    { p: [-0.15, 0.75, -0.12], r: 0.2 },
    { p: [0.1, 0.45, 0.15], r: 0.15 },
    { p: [-0.05, 1.5, -0.1], r: 0.13 },
  ]
  defs.forEach((d, j) => {
    const s = new THREE.Mesh(mudSpotGeo, mudSpotMat)
    const jx = ((slotIdx * 0.37 + j * 0.53) % 0.12) - 0.06
    s.position.set(d.p[0] + jx, d.p[1], d.p[2] - jx)
    s.rotation.set(Math.random() * 3, Math.random() * 3, 0)
    s.scale.setScalar(0.001)
    s.userData.baseR = d.r
    group.add(s)
    spots.push(s)
  })
  return spots
}

// Người dự phòng nếu file GLB chưa tải kịp / tải lỗi: thân + đầu đơn giản.
function makeFallbackHuman(colorHex) {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex })
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8b88a })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), bodyMat)
  body.position.y = 0.85
  g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat)
  head.position.y = 1.55
  g.add(head)
  return g
}

// ─── Nhân vật khán giả: người xem bình luận A/B là tự hiện ra 1 nhân vật
// trong đội, cầm dây kéo cùng. Hình đơn giản (thân + đầu + 2 tay chìa ra
// trước nắm dây) để vẽ được nhiều người mà không nặng máy; trên đầu có
// bảng tên + ảnh đại diện của chính người đó.
// Màu vòng avatar lấy từ tên (ổn định theo từng người).
function colorFromName(name) {
  const palette = [0xe03131, 0x1971c2, 0x2f9e44, 0xf08c00, 0x6741d9, 0xe8590c, 0x0ca678, 0xd6336c]
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.charCodeAt(0)) % 997
  return palette[h % palette.length]
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
// Bảng tên trên đầu: nền màu đội, chữ trắng. Vẽ lại khi đổi người.
function makeNameSprite(teamColorHex) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(1.0, 0.25, 1)
  sprite.position.y = 1.98
  const draw = (name) => {
    const label = String(name || 'Khán giả').slice(0, 14)
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = `#${teamColorHex.toString(16).padStart(6, '0')}e6`
    roundRect(ctx, 4, 6, 248, 52, 26)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 3
    roundRect(ctx, 4, 6, 248, 52, 26)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = '900 30px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 34)
    texture.needsUpdate = true
  }
  return { sprite, draw }
}
// Ảnh đại diện tròn trên đầu: có URL thì tải ảnh thật, không có / tải lỗi
// thì vẽ vòng tròn màu + chữ cái đầu tên (vẫn nhận ra là ai).
function makeAvatarSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(0.52, 0.52, 1)
  sprite.position.y = 2.42
  const drawFallback = (name) => {
    const color = colorFromName(name)
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    ctx.beginPath()
    ctx.arc(64, 64, 62, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(64, 64, 60, 0, Math.PI * 2)
    ctx.stroke()
    const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?'
    ctx.fillStyle = '#fff'
    ctx.font = '900 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initial, 64, 68)
    texture.needsUpdate = true
  }
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const draw = (name, url) => {
    drawFallback(name)
    if (!url) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Cắt ảnh thành hình tròn (ảnh TikTok là hình vuông).
      ctx.clearRect(0, 0, 128, 128)
      ctx.save()
      ctx.beginPath()
      ctx.arc(64, 64, 62, 0, Math.PI * 2)
      ctx.clip()
      const side = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128)
      ctx.restore()
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(64, 64, 60, 0, Math.PI * 2)
      ctx.stroke()
      texture.needsUpdate = true
    }
    img.onerror = () => { /* giữ vòng tròn chữ cái */ }
    img.src = url
  }
  return { sprite, draw }
}

export default function TugScene({ liveRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || 360
    const height = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    // Sương mù xa: màu xanh nhạt theo chân trời, đẩy xa để đồi + rừng xa
    // mờ dần tự nhiên như ngoài đời (không cắt cụt).
    scene.fog = new THREE.Fog(0xbfd4e6, 55, 160)
    const camera = new THREE.PerspectiveCamera(66, width / height, 0.1, 400)
    camera.position.set(0, 6.2, 23)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7c59, 0.7))
    // Nắng CHÍNH từ phía trước-trái-cao (hướng về camera): chiếu thẳng
    // vào mặt trước của nhân vật (mặt hướng về camera) để nhân vật sáng
    // lên, không bị tối đen vì bóng lưng. Trước đây nắng ở phía sau
    // (z âm) nên mặt trước nhân vật chìm trong bóng — tấn chỉ ra 2026-11-19.
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.9)
    const sunDir = new THREE.Vector3(-0.45, 0.55, 0.65).normalize()
    sun.position.copy(sunDir).multiplyScalar(20)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -18
    sun.shadow.camera.right = 18
    sun.shadow.camera.top = 18
    sun.shadow.camera.bottom = -18
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 45
    sun.shadow.bias = -0.0005
    scene.add(sun)
    // Đèn PHỤ từ phía trước-phải (hướng camera): hắt sáng nhẹ lên mặt
    // nhân vật, làm mềm bóng đổ (không tạo bóng mới) để nhân vật nổi
    // hẳn lên trên nền cỏ. Không ảnh hưởng trời (Sky chỉ dùng nắng chính).
    const fill = new THREE.DirectionalLight(0xfff5e0, 0.55)
    fill.position.set(8, 7, 14)
    scene.add(fill)

    // ── Bầu trời 3D (không dùng ảnh): shader Sky của Three.js — trời xanh
    // chuyển sắc + mặt trời thật, như bầu trời trong game 3D. Mây là khối
    // 3D (cụm cầu trắng) trôi theo gió, xem dưới.
    const sky = new Sky()
    sky.scale.setScalar(300)
    const skyU = sky.material.uniforms
    skyU.turbidity.value = 4
    skyU.rayleigh.value = 2.5
    skyU.mieCoefficient.value = 0.002
    skyU.mieDirectionalG.value = 0.8
    skyU.sunPosition.value.copy(sunDir)
    scene.add(sky)

    // ── Đất 3D (không dùng ảnh): địa hình lồi lõm nhẹ bằng đỉnh lưới +
    // màu lá vẽ theo đỉnh (từng mảng xanh đậm/nhạt như đồng cỏ thật).
    // Khu vực chơi ở giữa được làm phẳng để nhân vật đứng vững, hố bùn
    // không bị nghiêng.
    const terrainNoise = (x, z) => (
      Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07 + 0.4) * 0.9
      + Math.sin(x * 0.22 + z * 0.16) * 0.28
      + Math.sin(x * 0.045 - 0.8) * Math.cos(z * 0.05 + 2.1) * 1.1
    )
    const terrainMask = (x, z) => {
      // 0 ở khu vực chơi (|x|<11, |z|<8) rồi tăng dần ra ngoài.
      const d = Math.max(Math.abs(x) / 11, Math.abs(z) / 8)
      return Math.min(1, Math.max(0, (d - 1) * 0.45))
    }
    const groundGeo = new THREE.PlaneGeometry(220, 150, 88, 60)
    {
      const pos = groundGeo.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const cA = new THREE.Color(0x71b356) // cỏ xanh tươi, dịu (không chói)
      const cB = new THREE.Color(0x93cc78) // cỏ vàng-xanh nhạt (mảng nắng)
      const cC = new THREE.Color(0x5a9c48) // cỏ đậm (mảng râm)
      const tmpC = new THREE.Color()
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const z = pos.getY(i) // mặt phẳng chưa xoay: Y là trục dọc của hình
        const m = terrainMask(x, z)
        pos.setZ(i, terrainNoise(x, z) * m)
        // Màu theo mảng: trộn 3 sắc xanh bằng sóng sin (như cỏ mọc từng đám).
        const n = Math.sin(x * 0.35 + 2.0) * Math.cos(z * 0.28 - 1.0)
          + Math.sin(x * 0.11 - z * 0.13) * 0.7
        if (n > 0.55) tmpC.copy(cB)
        else if (n < -0.55) tmpC.copy(cC)
        else tmpC.copy(cA)
        // Chỗ trũng tối hơn 1 chút, chỗ cao sáng hơn 1 chút.
        tmpC.multiplyScalar(0.92 + 0.16 * Math.min(1, Math.max(-1, terrainNoise(x, z) * 0.4)))
        colors[i * 3] = tmpC.r
        colors[i * 3 + 1] = tmpC.g
        colors[i * 3 + 2] = tmpC.b
      }
      groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      groundGeo.computeVertexNormals()
    }
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0,
    }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -0.05, 0)
    ground.receiveShadow = true
    scene.add(ground)
    // Chiều cao mặt đất tại (x, z) — cây/cỏ/bụi phải đứng đúng mặt đất
    // (địa hình lồi lõm ngoài khu vực chơi), không lơ lửng hay chìm.
    const terrainY = (x, z) => terrainNoise(x, z) * terrainMask(x, z) - 0.05
    // Hố bùn 3D: 2 vòng nâu đậm dần (màu trơn, không ảnh) + vài cục bùn ở mép.
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1, metalness: 0 })
    const mudOuter = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), mudMat)
    mudOuter.rotation.x = -Math.PI / 2
    mudOuter.position.set(0, 0.01, 0)
    mudOuter.receiveShadow = true
    scene.add(mudOuter)
    const mudInner = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x54331a, roughness: 1, metalness: 0 }))
    mudInner.rotation.x = -Math.PI / 2
    mudInner.position.set(0, 0.02, 0)
    mudInner.receiveShadow = true
    scene.add(mudInner)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.35 + Math.random() * 0.25, 8, 6), mat(0x6b4423))
      blob.scale.y = 0.35
      blob.position.set(Math.cos(a) * 3.6, 0.05, Math.sin(a) * 3.6)
      scene.add(blob)
    }
    // Vùng đội: vòng tròn đỏ / xanh dưới chân mỗi đội
    for (const [teamId, color, cx] of [['A', 0xe03131, -4.2], ['B', 0x1971c2, 4.2]]) {
      const zone = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 }))
      zone.rotation.x = -Math.PI / 2
      zone.position.set(cx, 0.015, 0)
      scene.add(zone)
    }
    // Vạch giữa trắng (kẻ ngang hố bùn)
    const midLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 6.4), mat(0xffffff))
    midLine.position.set(0, 0.03, 0)
    scene.add(midLine)
    // Cờ đội: cột + cờ đỏ / xanh hai bên sân
    const banners = []
    for (const [teamId, color, bx] of [['A', 0xe03131, -8.5], ['B', 0x1971c2, 8.5]]) {
      const grp = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 6), mat(0x495057))
      pole.position.y = 1.8
      grp.add(pole)
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.06), mat(color))
      flag.position.set(teamId === 'A' ? 0.8 : -0.8, 3.1, 0)
      grp.add(flag)
      grp.position.set(bx, 0, -5)
      scene.add(grp)
      banners.push({ flag, base: flag.position.x, teamId })
    }

    // ── Bối cảnh 3D: cây rừng + bụi + cỏ (3dassets.dev "Dense Temperate
    // Forest Flora" CC0 — sồi/beech/liễu/thông nhiều tuổi, tán chi tiết
    // hơn bộ stylized cũ). Cây đứng thành CỤM chen nhau ở xa như rìa rừng.
    // Gió: cây đung đưa nhẹ (swayTrees), cỏ đung đưa (grassSway, xem animate).
    const envGroup = new THREE.Group()
    scene.add(envGroup)
    const envLoader = new GLTFLoader()
    const swayTrees = [] // { group, phase, amp } — đung đưa theo gió
    const placeEnv = (url, list, { sway = 0 } = {}) => {
      envLoader.loadAsync(url).then((gltf) => {
        for (const t of list) {
          const c = gltf.scene.clone()
          c.position.set(t.x, t.y ?? terrainY(t.x, t.z), t.z)
          c.rotation.y = t.ry ?? 0
          const s = t.s ?? 0.6
          c.scale.set(t.sx ?? s, t.sy ?? s, t.sz ?? s)
          c.traverse((o) => { if (o.isMesh) o.castShadow = true })
          envGroup.add(c)
          if (sway > 0) swayTrees.push({ group: c, phase: Math.random() * 6.28, amp: sway })
        }
      }).catch(() => { /* thiếu file thì cảnh đó trống */ })
    }
    // Lều 2 bên sân (giữ lại làm trại đội)
    placeEnv('/track/track-tents.glb', [
      { x: -11, z: -9 }, { x: 11, z: -9 },
    ])
    // Rừng quanh sân: sồi + beech + liễu + thông, nhiều tuổi, tán chi
    // tiết. ÍT CÂY — chỉ 4 cụm nhỏ ở phía sau xa (không trồng 2 bên, vì
    // cây gần sẽ che + tranh với nhân vật). Tâm điểm là các nhân vật kéo
    // dây ở giữa, cây chỉ làm nền mờ phía sau.
    // Random có hạt giống cố định để cảnh không đổi mỗi lần tải lại.
    const treeDefs = [
      { url: '/env3/forest/oak_old.glb', s: 1.2 },
      { url: '/env3/forest/oak_mature.glb', s: 1.15 },
      { url: '/env3/forest/beech_old.glb', s: 1.2 },
      { url: '/env3/forest/beech_mature.glb', s: 1.15 },
      { url: '/env3/forest/willow_mature.glb', s: 1.15 },
      { url: '/env3/forest/scots_pine_mature.glb', s: 1.2 },
    ]
    const treeRand = (() => { let seed = 7; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 } })()
    const treeSpots = []
    // 4 cụm, mỗi cụm 2 cây chen nhau, chỉ ở hàng rào phía sau xa, TRÁNH
    // GIỮA (|x| < 12) — cây ở giữa sẽ che trời + tranh với nhân vật ở
    // trung tâm khung hình. Cây chỉ làm nền 2 bên, giữa để trời + đồi.
    const clusterX = [-26, -15, 15, 26]
    for (let c = 0; c < 4; c++) {
      const cx = clusterX[c] + (treeRand() - 0.5) * 4
      const cz = -22 + treeRand() * 5
      for (let k = 0; k < 2; k++) {
        treeSpots.push({
          x: cx + (treeRand() - 0.5) * 4,
          z: cz + (treeRand() - 0.5) * 3,
          ry: treeRand() * 6.28,
          s: 0.8 + treeRand() * 0.4,
        })
      }
    }
    treeDefs.forEach((def, k) => {
      placeEnv(def.url, treeSpots.filter((_, i) => i % treeDefs.length === k).map((t) => ({ ...t, s: t.s * def.s })), { sway: 0.02 })
    })
    // Bụi rừng rải rác quanh sân (ít thôi, để nền thoáng, nhân vật nổi).
    const bushSpots = []
    for (let i = 0; i < 6; i++) {
      let x, z
      do {
        x = -26 + Math.random() * 52
        z = -18 + Math.random() * 30
      } while ((Math.abs(x) < 8 && Math.abs(z) < 5) || z > 13)
      bushSpots.push({ x, z, ry: Math.random() * 6.28, s: 0.9 + Math.random() * 0.7 })
    }
    placeEnv('/env3/forest/holly_bush.glb', bushSpots.filter((_, i) => i % 2 === 0))
    placeEnv('/env3/forest/hawthorn_bush.glb', bushSpots.filter((_, i) => i % 2 === 1))
    // Cờ dọc phía sau
    const flagSpots = []
    for (let i = 0; i < 6; i++) flagSpots.push({ x: -12 + i * 4.8, z: -10, ry: (i % 2 ? Math.PI : 0) })
    placeEnv('/track/quaternius-flag.glb', flagSpots)
    // ── Bảng tên tỉnh: 3 tỉnh tặng quà nhiều nhất, tên viết lên bảng treo
    // trên cột sau hố bùn, cao hơn đầu người để nhìn rõ từ xa. Bảng của
    // tỉnh dẫn đầu nền vàng, 2 bảng sau nền xanh đậm — đổi bảng khi BXH
    // tỉnh thành đổi.
    const provinceBannerSlots = []
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group()
      grp.position.set((i - 1) * 3.2, 0, -5)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6), mat(0x495057))
      pole.position.y = 1.1
      grp.add(pole)
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 96
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
      )
      cloth.position.set(0, 1.95, 0)
      grp.add(cloth)
      grp.visible = false
      scene.add(grp)
      provinceBannerSlots.push({ grp, canvas, tex, cloth })
    }
    let provinceBannerSig = ''
    // ── Đồi xa 3D: khối cầu dẹt xanh dịu (mờ dần theo sương mù, không
    // tranh với nhân vật), bao quanh chân trời như núi đồi ngoài đời.
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f9a63, roughness: 1, metalness: 0 })
    const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x7ba06b, roughness: 1, metalness: 0 })
    const hillSpots = [
      { x: -55, z: -55, r: 26, h: 0.32 }, { x: -18, z: -62, r: 30, h: 0.38 },
      { x: 20, z: -58, r: 28, h: 0.34 }, { x: 55, z: -50, r: 24, h: 0.3 },
      { x: -70, z: -20, r: 22, h: 0.3 }, { x: 70, z: -18, r: 22, h: 0.28 },
    ]
    hillSpots.forEach((t, i) => {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(t.r, 24, 16), i % 2 ? hillMat2 : hillMat)
      hill.scale.y = t.h
      hill.position.set(t.x, -1, t.z)
      scene.add(hill)
    })
    // ── Hàng rào gỗ 3D quanh sân (như hàng rào nông trại): cột + 2 thanh
    // ngang, bao 4 phía sân chơi.
    const fenceMat = mat(0x8b5a2b)
    const fenceMat2 = mat(0x7a4e24)
    const fenceGroup = new THREE.Group()
    const fenceRect = { x0: -13, x1: 13, z0: -9, z1: 9 }
    const addFenceRun = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(2, Math.round(len / 2.2))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.14), i % 2 ? fenceMat2 : fenceMat)
        post.position.set(x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t)
        post.castShadow = true
        fenceGroup.add(post)
      }
      for (const y of [0.45, 0.9]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.06), fenceMat)
        rail.position.set((x0 + x1) / 2, y, (z0 + z1) / 2)
        rail.rotation.y = Math.atan2(-(z1 - z0), x1 - x0)
        rail.castShadow = true
        fenceGroup.add(rail)
      }
    }
    addFenceRun(fenceRect.x0, fenceRect.z0, fenceRect.x1, fenceRect.z0)
    addFenceRun(fenceRect.x0, fenceRect.z1, fenceRect.x1, fenceRect.z1)
    addFenceRun(fenceRect.x0, fenceRect.z0, fenceRect.x0, fenceRect.z1)
    addFenceRun(fenceRect.x1, fenceRect.z0, fenceRect.x1, fenceRect.z1)
    scene.add(fenceGroup)
    // Mây 3D — cụm cầu trắng to, trôi chậm theo gió (xem animate).
    // Đặt thấp + gần hơn để thấy rõ trong khung hình (mây cao quá thì
    // ra khỏi khung, trời trống trơn).
    const decor = new THREE.Group()
    const decorClouds = []
    // 2 đám mây cố định ở vị trí đẹp trong khung hình (luôn thấy), còn lại
    // random để trời không đơn điệu.
    const fixedClouds = [{ x: -9, y: 9.5, z: -16 }, { x: 11, y: 11, z: -19 }]
    fixedClouds.forEach((fc) => {
      const cloud = new THREE.Group()
      for (let j = 0; j < 6; j++) {
        // Mây dùng MeshBasicMaterial (không nhận sáng): mây lúc nào cũng
        // trắng sáng, không bị tối đen khi đổi góc nắng. (Nắng chuyển ra
        // phía trước 2026-11-19 làm mây Lambert tối sầm như mây giông.)
        const puff = new THREE.Mesh(new THREE.SphereGeometry(2.6 + Math.random() * 1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }))
        puff.position.set((j - 3) * 2.4 + Math.random(), Math.random() * 0.9, (Math.random() - 0.5) * 1.5)
        puff.scale.y = 0.7
        cloud.add(puff)
      }
      cloud.position.set(fc.x, fc.y, fc.z)
      decor.add(cloud)
      decorClouds.push(cloud)
    })
    for (let i = 0; i < 5; i++) {
      const cloud = new THREE.Group()
      const puffs = 5 + Math.floor(Math.random() * 3)
      for (let j = 0; j < puffs; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(2.8 + Math.random() * 1.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }))
        puff.position.set((j - puffs / 2) * 2.6 + Math.random(), Math.random() * 1.0, (Math.random() - 0.5) * 1.8)
        puff.scale.y = 0.7
        cloud.add(puff)
      }
      cloud.position.set(-26 + Math.random() * 52, 8 + Math.random() * 3, -12 - Math.random() * 8)
      decor.add(cloud)
      decorClouds.push(cloud)
    }
    scene.add(decor)
    // Bụi cỏ rừng rải DÀY quanh sân (3dassets.dev CC0) — InstancedMesh cho
    // nhẹ máy. Gió: từng bụi cỏ đung đưa (grassSway, xem animate).
    const grassSway = [] // { mesh, base: [{x,z,ry,s,phase}] }
    const makeGrass = (url, count, scaleBase) => {
      envLoader.loadAsync(url).then((gltf) => {
        const tufts = []
        gltf.scene.traverse((o) => { if (o.isMesh && tufts.length < 3) tufts.push(o) })
        tufts.forEach((tuft) => {
          const inst = new THREE.InstancedMesh(tuft.geometry, tuft.material, count)
          const base = []
          const m = new THREE.Matrix4()
          const q = new THREE.Quaternion()
          const e = new THREE.Euler()
          const v = new THREE.Vector3()
          const sc = new THREE.Vector3()
          for (let i = 0; i < count; i++) {
            let x = 0, z = 0
            do {
              x = -30 + Math.random() * 60
              z = -18 + Math.random() * 32
            } while ((Math.abs(x) < 5.5 && Math.abs(z) < 2.5) || Math.hypot(x, z) < 4.2)
            const ry = Math.random() * Math.PI * 2
            const s = scaleBase * (0.7 + Math.random() * 0.8)
            const gy = terrainY(x, z)
            base.push({ x, y: gy, z, ry, s, phase: Math.random() * 6.28 })
            e.set(0, ry, 0)
            q.setFromEuler(e)
            v.set(x, gy, z)
            sc.set(s, s, s)
            m.compose(v, q, sc)
            inst.setMatrixAt(i, m)
          }
          inst.instanceMatrix.needsUpdate = true
          scene.add(inst)
          grassSway.push({ mesh: inst, base })
        })
      }).catch(() => { /* thiếu file thì sân vẫn có cỏ */ })
    }
    makeGrass('/env3/forest/grass_tussock.glb', 130, 0.9)
    makeGrass('/env3/forest/grass_clump.glb', 60, 1.0)
    makeGrass('/env3/forest/fern_clump.glb', 14, 0.9)

    // ── Dây kéo + cờ giữa ──
    // Dây dài 17m để dù cờ trượt ±3,4m (khi 1 đội thắng áp đảo) thì dây vẫn
    // chạy qua tay người cuối cùng của cả 2 đội (x = ±4,5) — không ai nắm
    // hụt dây. Nút thắt ở 2 đầu dây, ngoài người cuối cùng.
    // Dây thừng thật: texture sợi xoắn gai + hình học nhiều đốt để uốn
    // cong được (chùng lúc chờ, căng lúc kéo). X nằm dọc dây, Y là độ võng.
    const ropeGroup = new THREE.Group()
    const ropeTex = makeRopeTexture()
    ropeTex.repeat.set(1, 28) // 1 bước xoắn ~0,6m → 17m dây = 28 bước xoắn
    const ropeMat = new THREE.MeshLambertMaterial({ map: ropeTex, bumpMap: ropeTex, bumpScale: 0.6 })
    const ropeGeo = new THREE.CylinderGeometry(0.09, 0.09, 17, 12, 96)
    ropeGeo.rotateZ(Math.PI / 2) // trục Y → trục X (dọc dây), X ∈ [-8.5, 8.5]
    const ropeMesh = new THREE.Mesh(ropeGeo, ropeMat)
    ropeMesh.castShadow = true
    ropeGroup.add(ropeMesh)
    // Lưu vị trí gốc để mỗi khung hình tính lại độ võng (không cộng dồn).
    const ropeBasePos = ropeGeo.attributes.position.array.slice()
    // Nút thắt 2 đầu dây (cùng chất liệu thừng)
    for (const x of [-8.4, 8.4]) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), ropeMat)
      knot.position.set(x, 0, 0)
      ropeGroup.add(knot)
    }
    // Cờ giữa dây (đỏ/trắng) — vị trí của nó chính là "điểm số" của trận.
    // Cờ bám theo độ võng giữa dây (x=0) nên Y của cờ cập nhật mỗi khung hình.
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), mat(0x495057))
    flagPole.position.set(0, 0.55, 0)
    ropeGroup.add(flagPole)
    const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.04), mat(0xe03131))
    flagCloth.position.set(0.38, 0.85, 0)
    ropeGroup.add(flagCloth)
    ropeGroup.position.set(0, ROPE_Y, 0)
    scene.add(ropeGroup)

    // ── Pool hạt: bụi chân + bùn văng + giấy màu ──
    const dustPool = []
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }))
      scene.add(d)
      dustPool.push({ mesh: d, life: 0 })
    }
    let dustIdx = 0
    const splashPool = []
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshBasicMaterial({ color: 0x5d3717, transparent: true, opacity: 0 }))
      scene.add(d)
      splashPool.push({ mesh: d, life: 0, vx: 0, vy: 0, vz: 0 })
    }
    let splashIdx = 0
    const confettiPool = []
    const confettiPalette = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2, 0xff922b]
    for (let i = 0; i < 28; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.04),
        new THREE.MeshBasicMaterial({ color: confettiPalette[i % confettiPalette.length], transparent: true, opacity: 0 }))
      scene.add(d)
      confettiPool.push({ mesh: d, life: 0, vy: 0, spin: 0 })
    }
    let confettiIdx = 0
    // Vòng gợn sóng trên mặt bùn khi ngã + vệt bùn loang + cục bùn dính quanh người ngã
    const ripplePool = []
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.66, 24),
        new THREE.MeshBasicMaterial({ color: 0x8a5a2b, transparent: true, opacity: 0, side: THREE.DoubleSide }))
      r.rotation.x = -Math.PI / 2
      r.position.y = 0.04
      scene.add(r)
      ripplePool.push({ mesh: r, life: 0 })
    }
    let rippleIdx = 0
    const splatPool = []
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.65, 20),
        new THREE.MeshBasicMaterial({ color: 0x4a2c12, transparent: true, opacity: 0 }))
      s.rotation.x = -Math.PI / 2
      s.position.y = 0.025
      scene.add(s)
      splatPool.push(s)
    }
    let splatIdx = 0
    const mudBlobPool = []
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x5d3717 }))
      b.scale.set(1.25, 0.32, 1.1)
      b.visible = false
      scene.add(b)
      mudBlobPool.push(b)
    }
    let mudBlobIdx = 0
    const spawnedFx = new Set()

    // ── Tải nhân vật người ──
    const modelCache = new Map() // file -> { scene, clips, rig }
    const clipPool = new Map() // tên clip thường -> clip Mixamo (dùng chung giữa các file)
    const realBuildTries = new Map() // file -> số lần dựng thật thất bại (skeleton hỏng)
    const healTries = new Map() // key "A-2" -> số lần tự chữa nhân vật bị lật
    const forceFallbackKeys = new Set() // key đã chữa 2 lần vẫn hỏng -> giữ người dự phòng
    const gltfLoader = new GLTFLoader()
    gltfLoader.setMeshoptDecoder(MeshoptDecoder) // player.glb nén meshopt
    const uniqueFiles = [...new Set(Object.values(HUMAN_SLOTS).flat().map((s) => s.file))]
    const fileUrl = {}
    for (const slots of Object.values(HUMAN_SLOTS)) for (const s of slots) fileUrl[s.file] = s.url
    for (const file of uniqueFiles) {
      gltfLoader.loadAsync(fileUrl[file]).then((gltf) => {
        const clips = new Map()
        for (const c of gltf.animations || []) clips.set(c.name.toLowerCase(), c)
        const rig = file === 'casual' ? 'casual' : 'mixamo'
        modelCache.set(file, { scene: gltf.scene, clips, rig })
        // Clip Mixamo dùng chung được giữa các nhân vật (cùng tên xương).
        if (rig === 'mixamo') for (const [name, clip] of clips) if (!clipPool.has(name)) clipPool.set(name, clip)
      }).catch((e) => { console.error('[GLB-LOAD-FAIL]', file, fileUrl[file], String(e?.message || e).slice(0, 200)) })
    }

    // Đổi màu áo/tóc/quần để 2 người dùng chung 1 model trông khác nhau.
    const applyVariant = (clone, variant) => {
      if (!variant) return
      const replaced = new Map() // uuid gốc -> material đã clone
      const tint = (o, mi, colorHex) => {
        const m = Array.isArray(o.material) ? o.material[mi] : o.material
        if (!m) return
        if (!replaced.has(m.uuid)) {
          const c = m.clone()
          c.color.set(colorHex)
          replaced.set(m.uuid, c)
        }
        if (Array.isArray(o.material)) o.material[mi] = replaced.get(m.uuid)
        else o.material = replaced.get(m.uuid)
      }
      clone.traverse((o) => {
        if (!o.isMesh) return
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m, mi) => {
          if (!m || !m.name) return
          if (variant === 'casual2') {
            if (m.name === 'Shirt') tint(o, mi, 0x2f9e44) // áo xanh lá
            else if (m.name === 'Hair') tint(o, mi, 0x1f1a17) // tóc đen
            else if (m.name === 'Pants') tint(o, mi, 0x364fc7) // quần jean xanh
          } else if (variant === 'soldierB') {
            if (m.name === 'VanguardBodyMat') tint(o, mi, 0x8fb3ff) // giáp xanh
          }
        })
      })
    }

    const findBones = (clone, rig) => {
      const map = BONE_MAP[rig]
      const bones = {}
      const byName = new Map()
      clone.traverse((o) => { if (o.name) byName.set(o.name, o) })
      for (const [key, name] of Object.entries(map)) {
        // Tên xương Mixamo có 3 dạng tùy nguồn: 'Hips', 'mixamorig:Hips'
        // (tên trong file GLB) và 'mixamorigHips' — GLTFLoader bỏ dấu ':'
        // khi tạo bone ở runtime, nên dạng không dấu ':' mới là dạng khớp
        // thật. Thiếu dạng này là findBones trả về toàn null, dáng kéo im
        // lặng không áp dụng (chỉ còn clip idle + nghiêng cả nhóm) mà
        // không báo lỗi gì — bẫy đã dính 1 lần 2026-11-19.
        bones[key] = byName.get(name) || byName.get(`mixamorig:${name}`) || byName.get(`mixamorig${name}`) || null
      }
      return bones
    }

    // Dựng 1 người 3D từ 1 định nghĩa slot (file + biến thể): clone model
    // đã tải (SkeletonUtils.clone chia sẻ geometry/material nên nhân bản
    // rẻ), gắn mixer + xương + vệt bùn. Dùng chung cho cả người mẫu (slot
    // cố định) lẫn khán giả (nhân bản NGẪU NHIÊN 1 trong 6 model).
    const buildHumanEntry = (teamId, slot, slotIdx) => {
      const group = new THREE.Group()
      const model = modelCache.get(slot.file)
      if (model) {
        const clone = cloneModel(model.scene)
        applyVariant(clone, slot.variant)
        // Kiểm tra skeleton của bản clone NGAY lúc dựng: nếu
        // SkeletonUtils.clone nối sai xương (mesh skin tham chiếu xương
        // ngoài bản clone) thì nhân vật xẹp thành 1 cục nhỏ trên đất hoặc
        // biến mất — Mia chỉ có 1 mesh duy nhất nên biến mất hoàn toàn.
        // Hỏng thì trả về người dự phòng (nhìn thấy được còn hơn biến
        // mất), lần sau thử dựng lại (giới hạn 3 lần).
        const cloneIds = new Set()
        clone.traverse((o) => cloneIds.add(o.id))
        let skeletonOk = true
        clone.traverse((o) => {
          if (!skeletonOk) return
          if (o.isSkinnedMesh && o.skeleton) {
            for (const b of o.skeleton.bones) if (!cloneIds.has(b.id)) { skeletonOk = false; break }
          }
        })
        const bones = findBones(clone, model.rig)
        let bonesOk = true
        for (const b of Object.values(bones)) if (!b) { bonesOk = false; break }
        if (!skeletonOk || !bonesOk) {
          console.warn('[CHAR-BUILD-BAD]', slot.file, 'skeletonOk:', skeletonOk, 'bonesOk:', bonesOk)
          realBuildTries.set(slot.file, (realBuildTries.get(slot.file) || 0) + 1)
        } else {
          const inner = new THREE.Group()
          inner.rotation.y = MODEL_FACE_Y[teamId] * FACE_SIGN[slot.file]
          // Co mọi nhân vật về cùng chiều cao 1,75 (file gốc khác đơn vị nhau).
          inner.scale.setScalar(HUMAN_HEIGHT / (BASE_HEIGHT[slot.file] || 1.75))
          inner.add(clone)
          group.add(inner)
          clone.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true
              // Skinned mesh lúc mới tải có bounding sphere chưa cập nhật theo
              // xương nên dễ bị cắt khỏi khung hình — tắt culling cho chắc.
              o.frustumCulled = false
            }
          })
          const mixer = new THREE.AnimationMixer(clone)
          const hipsBaseY = bones.hips ? bones.hips.position.y : 0.95
          return {
            group, mixer, clips: model.clips, rig: model.rig, bones, hipsBaseY,
            currentClip: null, currentAction: null, isFallback: false,
            poseWeight: 0, slotIdx, faceSign: FACE_SIGN[slot.file] || 1,
            mudSpots: makeMudSpots(group, slotIdx),
          }
        }
      }
      const human = makeFallbackHuman(TEAM_COLORS[teamId])
      group.add(human)
      return { group, mixer: null, clips: null, rig: null, bones: null, hipsBaseY: 0.95, currentClip: null, currentAction: null, isFallback: true, poseWeight: 0, slotIdx, faceSign: 1, mudSpots: makeMudSpots(group, slotIdx) }
    }

    const humanMeshes = new Map() // key "A-0" -> entry
    const TEAM_COLORS = { A: 0xe03131, B: 0x1971c2 }
    // Người dự phòng (dùng khi file chưa tải / dựng thật thất bại).
    const buildFallbackEntry = (teamId, slotIdx) => {
      const group = new THREE.Group()
      group.add(makeFallbackHuman(TEAM_COLORS[teamId]))
      return { group, mixer: null, clips: null, rig: null, bones: null, hipsBaseY: 0.95, currentClip: null, currentAction: null, isFallback: true, poseWeight: 0, slotIdx, faceSign: 1, mudSpots: makeMudSpots(group, slotIdx) }
    }
    const getHumanMesh = (teamId, slotIdx) => {
      const key = `${teamId}-${slotIdx}`
      const slot = HUMAN_SLOTS[teamId][slotIdx]
      let entry = humanMeshes.get(key)
      // Đã chữa 2 lần vẫn hỏng -> giữ người dự phòng, khỏi dựng đi dựng lại.
      if (forceFallbackKeys.has(key)) {
        if (!entry || !entry.isFallback) {
          if (entry) scene.remove(entry.group)
          entry = buildFallbackEntry(teamId, slotIdx)
          scene.add(entry.group)
          humanMeshes.set(key, entry)
        }
        return entry
      }
      // Đổi dự phòng -> thật khi model về tới (giới hạn 3 lần thử để
      // khỏi tháo/dựng vô hạn nếu file đó dựng thật cứ hỏng).
      if (entry?.isFallback && modelCache.has(slot.file) && (realBuildTries.get(slot.file) || 0) < 3) {
        scene.remove(entry.group)
        humanMeshes.delete(key)
        entry = null
      }
      if (entry) return entry
      entry = buildHumanEntry(teamId, slot, slotIdx)
      scene.add(entry.group)
      humanMeshes.set(key, entry)
      return entry
    }

    // ── Nhân vật khán giả: mỗi đội 3 ô, ô nào có người mới vào gần nhất
    // thì hiện nhân vật của người đó (tên + avatar trên đầu). Nhân vật là
    // BẢN SAO NGẪU NHIÊN 1 trong 6 người mẫu 3D (không tạo hình mới) —
    // clone model đã tải nên rẻ, có đủ clip idle + dáng kéo + té bùn.
    // Nhóm ngoài để đặt vị trí + ngửa người (theo trục Z thế giới, như
    // người mẫu); nhóm trong (holder) chứa bản sao người 3D, thay được
    // khi đổi người.
    const VIEWER_POOL = [...HUMAN_SLOTS.A, ...HUMAN_SLOTS.B]
    const pickRandomModel = () => VIEWER_POOL[Math.floor(Math.random() * VIEWER_POOL.length)]
    const viewerSlots = { A: [], B: [] }
    for (const teamId of ['A', 'B']) {
      for (let i = 0; i < VIEWER_CAP; i++) {
        const group = new THREE.Group()
        const holder = new THREE.Group()
        group.add(holder)
        const nameTag = makeNameSprite(TEAM_COLORS[teamId])
        group.add(nameTag.sprite)
        const avatarTag = makeAvatarSprite()
        group.add(avatarTag.sprite)
        group.visible = false
        group.scale.setScalar(0.001)
        scene.add(group)
        viewerSlots[teamId].push({ group, holder, nameTag, avatarTag, entry: null, userId: null, spawn: 0 })
      }
    }

    const pickClip = (entry, want) => {
      if (!entry.clips) return null
      const own = (names) => {
        for (const n of names) { const c = entry.clips.get(n); if (c) return c }
        return null
      }
      if (want === 'dance') {
        // Mỗi người múa kiểu riêng: Mia samba, Lan/Hương ăn mừng, lính dùng
        // clip victory mượn từ Kaito (cùng rig Mixamo).
        return own(['sambadance', 'victory']) || (entry.rig === 'mixamo' ? clipPool.get('victory') : null) || own(['idle'])
      }
      if (want === 'walk') return own(['walk']) || (entry.rig === 'mixamo' ? clipPool.get('walk') : null)
      // KHÔNG lấy clip đầu tiên bừa (entry.clips.values().next()) — clip
      // đầu của file có thể là clip cúi/ngồi/nhảy, nhân vật sẽ lùn xuống
      // như độn thổ; chỉ dùng 'idle', mượn từ pool, 'tpose' đứng yên, còn
      // không thì null (đứng tư thế gốc) cho tới khi idle tải xong.
      return own(['idle']) || (entry.rig === 'mixamo' ? clipPool.get('idle') : null)
        || own(['tpose']) || null
    }
    const setClip = (entry, want) => {
      if (!entry.mixer) return
      const clip = pickClip(entry, want)
      if (!clip || entry.currentClip === clip) return
      const next = entry.mixer.clipAction(clip)
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play()
      if (entry.currentAction && entry.currentAction !== next) entry.currentAction.fadeOut(0.15)
      entry.currentAction = next
      entry.currentClip = clip
    }

    // Dáng kéo: trộn dần từ clip đang chạy sang tư thế gồng sức (ngửa người,
    // 2 tay nắm dây, chân trụ) — w=0 là clip nguyên, w=1 là dáng kéo nguyên.
    // Rig Quaternius (Lan/Hương) có trục xương chân khác Mixamo nên KHÔNG
    // xoay chân cho họ (xoay sai là chân gập lại, người lùn xuống như ngồi
    // xổm) — chỉ ngửa thân trên + giơ tay, chân giữ nguyên tư thế đứng.
    const LEG_KEYS = ['lUpLeg', 'rUpLeg', 'lLeg', 'rLeg']
    const applyPullPose = (entry, time, rockAmp, w) => {
      if (!entry.bones || w <= 0.01) return
      // Dáng kéo được định nghĩa theo hướng mặt của nhân vật (local +Z).
      // Soldier quay mặt về local -Z nên mọi góc xoay phải đảo dấu cho anh
      // ta, không thì anh ta ngửa về phía trước (hướng dây) thay vì ra sau.
      const s = entry.faceSign || 1
      // Nhịp kéo chậm, nặng (giật lên từng nhịp như kéo co thật) thay vì
      // rung nhanh — rung nhanh nhìn như giật cục, không mượt.
      const rock = Math.sin(time * 2.2 + entry.slotIdx * 1.3) * 0.04 * rockAmp
      const lerp = THREE.MathUtils.lerp
      for (const [key, pose] of Object.entries(PULL_POSE)) {
        if (entry.rig === 'casual' && LEG_KEYS.includes(key)) continue
        const bone = entry.bones[key]
        if (!bone) continue
        // CỘNG góc dáng kéo vào góc hiện tại (xem ghi chú ở PULL_POSE) —
        // không lerp về góc tuyệt đối, xương Mixamo có tư thế gốc lớn.
        const r = bone.rotation
        const rockX = (key === 'hips' || key === 'spine' || key === 'lArm' || key === 'rArm') ? rock : 0
        if (entry.rig === 'casual') {
          // Rig Quaternius: clip Idle thiếu track xoay cho cột sống/tay nên
          // mixer không reset góc mỗi khung — cộng delta sẽ tích lũy, quay
          // mãi. Lerp về góc tuyệt đối (tư thế gốc của rig này nhỏ nên an
          // toàn) thay vì cộng delta.
          if (pose.x !== undefined) r.x = lerp(r.x, pose.x * s + rockX, w)
          if (pose.y !== undefined) r.y = lerp(r.y, pose.y * s, w)
          if (pose.z !== undefined) r.z = lerp(r.z, pose.z * s, w)
        } else {
          // Rig Mixamo: clip Idle/idle có đủ track xoay cho mọi xương dáng
          // kéo nên mixer reset góc mỗi khung — cộng delta an toàn.
          if (pose.x !== undefined) r.x += (pose.x * s + rockX) * w
          if (pose.y !== undefined) r.y += pose.y * s * w
          if (pose.z !== undefined) r.z += pose.z * s * w
        }
      }
    }

    let raf = 0
    let lastT = performance.now()
    let lastHealthCheck = 0
    let smoothRopeX = 0
    let smoothRopeY = ROPE_Y
    let smoothSag = 0.35 // độ võng dây hiện tại (m) — bắt đầu chùng như lúc chờ
    let lastPhase = ''
    let roundEndStart = 0
    let shake = 0
    // key "A-0" -> true khi người đó đã chạm bùn (để văng bùn 1 lần duy nhất)
    const humanFall = new Map()
    const humanBlob = new Map()
    const camBase = new THREE.Vector3(0, 6.2, 23) // đội hình rộng (±7,05) nên lùi ra để thấy hết 2 đội
    const lookTarget = new THREE.Vector3(0, 1.1, 0)
    // Vị trí camera hiện tại (trượt mượt giữa toàn cảnh và cận cảnh té bùn).
    const curCamPos = camBase.clone()
    const curLook = lookTarget.clone()
    const tmpCamPos = new THREE.Vector3()
    const tmpLook = new THREE.Vector3()
    // Tạm dùng cho gió (tránh cấp phát mới mỗi khung hình).
    const tmpWindM = new THREE.Matrix4()
    const tmpWindQ = new THREE.Quaternion()
    const tmpWindE = new THREE.Euler()
    const tmpWindV = new THREE.Vector3()
    const tmpWindS = new THREE.Vector3()

    // Ngã xuống bùn: bùn văng tung tóe + gợn sóng lan ra + vệt bùn loang + rung camera
    const spawnMudImpact = (x, z) => {
      for (let i = 0; i < 14; i++) {
        const s = splashPool[splashIdx++ % splashPool.length]
        const a = Math.random() * Math.PI * 2
        s.mesh.position.set(x + Math.cos(a) * 0.4, 0.3, z + Math.sin(a) * 0.4)
        s.vx = Math.cos(a) * (1.5 + Math.random() * 3)
        s.vy = 2.5 + Math.random() * 3.5
        s.vz = Math.sin(a) * (1.5 + Math.random() * 3)
        s.mesh.material.opacity = 0.95
        s.life = 1
      }
      const r = ripplePool[rippleIdx++ % ripplePool.length]
      r.mesh.position.set(x, 0.04, z)
      r.mesh.scale.setScalar(1)
      r.mesh.material.opacity = 0.75
      r.life = 0.8
      const sp = splatPool[splatIdx++ % splatPool.length]
      sp.position.set(x, 0.025, z)
      sp.material.opacity = 0.6
      shake = 0.35
    }

    const animate = (t) => {
    raf = requestAnimationFrame(animate)
      const dt = Math.min(0.1, (t - lastT) / 1000)
      lastT = t
      const time = t / 1000
      const st = liveRef.current
      if (!st) { renderer.render(scene, camera); return }
      const now = st.now ?? 0
      const phase = st.phase || 'waiting'
      const rope = st.rope ?? 0
      const damp = (lambda) => 1 - Math.exp(-lambda * dt)
      // Dây trôi mượt theo vị trí thật (giảm chấn theo thời gian thực).
      // Dây +1 = Đỏ thắng → cờ chạy về phía Đỏ (bên trái, -X).
      smoothRopeX += (-rope * ROPE_RANGE - smoothRopeX) * damp(3.0)
      // Hết màn: dây chùng xuống (không còn căng) — đội thua hết gồng.
      const ropeYTarget = (phase === 'roundEnd' || phase === 'matchEnd') ? 0.5 : ROPE_Y
      smoothRopeY += (ropeYTarget - smoothRopeY) * damp(2.5)
      ropeGroup.position.set(smoothRopeX, smoothRopeY, 0)
      ropeGroup.rotation.z = -smoothRopeX * 0.012 // dây hơi nghiêng theo hướng kéo
      // ── Dây thừng chùng / căng như ngoài đời ──
      // Chờ bắt đầu: không ai gồng → dây chùng xuống, đung đưa nhẹ.
      // Đang kéo: 2 đội gồng càng mạnh dây càng căng thẳng (hết võng).
      // Hết màn: đội thua hết gồng → dây lại chùng xuống.
      const strA = st.teams?.A?.pullRate ?? st.teams?.A?.members?.length ?? 0
      const strB = st.teams?.B?.pullRate ?? st.teams?.B?.members?.length ?? 0
      const totalPull = strA + strB
      let tension = 0
      if (phase === 'pulling') tension = Math.min(1, Math.max(0.3, totalPull / 8))
      else if (phase === 'countdown') tension = 0.5
      else if (phase === 'roundEnd' || phase === 'matchEnd') tension = 0.1
      const sagTarget = 0.35 * (1 - tension) // võng tối đa 0,35m lúc chờ
      smoothSag += (sagTarget - smoothSag) * damp(2.0)
      // Đung đưa nhẹ lúc dây chùng (càng chùng càng đưa), hết đưa lúc căng.
      const sagNow = smoothSag * (1 + 0.12 * Math.sin(time * 1.4))
      const swayZ = 0.08 * (1 - tension) * Math.sin(time * 0.9 + 1)
      const pos = ropeGeo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const ox = ropeBasePos[i * 3]
        const k = 1 - (ox / 8.5) * (ox / 8.5) // võng nhiều nhất ở giữa, 0 ở 2 đầu
        pos.array[i * 3 + 1] = ropeBasePos[i * 3 + 1] - sagNow * k
        pos.array[i * 3 + 2] = ropeBasePos[i * 3 + 2] + swayZ * k
      }
      pos.needsUpdate = true
      ropeGeo.computeVertexNormals()
      // Cờ bám theo độ võng giữa dây (điểm giữa dây hạ xuống = độ võng).
      flagPole.position.y = 0.55 - sagNow
      flagCloth.position.y = 0.85 - sagNow
      flagCloth.rotation.y = Math.sin(time * 3) * 0.25 // cờ phấp phới
      for (const b of banners) b.flag.position.x = b.base + Math.sin(time * 2 + (b.teamId === 'A' ? 0 : 2)) * 0.08
      // ── Bảng tên tỉnh: top 3 tỉnh đổi thì vẽ lại bảng trên 3 cột sau hố bùn ──
      if (st.provinceTotals) {
        const top3 = Object.values(st.provinceTotals).sort((a, b) => b.power - a.power).slice(0, 3)
        const sig = top3.map((c) => c.code).join('|')
        if (sig !== provinceBannerSig) {
          provinceBannerSig = sig
          provinceBannerSlots.forEach((slot, i) => {
            const c = top3[i]
            slot.grp.visible = !!c
            if (!c) return
            const ctx = slot.canvas.getContext('2d')
            ctx.clearRect(0, 0, 256, 96)
            // Nền bảng: tỉnh dẫn đầu vàng, 2 tỉnh sau xanh đậm.
            ctx.fillStyle = i === 0 ? '#f59f00' : '#08261a'
            ctx.beginPath()
            ctx.roundRect(4, 8, 248, 80, 16)
            ctx.fill()
            ctx.strokeStyle = i === 0 ? '#fff3bf' : 'rgba(255,255,255,.35)'
            ctx.lineWidth = 3
            ctx.stroke()
            ctx.fillStyle = '#ffffff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            // Tên vùng trên bảng: tỉnh thì tên ngắn, nước thì cờ + tên ngắn.
            // Co chữ lại nếu dài (cờ + tên nước dài) để vừa bảng 256px.
            const info = regionInfo(c.code)
            const label = info ? (info.flag ? `${info.flag} ${info.short}` : info.short) : c.code
            let fs = 40
            ctx.font = `900 ${fs}px sans-serif`
            while (ctx.measureText(label).width > 220 && fs > 20) {
              fs -= 2
              ctx.font = `900 ${fs}px sans-serif`
            }
            ctx.fillText(label, 128, 50)
            slot.tex.needsUpdate = true
            slot.cloth.rotation.y = Math.sin(time * 2 + i) * 0.15
          })
        }
        provinceBannerSlots.forEach((slot, i) => {
          if (slot.grp.visible) slot.cloth.rotation.y = Math.sin(time * 2.5 + i * 1.3) * 0.18
        })
      }
      // ── Gió: cỏ đung đưa + cây đung đưa + mây trôi ──
      // Cỏ: từng bụi lệch ngang + nghiêng nhẹ theo nhịp gió (mỗi bụi lệch
      // pha nhau nên không đung đưa đồng loạt như robot).
      for (const g of grassSway) {
        g.base.forEach((b, i) => {
          const sway = Math.sin(time * 1.8 + b.phase) * 0.06
          tmpWindE.set(sway * 0.7, b.ry, sway)
          tmpWindQ.setFromEuler(tmpWindE)
          tmpWindV.set(b.x + sway * 0.5, b.y, b.z)
          tmpWindS.set(b.s, b.s, b.s)
          tmpWindM.compose(tmpWindV, tmpWindQ, tmpWindS)
          g.mesh.setMatrixAt(i, tmpWindM)
        })
        g.mesh.instanceMatrix.needsUpdate = true
      }
      // Cây: đung đưa rất nhẹ (cây nặng, chỉ nghiêng 1-2°).
      for (const t of swayTrees) {
        t.group.rotation.z = Math.sin(time * 0.8 + t.phase) * t.amp
        t.group.rotation.x = Math.cos(time * 0.6 + t.phase) * t.amp * 0.6
      }
      // Mây trôi chậm từ trái sang phải, qua khỏi thì quay lại đầu bên kia.
      for (const c of decorClouds) {
        c.position.x += dt * 0.25
        if (c.position.x > 28) c.position.x = -28
      }

      // Ghi lại lúc bắt đầu ăn mừng để tính ngã xuống bùn.
      if (phase !== lastPhase) {
        if (phase === 'roundEnd' || phase === 'matchEnd') {
          roundEndStart = now
          humanFall.clear()
          humanBlob.clear()
        } else {
          // Sang màn mới: dọn vệt bùn + cục bùn dính + đốm bùn trên người của màn trước.
          for (const s of splatPool) s.material.opacity = 0
          for (const b of mudBlobPool) b.visible = false
          for (const e of humanMeshes.values()) for (const s of e.mudSpots || []) s.scale.setScalar(0.001)
          humanFall.clear()
          humanBlob.clear()
        }
        lastPhase = phase
      }
      const loserTeam = phase === 'roundEnd' || phase === 'matchEnd'
        ? (st.roundWinner ? (st.roundWinner === 'A' ? 'B' : 'A') : null)
        : null
      const winnerTeam = phase === 'roundEnd' || phase === 'matchEnd' ? st.roundWinner : null
      // Hiệu ứng mới từ engine (giấy màu khi thắng màn).
      for (const fx of st.effects || []) {
        if (fx.kind === 'confetti' && !spawnedFx.has(fx.id)) {
          spawnedFx.add(fx.id)
          for (let i = 0; i < 20; i++) {
            const c = confettiPool[confettiIdx++ % confettiPool.length]
            c.mesh.position.set((Math.random() - 0.5) * 12, 7 + Math.random() * 3, (Math.random() - 0.5) * 6)
            c.vy = 1.2 + Math.random() * 1.2
            c.spin = (Math.random() - 0.5) * 6
            c.mesh.material.opacity = 1
            c.life = 3
          }
        }
      }
      if (spawnedFx.size > 40) spawnedFx.clear()

      // ── 6 người 2 đội ──
      for (const teamId of ['A', 'B']) {
        const teamState = st.teams?.[teamId]
        // pullRate giờ là sức mạnh đội = số người + bùng quà (kéo liên tục),
        // nên 6 người mẫu phải vào dáng kéo ngay khi màn đang kéo — kể cả
        // khi đội chưa có khán giả nào vào (họ là đội, không phải khán giả).
        const pulling = phase === 'pulling'
        const posing = phase === 'pulling'
        const isWinner = winnerTeam === teamId
        const isLoser = loserTeam === teamId
        // Độ ngửa người theo lực kéo (mượt: trượt dần, không giật theo từng quà).
        // Tổng độ ngửa tối đa ~25° (hông + cột sống + nghiêng nhóm) — ngửa
        // hơn nữa trông như sắp ngã ngửa ra sau. Đội đông ngửa nhiều hơn đội ít.
        const leanTarget = Math.min(0.15, 0.04 + (teamState?.pullRate || 0) * 0.001)
        const spots = TEAM_SPOTS[teamId]
        TEAMS[teamId].members.forEach((memberId, i) => {
          const entry = getHumanMesh(teamId, i)
          const { group } = entry
          const spot = spots[i]
          // Cả đội DI CHUYỂN THEO DÂY: khi dây bị kéo về sau (đội thắng
          // lùi lại, đội thua bị lôi về trước) thì nhân vật cũng trượt
          // theo cùng 1 khoảng (smoothRopeX) để tay vẫn nắm đúng dây —
          // không phải chỉ có dây chạy mà người đứng yên. (tấn 2026-11-19)
          let x = spot.x + smoothRopeX
          let y = 0
          let rotX = 0
          entry.smoothLean = (entry.smoothLean ?? 0) + (leanTarget - (entry.smoothLean ?? 0)) * damp(3)
          let rotZ = teamId === 'A' ? entry.smoothLean : -entry.smoothLean
          if (isLoser) {
            // Đội thua bị kéo tuột vào hố bùn, ngã ngửa ra sau — từng người
            // lệch nhau 0,18s nên không ngã đồng loạt: người đầu bị lôi
            // trước, người sau chúi theo. Bắt đầu từ chỗ đang bị kéo tới
            // (x đã cộng smoothRopeX) để không nhảy cóc về chỗ cũ.
            const delay = i * 0.18
            const ft = Math.min(1, Math.max(0, (now - roundEndStart - delay) / 1.1))
            const dragT = ft * ft // kéo càng lúc càng nhanh (tuột tay)
            // Ngã rải ra khắp hố (mỗi người lệch nhau gần 1 bước) để cả 3 đều thấy rõ.
            const pitX = (teamId === 'A' ? 0.9 : -0.9) + (i - 1) * 0.8
            x = x + (pitX - x) * dragT
            y = -0.22 * ft // chìm nửa người xuống bùn (đủ sâu để thấy bùn, đủ nông để thấy người)
            // Ngã ngửa ra sau (xa dây) có "bật" nhẹ rồi mới nằm yên.
            const c1 = 1.70158, c3 = c1 + 1
            const ob = 1 + c3 * Math.pow(ft - 1, 3) + c1 * Math.pow(ft - 1, 2)
            rotZ = (teamId === 'A' ? 1 : -1) * 1.35 * ob
            rotX = 0
            const key = `${teamId}-${i}`
            // Bùn văng lên dính vào người: từng đốm nở dần ra sau khi chạm bùn.
            const spotT = Math.min(1, Math.max(0, (ft - 0.55) / 0.45))
            ;(entry.mudSpots || []).forEach((spot, j) => {
              const st = Math.min(1, Math.max(0, (spotT - j * 0.12) / 0.5))
              spot.scale.setScalar(Math.max(0.001, st * spot.userData.baseR))
            })
            if (ft >= 0.65 && !humanFall.get(key)) {
              // Chạm bùn: bùn văng tung tóe + gợn sóng + vệt loang.
              humanFall.set(key, true)
              spawnMudImpact(x, spot.z)
              const blob = mudBlobPool[mudBlobIdx++ % mudBlobPool.length]
              blob.visible = true
              humanBlob.set(key, blob)
            }
            const blob = humanBlob.get(key)
            if (blob && ft > 0.7) {
              // Cục bùn dính quanh người khi đã nằm trong hố.
              blob.position.set(x, 0.08, spot.z)
              blob.scale.set(1.25 * (0.6 + ft * 0.5), 0.32, 1.1 * (0.6 + ft * 0.5))
            }
            // Bùn nhỏ giọt từ người đang nằm trong hố.
            if (ft > 0.9 && Math.random() < dt * 2) {
              const s = splashPool[splashIdx++ % splashPool.length]
              s.mesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.35, spot.z + (Math.random() - 0.5) * 0.4)
              s.vx = (Math.random() - 0.5) * 0.6
              s.vy = 0.6 + Math.random() * 0.8
              s.vz = (Math.random() - 0.5) * 0.6
              s.mesh.material.opacity = 0.9
              s.life = 0.5
            }
          } else if (isWinner && phase !== 'waiting') {
            if (!entry.mixer) y = Math.abs(Math.sin(time * 6 + i)) * 0.4
          } else if (pulling && !entry.mixer) {
            // Người dự phòng: nhún chân khi đang gồng sức kéo.
            y = Math.abs(Math.sin(time * 9 + i * 2)) * 0.08
          }
          group.position.set(x, y, spot.z)
          group.rotation.set(rotX, 0, rotZ)
          if (entry.mixer) {
            let want = 'idle'
            if (isWinner && phase !== 'waiting') want = 'dance'
            else if (isLoser) want = 'idle'
            else if (pulling) want = 'idle' // dáng kéo phủ lên trên clip idle
            setClip(entry, want)
            entry.mixer.update(dt)
            // Trộn dáng kéo vào sau khi clip chạy xong (không tích lũy).
            // Dáng kéo sâu dần theo lực kéo (quà tới dồn dập thì gồng mạnh
            // hơn), lên/xuống đều trượt mượt thay vì bật tắt theo từng quà.
            // Dáng kéo: vào dáng chắc (tối thiểu 0,7) ngay khi màn đang kéo,
            // gồng mạnh hơn khi đội đông người / quà bùng lên.
            const targetW = posing && !isLoser ? Math.max(0.7, Math.min(1, Math.max(0, ((teamState?.pullRate || 0) - 0.3) / 0.7))) : 0
            // Ngã xuống bùn thì tay BUÔNG NHANH (tốc độ 8 thay vì 1,5):
            // người té mà tay vẫn gồng cứng dáng kéo trong lúc người ngửa
            // ra sau thì tay nhìn như bẻ ngược ra sau. Tay buông lỏng theo
            // dáng idle thì té mới tự nhiên.
            const poseRate = isLoser ? 8 : (targetW > entry.poseWeight ? 4 : 1.5)
            entry.poseWeight += (targetW - entry.poseWeight) * damp(poseRate)
            const rockAmp = 0.5 + Math.min(1, (teamState?.pullRate || 0) * 0.15)
            applyPullPose(entry, time, rockAmp, entry.poseWeight)
          }
          // Bụi chân khi đang gồng sức kéo
          if (pulling && Math.random() < dt * 5) {
            const d = dustPool[dustIdx++ % dustPool.length]
            d.mesh.position.set(x + (teamId === 'A' ? -0.5 : 0.5), 0.15, spot.z + (Math.random() - 0.5) * 0.5)
            d.mesh.material.opacity = 0.5
            d.life = 0.5
          }
        })
      }
      // ── Nhân vật khán giả: người mới vào gần nhất hiện ra kéo dây ──
      // Mỗi người vào đội là 1 nhân vật (tên + avatar trên đầu) đứng chen
      // vào hàng kéo, +1 lực kéo. Chỉ hiện 3 người mới nhất/đội, còn lại
      // vẫn tính lực kéo (xem số người ở bảng tỉ số). Nhân vật là bản sao
      // NGẪU NHIÊN 1 trong 6 người mẫu 3D nên kéo/nhảy/té bùn y hệt họ.
      for (const teamId of ['A', 'B']) {
        const teamState = st.teams?.[teamId]
        const visible = visibleMembers(st, teamId, VIEWER_CAP)
        const isLoser = loserTeam === teamId
        const isWinner = winnerTeam === teamId
        const pulling = phase === 'pulling'
        const leanTarget = Math.min(0.15, 0.04 + (teamState?.pullRate || 0) * 0.001)
        const spots = VIEWER_SPOTS[teamId]
        const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
        viewerSlots[teamId].forEach((slot, i) => {
          const member = visible[i]
          if (!member) { slot.group.visible = false; slot.userId = null; slot.spawn = 0; return }
          if (slot.userId !== member.userId) {
            // Đổi người: nhân bản ngẫu nhiên 1 trong 6 model 3D + vẽ lại
            // bảng tên + avatar, hiện dần từ nhỏ lên.
            slot.userId = member.userId
            if (slot.entry) slot.holder.remove(slot.entry.group)
            slot.modelSlot = pickRandomModel()
            slot.entry = buildHumanEntry(teamId, slot.modelSlot, i)
            slot.holder.add(slot.entry.group)
            slot.nameTag.draw(member.nickname)
            slot.avatarTag.draw(member.nickname, member.avatar || '')
            slot.spawn = 0
          }
          let entry = slot.entry
          if (!entry) return
          // Model 3D tải chậm (khán giả vào lúc model chưa tải xong thì lúc
          // đầu chỉ là người dự phòng) — model về tới thì đổi sang người
          // thật, giữ nguyên model đã bốc (không bốc lại cho khỏi đổi mặt).
          // Giới hạn 3 lần thử như người mẫu (tránh tháo/dựng vô hạn).
          if (entry.isFallback && slot.modelSlot && modelCache.has(slot.modelSlot.file) && (realBuildTries.get(slot.modelSlot.file) || 0) < 3) {
            slot.holder.remove(entry.group)
            slot.entry = buildHumanEntry(teamId, slot.modelSlot, i)
            slot.holder.add(slot.entry.group)
            entry = slot.entry
          }
          slot.spawn = Math.min(1, slot.spawn + dt * 2.5)
          const spot = spots[i]
          // Khán giả cũng DI CHUYỂN THEO DÂY như người mẫu (cùng 1 khoảng
          // smoothRopeX) để tay vẫn nắm đúng dây khi đội bị kéo về sau.
          let x = spot.x + smoothRopeX
          let y = 0
          // Ngửa người theo lực kéo (giống người mẫu, mượt dần).
          slot.smoothLean = (slot.smoothLean ?? 0) + (leanTarget - (slot.smoothLean ?? 0)) * damp(3)
          let rotZ = teamId === 'A' ? slot.smoothLean : -slot.smoothLean
          if (isLoser) {
            // Đội thua: khán giả cũng bị kéo tuột vào hố bùn cùng người mẫu.
            // Bắt đầu từ chỗ đang bị kéo tới (x đã cộng smoothRopeX).
            const delay = i * 0.18
            const ft = Math.min(1, Math.max(0, (now - roundEndStart - delay) / 1.1))
            const dragT = ft * ft
            const pitX = (teamId === 'A' ? 0.9 : -0.9) + (i - 1) * 0.8
            x = x + (pitX - x) * dragT
            y = -0.22 * ft
            const c1 = 1.70158, c3 = c1 + 1
            const ob = 1 + c3 * Math.pow(ft - 1, 3) + c1 * Math.pow(ft - 1, 2)
            rotZ = (teamId === 'A' ? 1 : -1) * 1.35 * ob
            // Bùn văng lên dính vào người (như người mẫu).
            const spotT = Math.min(1, Math.max(0, (ft - 0.55) / 0.45))
            ;(entry.mudSpots || []).forEach((s, j) => {
              const sv = Math.min(1, Math.max(0, (spotT - j * 0.12) / 0.5))
              s.scale.setScalar(Math.max(0.001, sv * s.userData.baseR))
            })
          } else if (isWinner && phase !== 'waiting') {
            y = Math.abs(Math.sin(time * 6 + i)) * 0.4
          } else if (pulling && !entry.mixer) {
            y = Math.abs(Math.sin(time * 9 + i * 2)) * 0.08
          }
          slot.group.visible = true
          slot.group.position.set(x, y, spot.z)
          slot.group.rotation.set(0, 0, rotZ)
          slot.group.scale.setScalar(Math.max(0.001, easeOutBack(slot.spawn)))
          // Clip + dáng kéo y hệt người mẫu (idle/dance + gồng sức).
          if (entry.mixer) {
            let want = 'idle'
            if (isWinner && phase !== 'waiting') want = 'dance'
            else if (isLoser) want = 'idle'
            else if (pulling) want = 'idle'
            setClip(entry, want)
            entry.mixer.update(dt)
            const targetW = pulling && !isLoser ? Math.max(0.7, Math.min(1, Math.max(0, ((teamState?.pullRate || 0) - 0.3) / 0.7))) : 0
            // Ngã xuống bùn thì tay BUÔNG NHANH (tốc độ 8 thay vì 1,5):
            // người té mà tay vẫn gồng cứng dáng kéo trong lúc người ngửa
            // ra sau thì tay nhìn như bẻ ngược ra sau. Tay buông lỏng theo
            // dáng idle thì té mới tự nhiên.
            const poseRate = isLoser ? 8 : (targetW > entry.poseWeight ? 4 : 1.5)
            entry.poseWeight += (targetW - entry.poseWeight) * damp(poseRate)
            const rockAmp = 0.5 + Math.min(1, (teamState?.pullRate || 0) * 0.15)
            applyPullPose(entry, time, rockAmp, entry.poseWeight)
          }
        })
      }
      // Bụi tan dần
      for (const d of dustPool) {
        if (d.life > 0) {
          d.life -= dt
          d.mesh.material.opacity = Math.max(0, d.life * 0.9)
          d.mesh.position.y += dt * 0.5
          d.mesh.scale.setScalar(1 + (0.5 - d.life))
        }
      }
      // Bùn văng: bay lên rồi rơi xuống
      for (const s of splashPool) {
        if (s.life > 0) {
          s.life -= dt
          s.mesh.position.x += s.vx * dt
          s.mesh.position.y += s.vy * dt
          s.mesh.position.z += s.vz * dt
          s.vy -= 9 * dt
          s.mesh.material.opacity = Math.max(0, s.life)
          if (s.mesh.position.y < 0.1) { s.mesh.position.y = 0.1; s.vy = 0 }
        }
      }
      // Gợn sóng trên mặt bùn: lan ra rồi tan
      for (const r of ripplePool) {
        if (r.life > 0) {
          r.life -= dt
          r.mesh.scale.setScalar(r.mesh.scale.x + dt * 3.2)
          r.mesh.material.opacity = Math.max(0, (r.life / 0.8) * 0.75)
        }
      }
      // Giấy màu rơi
      for (const c of confettiPool) {
        if (c.life > 0) {
          c.life -= dt
          c.mesh.position.y -= c.vy * dt
          c.mesh.rotation.z += c.spin * dt
          c.mesh.rotation.x += c.spin * 0.7 * dt
          c.mesh.material.opacity = Math.max(0, Math.min(1, c.life))
        }
      }

      // ── Tự chữa nhân vật bị lật / biến mất ──
      // Hông Mixamo lúc nghỉ ≈ -1,5 rad, kéo co -1,6, múa cũng trong
      // khoảng này; nếu hông xoay quá giới hạn (tích lũy góc do clip
      // không reset xương, hoặc NaN) thì nhân vật đã lật xuống đất — dựng
      // lại nhân vật đó từ model đã tải. Kiểm tra 2 giây/lần, tối đa 2
      // lần/người — quá thì giữ người dự phòng (tránh dựng vô hạn).
      if (time - lastHealthCheck > 2) {
        lastHealthCheck = time
        for (const [key, e] of humanMeshes) {
          if (e.isFallback || !e.bones?.hips) continue
          const hr = e.bones.hips.rotation
          const bad = !Number.isFinite(hr.x) || !Number.isFinite(hr.y) || !Number.isFinite(hr.z)
            || hr.x < -4 || hr.x > 2
          if (!bad) continue
          const n = (healTries.get(key) || 0) + 1
          healTries.set(key, n)
          console.warn('[CHAR-HEAL]', key, 'hips=', hr.toArray().slice(0, 3).map((v) => +v.toFixed(2)), 'lần', n)
          scene.remove(e.group)
          humanMeshes.delete(key)
          if (n >= 2) forceFallbackKeys.add(key)
        }
      }

      // ── Camera: toàn cảnh lúc kéo, hết màn quay cận 2 chặng ──
      // Hết màn: 4 giây đầu camera trượt lại gần hố bùn để xem rõ đội thua
      // té xuống bùn ra sao (bùn văng, người lấm lem); từ giây thứ 4 trở đi
      // camera chạy sang đội thắng để xem họ ăn mừng (nhảy + vẫy tay).
      // Sang màn mới thì trượt ra lại toàn cảnh. Ngã xuống bùn thì camera
      // rung nhẹ 1 cái.
      // Quà to (≥25 lực): lúc đang kéo, camera quay cận từng người của đội
      // được tặng, từ trước (gần hố bùn nhất) ra sau, mỗi người ~1,2 giây
      // (tổng 3,6 giây), rồi trượt về toàn cảnh.
      const GIFT_CAM_SEG = 1.2 // mỗi người được quay cận ~1,2 giây
      const GIFT_CAM_SECONDS = GIFT_CAM_SEG * 3 // 3 người/đội → 3,6 giây
      shake *= Math.exp(-5 * dt)
      const sway = Math.sin(time * 0.15) * 0.25
      const giftCam = st.giftCam
      const giftAge = giftCam ? now - giftCam.at : -1
      // Tốc độ trượt camera: mặc định 2,2; camera quà phải tới nơi
      // nhanh trong mỗi đoạn 1,2s (không thì hết đoạn vẫn còn đang
      // trượt, nhân vật trôi ngang khung hình, avatar lệch ra mép).
      let camDamp = 2.2
      if (phase === 'pulling' && giftCam && giftAge >= 0 && giftAge < GIFT_CAM_SECONDS) {
        // Avatar (tên + ảnh đại diện) CHỈ có trên nhân vật KHÁN GIẢ
        // (VIEWER_SPOTS); người mẫu (TEAM_SPOTS) không có bảng tên.
        // Quay cận TEAM_SPOTS nên avatar toàn nằm lệch ra mép khung
        // hình, bị mép màn hình + vệt bùn che mất (tấn báo 2026-11-20).
        // Đội có khán giả thì quay VIEWER_SPOTS để avatar vào giữa
        // khung (chỉ quay đúng số khán giả đang hiện, khỏi quay chỗ
        // trống); chưa có ai vào đội thì giữ TEAM_SPOTS (quay người mẫu).
        const viewerCount = visibleMembers(st, giftCam.teamId, VIEWER_CAP).length
        const spots = viewerCount > 0
          ? (VIEWER_SPOTS[giftCam.teamId] || VIEWER_SPOTS.A)
          : (TEAM_SPOTS[giftCam.teamId] || TEAM_SPOTS.A)
        const spotCount = viewerCount > 0 ? viewerCount : spots.length
        const idx = Math.min(spotCount - 1, Math.floor(giftAge / GIFT_CAM_SEG))
        camDamp = 6
        const spot = spots[idx]
        // Đội Đỏ nhìn về +X, đội Xanh nhìn về -X — camera đứng chếch về
        // phía mặt họ (hướng về giữa sân + hơi lệch ra trước) để thấy mặt
        // lúc quay cận. Người kéo theo dây (smoothRopeX) nên cộng vào.
        // Quà to thì cam lại gần + thấp hơn (khác biệt, đẹp hơn, gần mặt
        // hơn để thấy rõ cảm xúc) — quà nhỏ thì giữ khoảng cách thường.
        // Ngắm cao (y=1,7, ngang đầu) để tên + avatar trên đầu nhân vật
        // lọt vào giữa khung hình (ô trống của bùn dính ống kính) — ngắm
        // thấp (ngang hông) thì avatar bị đẩy lên mép trên, bùn che mất.
        const dir = giftCam.teamId === 'A' ? 1 : -1
        const mx = spot.x + smoothRopeX
        if (giftCam.big) {
          tmpCamPos.set(mx + dir * 1.8, 1.7, spot.z + 3.2)
          tmpLook.set(mx, 1.7, spot.z)
        } else {
          tmpCamPos.set(mx + dir * 2.2, 2.0, spot.z + 4.2)
          tmpLook.set(mx, 1.7, spot.z)
        }
      } else if ((phase === 'roundEnd' || phase === 'matchEnd') && loserTeam) {
        const endElapsed = now - roundEndStart
        if (endElapsed < 4) {
          // Chặng 1 (0–4s): đội thua té bùn. Đội thua bị kéo về phía đội
          // thắng: A thua thì nằm bên phải hố (+X), B thua thì nằm bên
          // trái (-X). Camera đứng phía ngược lại để thấy mặt + cả người
          // họ lúc té.
          const ls = loserTeam === 'A' ? 1 : -1
          tmpCamPos.set(-ls * 4.2, 3.0, 11.0)
          tmpLook.set(ls * 0.7, 0.35, 0)
        } else {
          // Chặng 2 (từ 4s trở đi): đội thắng ăn mừng. ws = phía đội thắng
          // (A ở -X, B ở +X). Đội thắng đứng ở ±4,0–6,6 (giữa đội ±5,3)
          // nên camera nhìn về ±5,3 để thấy mặt họ lúc nhảy ăn mừng.
          const ws = winnerTeam === 'A' ? -1 : 1
          tmpCamPos.set(-ws * 3.0, 2.8, 12.0)
          tmpLook.set(ws * 5.3, 1.0, 0)
        }
      } else {
        tmpCamPos.set(camBase.x + sway, camBase.y, camBase.z + Math.abs(rope) * 1.5)
        tmpLook.copy(lookTarget)
      }
      curCamPos.lerp(tmpCamPos, damp(camDamp))
      curLook.lerp(tmpLook, damp(camDamp))
      camera.position.set(
        curCamPos.x + (Math.random() - 0.5) * shake,
        curCamPos.y + (Math.random() - 0.5) * shake * 0.6,
        curCamPos.z,
      )
      camera.lookAt(curLook)

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(animate)

    const onResize = () => {
      const w = mount.clientWidth || 360
      const h = mount.clientHeight || 600
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      pmrem.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((mm) => mm.dispose())
        }
      })
    }
  }, [liveRef])

  return <div ref={mountRef} className="pml-scene" />
}
