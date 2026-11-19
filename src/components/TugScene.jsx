// ─── KÉO CO LIVE · TugScene.jsx ────────────────────────────────────────────
// Sân kéo co 3D bằng Three.js: 2 đội thú khối vuông kéo 1 sợi dây qua hố bùn.
// Giữ nhẹ cho điện thoại: vật liệu đơn giản, ít đa giác, không bóng đổ.
// Đọc trực tiếp state engine qua liveRef mỗi khung hình nên chuyển động mượt
// mà không cần React render lại.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneModel } from 'three/addons/utils/SkeletonUtils.js'
import { TEAMS } from '../game/engine'

// Vị trí 3 thú mỗi đội dọc theo dây (dây chạy theo trục X, hố bùn ở giữa).
const TEAM_SPOTS = {
  A: [{ x: -2.0, z: 0.9 }, { x: -3.3, z: -0.9 }, { x: -4.5, z: 0.2 }],
  B: [{ x: 2.0, z: -0.9 }, { x: 3.3, z: 0.9 }, { x: 4.5, z: -0.2 }],
}
const ROPE_Y = 1.0
const ROPE_RANGE = 3.8 // dây thắng ở |rope| = 0,9 → cờ vượt mép hố bùn (3,2)

const PET_COLORS = {
  cat: 0xff9f43, dog: 0xb08954, rabbit: 0xf5f0ff,
  beaver: 0xe8a04c, duck: 0xffd60a, panda: 0xe8e8e8,
}

// Model 3D khối vuông (Kenney Cube Pets) — file .glb trong public/models.
const PET_MODEL_URLS = {
  cat: '/models/animal-cat.glb',
  dog: '/models/animal-dog.glb',
  rabbit: '/models/animal-bunny.glb',
  beaver: '/models/animal-beaver.glb',
  duck: '/models/animal-chick.glb',
  panda: '/models/animal-panda.glb',
}
const MODEL_SCALE = 0.9
// Model quay mặt +Z; đội Đỏ nhìn về +X (xoay +90°), đội Xanh nhìn về -X (-90°).
const MODEL_FACE_Y = { A: Math.PI / 2, B: -Math.PI / 2 }

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts })
}

