// src/components/three/ZenBridgeSceneCosmic.tsx
//
// Nighttime "cosmic" zen bridge scene (TruthStream). The daytime arched bridge
// over a koi pond becomes a moonlit night crossing beneath a galaxy: a
// procedural nebula sky dome, dense twinkling stars, named constellations and a
// glowing moon, with the moon reflecting on dark rippling water. Keeps the
// scene's identity — the arched wooden bridge, lit stone lanterns, mossy rocks,
// koi and falling petals — recolored to cool moonlit tones. Rendered by
// ZenBridgeScene when theme === 'cosmic'.
import { useEffect } from 'react';
import * as THREE from 'three';

interface KoiData {
  radius: number;
  speed: number;
  phase: number;
  y: number;
}

// Procedural galaxy/nebula texture for the sky dome.
function makeNebulaTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;

  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#04050d');
  base.addColorStop(0.55, '#080c1f');
  base.addColorStop(1, '#0f1430');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

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

  const core = g.createRadialGradient(w * 0.46, h * 0.36, 0, w * 0.46, h * 0.36, 150);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.25, 'rgba(220,230,255,0.6)');
  core.addColorStop(1, 'rgba(120,150,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, w, h);

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

export default function ZenBridgeSceneCosmic() {
  useEffect(() => {
    const canvas = document.getElementById('zen-bridge-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[]; tex: THREE.Texture[] } = { geo: [], mat: [], tex: [] };

    // ─── Night lighting ───
    scene.add(new THREE.AmbientLight(0x3a4675, 0.5));
    const moonLight = new THREE.DirectionalLight(0xc8d4ff, 0.8);
    moonLight.position.set(-9, 17, -7);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    scene.add(moonLight);
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

    // ─── Starfield ───
    function makeStarLayer(count: number, radius: number, size: number, baseOpacity: number) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(Math.random());
        const r = radius * (0.85 + Math.random() * 0.15);
        pos[i * 3] = Math.sin(v) * Math.cos(u) * r;
        pos[i * 3 + 1] = Math.cos(v) * r * 0.9 + 6;
        pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
        const tint = Math.random();
        const c = new THREE.Color().setHSL(tint < 0.7 ? 0.6 : 0.08, 0.3, 0.85 + Math.random() * 0.15);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, transparent: true, opacity: baseOpacity, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      scene.add(new THREE.Points(geo, mat));
      disposables.geo.push(geo);
      disposables.mat.push(mat);
      return mat;
    }
    const starsFar = makeStarLayer(450, 150, 0.55, 0.65);
    const starsNear = makeStarLayer(160, 110, 0.95, 0.9);

    // ─── Constellations ───
    const CONSTELLATIONS: { nodes: [number, number][]; edges: [number, number][]; at: THREE.Vector3; scale: number }[] = [
      { nodes: [[0, 0], [1.1, 0.15], [2.1, 0.0], [3.0, 0.35], [3.6, 1.2], [2.7, 1.5], [2.6, 0.6]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]], at: new THREE.Vector3(38, 40, -52), scale: 6 },
      { nodes: [[0, 0], [1, 1], [2, 0.2], [3, 1.1], [4, 0.1]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]], at: new THREE.Vector3(-50, 46, -34), scale: 5.5 },
      { nodes: [[0, 0], [0.4, 0.5], [0.8, 1.0], [-0.6, 2.0], [1.7, 1.9], [-1.0, -1.6], [1.9, -1.4]], edges: [[0, 1], [1, 2], [3, 1], [4, 1], [5, 0], [6, 2]], at: new THREE.Vector3(12, 34, -64), scale: 4.8 },
      { nodes: [[0, 0], [0, 1], [0, 2.2], [0, 3.2], [-1.2, 2.0], [1.2, 2.0]], edges: [[0, 1], [1, 2], [2, 3], [4, 2], [5, 2]], at: new THREE.Vector3(-30, 52, -58), scale: 4.2 },
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

    // ─── Moon + glow ───
    const MOON_POS = new THREE.Vector3(-12, 16, -22);
    const moonGeo = new THREE.SphereGeometry(3.3, 48, 48);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xeaf0ff, emissive: 0xc4d2ff, emissiveIntensity: 1.1, roughness: 0.9 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.copy(MOON_POS);
    scene.add(moon);
    disposables.geo.push(moonGeo);
    disposables.mat.push(moonMat);
    const haloGeo = new THREE.SphereGeometry(4.7, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb9c9ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(MOON_POS);
    scene.add(halo);
    disposables.geo.push(haloGeo);
    disposables.mat.push(haloMat);

    // ─── Koi Pond (dark reflective water with ripples) ───
    const pondRadius = 12;
    const waterGeo = new THREE.CircleGeometry(pondRadius, 64);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0a1838, metalness: 0.82, roughness: 0.2, emissive: 0x081026, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.05;
    water.receiveShadow = true;
    scene.add(water);
    disposables.geo.push(waterGeo);
    disposables.mat.push(waterMat);
    const waterPositions = waterGeo.attributes.position;
    const waterOriginalZ = new Float32Array(waterPositions.count);
    for (let i = 0; i < waterPositions.count; i++) waterOriginalZ[i] = waterPositions.getZ(i);

    // Moon reflection glitter
    const glintCount = 80;
    const glintGeo = new THREE.BufferGeometry();
    const glintPos = new Float32Array(glintCount * 3);
    const glintPhases: number[] = [];
    for (let i = 0; i < glintCount; i++) {
      const along = (i / glintCount) * 14;
      glintPos[i * 3] = MOON_POS.x * 0.36 + (Math.random() - 0.5) * (1 + along * 0.18);
      glintPos[i * 3 + 1] = 0.02;
      glintPos[i * 3 + 2] = -along + 2 + (Math.random() - 0.5) * 0.5;
      glintPhases.push(Math.random() * Math.PI * 2);
    }
    glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
    const glintMat = new THREE.PointsMaterial({ color: 0xdbe6ff, size: 0.13, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(glintGeo, glintMat));
    disposables.geo.push(glintGeo);
    disposables.mat.push(glintMat);

    // ─── Arched Wooden Bridge (cosmic night wood) ───
    function createBridge(): THREE.Group {
      const bridge = new THREE.Group();
      const bridgeLen = 12;
      const archHeight = 2.2;
      const bridgeWidth = 1.6;
      const plankCount = 28;
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x241f38, emissive: 0x141228, emissiveIntensity: 0.2, roughness: 0.85 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x1b1730, emissive: 0x100e22, emissiveIntensity: 0.25, roughness: 0.9 });
      disposables.mat.push(woodMat, darkWoodMat);

      for (let i = 0; i < plankCount; i++) {
        const frac = i / (plankCount - 1);
        const x = (frac - 0.5) * bridgeLen;
        const y = Math.sin(frac * Math.PI) * archHeight;
        const plankGeo = new THREE.BoxGeometry(bridgeLen / plankCount + 0.02, 0.06, bridgeWidth);
        const plank = new THREE.Mesh(plankGeo, woodMat);
        plank.position.set(x, y, 0);
        const nextY = Math.sin(Math.min(1, (i + 1) / (plankCount - 1)) * Math.PI) * archHeight;
        const prevY = Math.sin(Math.max(0, (i - 1) / (plankCount - 1)) * Math.PI) * archHeight;
        plank.rotation.z = Math.atan2(nextY - prevY, (2 * bridgeLen) / (plankCount - 1));
        plank.castShadow = true;
        bridge.add(plank);
        disposables.geo.push(plankGeo);
      }
      const railSegments = 40;
      for (const side of [-1, 1]) {
        const railPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= railSegments; i++) {
          const frac = i / railSegments;
          railPoints.push(new THREE.Vector3((frac - 0.5) * bridgeLen, Math.sin(frac * Math.PI) * archHeight + 0.6, side * bridgeWidth * 0.5));
        }
        const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), railSegments, 0.035, 6, false);
        bridge.add(new THREE.Mesh(railGeo, darkWoodMat));
        disposables.geo.push(railGeo);
        const postCount = 14;
        for (let i = 1; i < postCount - 1; i++) {
          const frac = i / (postCount - 1);
          const baseY = Math.sin(frac * Math.PI) * archHeight;
          const postGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6);
          const post = new THREE.Mesh(postGeo, darkWoodMat);
          post.position.set((frac - 0.5) * bridgeLen, baseY + 0.3, side * bridgeWidth * 0.5);
          bridge.add(post);
          disposables.geo.push(postGeo);
        }
      }
      for (const xOff of [-2.5, 0, 2.5]) {
        const archY = Math.sin(((xOff / bridgeLen) + 0.5) * Math.PI) * archHeight;
        const supportH = archY + 0.6;
        const supportGeo = new THREE.CylinderGeometry(0.06, 0.09, supportH, 8);
        const support = new THREE.Mesh(supportGeo, darkWoodMat);
        support.position.set(xOff, -0.6 + supportH / 2, 0);
        support.castShadow = true;
        bridge.add(support);
        disposables.geo.push(supportGeo);
      }
      return bridge;
    }
    const bridge = createBridge();
    bridge.rotation.y = Math.PI * 0.15;
    scene.add(bridge);

    // ─── Stone Lanterns (lit — warm glow against the cosmos) ───
    const lanternGlows: THREE.Mesh[] = [];
    function createStoneLantern(x: number, z: number, scale: number): THREE.Group {
      const lantern = new THREE.Group();
      lantern.position.set(x, 0, z);
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x36406a, emissive: 0x1c2347, emissiveIntensity: 0.18, roughness: 0.9 });
      disposables.mat.push(stoneMat);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.4 * scale, 0.15 * scale, 8), stoneMat);
      base.position.y = 0.075 * scale;
      lantern.add(base);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 1.2 * scale, 8), stoneMat);
      post.position.y = 0.75 * scale;
      lantern.add(post);
      const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.35 * scale, 0.4 * scale), stoneMat);
      firebox.position.y = 1.52 * scale;
      lantern.add(firebox);
      const glowGeo = new THREE.SphereGeometry(0.13 * scale, 8, 6);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.75 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.y = 1.52 * scale;
      lantern.add(glow);
      lanternGlows.push(glow);
      disposables.geo.push(glowGeo);
      disposables.mat.push(glowMat);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4 * scale, 0.35 * scale, 4), stoneMat);
      roof.position.y = 1.87 * scale;
      roof.rotation.y = Math.PI / 4;
      lantern.add(roof);
      const light = new THREE.PointLight(0xffcc80, 0.8 * scale, 6 * scale);
      light.position.y = 1.52 * scale;
      lantern.add(light);
      // collect simple geos for disposal
      [base.geometry, post.geometry, firebox.geometry, roof.geometry].forEach((g) => disposables.geo.push(g));
      return lantern;
    }
    scene.add(createStoneLantern(-6.5, -1.2, 1.0));
    scene.add(createStoneLantern(6.8, 1.0, 0.95));
    scene.add(createStoneLantern(-3, 9, 0.8));
    scene.add(createStoneLantern(8, -7, 0.75));

    // ─── Mossy Rocks (cool night stone) ───
    function createMossyRock(x: number, z: number, size: number): THREE.Mesh {
      const geo = new THREE.SphereGeometry(size, 7, 5);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
        const noise = 1 + (Math.sin(nx * 5) * Math.cos(ny * 3) * Math.sin(nz * 4)) * 0.2;
        pos.setXYZ(i, nx * noise, ny * (0.6 + Math.random() * 0.15), nz * noise);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.62, 0.2, 0.22 + Math.random() * 0.08), emissive: 0x1a2347, emissiveIntensity: 0.12, roughness: 0.95 });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x, size * 0.2, z);
      rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.3);
      rock.castShadow = true;
      disposables.geo.push(geo);
      disposables.mat.push(mat);
      return rock;
    }
    [
      { x: -9, z: 4, s: 0.7 }, { x: -8.5, z: 6, s: 0.5 }, { x: 9, z: -3, s: 0.65 },
      { x: 10, z: -1, s: 0.45 }, { x: -5, z: -9, s: 0.5 }, { x: 3, z: 9.5, s: 0.55 },
      { x: 5, z: 8.5, s: 0.6 }, { x: -7, z: -7, s: 0.35 }, { x: 7, z: 7, s: 0.5 },
    ].forEach((r) => scene.add(createMossyRock(r.x, r.z, r.s)));

    // ─── Night cherry trees (dark silhouettes w/ glowing blossoms) ───
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

    function createNightTree(x: number, z: number, scale: number): THREE.Group {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      const trunkH = 2.8 * scale;
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x14152a, emissive: 0x0a0c1e, emissiveIntensity: 0.2, roughness: 1 });
      disposables.mat.push(trunkMat);
      const trunkGeo = new THREE.CylinderGeometry(0.08 * scale, 0.2 * scale, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      tree.add(trunk);
      disposables.geo.push(trunkGeo);
      const center = new THREE.Vector3(0, trunkH + 0.3 * scale, 0);
      const rXZ = (1.6 + Math.random() * 0.5) * scale;
      const rY = (1.0 + Math.random() * 0.3) * scale;
      for (let i = 0; i < 44; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        const rFrac = 0.2 + Math.random() * 0.8;
        const blobGeo = new THREE.SphereGeometry((0.15 + Math.random() * 0.28) * scale, 6, 5);
        const blobMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.66 + Math.random() * 0.06, 0.45, 0.22 + Math.random() * 0.1), transparent: true, opacity: 0.6 + Math.random() * 0.3, emissive: 0x3a3f8a, emissiveIntensity: 0.18, roughness: 1 });
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.set(center.x + Math.sin(phi) * Math.cos(theta) * rXZ * rFrac, center.y + Math.cos(phi) * rY * rFrac, center.z + Math.sin(phi) * Math.sin(theta) * rXZ * rFrac);
        blob.scale.set(1, 0.6 + Math.random() * 0.3, 1);
        tree.add(blob);
        disposables.geo.push(blobGeo);
        disposables.mat.push(blobMat);
      }
      return tree;
    }
    scene.add(createNightTree(-11, -6, 1.1));
    scene.add(createNightTree(12, 6, 1.0));
    scene.add(createNightTree(-12, 8, 0.8));
    scene.add(createNightTree(11, -10, 0.75));

    // ─── Koi (simple glowing fish swimming in the pond) ───
    const koi: THREE.Mesh[] = [];
    const koiColors = [0xff8a5b, 0xf4f4f4, 0xffd166, 0xff6f91];
    for (let i = 0; i < 5; i++) {
      const koiGeo = new THREE.SphereGeometry(0.22, 12, 8);
      const koiMat = new THREE.MeshStandardMaterial({ color: koiColors[i % koiColors.length], emissive: koiColors[i % koiColors.length], emissiveIntensity: 0.3, roughness: 0.5, transparent: true, opacity: 0.92 });
      const fish = new THREE.Mesh(koiGeo, koiMat);
      fish.scale.set(2.2, 0.5, 0.9);
      const radius = 2.5 + Math.random() * 6;
      fish.userData = { radius, speed: 0.2 + Math.random() * 0.25, phase: Math.random() * Math.PI * 2, y: -0.02 } as KoiData;
      scene.add(fish);
      koi.push(fish);
      disposables.geo.push(koiGeo);
      disposables.mat.push(koiMat);
    }

    // ─── Falling petals (pale moonlit) ───
    const fallingPetals: THREE.Mesh[] = [];
    for (let i = 0; i < 55; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xc9d6ff, transparent: true, opacity: 0.55 + Math.random() * 0.3, emissive: 0x6f86d9, emissiveIntensity: 0.25, side: THREE.DoubleSide, roughness: 0.7 });
      const petal = new THREE.Mesh(petalShapeGeo, mat);
      petal.position.set((Math.random() - 0.5) * 28, Math.random() * 12 + 4, (Math.random() - 0.5) * 24);
      petal.scale.setScalar(0.18 + Math.random() * 0.3);
      petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      petal.userData = { fall: 0.004 + Math.random() * 0.008, sway: 0.3 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2, rot: (Math.random() - 0.5) * 0.02 };
      scene.add(petal);
      fallingPetals.push(petal);
      disposables.mat.push(mat);
    }

    // ─── Spirit fireflies ───
    const spiritCount = 70;
    const spiritGeo = new THREE.BufferGeometry();
    const spiritPos = new Float32Array(spiritCount * 3);
    const spiritPhases: number[] = [];
    for (let i = 0; i < spiritCount; i++) {
      spiritPos[i * 3] = (Math.random() - 0.5) * 30;
      spiritPos[i * 3 + 1] = 0.3 + Math.random() * 7;
      spiritPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      spiritPhases.push(Math.random() * Math.PI * 2);
    }
    spiritGeo.setAttribute('position', new THREE.BufferAttribute(spiritPos, 3));
    const spiritMat = new THREE.PointsMaterial({ color: 0x86e1ff, size: 0.1, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(spiritGeo, spiritMat));
    disposables.geo.push(spiritGeo);
    disposables.mat.push(spiritMat);

    // ─── Camera ───
    const camOrbitRadius = 11;
    const camY = 2.0;
    camera.position.set(camOrbitRadius, camY, 0);
    camera.lookAt(0, 0.5, 0);
    canvas.style.pointerEvents = 'none';

    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Water ripples
      for (let i = 0; i < waterPositions.count; i++) {
        const x = waterPositions.getX(i);
        const y = waterPositions.getY(i);
        const wave = Math.sin(x * 0.4 + t * 0.9) * 0.05 + Math.cos(y * 0.5 + t * 0.7) * 0.04;
        waterPositions.setZ(i, waterOriginalZ[i] + wave);
      }
      waterPositions.needsUpdate = true;
      waterGeo.computeVertexNormals();
      waterMat.emissiveIntensity = 0.45 + Math.sin(t * 0.5) * 0.08;

      // Koi swim
      koi.forEach((fish) => {
        const d = fish.userData as KoiData;
        const a = t * d.speed + d.phase;
        fish.position.set(Math.cos(a) * d.radius, d.y, Math.sin(a) * d.radius);
        fish.rotation.y = -a + Math.PI / 2;
      });

      // Petals fall
      fallingPetals.forEach((petal) => {
        const d = petal.userData as { fall: number; sway: number; phase: number; rot: number };
        petal.position.y -= d.fall;
        petal.position.x += Math.sin(t * d.sway + d.phase) * 0.005;
        petal.rotation.z += d.rot;
        petal.rotation.x += d.rot * 0.5;
        if (petal.position.y < -0.5) {
          petal.position.y = Math.random() * 5 + 10;
          petal.position.x = (Math.random() - 0.5) * 28;
          petal.position.z = (Math.random() - 0.5) * 24;
        }
      });

      // Spirit lights
      const sp = spiritGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < spiritCount; i++) {
        const i3 = i * 3;
        sp[i3] += Math.sin(t * 0.4 + spiritPhases[i]) * 0.006;
        sp[i3 + 1] += Math.sin(t * 0.5 + spiritPhases[i] * 1.3) * 0.004;
        sp[i3 + 2] += Math.cos(t * 0.35 + spiritPhases[i] * 0.9) * 0.006;
        if (sp[i3 + 1] < 0.2) sp[i3 + 1] = 6;
        if (sp[i3 + 1] > 8) sp[i3 + 1] = 0.3;
      }
      spiritGeo.attributes.position.needsUpdate = true;
      spiritMat.opacity = 0.4 + Math.sin(t * 3) * 0.25 + Math.sin(t * 7) * 0.1;

      // Lantern flicker
      lanternGlows.forEach((glow, i) => {
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(t * 5 + i * 1.7) * 0.12 + Math.sin(t * 13 + i) * 0.05;
      });

      // Sky drift, twinkle, moon halo, glints
      sky.rotation.y = t * 0.004;
      starsFar.opacity = 0.6 + Math.sin(t * 1.3) * 0.12;
      starsNear.opacity = 0.8 + Math.sin(t * 2.1 + 1) * 0.15;
      cNodeMat.opacity = 0.85 + Math.sin(t * 1.7) * 0.12;
      halo.scale.setScalar(1 + Math.sin(t * 0.4) * 0.04);
      haloMat.opacity = 0.1 + Math.sin(t * 0.4) * 0.03;
      glintMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.3;

      // Camera orbit
      const camAngle = t * 0.05;
      camera.position.x = Math.cos(camAngle) * camOrbitRadius;
      camera.position.z = Math.sin(camAngle) * camOrbitRadius;
      camera.position.y = camY + Math.sin(t * 0.12) * 0.3;
      camera.lookAt(0, 0.5, 0);

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

  return <canvas id="zen-bridge-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}