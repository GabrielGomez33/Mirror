// src/components/three/ZenGardenScene.tsx
// Enterprise zen garden: realistic cherry trees at depth, lifelike petals & flowers,
// animated ripple rings in sand, butterflies & fireflies, low camera.
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

export default function ZenGardenScene() {
  useEffect(() => {
    const canvas = document.getElementById('zen-garden-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // ─── Core ───
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ─── Lighting ───
    const ambientLight = new THREE.AmbientLight(0xffd1dc, 0.55);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffe4e6, 1.0);
    sunLight.position.set(6, 18, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xff69b4, 0.3);
    fillLight.position.set(-6, 10, -4);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0xfce4ec, 0x8d6e63, 0.25);
    scene.add(hemiLight);

    // ─── Fog ───
    scene.fog = new THREE.FogExp2(0xfce4ec, 0.014);

    // Disposable tracking
    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[] } = { geo: [], mat: [] };

    // ─── Sand Ground ───
    const sandGeo = new THREE.CircleGeometry(35, 64);
    const sandMat = new THREE.MeshLambertMaterial({
      color: 0xfff5ee,
      emissive: 0xffb6c1,
      emissiveIntensity: 0.03,
    });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.02;
    sand.receiveShadow = true;
    scene.add(sand);
    disposables.geo.push(sandGeo);
    disposables.mat.push(sandMat);

    // ─── Raked Sand Patterns ───
    const rakedRings: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const inner = 2.0 + i * 1.0;
      const outer = inner + 0.05;
      const ringGeo = new THREE.RingGeometry(inner, outer, 72);
      const ringMat = new THREE.MeshLambertMaterial({
        color: 0xffe8d6,
        transparent: true,
        opacity: 0.5 - i * 0.02,
        emissive: 0xffc0cb,
        emissiveIntensity: 0.02,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      scene.add(ring);
      rakedRings.push(ring);
      disposables.geo.push(ringGeo);
      disposables.mat.push(ringMat);
    }

    // Radial lines
    const radialLines: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const lineGeo = new THREE.BoxGeometry(0.04, 0.004, 14);
      const lineMat = new THREE.MeshLambertMaterial({
        color: 0xffe8d6,
        transparent: true,
        opacity: 0.18,
        emissive: 0xffc0cb,
        emissiveIntensity: 0.02,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(Math.cos(angle) * 10, 0.003, Math.sin(angle) * 10);
      line.rotation.y = angle;
      scene.add(line);
      radialLines.push(line);
      disposables.geo.push(lineGeo);
      disposables.mat.push(lineMat);
    }

    // ─── Stacked Meditation Stones (Cairn) ───
    const stones: THREE.Mesh[] = [];
    const stoneConfigs = [
      { radius: 0.95, scaleY: 0.52, scaleXZ: 1.1, y: 0.32, color: 0x556b6b },
      { radius: 0.78, scaleY: 0.5, scaleXZ: 1.05, y: 0.88, color: 0x607878 },
      { radius: 0.62, scaleY: 0.48, scaleXZ: 1.0, y: 1.35, color: 0x6b8383 },
      { radius: 0.48, scaleY: 0.45, scaleXZ: 0.95, y: 1.72, color: 0x708888 },
      { radius: 0.35, scaleY: 0.42, scaleXZ: 0.9, y: 2.02, color: 0x789090 },
    ];

    stoneConfigs.forEach((cfg, index) => {
      const geo = new THREE.SphereGeometry(cfg.radius, 24, 16);
      const mat = new THREE.MeshLambertMaterial({
        color: cfg.color,
        emissive: 0xff69b4,
        emissiveIntensity: 0.015,
      });
      const stone = new THREE.Mesh(geo, mat);
      stone.scale.set(cfg.scaleXZ, cfg.scaleY, cfg.scaleXZ);
      stone.position.set(0, cfg.y, 0);
      stone.rotation.y = index * 0.35;
      stone.castShadow = true;
      stone.userData = {
        baseY: cfg.y,
        breathPhase: index * 0.25,
        breathSpeed: 0.3 + index * 0.04,
      } as StoneUserData;
      scene.add(stone);
      stones.push(stone);
      disposables.geo.push(geo);
      disposables.mat.push(mat);
    });

    // 4 accent stones evenly spaced around cairn (all visible from any angle)
    [
      { x: 1.5, z: 0.0, r: 0.28, c: 0x5e7575 },   // right
      { x: -1.4, z: 0.2, r: 0.24, c: 0x677e7e },   // left
      { x: 0.1, z: 1.4, r: 0.26, c: 0x5a7070 },    // front
      { x: -0.2, z: -1.5, r: 0.22, c: 0x6d8585 },   // back
    ].forEach(cfg => {
      const geo = new THREE.SphereGeometry(cfg.r, 12, 8);
      const mat = new THREE.MeshLambertMaterial({ color: cfg.c, emissive: 0xff69b4, emissiveIntensity: 0.01 });
      const s = new THREE.Mesh(geo, mat);
      s.scale.set(1.15, 0.55, 1.05);
      s.position.set(cfg.x, cfg.r * 0.32, cfg.z);
      s.castShadow = true;
      scene.add(s);
      stones.push(s);
      disposables.geo.push(geo);
      disposables.mat.push(mat);
    });

    // ─── Realistic Petal & Leaf Shapes ───
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

    function makeLeafShape(): THREE.Shape {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(0.08, 0.05, 0.15, 0.2, 0.12, 0.4);
      s.bezierCurveTo(0.1, 0.55, 0.04, 0.7, 0, 0.8);
      s.bezierCurveTo(-0.04, 0.7, -0.1, 0.55, -0.12, 0.4);
      s.bezierCurveTo(-0.15, 0.2, -0.08, 0.05, 0, 0);
      return s;
    }

    const petalShapeGeo = new THREE.ShapeGeometry(makePetalShape());
    const leafShapeGeo = new THREE.ShapeGeometry(makeLeafShape());
    disposables.geo.push(petalShapeGeo, leafShapeGeo);

    // ─── Cherry Blossom Tree Builder ───
    // Simple: trunk + dense soft canopy dome. No exposed limbs.
    function createCherryTree(
      baseX: number, baseZ: number, scale: number, density: number
    ): THREE.Group {
      const tree = new THREE.Group();
      tree.position.set(baseX, 0, baseZ);

      const trunkH = 2.8 * scale;
      const trunkMat = new THREE.MeshLambertMaterial({
        color: 0x5d4037,
        emissive: 0x3e2723,
        emissiveIntensity: 0.05,
      });
      disposables.mat.push(trunkMat);

      // ── Trunk (tapered, slight lean) ──
      const trunkGeo = new THREE.CylinderGeometry(
        0.08 * scale, 0.2 * scale, trunkH, 8
      );
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      trunk.rotation.z = (Math.random() - 0.5) * 0.08;
      tree.add(trunk);
      disposables.geo.push(trunkGeo);

      // ── Canopy: many small soft blobs = cloud-like blossom dome ──
      const canopyCenter = new THREE.Vector3(0, trunkH + 0.3 * scale, 0);
      const canopyRXZ = (1.8 + Math.random() * 0.6) * scale;
      const canopyRY = (1.0 + Math.random() * 0.3) * scale;

      // Many SMALL blobs for a soft, cohesive cloud
      const cloudCount = Math.floor(55 * Math.max(density, 0.5));
      for (let i = 0; i < cloudCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        const rFrac = 0.2 + Math.random() * 0.8;

        const blobSize = (0.15 + Math.random() * 0.3) * scale;
        const blobGeo = new THREE.SphereGeometry(blobSize, 6, 5);
        const blobMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(
            0.93 + Math.random() * 0.04,
            0.4 + Math.random() * 0.25,
            0.78 + Math.random() * 0.14
          ),
          transparent: true,
          opacity: 0.55 + Math.random() * 0.35,
          emissive: 0xf48fb1,
          emissiveIntensity: 0.08,
        });
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.set(
          canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ * rFrac,
          canopyCenter.y + Math.cos(phi) * canopyRY * rFrac,
          canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ * rFrac
        );
        blob.scale.set(1, 0.5 + Math.random() * 0.3, 1);
        tree.add(blob);
        disposables.geo.push(blobGeo);
        disposables.mat.push(blobMat);
      }

      // ── Detail flowers on canopy surface ──
      const flowerCount = Math.floor(10 * Math.max(density, 0.4));
      for (let f = 0; f < flowerCount; f++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.55;
        const fx = canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ;
        const fy = canopyCenter.y + Math.cos(phi) * canopyRY;
        const fz = canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ;

        const fGroup = new THREE.Group();
        fGroup.position.set(fx, fy, fz);
        const hue = 0.92 + Math.random() * 0.06;
        for (let p = 0; p < 5; p++) {
          const pMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(hue, 0.65, 0.82 + Math.random() * 0.1),
            transparent: true, opacity: 0.88,
            emissive: 0xff69b4, emissiveIntensity: 0.12,
            side: THREE.DoubleSide,
          });
          const pet = new THREE.Mesh(petalShapeGeo, pMat);
          disposables.mat.push(pMat);
          const pa = (p / 5) * Math.PI * 2;
          pet.position.set(Math.cos(pa) * 0.07 * scale, 0, Math.sin(pa) * 0.07 * scale);
          pet.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, pa, 0);
          pet.scale.setScalar((0.18 + Math.random() * 0.1) * scale);
          fGroup.add(pet);
        }
        const stGeo = new THREE.SphereGeometry(0.02 * scale, 6, 4);
        const stMat = new THREE.MeshLambertMaterial({
          color: 0xffd54f, emissive: 0xffab00, emissiveIntensity: 0.3,
        });
        fGroup.add(new THREE.Mesh(stGeo, stMat));
        disposables.geo.push(stGeo);
        disposables.mat.push(stMat);
        fGroup.lookAt(fx + (fx - canopyCenter.x), fy + (fy - canopyCenter.y) * 0.5, fz + (fz - canopyCenter.z));
        tree.add(fGroup);
      }

      // ── Leaves ──
      const leafCount = Math.floor(12 * Math.max(density, 0.4));
      for (let i = 0; i < leafCount; i++) {
        const lMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.28 + Math.random() * 0.1, 0.5, 0.3 + Math.random() * 0.15),
          transparent: true, opacity: 0.75, side: THREE.DoubleSide,
        });
        const leaf = new THREE.Mesh(leafShapeGeo, lMat);
        disposables.mat.push(lMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.55;
        const r = 0.5 + Math.random() * 0.5;
        leaf.position.set(
          canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ * r,
          canopyCenter.y + Math.cos(phi) * canopyRY * r,
          canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ * r
        );
        leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        leaf.scale.setScalar((0.2 + Math.random() * 0.25) * scale);
        tree.add(leaf);
      }

      return tree;
    }

    // ─── Place Trees (ALL outside camera orbit radius of 10) ───
    const allTrees: THREE.Group[] = [];

    // Ring of trees around the garden — closest at ~14 units from center
    allTrees.push(createCherryTree(14, 4, 1.2, 1.2));
    allTrees.push(createCherryTree(-13, 6, 1.1, 1.1));
    allTrees.push(createCherryTree(6, -14, 1.0, 1.0));
    allTrees.push(createCherryTree(-8, -14, 1.05, 1.0));

    // Mid-distance ring ~18-22 units
    allTrees.push(createCherryTree(18, -10, 0.85, 0.85));
    allTrees.push(createCherryTree(-18, -8, 0.8, 0.8));
    allTrees.push(createCherryTree(0, 18, 0.9, 0.9));
    allTrees.push(createCherryTree(15, 14, 0.75, 0.75));

    // Far trees ~25-30 units (smaller, depth)
    allTrees.push(createCherryTree(-24, -18, 0.55, 0.55));
    allTrees.push(createCherryTree(26, -16, 0.5, 0.5));
    allTrees.push(createCherryTree(-12, 24, 0.5, 0.5));

    allTrees.forEach(t => scene.add(t));

    // ─── Glowing Moon ───
    const moonGeo = new THREE.SphereGeometry(3.5, 32, 32);
    const moonMat = new THREE.MeshLambertMaterial({
      color: 0xffd1dc,
      transparent: true,
      opacity: 0.65,
      emissive: 0xffb6c1,
      emissiveIntensity: 0.8,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-8, 15, -22);
    scene.add(moon);
    disposables.geo.push(moonGeo);
    disposables.mat.push(moonMat);

    const haloGeo = new THREE.SphereGeometry(4.8, 32, 32);
    const haloMat = new THREE.MeshLambertMaterial({
      color: 0xffc0cb,
      transparent: true,
      opacity: 0.1,
      emissive: 0xff69b4,
      emissiveIntensity: 0.4,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(moon.position);
    scene.add(halo);
    disposables.geo.push(haloGeo);
    disposables.mat.push(haloMat);

    const outerGlowGeo = new THREE.SphereGeometry(6.5, 32, 32);
    const outerGlowMat = new THREE.MeshLambertMaterial({
      color: 0xffd1dc,
      transparent: true,
      opacity: 0.05,
      emissive: 0xffb6c1,
      emissiveIntensity: 0.2,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    outerGlow.position.copy(moon.position);
    scene.add(outerGlow);
    disposables.geo.push(outerGlowGeo);
    disposables.mat.push(outerGlowMat);

    // ─── Falling Sakura Petals (lifelike) ───
    const petalColors = [0xffb3d9, 0xffc0cb, 0xff69b4, 0xffa0c9, 0xffb6c1, 0xffc1cc];
    const fallingPetals: THREE.Mesh[] = [];

    for (let i = 0; i < 100; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        transparent: true,
        opacity: 0.7 + Math.random() * 0.3,
        emissive: 0xff69b4,
        emissiveIntensity: 0.12,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(mat);

      const petal = new THREE.Mesh(petalShapeGeo, mat);
      petal.position.set(
        (Math.random() - 0.5) * 35,
        Math.random() * 14 + 5,
        (Math.random() - 0.5) * 25
      );
      const s = 0.2 + Math.random() * 0.4;
      petal.scale.setScalar(s);
      petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      petal.userData = {
        fallSpeed: 0.004 + Math.random() * 0.01,
        swayFreq: 0.3 + Math.random() * 0.4,
        swayAmp: 0.3 + Math.random() * 0.7,
        spiralSpeed: (Math.random() - 0.5) * 0.3,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.018,
          (Math.random() - 0.5) * 0.012
        ),
        phase: Math.random() * Math.PI * 2,
        flutterAmp: 0.5 + Math.random() * 1.5,
      } as PetalUserData;

      scene.add(petal);
      fallingPetals.push(petal);
    }

    // ─── Settled Petals on Sand ───
    const settledPetals: THREE.Mesh[] = [];
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(0.92 + Math.random() * 0.06, 0.6, 0.85),
        transparent: true,
        opacity: 0.5 + Math.random() * 0.3,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(mat);
      const petal = new THREE.Mesh(petalShapeGeo, mat);
      const a = Math.random() * Math.PI * 2;
      const d = 1.5 + Math.random() * 10;
      petal.position.set(Math.cos(a) * d, 0.015, Math.sin(a) * d);
      petal.scale.setScalar(0.12 + Math.random() * 0.18);
      petal.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      petal.rotation.z = Math.random() * Math.PI * 2;
      scene.add(petal);
      settledPetals.push(petal);
    }

    // ─── Butterflies ───
    interface ButterflyData {
      orbitRadius: number;
      orbitSpeed: number;
      baseY: number;
      vertSpeed: number;
      wingSpeed: number;
      phase: number;
    }
    const butterflies: THREE.Group[] = [];

    function createButterfly(): THREE.Group {
      const bg = new THREE.Group();
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.bezierCurveTo(0.06, 0.08, 0.15, 0.12, 0.14, 0.06);
      wingShape.bezierCurveTo(0.16, 0.02, 0.12, -0.04, 0.08, -0.06);
      wingShape.bezierCurveTo(0.04, -0.08, 0, -0.02, 0, 0);
      const wGeo = new THREE.ShapeGeometry(wingShape);
      disposables.geo.push(wGeo);

      const hue = Math.random() > 0.5 ? 0.75 + Math.random() * 0.2 : 0.05 + Math.random() * 0.1;
      const wMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        transparent: true,
        opacity: 0.85,
        emissive: new THREE.Color().setHSL(hue, 0.9, 0.4),
        emissiveIntensity: 0.15,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(wMat);

      const lw = new THREE.Mesh(wGeo, wMat);
      lw.scale.set(1.5, 1.5, 1);
      bg.add(lw);
      const rw = new THREE.Mesh(wGeo, wMat);
      rw.scale.set(-1.5, 1.5, 1);
      bg.add(rw);

      const bodyGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      bg.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      bg.scale.setScalar(0.7 + Math.random() * 0.4);
      return bg;
    }

    for (let i = 0; i < 6; i++) {
      const bf = createButterfly();
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 8;
      bf.position.set(Math.cos(a) * r, 2 + Math.random() * 5, Math.sin(a) * r);
      bf.userData = {
        orbitRadius: r,
        orbitSpeed: 0.15 + Math.random() * 0.3,
        baseY: 2 + Math.random() * 5,
        vertSpeed: 0.5 + Math.random() * 1.0,
        wingSpeed: 6 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
      } as ButterflyData;
      scene.add(bf);
      butterflies.push(bf);
    }

    // ─── Fireflies ───
    const fireflyCount = 60;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    const fireflyPhases: number[] = [];
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3] = (Math.random() - 0.5) * 35;
      fireflyPos[i * 3 + 1] = 0.3 + Math.random() * 8;
      fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 35;
      fireflyPhases.push(Math.random() * Math.PI * 2);
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
    const fireflyMat = new THREE.PointsMaterial({
      color: 0xffeb3b,
      size: 0.08,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
    scene.add(fireflyPoints);
    disposables.geo.push(fireflyGeo);
    disposables.mat.push(fireflyMat);

    // ─── Sparkle Particles ───
    const sparkCount = 120;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkPhases: number[] = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 40;
      sparkPos[i * 3 + 1] = 0.5 + Math.random() * 18;
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      sparkPhases.push(Math.random() * Math.PI * 2);
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);
    disposables.geo.push(sparkGeo);
    disposables.mat.push(sparkMat);

    // ─── Camera: low intimate perspective ───
    camera.position.set(8, 3, 8);
    camera.lookAt(0, 2.5, 0);

    // Disable user interaction
    canvas.style.pointerEvents = 'none';

    // ─── Animation Loop ───
    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Stone breathing
      stones.forEach(stone => {
        const d = stone.userData as StoneUserData;
        if (d.baseY !== undefined) {
          stone.position.y = d.baseY + Math.sin(t * d.breathSpeed + d.breathPhase) * 0.005;
        }
      });

      // Falling petals (lifelike physics)
      fallingPetals.forEach(petal => {
        const d = petal.userData as PetalUserData;
        petal.position.y -= d.fallSpeed;
        petal.position.x += Math.sin(t * d.swayFreq + d.phase) * d.swayAmp * 0.005;
        petal.position.z += Math.cos(t * d.swayFreq * 0.7 + d.phase) * d.swayAmp * 0.003;
        const spiral = t * d.spiralSpeed + d.phase;
        petal.position.x += Math.cos(spiral) * 0.002;
        petal.position.z += Math.sin(spiral) * 0.002;
        petal.rotation.x += d.rotSpeed.x + Math.sin(t * d.flutterAmp + d.phase) * 0.004;
        petal.rotation.y += d.rotSpeed.y;
        petal.rotation.z += d.rotSpeed.z + Math.cos(t * d.flutterAmp * 0.8 + d.phase) * 0.003;

        const mat = petal.material as THREE.MeshLambertMaterial;
        if (petal.position.y < 0.5) {
          mat.opacity = Math.max(0, mat.opacity - 0.012);
        }
        if (petal.position.y < -2 || mat.opacity <= 0) {
          petal.position.y = Math.random() * 5 + 12;
          petal.position.x = (Math.random() - 0.5) * 35;
          petal.position.z = (Math.random() - 0.5) * 25;
          mat.opacity = 0.7 + Math.random() * 0.3;
        }
      });

      // Settled petals drift
      settledPetals.forEach((p, i) => {
        p.rotation.z += 0.0006;
        p.position.y = 0.015 + Math.sin(t * 0.3 + i) * 0.002;
      });

      // Moon glow pulse
      haloMat.opacity = 0.08 + Math.sin(t * 0.4) * 0.03;
      outerGlowMat.opacity = 0.04 + Math.sin(t * 0.3 + 1) * 0.015;

      // Raked ring shimmer
      rakedRings.forEach((ring, i) => {
        const m = ring.material as THREE.MeshLambertMaterial;
        m.opacity = (0.45 - i * 0.02) + Math.sin(t * 0.3 + i * 0.5) * 0.03;
      });

      // Butterflies
      butterflies.forEach(bf => {
        const d = bf.userData as ButterflyData;
        const a = t * d.orbitSpeed + d.phase;
        bf.position.x = Math.cos(a) * d.orbitRadius + Math.sin(t * 0.3 + d.phase) * 1.5;
        bf.position.z = Math.sin(a) * d.orbitRadius + Math.cos(t * 0.4 + d.phase) * 1.2;
        bf.position.y = d.baseY + Math.sin(t * d.vertSpeed + d.phase) * 1.0;
        const flap = Math.sin(t * d.wingSpeed) * 0.8;
        if (bf.children[0]) bf.children[0].rotation.y = flap;
        if (bf.children[1]) bf.children[1].rotation.y = -flap;
        const na = (t + 0.05) * d.orbitSpeed + d.phase;
        bf.rotation.y = Math.atan2(
          Math.sin(na) * d.orbitRadius - bf.position.z,
          Math.cos(na) * d.orbitRadius - bf.position.x
        );
      });

      // Fireflies
      const fPos = fireflyGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < fireflyCount; i++) {
        const i3 = i * 3;
        fPos[i3] += Math.sin(t * 0.4 + fireflyPhases[i]) * 0.006;
        fPos[i3 + 1] += Math.sin(t * 0.5 + fireflyPhases[i] * 1.3) * 0.004;
        fPos[i3 + 2] += Math.cos(t * 0.35 + fireflyPhases[i] * 0.9) * 0.006;
        if (fPos[i3 + 1] < 0.2) fPos[i3 + 1] = 7;
        if (fPos[i3 + 1] > 9) fPos[i3 + 1] = 0.3;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      fireflyMat.opacity = 0.3 + Math.sin(t * 3) * 0.25 + Math.sin(t * 7) * 0.1;

      // Sparkles
      const sPos = sparkGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkCount; i++) {
        const i3 = i * 3;
        sPos[i3] += Math.sin(t * 0.25 + sparkPhases[i]) * 0.003;
        sPos[i3 + 1] += Math.sin(t * 0.35 + sparkPhases[i] * 1.5) * 0.004;
        sPos[i3 + 2] += Math.cos(t * 0.3 + sparkPhases[i] * 0.8) * 0.003;
        if (sPos[i3] > 20) sPos[i3] = -20;
        if (sPos[i3] < -20) sPos[i3] = 20;
        if (sPos[i3 + 2] > 20) sPos[i3 + 2] = -20;
        if (sPos[i3 + 2] < -20) sPos[i3 + 2] = 20;
        if (sPos[i3 + 1] < 0.5) sPos[i3 + 1] = 18;
        if (sPos[i3 + 1] > 19) sPos[i3 + 1] = 1;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 0.25 + Math.sin(t * 2.5) * 0.3;

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
      disposables.geo.forEach(g => g.dispose());
      disposables.mat.forEach(m => m.dispose());
      renderer.dispose();
    };
  }, []);

  return <canvas id="zen-garden-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}
