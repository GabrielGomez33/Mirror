// src/components/three/ZenGardenSceneCosmic.tsx
// Nighttime "cosmic" zen garden (the cosmic colorway). The daytime sand garden
// becomes a still pool of moonlit water under a deep-indigo sky: a glowing moon
// with a reflection glitter on the water, a twinkling starfield, named
// constellations, moonlit cairn stones and silhouetted cherry trees, drifting
// pale petals and cool spirit-lights. Same structure/quality as the sakura
// scene; rendered by ZenGardenScene when theme === 'cosmic'.
import { useEffect } from 'react';
import * as THREE from 'three';

interface StoneUserData {
  baseY: number;
  breathPhase: number;
  breathSpeed: number;
}

interface PetalUserData {
  fallSpeed: number;
  swayFreq: number;
  swayAmp: number;
  spiralSpeed: number;
  rotSpeed: THREE.Vector3;
  phase: number;
  flutterAmp: number;
}

interface RippleUserData {
  speed: number;
  maxR: number;
  phase: number;
}

export default function ZenGardenSceneCosmic() {
  useEffect(() => {
    const canvas = document.getElementById('zen-garden-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // ─── Core ───
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ─── Lighting (night) ───
    const ambientLight = new THREE.AmbientLight(0x404a7a, 0.5);
    scene.add(ambientLight);

    // Cool moonlight as the key light
    const moonLight = new THREE.DirectionalLight(0xc8d4ff, 0.85);
    moonLight.position.set(-8, 18, -10);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    scene.add(moonLight);

    const fillLight = new THREE.DirectionalLight(0x5b6bd6, 0.25);
    fillLight.position.set(6, 8, 6);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0x2a3570, 0x05060f, 0.4);
    scene.add(hemiLight);

    // ─── Fog (deep indigo, for depth) ───
    scene.fog = new THREE.FogExp2(0x0a1030, 0.012);

    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[] } = { geo: [], mat: [] };

    // ─── Sky dome (vertical gradient: near-black zenith → indigo horizon) ───
    const skyGeo = new THREE.SphereGeometry(220, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x04060f) },
        bottomColor: { value: new THREE.Color(0x1a234f) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        void main() {
          float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.8)), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    disposables.geo.push(skyGeo);
    disposables.mat.push(skyMat);

    // ─── Moonlit Water Surface (animated gentle waves) ───
    const WATER_SEG = 80;
    const waterGeo = new THREE.PlaneGeometry(120, 120, WATER_SEG, WATER_SEG);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0a1838,
      metalness: 0.78,
      roughness: 0.22,
      emissive: 0x081026,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.98,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.05;
    water.receiveShadow = true;
    //scene.add(water);
    disposables.geo.push(waterGeo);
    disposables.mat.push(waterMat);
    // Snapshot base vertex positions for wave animation
    const waterBaseZ = (waterGeo.attributes.position.array as Float32Array).slice();

    // ─── Expanding moonlight ripples on the water ───
    const ripples: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const ringGeo = new THREE.RingGeometry(0.6, 0.78, 80);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x9fc4ff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.userData = { speed: 0.5 + Math.random() * 0.4, maxR: 9 + Math.random() * 5, phase: (i / 7) * Math.PI * 2 } as RippleUserData;
      scene.add(ring);
      ripples.push(ring);
      disposables.geo.push(ringGeo);
      disposables.mat.push(ringMat);
    }

    // ─── Glowing Moon (cool white-blue) + glow shells ───
    const moonGeo = new THREE.SphereGeometry(3.6, 48, 48);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xeaf0ff,
      emissive: 0xc4d2ff,
      emissiveIntensity: 1.1,
      roughness: 0.9,
      metalness: 0.0,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    const MOON_POS = new THREE.Vector3(-9, 17, -24);
    moon.position.copy(MOON_POS);
    scene.add(moon);
    disposables.geo.push(moonGeo);
    disposables.mat.push(moonMat);

    // Subtle craters (darker patches)
    for (let i = 0; i < 6; i++) {
      const cGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.45, 12, 12);
      const cMat = new THREE.MeshStandardMaterial({ color: 0xbcc8ee, emissive: 0x9aa8d8, emissiveIntensity: 0.5, roughness: 1 });
      const crater = new THREE.Mesh(cGeo, cMat);
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI - Math.PI / 2;
      const rr = 3.45;
      crater.position.set(
        MOON_POS.x + Math.cos(v) * Math.cos(u) * rr,
        MOON_POS.y + Math.sin(v) * rr,
        MOON_POS.z + Math.cos(v) * Math.sin(u) * rr,
      );
      crater.scale.z = 0.3;
      crater.lookAt(MOON_POS);
      scene.add(crater);
      disposables.geo.push(cGeo);
      disposables.mat.push(cMat);
    }

    const haloGeo = new THREE.SphereGeometry(5.0, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb9c9ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(MOON_POS);
    scene.add(halo);
    disposables.geo.push(haloGeo);
    disposables.mat.push(haloMat);

    const outerGlowGeo = new THREE.SphereGeometry(7.5, 32, 32);
    const outerGlowMat = new THREE.MeshBasicMaterial({ color: 0x8ea4ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
    const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    outerGlow.position.copy(MOON_POS);
    scene.add(outerGlow);
    disposables.geo.push(outerGlowGeo);
    disposables.mat.push(outerGlowMat);

    // ─── Moon reflection glitter on the water (vertical shimmer column) ───
    const glintCount = 90;
    const glintGeo = new THREE.BufferGeometry();
    const glintPos = new Float32Array(glintCount * 3);
    const glintPhases: number[] = [];
    for (let i = 0; i < glintCount; i++) {
      // Column running from near the camera toward the moon's azimuth
      const along = (i / glintCount) * 26;
      glintPos[i * 3] = MOON_POS.x * 0.32 + (Math.random() - 0.5) * (1.0 + along * 0.16);
      glintPos[i * 3 + 1] = 0.04;
      glintPos[i * 3 + 2] = -along + 3 + (Math.random() - 0.5) * 0.6;
      glintPhases.push(Math.random() * Math.PI * 2);
    }
    glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
    const glintMat = new THREE.PointsMaterial({ color: 0xdbe6ff, size: 0.14, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const glints = new THREE.Points(glintGeo, glintMat);
    scene.add(glints);
    disposables.geo.push(glintGeo);
    disposables.mat.push(glintMat);

    // ─── Starfield (two layers, twinkling) ───
    function makeStarLayer(count: number, radius: number, size: number, baseOpacity: number): { pts: THREE.Points; mat: THREE.PointsMaterial } {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // Upper hemisphere bias so stars sit in the sky
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(Math.random()); // 0..PI/2 → upper dome
        const r = radius * (0.85 + Math.random() * 0.15);
        pos[i * 3] = Math.sin(v) * Math.cos(u) * r;
        pos[i * 3 + 1] = Math.cos(v) * r * 0.9 + 6;
        pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
        // Slight color variation: white / pale blue / pale gold
        const tint = Math.random();
        const c = new THREE.Color().setHSL(tint < 0.7 ? 0.6 : 0.12, 0.25, 0.85 + Math.random() * 0.15);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, transparent: true, opacity: baseOpacity, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      disposables.geo.push(geo);
      disposables.mat.push(mat);
      return { pts, mat };
    }
    const starsFar = makeStarLayer(520, 150, 0.55, 0.7);
    const starsNear = makeStarLayer(180, 110, 0.95, 0.9);

    // ─── Constellations (named line patterns + bright nodes) ───
    // Each: 2D node coords (unit-ish) + edges, placed at a sky direction.
    const CONSTELLATIONS: { nodes: [number, number][]; edges: [number, number][]; at: THREE.Vector3; scale: number }[] = [
      { // Big Dipper
        nodes: [[0, 0], [1.1, 0.15], [2.1, 0.0], [3.0, 0.35], [3.6, 1.2], [2.7, 1.5], [2.6, 0.6]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
        at: new THREE.Vector3(34, 40, -60), scale: 6.5,
      },
      { // Cassiopeia (W)
        nodes: [[0, 0], [1, 1], [2, 0.2], [3, 1.1], [4, 0.1]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
        at: new THREE.Vector3(-46, 46, -40), scale: 5.5,
      },
      { // Orion-ish (belt + shoulders/feet)
        nodes: [[0, 0], [0.4, 0.5], [0.8, 1.0], [-0.6, 2.0], [1.7, 1.9], [-1.0, -1.6], [1.9, -1.4]],
        edges: [[0, 1], [1, 2], [3, 1], [4, 1], [5, 0], [6, 2]],
        at: new THREE.Vector3(8, 34, -70), scale: 5.0,
      },
      { // Northern Cross
        nodes: [[0, 0], [0, 1], [0, 2.2], [0, 3.2], [-1.2, 2.0], [1.2, 2.0]],
        edges: [[0, 1], [1, 2], [2, 3], [4, 2], [5, 2]],
        at: new THREE.Vector3(-30, 52, -64), scale: 4.5,
      },
    ];

    const constellationNodes: { pts: THREE.Points; mat: THREE.PointsMaterial } | null = (() => {
      const allNodePos: number[] = [];
      const lineSegs: number[] = [];
      CONSTELLATIONS.forEach(({ nodes, edges, at, scale }) => {
        // Build an orthonormal-ish basis facing the origin so the pattern hangs flat in the sky
        const normal = at.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(up, normal).normalize();
        const realUp = new THREE.Vector3().crossVectors(normal, right).normalize();
        const worldPts = nodes.map(([x, y]) =>
          at.clone()
            .add(right.clone().multiplyScalar(x * scale))
            .add(realUp.clone().multiplyScalar(y * scale)),
        );
        worldPts.forEach((p) => allNodePos.push(p.x, p.y, p.z));
        edges.forEach(([a, b]) => {
          const pa = worldPts[a]; const pb = worldPts[b];
          lineSegs.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        });
      });

      // Lines
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineSegs), 3));
      const lineMat = new THREE.LineBasicMaterial({ color: 0x7d92e0, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lines);
      disposables.geo.push(lineGeo);
      disposables.mat.push(lineMat);

      // Bright nodes
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allNodePos), 3));
      const nodeMat = new THREE.PointsMaterial({ color: 0xeaf1ff, size: 1.5, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
      const nodePts = new THREE.Points(nodeGeo, nodeMat);
      scene.add(nodePts);
      disposables.geo.push(nodeGeo);
      disposables.mat.push(nodeMat);
      return { pts: nodePts, mat: nodeMat };
    })();

    // ─── Shapes (petals / leaves / trees) ───
    function makePetalShape(): THREE.Shape {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(0.12, 0.02, 0.22, 0.15, 0.18, 0.35);
      s.bezierCurveTo(0.15, 0.48, 0.08, 0.58, 0.03, 0.62);
      s.bezierCurveTo(0.01, 0.64, 0, 0.65, 0, 0.65);
      s.bezierCurveTo(0, 0.65, -0.01, 0.64, -0.03, 0.62);
      s.bezierCurveTo(-0.08, 0.58, -0.15, 0.48, -0.18, 0.35);
      s.bezierCurveTo(-0.22, 0.15, -0.12, 0.02, 0, 0);
      return s;
    }
    const petalShapeGeo = new THREE.ShapeGeometry(makePetalShape());
    disposables.geo.push(petalShapeGeo);

    // ─── Moonlit Cairn Stones ───
    const stones: THREE.Mesh[] = [];
    const stoneConfigs = [
      { radius: 0.95, scaleY: 0.52, scaleXZ: 1.1, y: 0.32, color: 0x2c3550 },
      { radius: 0.78, scaleY: 0.5, scaleXZ: 1.05, y: 0.88, color: 0x333d5c },
      { radius: 0.62, scaleY: 0.48, scaleXZ: 1.0, y: 1.35, color: 0x3b466a },
      { radius: 0.48, scaleY: 0.45, scaleXZ: 0.95, y: 1.72, color: 0x44507a },
      { radius: 0.35, scaleY: 0.42, scaleXZ: 0.9, y: 2.02, color: 0x4d5a88 },
    ];
    stoneConfigs.forEach((cfg, index) => {
      const geo = new THREE.SphereGeometry(cfg.radius, 24, 16);
      const mat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: 0x2a3a7a, emissiveIntensity: 0.12, roughness: 0.85, metalness: 0.1 });
      const stone = new THREE.Mesh(geo, mat);
      stone.scale.set(cfg.scaleXZ, cfg.scaleY, cfg.scaleXZ);
      stone.position.set(0, cfg.y, 0);
      stone.rotation.y = index * 0.35;
      stone.castShadow = true;
      stone.userData = { baseY: cfg.y, breathPhase: index * 0.25, breathSpeed: 0.3 + index * 0.04 } as StoneUserData;
      scene.add(stone);
      stones.push(stone);
      disposables.geo.push(geo);
      disposables.mat.push(mat);
    });

    // ─── Silhouetted Night Cherry Trees (dark trunks, deep-indigo canopy w/ glowing blossoms) ───
    function createNightTree(baseX: number, baseZ: number, scale: number, density: number): THREE.Group {
      const tree = new THREE.Group();
      tree.position.set(baseX, 0, baseZ);

      const trunkH = 2.8 * scale;
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x14152a, emissive: 0x0a0c1e, emissiveIntensity: 0.2, roughness: 1 });
      disposables.mat.push(trunkMat);
      const trunkGeo = new THREE.CylinderGeometry(0.08 * scale, 0.2 * scale, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      trunk.rotation.z = (Math.random() - 0.5) * 0.08;
      tree.add(trunk);
      disposables.geo.push(trunkGeo);

      const canopyCenter = new THREE.Vector3(0, trunkH + 0.3 * scale, 0);
      const canopyRXZ = (1.8 + Math.random() * 0.6) * scale;
      const canopyRY = (1.0 + Math.random() * 0.3) * scale;

      const cloudCount = Math.floor(50 * Math.max(density, 0.5));
      for (let i = 0; i < cloudCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        const rFrac = 0.2 + Math.random() * 0.8;
        const blobSize = (0.15 + Math.random() * 0.3) * scale;
        const blobGeo = new THREE.SphereGeometry(blobSize, 6, 5);
        const blobMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.66 + Math.random() * 0.06, 0.45, 0.22 + Math.random() * 0.1),
          transparent: true,
          opacity: 0.6 + Math.random() * 0.3,
          emissive: 0x3a3f8a,
          emissiveIntensity: 0.18,
          roughness: 1,
        });
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.set(
          canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ * rFrac,
          canopyCenter.y + Math.cos(phi) * canopyRY * rFrac,
          canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ * rFrac,
        );
        blob.scale.set(1, 0.5 + Math.random() * 0.3, 1);
        tree.add(blob);
        disposables.geo.push(blobGeo);
        disposables.mat.push(blobMat);
      }

      // A few luminous night blossoms (cool glow)
      const flowerCount = Math.floor(8 * Math.max(density, 0.4));
      for (let f = 0; f < flowerCount; f++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.55;
        const fx = canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ;
        const fy = canopyCenter.y + Math.cos(phi) * canopyRY;
        const fz = canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ;
        const fGroup = new THREE.Group();
        fGroup.position.set(fx, fy, fz);
        for (let p = 0; p < 5; p++) {
          const pMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.62, 0.5, 0.78),
            transparent: true, opacity: 0.9,
            emissive: 0x9fb4ff, emissiveIntensity: 0.45,
            roughness: 0.8, side: THREE.DoubleSide,
          });
          const pet = new THREE.Mesh(petalShapeGeo, pMat);
          disposables.mat.push(pMat);
          const pa = (p / 5) * Math.PI * 2;
          pet.position.set(Math.cos(pa) * 0.07 * scale, 0, Math.sin(pa) * 0.07 * scale);
          pet.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, pa, 0);
          pet.scale.setScalar((0.18 + Math.random() * 0.1) * scale);
          fGroup.add(pet);
        }
        fGroup.lookAt(fx + (fx - canopyCenter.x), fy + (fy - canopyCenter.y) * 0.5, fz + (fz - canopyCenter.z));
        tree.add(fGroup);
      }
      return tree;
    }

    const allTrees: THREE.Group[] = [];
    allTrees.push(createNightTree(14, 4, 1.2, 1.2));
    allTrees.push(createNightTree(-13, 6, 1.1, 1.1));
    allTrees.push(createNightTree(6, -14, 1.0, 1.0));
    allTrees.push(createNightTree(-8, -14, 1.05, 1.0));
    allTrees.push(createNightTree(18, -10, 0.85, 0.85));
    allTrees.push(createNightTree(-18, -8, 0.8, 0.8));
    allTrees.push(createNightTree(0, 18, 0.9, 0.9));
    allTrees.push(createNightTree(15, 14, 0.75, 0.75));
    allTrees.push(createNightTree(-24, -18, 0.55, 0.55));
    allTrees.push(createNightTree(26, -16, 0.5, 0.5));
    allTrees.push(createNightTree(-12, 24, 0.5, 0.5));
    allTrees.forEach((t) => scene.add(t));

    // ─── Falling Pale Petals (moonlit, fewer) ───
    const petalColors = [0xcdd6ff, 0xb9c9ff, 0xe7ecff, 0xa9bcf5, 0xd6c8ff];
    const fallingPetals: THREE.Mesh[] = [];
    for (let i = 0; i < 60; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        transparent: true,
        opacity: 0.55 + Math.random() * 0.3,
        emissive: 0x6f86d9,
        emissiveIntensity: 0.25,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(mat);
      const petal = new THREE.Mesh(petalShapeGeo, mat);
      petal.position.set((Math.random() - 0.5) * 35, Math.random() * 14 + 5, (Math.random() - 0.5) * 25);
      petal.scale.setScalar(0.2 + Math.random() * 0.4);
      petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      petal.userData = {
        fallSpeed: 0.004 + Math.random() * 0.009,
        swayFreq: 0.3 + Math.random() * 0.4,
        swayAmp: 0.3 + Math.random() * 0.7,
        spiralSpeed: (Math.random() - 0.5) * 0.3,
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.018, (Math.random() - 0.5) * 0.012),
        phase: Math.random() * Math.PI * 2,
        flutterAmp: 0.5 + Math.random() * 1.5,
      } as PetalUserData;
      scene.add(petal);
      fallingPetals.push(petal);
    }

    // ─── Spirit Lights (cool drifting fireflies) ───
    const spiritCount = 70;
    const spiritGeo = new THREE.BufferGeometry();
    const spiritPos = new Float32Array(spiritCount * 3);
    const spiritPhases: number[] = [];
    for (let i = 0; i < spiritCount; i++) {
      spiritPos[i * 3] = (Math.random() - 0.5) * 36;
      spiritPos[i * 3 + 1] = 0.3 + Math.random() * 8;
      spiritPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
      spiritPhases.push(Math.random() * Math.PI * 2);
    }
    spiritGeo.setAttribute('position', new THREE.BufferAttribute(spiritPos, 3));
    const spiritMat = new THREE.PointsMaterial({ color: 0x86e1ff, size: 0.1, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const spiritPoints = new THREE.Points(spiritGeo, spiritMat);
    scene.add(spiritPoints);
    disposables.geo.push(spiritGeo);
    disposables.mat.push(spiritMat);

    // ─── Camera: low intimate perspective ───
    camera.position.set(8, 3, 8);
    camera.lookAt(0, 2.5, 0);
    canvas.style.pointerEvents = 'none';

    // ─── Animation Loop ───
    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Water waves
      const wPos = waterGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < wPos.length; i += 3) {
        const bx = waterBaseZ[i];
        const by = waterBaseZ[i + 1];
        wPos[i + 2] =
          Math.sin(bx * 0.18 + t * 0.8) * 0.18 +
          Math.cos(by * 0.22 + t * 0.6) * 0.16 +
          Math.sin((bx + by) * 0.12 + t * 0.4) * 0.1;
      }
      waterGeo.attributes.position.needsUpdate = true;
      waterGeo.computeVertexNormals();
      waterMat.emissiveIntensity = 0.45 + Math.sin(t * 0.5) * 0.08;

      // Ripples expand & fade
      ripples.forEach((ring) => {
        const d = ring.userData as RippleUserData;
        const cycle = (t * d.speed + d.phase) % (Math.PI * 2);
        const prog = cycle / (Math.PI * 2);
        const r = 0.6 + prog * d.maxR;
        ring.scale.set(r, r, r);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - prog);
      });

      // Stone breathing
      stones.forEach((stone) => {
        const d = stone.userData as StoneUserData;
        stone.position.y = d.baseY + Math.sin(t * d.breathSpeed + d.breathPhase) * 0.005;
      });

      // Moon glow pulse
      haloMat.opacity = 0.1 + Math.sin(t * 0.4) * 0.03;
      outerGlowMat.opacity = 0.05 + Math.sin(t * 0.3 + 1) * 0.02;

      // Star twinkle (layer opacity shimmer)
      starsFar.mat.opacity = 0.6 + Math.sin(t * 1.3) * 0.12;
      starsNear.mat.opacity = 0.8 + Math.sin(t * 2.1 + 1.0) * 0.15;
      if (constellationNodes) constellationNodes.mat.opacity = 0.85 + Math.sin(t * 1.7) * 0.12;

      // Moon glints shimmer
      glintMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.3;
      const gPos = glintGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < glintCount; i++) {
        gPos[i * 3] += Math.sin(t * 1.5 + glintPhases[i]) * 0.004;
      }
      glintGeo.attributes.position.needsUpdate = true;

      // Falling petals
      fallingPetals.forEach((petal) => {
        const d = petal.userData as PetalUserData;
        petal.position.y -= d.fallSpeed;
        petal.position.x += Math.sin(t * d.swayFreq + d.phase) * d.swayAmp * 0.005;
        petal.position.z += Math.cos(t * d.swayFreq * 0.7 + d.phase) * d.swayAmp * 0.003;
        petal.rotation.x += d.rotSpeed.x + Math.sin(t * d.flutterAmp + d.phase) * 0.004;
        petal.rotation.y += d.rotSpeed.y;
        petal.rotation.z += d.rotSpeed.z + Math.cos(t * d.flutterAmp * 0.8 + d.phase) * 0.003;
        const mat = petal.material as THREE.MeshStandardMaterial;
        if (petal.position.y < 0.4) mat.opacity = Math.max(0, mat.opacity - 0.012);
        if (petal.position.y < -2 || mat.opacity <= 0) {
          petal.position.y = Math.random() * 5 + 12;
          petal.position.x = (Math.random() - 0.5) * 35;
          petal.position.z = (Math.random() - 0.5) * 25;
          mat.opacity = 0.55 + Math.random() * 0.3;
        }
      });

      // Spirit lights drift
      const sPos = spiritGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < spiritCount; i++) {
        const i3 = i * 3;
        sPos[i3] += Math.sin(t * 0.4 + spiritPhases[i]) * 0.006;
        sPos[i3 + 1] += Math.sin(t * 0.5 + spiritPhases[i] * 1.3) * 0.004;
        sPos[i3 + 2] += Math.cos(t * 0.35 + spiritPhases[i] * 0.9) * 0.006;
        if (sPos[i3 + 1] < 0.2) sPos[i3 + 1] = 7;
        if (sPos[i3 + 1] > 9) sPos[i3 + 1] = 0.3;
      }
      spiritGeo.attributes.position.needsUpdate = true;
      spiritMat.opacity = 0.4 + Math.sin(t * 3) * 0.25 + Math.sin(t * 7) * 0.1;

      // Camera orbit (low)
      const camAngle = t * 0.04;
      camera.position.x = Math.cos(camAngle) * 10;
      camera.position.z = Math.sin(camAngle) * 10;
      camera.position.y = 3.0 + Math.sin(t * 0.03) * 0.3;
      camera.lookAt(0, 2.5, 0);

      renderer.render(scene, camera);
    }
    animate();

    // ─── Resize ───
    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    // ─── Cleanup ───
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      disposables.geo.forEach((g) => g.dispose());
      disposables.mat.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, []);

  return <canvas id="zen-garden-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}