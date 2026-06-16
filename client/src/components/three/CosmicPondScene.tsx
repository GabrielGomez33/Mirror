// src/components/three/CosmicPondScene.tsx
// Nighttime "cosmic" zen pond (cosmic colorway). Keeps the lily pads and
// butterflies of the day pond but sets them on still moonlit water beneath a
// galaxy: a nebula sky dome (procedural canvas texture), dense twinkling stars,
// named constellations, and a glowing moon with a reflection on the water.
// Rendered by ZenPondScene2 when theme === 'cosmic'.
import { useEffect } from 'react';
import * as THREE from 'three';

interface ButterflyData {
  orbitRadius: number;
  orbitSpeed: number;
  baseY: number;
  vertSpeed: number;
  wingSpeed: number;
  phase: number;
}

interface RippleUserData {
  speed: number;
  maxR: number;
  phase: number;
}

// Procedural galaxy/nebula texture for the sky dome: dark base + soft colored
// clouds (blue/teal/magenta) + a bright core + a dense scatter of stars.
function makeNebulaTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;

  // Dark vertical base (top darker → indigo horizon)
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#04050d');
  base.addColorStop(0.55, '#080c1f');
  base.addColorStop(1, '#0f1430');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  // Colored nebula clouds (additive)
  g.globalCompositeOperation = 'lighter';
  const clouds: [number, number, number, string][] = [
    [w * 0.42, h * 0.4, 460, 'rgba(43, 86, 180, 0.55)'],
    [w * 0.5, h * 0.34, 360, 'rgba(40, 150, 190, 0.45)'],
    [w * 0.36, h * 0.5, 300, 'rgba(150, 45, 90, 0.40)'],
    [w * 0.6, h * 0.52, 340, 'rgba(120, 40, 110, 0.38)'],
    [w * 0.2, h * 0.32, 280, 'rgba(150, 50, 70, 0.30)'],
    [w * 0.78, h * 0.4, 300, 'rgba(40, 90, 170, 0.35)'],
    [w * 0.48, h * 0.62, 240, 'rgba(60, 130, 170, 0.30)'],
  ];
  clouds.forEach(([cx, cy, r, color]) => {
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });

  // Bright galactic core
  const core = g.createRadialGradient(w * 0.46, h * 0.36, 0, w * 0.46, h * 0.36, 150);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.25, 'rgba(220,230,255,0.6)');
  core.addColorStop(1, 'rgba(120,150,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, w, h);

  // Stars
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() < 0.92 ? Math.random() * 0.9 + 0.2 : Math.random() * 1.8 + 1;
    const a = 0.4 + Math.random() * 0.6;
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function CosmicPondScene() {
  useEffect(() => {
    const canvas = document.getElementById('forest-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // ─── Core ───
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[]; tex: THREE.Texture[] } = { geo: [], mat: [], tex: [] };

    // ─── Lighting (night) ───
    scene.add(new THREE.AmbientLight(0x3a4675, 0.5));
    const moonLight = new THREE.DirectionalLight(0xc8d4ff, 0.8);
    moonLight.position.set(-10, 18, -8);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    scene.add(moonLight);
    const fillLight = new THREE.DirectionalLight(0x5b6bd6, 0.22);
    fillLight.position.set(8, 10, 6);
    scene.add(fillLight);
    scene.add(new THREE.HemisphereLight(0x2a3570, 0x05060f, 0.4));
    scene.fog = new THREE.FogExp2(0x080c20, 0.011);

    // ─── Galaxy nebula sky dome ───
    const nebulaTex = makeNebulaTexture();
    disposables.tex.push(nebulaTex);
    const skyGeo = new THREE.SphereGeometry(220, 48, 24);
    const skyMat = new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.BackSide, depthWrite: false, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    disposables.geo.push(skyGeo);
    disposables.mat.push(skyMat);

    // ─── Foreground 3D starfield (twinkle + parallax over the dome) ───
    function makeStarLayer(count: number, radius: number, size: number, baseOpacity: number) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(Math.random());
        const r = radius * (0.85 + Math.random() * 0.15);
        pos[i * 3] = Math.sin(v) * Math.cos(u) * r;
        pos[i * 3 + 1] = Math.cos(v) * r * 0.9 + 5;
        pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
        const tint = Math.random();
        const c = new THREE.Color().setHSL(tint < 0.7 ? 0.6 : 0.08, 0.3, 0.85 + Math.random() * 0.15);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, transparent: true, opacity: baseOpacity, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      disposables.geo.push(geo);
      disposables.mat.push(mat);
      return mat;
    }
    const starsFar = makeStarLayer(420, 140, 0.5, 0.65);
    const starsNear = makeStarLayer(150, 100, 0.9, 0.9);

    // ─── Constellations ───
    const CONSTELLATIONS: { nodes: [number, number][]; edges: [number, number][]; at: THREE.Vector3; scale: number }[] = [
      { nodes: [[0, 0], [1.1, 0.15], [2.1, 0.0], [3.0, 0.35], [3.6, 1.2], [2.7, 1.5], [2.6, 0.6]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]], at: new THREE.Vector3(36, 38, -56), scale: 6 },
      { nodes: [[0, 0], [1, 1], [2, 0.2], [3, 1.1], [4, 0.1]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]], at: new THREE.Vector3(-48, 44, -36), scale: 5.5 },
      { nodes: [[0, 0], [0.4, 0.5], [0.8, 1.0], [-0.6, 2.0], [1.7, 1.9], [-1.0, -1.6], [1.9, -1.4]], edges: [[0, 1], [1, 2], [3, 1], [4, 1], [5, 0], [6, 2]], at: new THREE.Vector3(10, 32, -66), scale: 4.8 },
      { nodes: [[0, 0], [0, 1], [0, 2.2], [0, 3.2], [-1.2, 2.0], [1.2, 2.0]], edges: [[0, 1], [1, 2], [2, 3], [4, 2], [5, 2]], at: new THREE.Vector3(-28, 50, -60), scale: 4.2 },
    ];
    const nodePosArr: number[] = [];
    const segArr: number[] = [];
    CONSTELLATIONS.forEach(({ nodes, edges, at, scale }) => {
      const normal = at.clone().normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
      const realUp = new THREE.Vector3().crossVectors(normal, right).normalize();
      const wp = nodes.map(([x, y]) => at.clone().add(right.clone().multiplyScalar(x * scale)).add(realUp.clone().multiplyScalar(y * scale)));
      wp.forEach((p) => nodePosArr.push(p.x, p.y, p.z));
      edges.forEach(([a, b]) => segArr.push(wp[a].x, wp[a].y, wp[a].z, wp[b].x, wp[b].y, wp[b].z));
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segArr), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x7d92e0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));
    disposables.geo.push(lineGeo);
    disposables.mat.push(lineMat);
    const cNodeGeo = new THREE.BufferGeometry();
    cNodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodePosArr), 3));
    const cNodeMat = new THREE.PointsMaterial({ color: 0xeaf1ff, size: 1.4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    scene.add(new THREE.Points(cNodeGeo, cNodeMat));
    disposables.geo.push(cNodeGeo);
    disposables.mat.push(cNodeMat);

    // ─── Moon + glow + reflection ───
    const MOON_POS = new THREE.Vector3(-10, 16, -26);
    const moonGeo = new THREE.SphereGeometry(3.4, 48, 48);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xeaf0ff, emissive: 0xc4d2ff, emissiveIntensity: 1.1, roughness: 0.9 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.copy(MOON_POS);
    scene.add(moon);
    disposables.geo.push(moonGeo);
    disposables.mat.push(moonMat);
    const haloGeo = new THREE.SphereGeometry(4.8, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb9c9ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(MOON_POS);
    scene.add(halo);
    disposables.geo.push(haloGeo);
    disposables.mat.push(haloMat);

    // ─── Moonlit Water (waves + ripples) ───
    const waterGeo = new THREE.PlaneGeometry(80, 80, 80, 80);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0a1838, metalness: 0.8, roughness: 0.2, emissive: 0x081026, emissiveIntensity: 0.5 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    scene.add(water);
    disposables.geo.push(waterGeo);
    disposables.mat.push(waterMat);
    const waterBase = (waterGeo.attributes.position.array as Float32Array).slice();

    // Moon reflection glitter column
    const glintCount = 90;
    const glintGeo = new THREE.BufferGeometry();
    const glintPos = new Float32Array(glintCount * 3);
    const glintPhases: number[] = [];
    for (let i = 0; i < glintCount; i++) {
      const along = (i / glintCount) * 24;
      glintPos[i * 3] = MOON_POS.x * 0.3 + (Math.random() - 0.5) * (1 + along * 0.16);
      glintPos[i * 3 + 1] = 0.05;
      glintPos[i * 3 + 2] = -along + 3 + (Math.random() - 0.5) * 0.6;
      glintPhases.push(Math.random() * Math.PI * 2);
    }
    glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
    const glintMat = new THREE.PointsMaterial({ color: 0xdbe6ff, size: 0.14, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(glintGeo, glintMat));
    disposables.geo.push(glintGeo);
    disposables.mat.push(glintMat);

    // Expanding ripples
    const ripples: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const rg = new THREE.RingGeometry(0.6, 0.78, 64);
      const rm = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(rg, rm);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      ring.userData = { speed: 0.45 + Math.random() * 0.4, maxR: 8 + Math.random() * 5, phase: (i / 6) * Math.PI * 2 } as RippleUserData;
      scene.add(ring);
      ripples.push(ring);
      disposables.geo.push(rg);
      disposables.mat.push(rm);
    }

    // ─── Petal shape (for lotus) ───
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.12, 0.02, 0.22, 0.15, 0.18, 0.35);
    petalShape.bezierCurveTo(0.15, 0.48, 0.08, 0.58, 0.03, 0.62);
    petalShape.bezierCurveTo(0.01, 0.64, 0, 0.65, 0, 0.65);
    petalShape.bezierCurveTo(0, 0.65, -0.01, 0.64, -0.03, 0.62);
    petalShape.bezierCurveTo(-0.08, 0.58, -0.15, 0.48, -0.18, 0.35);
    petalShape.bezierCurveTo(-0.22, 0.15, -0.12, 0.02, 0, 0);
    const petalShapeGeo = new THREE.ShapeGeometry(petalShape);
    disposables.geo.push(petalShapeGeo);

    // ─── Lily pads + lotus (moonlit) ───
    const lotusFlowers: THREE.Group[] = [];
    function createLotus(scale: number): THREE.Group {
      const group = new THREE.Group();
      const padGeo = new THREE.CircleGeometry(0.9 * scale, 24);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x16324a, emissive: 0x10324a, emissiveIntensity: 0.25, roughness: 0.7, metalness: 0.2 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      group.add(pad);
      disposables.geo.push(padGeo);
      disposables.mat.push(padMat);

      const petalLayers = [
        { count: 6, radius: 0.22, height: 0.08, tilt: 0.6, size: 0.7 },
        { count: 5, radius: 0.12, height: 0.14, tilt: 0.3, size: 0.5 },
      ];
      petalLayers.forEach((layer) => {
        for (let p = 0; p < layer.count; p++) {
          const angle = (p / layer.count) * Math.PI * 2 + (layer.count === 5 ? 0.3 : 0);
          const petalMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.62, 0.4, 0.8),
            transparent: true, opacity: 0.92,
            emissive: 0x9fb4ff, emissiveIntensity: 0.35,
            roughness: 0.7, side: THREE.DoubleSide,
          });
          const petal = new THREE.Mesh(petalShapeGeo, petalMat);
          disposables.mat.push(petalMat);
          petal.position.set(Math.cos(angle) * layer.radius * scale, layer.height * scale, Math.sin(angle) * layer.radius * scale);
          petal.rotation.set(-Math.PI / 2 + layer.tilt, angle, 0);
          petal.scale.setScalar(layer.size * scale);
          group.add(petal);
        }
      });
      const cGeo = new THREE.SphereGeometry(0.06 * scale, 8, 6);
      const cMat = new THREE.MeshStandardMaterial({ color: 0xdbe6ff, emissive: 0xaebfff, emissiveIntensity: 0.6, roughness: 0.6 });
      const center = new THREE.Mesh(cGeo, cMat);
      center.position.y = 0.18 * scale;
      group.add(center);
      disposables.geo.push(cGeo);
      disposables.mat.push(cMat);
      return group;
    }
    const centerLotus = createLotus(1.3);
    centerLotus.position.set(0, 0.03, 2);
    scene.add(centerLotus);
    lotusFlowers.push(centerLotus);
    [
      { x: -3, z: 4, s: 1.0 }, { x: 4, z: 3, s: 0.9 }, { x: -5, z: 0, s: 0.8 }, { x: 6, z: -1, s: 0.85 },
      { x: -2, z: -3, s: 0.7 }, { x: 3, z: 6, s: 0.95 }, { x: -6, z: 5, s: 0.75 }, { x: 7, z: 5, s: 0.8 },
    ].forEach((lp) => {
      const lotus = createLotus(lp.s);
      lotus.position.set(lp.x, 0.03, lp.z);
      scene.add(lotus);
      lotusFlowers.push(lotus);
    });

    // ─── Butterflies (cool/glowing) ───
    const butterflies: THREE.Group[] = [];
    function createButterfly(): THREE.Group {
      const bGroup = new THREE.Group();
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.bezierCurveTo(0.06, 0.08, 0.15, 0.12, 0.14, 0.06);
      wingShape.bezierCurveTo(0.16, 0.02, 0.12, -0.04, 0.08, -0.06);
      wingShape.bezierCurveTo(0.04, -0.08, 0, -0.02, 0, 0);
      const wingGeo = new THREE.ShapeGeometry(wingShape);
      disposables.geo.push(wingGeo);
      const hue = Math.random() > 0.5 ? 0.6 + Math.random() * 0.08 : 0.72 + Math.random() * 0.08;
      const wingMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.6, 0.7),
        transparent: true, opacity: 0.88,
        emissive: new THREE.Color().setHSL(hue, 0.8, 0.55), emissiveIntensity: 0.5,
        roughness: 0.6, side: THREE.DoubleSide,
      });
      disposables.mat.push(wingMat);
      const lw = new THREE.Mesh(wingGeo, wingMat);
      lw.scale.set(1.5, 1.5, 1);
      bGroup.add(lw);
      const rw = new THREE.Mesh(wingGeo, wingMat);
      rw.scale.set(-1.5, 1.5, 1);
      bGroup.add(rw);
      const bodyGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2036, emissive: 0x2a3358, emissiveIntensity: 0.3 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      bGroup.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);
      bGroup.scale.setScalar(0.8 + Math.random() * 0.4);
      return bGroup;
    }
    for (let i = 0; i < 8; i++) {
      const bf = createButterfly();
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 10;
      bf.position.set(Math.cos(angle) * dist, 2 + Math.random() * 5, Math.sin(angle) * dist);
      bf.userData = { orbitRadius: dist, orbitSpeed: 0.15 + Math.random() * 0.3, baseY: 2 + Math.random() * 5, vertSpeed: 0.5 + Math.random() * 1, wingSpeed: 6 + Math.random() * 6, phase: Math.random() * Math.PI * 2 } as ButterflyData;
      scene.add(bf);
      butterflies.push(bf);
    }

    // ─── Spirit lights ───
    const spiritCount = 70;
    const spiritGeo = new THREE.BufferGeometry();
    const spiritPos = new Float32Array(spiritCount * 3);
    const spiritPhases: number[] = [];
    for (let i = 0; i < spiritCount; i++) {
      spiritPos[i * 3] = (Math.random() - 0.5) * 34;
      spiritPos[i * 3 + 1] = 0.3 + Math.random() * 8;
      spiritPos[i * 3 + 2] = (Math.random() - 0.5) * 34;
      spiritPhases.push(Math.random() * Math.PI * 2);
    }
    spiritGeo.setAttribute('position', new THREE.BufferAttribute(spiritPos, 3));
    const spiritMat = new THREE.PointsMaterial({ color: 0x86e1ff, size: 0.1, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(spiritGeo, spiritMat));
    disposables.geo.push(spiritGeo);
    disposables.mat.push(spiritMat);

    // ─── Camera ───
    camera.position.set(8, 2.5, 10);
    camera.lookAt(0, 1.5, 0);
    canvas.style.pointerEvents = 'none';

    // ─── Animation ───
    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Water waves
      const wPos = waterGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < wPos.length; i += 3) {
        const bx = waterBase[i];
        const by = waterBase[i + 1];
        wPos[i + 2] = Math.sin(bx * 0.18 + t * 0.8) * 0.16 + Math.cos(by * 0.22 + t * 0.6) * 0.14 + Math.sin((bx + by) * 0.12 + t * 0.4) * 0.09;
      }
      waterGeo.attributes.position.needsUpdate = true;
      waterGeo.computeVertexNormals();
      waterMat.emissiveIntensity = 0.45 + Math.sin(t * 0.5) * 0.08;

      // Ripples
      ripples.forEach((ring) => {
        const d = ring.userData as RippleUserData;
        const prog = ((t * d.speed + d.phase) % (Math.PI * 2)) / (Math.PI * 2);
        const r = 0.6 + prog * d.maxR;
        ring.scale.set(r, r, r);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.26 * (1 - prog);
      });

      // Lotus bob
      lotusFlowers.forEach((lotus, idx) => {
        lotus.position.y = 0.03 + Math.sin(t * 0.5 + idx * 0.7) * 0.015;
        lotus.rotation.y += 0.001;
      });

      // Butterflies
      butterflies.forEach((bf) => {
        const d = bf.userData as ButterflyData;
        const angle = t * d.orbitSpeed + d.phase;
        bf.position.x = Math.cos(angle) * d.orbitRadius + Math.sin(t * 0.3 + d.phase) * 1.5;
        bf.position.z = Math.sin(angle) * d.orbitRadius + Math.cos(t * 0.4 + d.phase) * 1.2;
        bf.position.y = d.baseY + Math.sin(t * d.vertSpeed + d.phase) * 1.0;
        const flap = Math.sin(t * d.wingSpeed) * 0.8;
        if (bf.children[0]) bf.children[0].rotation.y = flap;
        if (bf.children[1]) bf.children[1].rotation.y = -flap;
        const na = (t + 0.05) * d.orbitSpeed + d.phase;
        bf.rotation.y = Math.atan2(Math.sin(na) * d.orbitRadius - bf.position.z, Math.cos(na) * d.orbitRadius - bf.position.x);
      });

      // Spirit lights drift
      const sp = spiritGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < spiritCount; i++) {
        const i3 = i * 3;
        sp[i3] += Math.sin(t * 0.4 + spiritPhases[i]) * 0.006;
        sp[i3 + 1] += Math.sin(t * 0.5 + spiritPhases[i] * 1.3) * 0.004;
        sp[i3 + 2] += Math.cos(t * 0.35 + spiritPhases[i] * 0.9) * 0.006;
        if (sp[i3 + 1] < 0.2) sp[i3 + 1] = 7;
        if (sp[i3 + 1] > 9) sp[i3 + 1] = 0.3;
      }
      spiritGeo.attributes.position.needsUpdate = true;
      spiritMat.opacity = 0.4 + Math.sin(t * 3) * 0.25 + Math.sin(t * 7) * 0.1;

      // Twinkle + nebula drift + moon halo + glints
      starsFar.opacity = 0.6 + Math.sin(t * 1.3) * 0.12;
      starsNear.opacity = 0.8 + Math.sin(t * 2.1 + 1) * 0.15;
      cNodeMat.opacity = 0.85 + Math.sin(t * 1.7) * 0.12;
      sky.rotation.y = t * 0.004;
      halo.scale.setScalar(1 + Math.sin(t * 0.4) * 0.04);
      haloMat.opacity = 0.1 + Math.sin(t * 0.4) * 0.03;
      glintMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.3;

      // Camera orbit
      const camAngle = t * 0.035;
      const camRadius = 11;
      camera.position.x = Math.cos(camAngle) * camRadius;
      camera.position.z = Math.sin(camAngle) * camRadius;
      camera.position.y = 2.4 + Math.sin(t * 0.03) * 0.3;
      camera.lookAt(0, 1.5, 0);

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      disposables.geo.forEach((g) => g.dispose());
      disposables.mat.forEach((m) => m.dispose());
      disposables.tex.forEach((tx) => tx.dispose());
      renderer.dispose();
    };
  }, []);

  return <canvas id="forest-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}