// ─── PET MARATHON LIVE · RaceScene.jsx ─────────────────────────────────────
// Đường đua 3D bằng Three.js: thú chibi low-poly dựng từ hình khối
// (box/sphere/capsule, không model ngoài), camera đi theo nhóm dẫn đầu.
// Giữ nhẹ cho điện thoại: vật liệu đơn giản, ít đa giác, không bóng đổ,
// không màn hình phản chiếu. Đọc trực tiếp state engine qua liveRef mỗi khung
// hình nên chuyển động mượt mà không cần React render lại.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneModel } from 'three/addons/utils/SkeletonUtils.js'

const SCALE = 0.6 // 1 mét = 0,6 đơn vị 3D
const LANE_Z = (lane) => (lane - 2.5) * 2.4
const PET_COLORS = {
  cat: 0xff9f43, dog: 0xb08954, rabbit: 0xf5f0ff,
  beaver: 0xe8a04c, duck: 0xffd60a, panda: 0xe8e8e8,
}

// Model 3D khối vuông (Kenney Cube Pets) — file .glb trong public/models.
// Vịt dùng gà con khối vuông làm vịt con; hải ly thay cho hamster
// (file hamster Sneznyj tải không được vì CDN itch.io bị chặn).
const PET_MODEL_URLS = {
  cat: '/models/animal-cat.glb',
  dog: '/models/animal-dog.glb',
  rabbit: '/models/animal-bunny.glb',
  beaver: '/models/animal-beaver.glb',
  duck: '/models/animal-chick.glb',
  panda: '/models/animal-panda.glb',
}
const MODEL_SCALE = 0.9
// Model quay mặt +Z (chân trước ở +Z, đuôi ở -Z); đường đua chạy theo +X
// nên xoay 90° để mặt hướng về đích.
const MODEL_FACE_Y = Math.PI / 2

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts })
}

function makePet(petId, colorHex) {
  const g = new THREE.Group()
  const color = new THREE.MeshLambertMaterial({ color: colorHex })
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 })
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const pink = new THREE.MeshLambertMaterial({ color: 0xff9fb0 })

  // Thân (hơi dẹt, nằm ngang) + đầu tròn phía trước
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), color)
  body.scale.set(1.25, 0.85, 0.9)
  body.position.y = 0.55
  g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), color)
  head.position.set(0.55, 0.85, 0)
  g.add(head)
  // Mắt to tròn + má hồng
  for (const z of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), dark)
    eye.position.set(0.9, 0.95, z)
    g.add(eye)
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pink)
    cheek.position.set(0.82, 0.78, z * 1.4)
    g.add(cheek)
  }
  // Tai / mỏ theo từng loài
  const legs = []
  if (petId === 'cat') {
    for (const z of [-0.18, 0.18]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 4), color)
      ear.position.set(0.5, 1.28, z)
      ear.rotation.x = z > 0 ? -0.25 : 0.25
      g.add(ear)
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.7, 6), color)
    tail.position.set(-0.75, 0.75, 0)
    tail.rotation.z = 0.9
    g.add(tail)
  } else if (petId === 'dog') {
    for (const z of [-0.2, 0.2]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.1), dark)
      ear.position.set(0.48, 1.05, z)
      ear.rotation.z = 0.3
      g.add(ear)
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6), color)
    tail.position.set(-0.7, 0.8, 0)
    tail.rotation.z = 1.1
    g.add(tail)
  } else if (petId === 'rabbit') {
    for (const z of [-0.14, 0.14]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 3, 6), color)
      ear.position.set(0.45, 1.5, z)
      ear.rotation.z = -0.25
      g.add(ear)
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), white)
    tail.position.set(-0.72, 0.6, 0)
    g.add(tail)
  } else if (petId === 'beaver') {
    for (const z of [-0.2, 0.2]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), color)
      ear.position.set(0.5, 1.22, z)
      g.add(ear)
    }
    // Đuôi dẹt đặc trưng của hải ly
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), color)
    tail.scale.set(1.6, 0.25, 0.9)
    tail.position.set(-0.78, 0.45, 0)
    g.add(tail)
    // Răng cửa to
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.2), white)
    tooth.position.set(0.82, 0.62, 0)
    g.add(tooth)
  } else if (petId === 'duck') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), new THREE.MeshLambertMaterial({ color: 0xff7b00 }))
    beak.position.set(0.95, 0.82, 0)
    beak.rotation.z = -Math.PI / 2
    g.add(beak)
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), white)
    wing.scale.set(1.2, 0.7, 0.5)
    wing.position.set(-0.05, 0.65, 0.42)
    g.add(wing)
  } else { // panda
    for (const z of [-0.2, 0.2]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), dark)
      ear.position.set(0.48, 1.24, z)
      g.add(ear)
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), dark)
      patch.scale.set(0.6, 1, 1)
      patch.position.set(0.88, 0.95, z)
      g.add(patch)
    }
  }
  // 4 chân ngắn, xoay được để chạy
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.34, 6)
  for (const [x, z] of [[0.35, -0.28], [0.35, 0.28], [-0.4, -0.28], [-0.4, 0.28]]) {
    const leg = new THREE.Mesh(legGeo, dark)
    leg.position.set(x, 0.18, z)
    g.add(leg)
    legs.push(leg)
  }
  g.userData.legs = legs
  g.userData.head = head
  return g
}