function makePet(petId, colorHex) {
  const g = new THREE.Group()
  const color = new THREE.MeshLambertMaterial({ color: colorHex })
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 })
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const pink = new THREE.MeshLambertMaterial({ color: 0xff9fb0 })

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), color)
  body.scale.set(1.25, 0.85, 0.9)
  body.position.y = 0.55
  g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), color)
  head.position.set(0.55, 0.85, 0)
  g.add(head)
  for (const z of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), dark)
    eye.position.set(0.9, 0.95, z)
    g.add(eye)
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pink)
    cheek.position.set(0.82, 0.78, z * 1.4)
    g.add(cheek)
  }
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
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), color)
    tail.scale.set(1.6, 0.25, 0.9)
    tail.position.set(-0.78, 0.45, 0)
    g.add(tail)
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
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.34, 6)
  for (const [x, z] of [[0.35, -0.28], [0.35, 0.28], [-0.4, -0.28], [-0.4, 0.28]]) {
    const leg = new THREE.Mesh(legGeo, dark)
    leg.position.set(x, 0.18, z)
    g.add(leg)
    legs.push(leg)
  }
  g.userData.legs = legs
  return g
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
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.Fog(0x87ceeb, 30, 95)
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 300)
    camera.position.set(0, 6.5, 20.5)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7c59, 0.95))
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.1)
    sun.position.set(-6, 14, 8)
    scene.add(sun)

    // ── Sân cỏ + hố bùn ở giữa ──
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 44), mat(0x6abe6a))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -0.05, 0)
    scene.add(ground)
    // Hố bùn: 2 vòng nâu đậm dần + vài cục bùn ở mép
    const mudOuter = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), mat(0x7a4a21))
    mudOuter.rotation.x = -Math.PI / 2
    mudOuter.position.set(0, 0.01, 0)
    scene.add(mudOuter)
    const mudInner = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), mat(0x5d3717))
    mudInner.rotation.x = -Math.PI / 2
    mudInner.position.set(0, 0.02, 0)
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

    // ── Bối cảnh: model GLB tái dùng từ bộ đường đua cũ ──
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
    // Lều 2 bên sân
    placeEnv('/track/track-tents.glb', [
      { x: -11, z: -9 }, { x: 11, z: -9 },
    ])
    // Rừng 2 góc sau
    placeEnv('/track/decoration-forest.glb', [
      { x: -15, z: -13 }, { x: 15, z: -13 },
    ])
    // Cây rải quanh sân
    const treeUrls = ['/track/tree-default.glb', '/track/tree-cone.glb', '/track/tree-oak.glb', '/track/tree-pine-tall-a.glb']
    const treeSpots = []
    for (let i = 0; i < 10; i++) {
      treeSpots.push({ x: -14 + i * 3.1, z: (i % 2 ? 1 : -1) * (8 + (i % 3) * 2), ry: (i * 1.3) % 6.28, s: 1.3 })
    }
    treeUrls.forEach((u, k) => placeEnv(u, treeSpots.filter((_, i) => i % 4 === k)))
    // Cờ dọc phía sau
    const flagSpots = []
    for (let i = 0; i < 6; i++) flagSpots.push({ x: -12 + i * 4.8, z: -10, ry: (i % 2 ? Math.PI : 0) })
    placeEnv('/track/quaternius-flag.glb', flagSpots)
    // Núi + đồi xa (Gobkit, đơn vị cm nên scale nhỏ)
    placeEnv('/track/gobkit-MountainFar001.glb', [
      { x: -22, z: -55, s: 0.02 }, { x: 0, z: -60, s: 0.024 }, { x: 22, z: -55, s: 0.02 },
    ])
    placeEnv('/track/gobkit-MountainFar002.glb', [
      { x: -11, z: -62, s: 0.022 }, { x: 11, z: -62, s: 0.02 },
    ])
    placeEnv('/track/gobkit-Hill001.glb', [
      { x: -16, z: -28, s: 0.02 }, { x: 16, z: -28, s: 0.02 },
    ])
    placeEnv('/track/gobkit-Hill002.glb', [
      { x: 0, z: -30, s: 0.02 }, { x: -26, z: -30, s: 0.018 },
    ])
    // Mây trang trí
    const decor = new THREE.Group()
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group()
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 8, 6), mat(0xffffff, { transparent: true, opacity: 0.9 }))
        puff.position.set(j * 1.8 - 1.8, Math.random() * 0.5, 0)
        cloud.add(puff)
      }
      cloud.position.set(-18 + Math.random() * 36, 13 + Math.random() * 5, -16 - Math.random() * 8)
      decor.add(cloud)
    }
    scene.add(decor)

    // ── Dây kéo + cờ giữa ──
    const ropeGroup = new THREE.Group()
    const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 9.6, 8), mat(0xc9a227))
    ropeMesh.rotation.z = Math.PI / 2
    ropeGroup.add(ropeMesh)
    // Nút thắt 2 đầu dây
    for (const x of [-4.7, 4.7]) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat(0x8a6d1f))
      knot.position.set(x, 0, 0)
      ropeGroup.add(knot)
    }
    // Cờ giữa dây (đỏ/trắng) — vị trí của nó chính là "điểm số" của trận
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
    const spawnedFx = new Set()

    // Tải trước model khối vuông; tải xong mới đổi thú từ bản hình khối sang model.
    const modelCache = new Map()
    const gltfLoader = new GLTFLoader()
    for (const [petId, url] of Object.entries(PET_MODEL_URLS)) {
      gltfLoader.loadAsync(url).then((gltf) => {
        const clips = new Map()
        for (const c of gltf.animations || []) clips.set(c.name.toLowerCase(), c)
        modelCache.set(petId, { scene: gltf.scene, clips })
      }).catch(() => { /* thiếu file thì thú đó dùng bản vẽ bằng hình khối */ })
    }

    const petMeshes = new Map() // key "A-cat" -> { group, mixer, clips, currentClip, currentAction, isPrimitive }
    const getPetMesh = (teamId, petId) => {
      const key = `${teamId}-${petId}`
      let entry = petMeshes.get(key)
      if (entry?.isPrimitive && modelCache.has(petId)) {
        scene.remove(entry.group)
        petMeshes.delete(key)
        entry = null
      }
      if (entry) return entry
      const group = new THREE.Group()
      const model = modelCache.get(petId)
      if (model) {
        const clone = cloneModel(model.scene)
        const inner = new THREE.Group()
        inner.rotation.y = MODEL_FACE_Y[teamId]
        inner.scale.setScalar(MODEL_SCALE)
        inner.add(clone)
        group.add(inner)
        const mixer = new THREE.AnimationMixer(clone)
        entry = { group, mixer, clips: model.clips, currentClip: null, currentAction: null, isPrimitive: false }
      } else {
        const pet = makePet(petId, PET_COLORS[petId] ?? 0xff9f43)
        if (teamId === 'B') pet.rotation.y = Math.PI // bản hình khối mặt hướng +X, đội Xanh quay lại
        group.add(pet)
        group.userData.legs = pet.userData.legs
        entry = { group, mixer: null, clips: null, currentClip: null, currentAction: null, isPrimitive: true }
      }
      scene.add(group)
      petMeshes.set(key, entry)
      return entry
    }

    const pickClip = (entry, want) => {
      if (!entry.clips) return null
      const order = {
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

    let raf = 0
    let lastT = performance.now()
    let smoothRopeX = 0
    let lastPhase = ''
    let roundEndStart = 0
    let splashDone = false
    const camBase = new THREE.Vector3(0, 6.5, 20.5)
    const lookTarget = new THREE.Vector3(0, 1.1, 0)

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
      ropeGroup.position.x = smoothRopeX
      ropeGroup.rotation.z = -smoothRopeX * 0.012 // dây hơi nghiêng theo hướng kéo
      flagCloth.rotation.y = Math.sin(time * 3) * 0.25 // cờ phấp phới
      for (const b of banners) b.flag.position.x = b.base + Math.sin(time * 2 + (b.teamId === 'A' ? 0 : 2)) * 0.08

      // Ghi lại lúc bắt đầu ăn mừng để tính ngã xuống bùn.
      if (phase !== lastPhase) {
        if (phase === 'roundEnd' || phase === 'matchEnd') { roundEndStart = now; splashDone = false }
        lastPhase = phase
      }
      const loserTeam = phase === 'roundEnd' || phase === 'matchEnd'
        ? (st.roundWinner ? (st.roundWinner === 'A' ? 'B' : 'A') : null)
        : null
      const winnerTeam = phase === 'roundEnd' || phase === 'matchEnd' ? st.roundWinner : null
      const fallT = loserTeam ? Math.min(1, Math.max(0, (now - roundEndStart) / 1.2)) : 0
      if (loserTeam && fallT > 0.5 && !splashDone) {
        splashDone = true
        // Bùn văng lên khi đội thua ngã xuống hố
        for (let i = 0; i < 10; i++) {
          const s = splashPool[splashIdx++ % splashPool.length]
          const a = Math.random() * Math.PI * 2
          s.mesh.position.set((loserTeam === 'A' ? 0.8 : -0.8) + Math.cos(a) * 0.5, 0.3, Math.sin(a) * 0.5)
          s.vx = Math.cos(a) * (1 + Math.random() * 2)
          s.vy = 2 + Math.random() * 2.5
          s.vz = Math.sin(a) * (1 + Math.random() * 2)
          s.mesh.material.opacity = 0.95
          s.life = 0.9
        }
      }
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

      // ── Thú 2 đội ──
      for (const teamId of ['A', 'B']) {
        const teamState = st.teams?.[teamId]
        const pulling = phase === 'pulling' && (teamState?.pullRate || 0) > 1
        const isWinner = winnerTeam === teamId
        const isLoser = loserTeam === teamId
        const lean = Math.min(0.32, (teamState?.pullRate || 0) * 0.05)
        const spots = TEAM_SPOTS[teamId]
        TEAMS[teamId].pets.forEach((petId, i) => {
          const entry = getPetMesh(teamId, petId)
          const { group } = entry
          const spot = spots[i]
          let x = spot.x
          let y = 0
          let rotX = 0
          let rotZ = teamId === 'A' ? lean : -lean
          if (isLoser) {
            // Đội thua bị kéo tuột vào hố bùn, ngã ngửa.
            const pitX = teamId === 'A' ? 0.9 : -0.9
            x = spot.x + (pitX - spot.x) * fallT
            y = -0.25 * fallT
            rotX = -1.25 * fallT
            rotZ = 0
          } else if (isWinner && phase !== 'waiting') {
            if (!entry.mixer) y = Math.abs(Math.sin(time * 6 + i)) * 0.4
          } else if (pulling && !entry.mixer) {
            // Bản hình khối: nhún chân khi đang gồng sức kéo.
            y = Math.abs(Math.sin(time * 9 + i * 2)) * 0.08
          }
          group.position.set(x, y, spot.z)
          group.rotation.set(rotX, 0, rotZ)
          if (group.userData.legs) {
            const swing = pulling ? Math.sin(time * 10 + i * 1.5) * 0.5 : 0
            group.userData.legs.forEach((leg, li) => {
              leg.rotation.x = (li % 2 === 0 ? swing : -swing)
            })
          }
          if (entry.mixer) {
            let want = 'idle'
            if (isWinner && phase !== 'waiting') want = 'dance'
            else if (isLoser) want = 'idle'
            else if (pulling) want = 'walk'
            setClip(entry, want)
            entry.mixer.update(dt)
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

      // ── Camera: đứng yên nhìn toàn sân, hơi đu đưa + lùi ra khi dây căng ──
      const sway = Math.sin(time * 0.15) * 0.4
      camera.position.set(
        camBase.x + sway,
        camBase.y,
        camBase.z + Math.abs(rope) * 1.5,
      )
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