function makeStatusVisuals() {
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0x5ac8fa, transparent: true, opacity: 0.3 }),
  )
  shield.position.y = 0.7
  shield.visible = false
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.5, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }),
  )
  net.position.y = 0.75
  net.visible = false
  const ice = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 16),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 }),
  )
  ice.rotation.x = -Math.PI / 2
  ice.position.y = 0.02
  ice.visible = false
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6b00, transparent: true, opacity: 0.9 }),
  )
  flame.rotation.z = Math.PI / 2
  flame.position.set(-0.95, 0.6, 0)
  flame.visible = false
  const stars = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd60a }))
    stars.add(s)
  }
  stars.position.y = 1.45
  stars.visible = false
  return { shield, net, ice, flame, stars }
}

export default function RaceScene({ liveRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || 360
    const height = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.Fog(0x87ceeb, 40, 140)
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 300)
    camera.position.set(-8, 7, 11)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7c59, 0.95))
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.1)
    sun.position.set(-6, 14, 8)
    scene.add(sun)

    // ── Mặt đất + đường đua ──
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), mat(0x6abe6a))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(100, -0.05, 0)
    scene.add(ground)
    const track = new THREE.Mesh(new THREE.PlaneGeometry(300, 15.5), mat(0xd9a066))
    track.rotation.x = -Math.PI / 2
    track.position.set(110, -0.05, 0) // thấp hơn mặt đường nhựa (y=0,02) để không tranh nhau
    scene.add(track)
    // Vạch làn
    for (let l = 1; l < 6; l++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(280, 0.02, 0.09), mat(0xffffff))
      line.position.set(110, 0.04, (l - 3) * 2.4)
      scene.add(line)
    }
    // Cổng xuất phát (cổng về đích dùng vòm Kenney bên dưới)
    const gantry = (x, color) => {
      const grp = new THREE.Group()
      for (const z of [-7.8, 7.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), mat(color))
        post.position.set(0, 2.5, z)
        grp.add(post)
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 16.2), mat(color))
      bar.position.set(0, 5.2, 0)
      grp.add(bar)
      grp.position.x = x
      scene.add(grp)
    }
    gantry(-6, 0x2f9e44)
    // ── Bối cảnh đường đua: model GLB (Kenney Racing, Quaternius, Gobkit) ──
    // Camera nhìn từ z dương về phía z âm nên đồ đẹp đặt hết ở phía xa (z âm).
    const envGroup = new THREE.Group()
    scene.add(envGroup)
    const envLoader = new GLTFLoader()
    const placeEnv = (url, list) => {
      envLoader.loadAsync(url).then((gltf) => {
        for (const t of list) {
          const c = gltf.scene.clone()
          c.position.set(t.x, t.y ?? 0, t.z)
          c.rotation.y = t.ry ?? 0
          const s = t.s ?? 0.6
          c.scale.set(t.sx ?? s, t.sy ?? s, t.sz ?? s)
          envGroup.add(c)
        }
      }).catch(() => { /* thiếu file thì cảnh đó trống */ })
    }
    // Mặt đường nhựa: 39 miếng Kenney, mỗi miếng dài 6 đơn vị, rộng 15,5.
    // Miếng dày 0,45 nên chìm xuống -0,43 cho mặt đường ở y=0,02 (trên nền nâu).
    const roadTiles = []
    for (let i = 0; i < 39; i++) {
      const x = -3 + i * 6
      if (x > 228) continue // chừa chỗ cho cổng về đích
      roadTiles.push({ x, y: -0.43, z: 0, sx: 0.6, sy: 0.6, sz: 1.55 })
    }
    placeEnv('/track/track-straight.glb', roadTiles)
    // Cổng về đích Kenney (xoay 90° cho vòm bắc ngang đường)
    placeEnv('/track/track-finish.glb', [{ x: 234, y: -0.43, z: 0, ry: Math.PI / 2, sx: 1.11, sy: 0.79, sz: 0.6 }])
    // Lều + rừng dọc phía xa
    placeEnv('/track/track-tents.glb', [
      { x: 45, z: -12.5 }, { x: 95, z: -12.5 }, { x: 145, z: -12.5 }, { x: 195, z: -12.5 },
    ])
    placeEnv('/track/decoration-forest.glb', [
      { x: 40, z: -18 }, { x: 90, z: -18 }, { x: 140, z: -18 }, { x: 190, z: -18 }, { x: 222, z: -18 },
    ])
    // Cây Kenney rải hai bên
    const treeUrls = ['/track/tree-default.glb', '/track/tree-cone.glb', '/track/tree-oak.glb', '/track/tree-pine-tall-a.glb']
    const treeSpots = []
    for (let i = 0; i < 18; i++) {
      treeSpots.push({ x: -8 + i * 13 + (i % 3) * 2, z: (i % 2 ? 1 : -1) * (10.5 + (i % 4) * 2), ry: (i * 1.3) % 6.28, s: 1.4 })
    }
    treeUrls.forEach((u, k) => placeEnv(u, treeSpots.filter((_, i) => i % 4 === k)))
    // Cờ + đèn đường dọc đường đua
    const flagSpots = []
    for (let i = 0; i < 14; i++) flagSpots.push({ x: 4 + i * 17, z: (i % 2 ? 1 : -1) * 8.6, ry: (i % 2 ? Math.PI : 0) })
    placeEnv('/track/quaternius-flag.glb', flagSpots)
    placeEnv('/track/quaternius-goal-flag.glb', [{ x: -4, z: -8.6 }, { x: -4, z: 8.6 }])
    const lightSpots = []
    for (let i = 0; i < 8; i++) lightSpots.push({ x: 15 + i * 30, z: (i % 2 ? 1 : -1) * 8.6, s: 1.2 })
    placeEnv('/track/quaternius-streetlight.glb', lightSpots)
    // Bảng quảng cáo phía xa
    placeEnv('/track/ad-board.glb', [
      { x: 50, z: -10.5 }, { x: 110, z: -10.5 }, { x: 170, z: -10.5 }, { x: 220, z: -10.5 },
    ])
    // Núi + đồi xa (Gobkit, đơn vị cm nên scale nhỏ)
    placeEnv('/track/gobkit-MountainFar001.glb', [
      { x: -30, z: -75, s: 0.02 }, { x: 60, z: -80, s: 0.024 }, { x: 150, z: -78, s: 0.02 }, { x: 240, z: -76, s: 0.026 },
    ])
    placeEnv('/track/gobkit-MountainFar002.glb', [
      { x: 20, z: -85, s: 0.022 }, { x: 110, z: -85, s: 0.02 }, { x: 200, z: -84, s: 0.024 },
    ])
    placeEnv('/track/gobkit-Hill001.glb', [
      { x: -10, z: -45, s: 0.02 }, { x: 80, z: -45, s: 0.02 }, { x: 180, z: -45, s: 0.018 },
    ])
    placeEnv('/track/gobkit-Hill002.glb', [
      { x: 30, z: -45, s: 0.02 }, { x: 130, z: -45, s: 0.02 }, { x: 220, z: -45, s: 0.018 },
    ])
    // Cọc tiêu gần vạch xuất phát / về đích
    placeEnv('/track/construction-cone.glb', [
      { x: -4, z: -6.5, s: 5 }, { x: -4, z: 6.5, s: 5 }, { x: 232, z: -6.5, s: 5 }, { x: 232, z: 6.5, s: 5 },
    ])
    // Khán đài (vẽ bằng hình khối, ở phía xa để không che thú) + khán giả.
    // Không có khán đài CC0 nào tải được (bản duy nhất có chữ KLYO) nên tự vẽ.
    const crowdStands = []
    const makeGrandstand = (x, z) => {
      const g = new THREE.Group()
      const base = new THREE.Mesh(new THREE.BoxGeometry(15, 1, 4.5), mat(0x3b5bdb))
      base.position.y = 0.5
      g.add(base)
      for (let r = 0; r < 3; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(15, 0.6, 1.2), mat(0x4a6fa5))
        step.position.set(0, 1.3 + r * 0.6, -1.5 + r * 1.2)
        g.add(step)
      }
      for (const px of [-7, 7]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), mat(0x495057))
        post.position.set(px, 4.6, -1)
        g.add(post)
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.25, 5.4), mat(0xe03131))
      roof.position.set(0, 6.4, -0.6)
      g.add(roof)
      const count = 36
      const crowd = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.55, 0.55, 0.55),
        new THREE.MeshLambertMaterial({ color: 0xffffff }),
        count,
      )
      const dummy = new THREE.Object3D()
      const palette = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2, 0xff922b, 0xffffff, 0x15aabf]
      const basePos = []
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 12)
        const col = i % 12
        const p = new THREE.Vector3(-6.5 + col * 1.18, 1.9 + row * 0.6, -1.5 + row * 1.2)
        basePos.push(p)
        dummy.position.copy(p)
        dummy.updateMatrix()
        crowd.setMatrixAt(i, dummy.matrix)
        crowd.setColorAt(i, new THREE.Color(palette[i % palette.length]))
      }
      crowd.instanceMatrix.needsUpdate = true
      if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true
      g.add(crowd)
      g.position.set(x, 0, z)
      scene.add(g)
      crowdStands.push({ mesh: crowd, base: basePos, dummy })
    }
    makeGrandstand(12, -14)
    makeGrandstand(212, -14)
    // Mây trang trí (nhẹ)
    const decor = new THREE.Group()
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group()
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 8, 6), mat(0xffffff, { transparent: true, opacity: 0.9 }))
        puff.position.set(j * 1.8 - 1.8, Math.random() * 0.5, 0)
        cloud.add(puff)
      }
      cloud.position.set(-5 + Math.random() * 240, 13 + Math.random() * 5, -18 - Math.random() * 8)
      decor.add(cloud)
    }
    scene.add(decor)

    // ── Pool vật thể động ──
    const petMeshes = new Map() // racerId -> { group, status, mixer, clips, currentClip, currentAction, isPrimitive }
    const coinMeshes = new Map()
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12)
    const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd60a, emissive: 0x664400 })
    const fxMeshes = new Map()
    const dustPool = []
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }))
      scene.add(d)
      dustPool.push({ mesh: d, life: 0 })
    }
    let dustIdx = 0
    // Tải trước model khối vuông; tải xong mới đổi thú từ bản hình khối sang model.
    const modelCache = new Map() // petId -> { scene, clips: Map<tenThuong, clip> }
    const gltfLoader = new GLTFLoader()
    for (const [petId, url] of Object.entries(PET_MODEL_URLS)) {
      gltfLoader.loadAsync(url).then((gltf) => {
        const clips = new Map()
        for (const c of gltf.animations || []) clips.set(c.name.toLowerCase(), c)
        modelCache.set(petId, { scene: gltf.scene, clips })
      }).catch(() => { /* thiếu file thì thú đó dùng bản vẽ bằng hình khối */ })
    }

    const getPetMesh = (racer) => {
      let entry = petMeshes.get(racer.id)
      // Model vừa tải xong mà thú đang dùng bản hình khối thì đổi sang model thật.
      if (entry?.isPrimitive && modelCache.has(racer.petId)) {
        scene.remove(entry.group)
        petMeshes.delete(racer.id)
        entry = null
      }
      if (entry) return entry
      const model = modelCache.get(racer.petId)
      const group = new THREE.Group()
      const status = makeStatusVisuals()
      group.add(status.shield, status.net, status.ice, status.flame, status.stars)
      if (model) {
        const clone = cloneModel(model.scene)
        const inner = new THREE.Group()
        inner.rotation.y = MODEL_FACE_Y
        inner.scale.setScalar(MODEL_SCALE)
        inner.add(clone)
        group.add(inner)
        const mixer = new THREE.AnimationMixer(clone)
        entry = { group, status, mixer, clips: model.clips, currentClip: null, currentAction: null, isPrimitive: false }
      } else {
        const pet = makePet(racer.petId, PET_COLORS[racer.petId] ?? 0xff9f43)
        group.add(pet)
        group.userData.legs = pet.userData.legs
        entry = { group, status, mixer: null, clips: null, currentClip: null, currentAction: null, isPrimitive: true }
      }
      scene.add(group)
      petMeshes.set(racer.id, entry)
      return entry
    }

    // Chọn động tác theo tên (không phân biệt hoa/thường) + dự phòng khi thiếu clip.
    const pickClip = (entry, want) => {
      if (!entry.clips) return null
      const order = {
        run: ['run', 'walk', 'idle', 'static'],
        walk: ['walk', 'run', 'idle', 'static'],
        idle: ['idle', 'static'],
        dance: ['dance', 'idle', 'static'],
      }
      for (const name of (order[want] || [want, 'idle', 'static'])) {
        const clip = entry.clips.get(name)
        if (clip) return clip
      }
      return entry.clips.values().next().value || null
    }
    // Đổi động tác mượt (fade 0,15s); trùng clip thì giữ nguyên.
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

    const getFxMesh = (fx) => {
      let m = fxMeshes.get(fx.id)
      if (m) return m
      if (fx.kind === 'banana' || fx.kind === 'bananaRain') {
        m = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.14, 6, 10, Math.PI * 1.2), mat(0xffe135))
      } else if (fx.kind === 'melon' || fx.kind === 'melonStorm') {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mat(0x2f9e44))
        const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1d6b2f, wireframe: true, transparent: true, opacity: 0.5 }))
        m.add(stripe)
      } else if (fx.kind === 'glove') {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), mat(0xe03131))
      } else if (fx.kind === 'net') {
        m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }))
      } else if (fx.kind === 'shieldBlock') {
        m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5ac8fa, transparent: true, opacity: 0.4 }))
      } else {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat(0xffd60a))
      }
      scene.add(m)
      fxMeshes.set(fx.id, m)
      return m
    }

    let raf = 0
    let lastT = performance.now()
    const camTarget = new THREE.Vector3(-8, 7, 11)
    const lookTarget = new THREE.Vector3(-2, 0.6, 0)
    // Giá trị đã làm mượt (giữ qua các khung hình): điểm giữa đoàn đua và
    // độ giãn của đoàn. Làm mượt cả hai để camera không giật khi đổi người
    // dẫn đầu hay khi 1 thú bị ném chiêu tụt lại đột ngột.
    let smoothMidX = -6
    let smoothSpread = 0

    const animate = (t) => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(0.1, (t - lastT) / 1000)
      lastT = t
      const time = t / 1000
      const st = liveRef.current
      if (!st) { renderer.render(scene, camera); return }
      const now = st.now ?? 0

      // ── Thú ──
      const alive = new Set()
      for (const r of st.racers || []) {
        alive.add(r.id)
        const entry = getPetMesh(r)
        const { group, status } = entry
        const isModel = !entry.isPrimitive
        const x = r.dist * SCALE - 6
        const z = LANE_Z(r.lane) + (r.lateral || 0)
        const running = st.phase === 'racing' && !r.finished
        const speedF = Math.min(1.6, (r.speed || 0) / 9)
        // Nảy khi chạy — model thật đã có clip chạy nên bỏ nảy thủ công,
        // chỉ giữ các hiệu ứng ngã/bay/quay (xoay cả nhóm).
        let y = 0
        let rotX = 0, rotY = 0, rotZ = 0
        if (r.anim === 'slip') { // ngã sấp mặt, xoay người
          rotZ = -1.2 * Math.sin(Math.min(1, (r.animUntil - now) / 1.4) * Math.PI)
          y = 0.15
        } else if (r.anim === 'fly') { // bay ngược
          y = 0.9 * Math.sin(Math.min(1, (r.animUntil - now)) * Math.PI)
          rotX = -0.5
        } else if (r.anim === 'dizzy') { // quay vòng vòng
          rotY = time * 9
          y = 0.1
        } else if (r.anim === 'celebrate') { // nhảy mừng (model thật dùng clip dance)
          if (!isModel) y = Math.abs(Math.sin(time * 6)) * 0.55
        } else if (r.anim === 'cry') { // khóc: cúi đầu
          rotX = 0.35
        } else if (r.anim === 'slide') {
          rotZ = Math.sin(time * 4) * 0.12
        } else if (running && !isModel) {
          y = Math.abs(Math.sin(time * 11 + r.lane * 2)) * 0.14 * speedF
        }
        group.position.set(x, y, z)
        group.rotation.set(rotX, rotY, rotZ)
        // Chân chạy — chỉ bản hình khối mới có chân rời để xoay
        if (group.userData.legs) {
          const swing = running ? Math.sin(time * 12 + r.lane * 1.5) * 0.7 * speedF : 0
          group.userData.legs.forEach((leg, i) => {
            leg.rotation.x = (i % 2 === 0 ? swing : -swing) * (i < 2 ? 1 : 0.8)
          })
        }
        // Động tác theo trạng thái: chạy thì chạy, đứng yên thì đứng yên.
        // Đua bình thường -> run; bị chậm (chuối/băng) -> walk; bị lưới/băng
        // cứng, chờ/về đích -> idle; thắng -> dance.
        if (entry.mixer) {
          const stt = r.st || {}
          let want = 'idle'
          if (r.anim === 'celebrate') want = 'dance'
          else if (running) {
            if (now < (stt.trappedUntil || 0) || now < (stt.iceUntil || 0)) want = 'idle'
            else if (now < (stt.slowUntil || 0)) want = 'walk'
            else want = 'run'
          }
          setClip(entry, want)
          entry.mixer.update(dt)
        }
        // Trạng thái hiển thị
        const s2 = r.st || {}
        status.shield.visible = r.shieldCharges > 0 && now < (s2.shieldUntil || 0)
        status.net.visible = now < (s2.trappedUntil || 0)
        status.ice.visible = now < (s2.iceUntil || 0)
        status.flame.visible = now < (s2.rocketUntil || 0) || now < (s2.boostUntil || 0)
        if (status.flame.visible) status.flame.scale.setScalar(0.8 + Math.sin(time * 20) * 0.25)
        status.stars.visible = now < (s2.dizzyUntil || 0) || r.anim === 'dizzy'
        if (status.stars.visible) {
          status.stars.rotation.y = time * 4
          status.stars.children.forEach((star, i) => {
            const a = (i / 3) * Math.PI * 2 + time * 4
            star.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.55)
          })
        }
        // Bụi chân khi chạy
        if (running && Math.random() < dt * 6) {
          const d = dustPool[dustIdx++ % dustPool.length]
          d.mesh.position.set(x - 0.6, 0.15, z + (Math.random() - 0.5) * 0.5)
          d.mesh.material.opacity = 0.55
          d.life = 0.6
        }
      }
      for (const [id, entry] of petMeshes) {
        if (!alive.has(id)) { scene.remove(entry.group); petMeshes.delete(id) }
      }
      // Bụi tan dần
      for (const d of dustPool) {
        if (d.life > 0) {
          d.life -= dt
          d.mesh.material.opacity = Math.max(0, d.life * 0.9)
          d.mesh.position.y += dt * 0.6
          d.mesh.scale.setScalar(1 + (0.6 - d.life))
        }
      }
      // Khán giả nhấp nhô khi đang đua
      if (st.phase === 'racing') {
        for (const cs of crowdStands) {
          for (let i = 0; i < cs.base.length; i++) {
            const p = cs.base[i]
            cs.dummy.position.set(p.x, p.y + Math.abs(Math.sin(time * 3 + i * 0.7)) * 0.25, p.z)
            cs.dummy.updateMatrix()
            cs.mesh.setMatrixAt(i, cs.dummy.matrix)
          }
          cs.mesh.instanceMatrix.needsUpdate = true
        }
      }
      // ── Xu ──
      const coinAlive = new Set()
      for (const c of st.coins || []) {
        if (c.taken) continue
        coinAlive.add(c.id)
        let m = coinMeshes.get(c.id)
        if (!m) {
          m = new THREE.Mesh(coinGeo, coinMat)
          scene.add(m)
          coinMeshes.set(c.id, m)
        }
        m.position.set(c.dist * SCALE - 6, 0.7 + Math.sin(time * 2 + c.spin) * 0.15, LANE_Z(c.lane))
        m.rotation.y = time * 3 + c.spin
        m.rotation.x = Math.PI / 2
      }
      for (const [id, m] of coinMeshes) {
        if (!coinAlive.has(id)) { scene.remove(m); coinMeshes.delete(id) }
      }
      // ── Hiệu ứng chiêu ──
      const fxAlive = new Set()
      for (const fx of st.effects || []) {
        fxAlive.add(fx.id)
        const m = getFxMesh(fx)
        const target = (st.racers || []).find((r) => r.id === fx.targetId)
        const tx = target ? target.dist * SCALE - 6 : 0
        const tz = target ? LANE_Z(target.lane) : 0
        const p = Math.min(1, (fx.t || 0) / Math.max(0.1, fx.dur || 1))
        if (fx.kind === 'banana') {
          m.position.set(tx + 0.8, 0.25 + Math.sin(p * Math.PI) * 0.5, tz)
          m.rotation.z = p * 6
        } else if (fx.kind === 'bananaRain') {
          m.position.set(tx + Math.sin(fx.id.length) * 4, 5 - p * 5, tz)
        } else if (fx.kind === 'melon' || fx.kind === 'melonStorm') {
          const startX = tx - 12 + (fx.seed || 0) * 6
          m.position.set(startX + p * 14, 0.7, tz + (fx.kind === 'melonStorm' ? Math.sin((fx.seed || 0) * 2) * 3 : 0))
          m.rotation.z = -p * 10
        } else if (fx.kind === 'glove') {
          m.position.set(tx - 6 + p * 6.5, 0.8 + Math.sin(p * Math.PI) * 0.8, tz)
          m.scale.setScalar(1 + p * 0.4)
        } else if (fx.kind === 'net') {
          m.position.set(tx, 0.8, tz)
          m.rotation.y = time * 2
        } else if (fx.kind === 'shieldBlock') {
          m.position.set(tx, 0.8, tz)
          m.scale.setScalar(1 + p)
          m.material.opacity = 0.4 * (1 - p)
        } else {
          m.position.set(tx, 1, tz)
        }
      }
      for (const [id, m] of fxMeshes) {
        if (!fxAlive.has(id)) { scene.remove(m); fxMeshes.delete(id) }
      }

      // ── Camera bám nhóm đua, nới rộng dần khi tốp đầu bỏ xa tốp cuối ──
      // (để thấy đủ 6 thú lúc bị ném chiêu; khung 9:16 hẹp nên chỉ nới vừa phải,
      // lúc đoàn còn chụm thì y hệt như trước)
      // Mượt kiểu điện ảnh: mọi chuyển động đều qua giảm chấn theo thời gian
      // thực (không phụ thuộc khung hình/giây) — cả vị trí camera, hướng nhìn,
      // điểm giữa đoàn và độ giãn đều trôi êm, không còn nhảy khi đổi người
      // dẫn đầu hay khi 1 thú bị đánh tụt lại.
      const racers = st.racers || []
      const lead = racers.length ? Math.max(...racers.map((r) => r.dist)) : 0
      const trail = racers.length ? Math.min(...racers.map((r) => r.dist)) : 0
      const spreadF = Math.min(1, Math.max(0, (lead - trail) / 120))
      const midX = ((lead + trail) / 2) * SCALE - 6
      // damp(lambda): hệ số trôi trong 1 khung hình, lambda càng lớn càng nhanh.
      // 1 - exp(-lambda*dt) cho cùng 1 tốc độ trôi dù máy chạy 30 hay 60 fps.
      const damp = (lambda) => 1 - Math.exp(-lambda * dt)
      smoothMidX += (midX - smoothMidX) * damp(2.0)
      smoothSpread += (spreadF - smoothSpread) * damp(2.0)
      const camX = st.phase === 'waiting' ? -10 : smoothMidX - 9 - smoothSpread * 4
      camTarget.set(camX, 7.2 + smoothSpread * 3, 11.5 + smoothSpread * 5)
      camera.position.lerp(camTarget, damp(3.0))
      const lookX = st.phase === 'waiting' ? -2 : smoothMidX + 6
      lookTarget.x += (lookX - lookTarget.x) * damp(4.5)
      lookTarget.y += (0.6 - lookTarget.y) * damp(4.5)
      lookTarget.z += (0 - lookTarget.z) * damp(4.5)
      camera.lookAt(lookTarget)

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
