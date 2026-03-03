// src/components/three/ZenPondScene.tsx
// Enterprise-level zen pond with realistic water, cherry blossom trees at depth,
// lifelike petals, animated ripples, butterflies, dragonflies, and fireflies.
import { useEffect } from 'react';
import * as THREE from 'three';

export default function ZenPondScene() {
  useEffect(() => {
    const canvas = document.getElementById('forest-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // ─── Core Setup ───
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ─── Lighting ───
    const ambientLight = new THREE.AmbientLight(0xffd1dc, 0.55);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffe8ec, 1.0);
    sunLight.position.set(10, 20, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xffc0e7, 0.35);
    fillLight.position.set(-8, 12, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff69b4, 0.25);
    rimLight.position.set(0, 5, -15);
    scene.add(rimLight);

    // Subtle hemisphere light for natural sky/ground color
    const hemiLight = new THREE.HemisphereLight(0xfce4ec, 0x8d6e63, 0.3);
    scene.add(hemiLight);

    // ─── Fog for Depth ───
    scene.fog = new THREE.FogExp2(0xfce4ec, 0.012);

    // ─── Ground Plane (earth beneath water) ───
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshLambertMaterial({
      color: 0x8d6e63,
      emissive: 0x5d4037,
      emissiveIntensity: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // ─── Water Surface with Ripple Vertices ───
    const waterSegments = 80;
    const waterGeo = new THREE.PlaneGeometry(60, 60, waterSegments, waterSegments);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0xffb8d9,
      transparent: true,
      opacity: 0.28,
      emissive: 0x90caf9,
      emissiveIntensity: 0.08,
      specular: 0xffffff,
      shininess: 180,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    water.receiveShadow = true;
    scene.add(water);

    // Store original water vertex positions for wave animation
    const waterPositions = waterGeo.attributes.position;
    const waterOriginalY = new Float32Array(waterPositions.count);
    for (let i = 0; i < waterPositions.count; i++) {
      waterOriginalY[i] = waterPositions.getZ(i); // Z because it's rotated
    }

    // ─── Ripple System ───
    interface Ripple {
      mesh: THREE.Mesh;
      age: number;
      maxAge: number;
      x: number;
      z: number;
    }
    const ripples: Ripple[] = [];
    const rippleGeo = new THREE.RingGeometry(0.1, 0.2, 32);

    function spawnRipple(x: number, z: number) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(rippleGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.02, z);
      scene.add(ring);
      ripples.push({ mesh: ring, age: 0, maxAge: 3 + Math.random() * 2, x, z });
    }

    // Pre-spawn some ripples
    for (let i = 0; i < 6; i++) {
      spawnRipple((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    }

    // ─── Cherry Blossom Tree Builder ───
    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[] } = { geo: [], mat: [] };

    function createRealisticPetalShape(): THREE.Shape {
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

    function createLeafShape(): THREE.Shape {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(0.08, 0.05, 0.15, 0.2, 0.12, 0.4);
      s.bezierCurveTo(0.1, 0.55, 0.04, 0.7, 0, 0.8);
      s.bezierCurveTo(-0.04, 0.7, -0.1, 0.55, -0.12, 0.4);
      s.bezierCurveTo(-0.15, 0.2, -0.08, 0.05, 0, 0);
      return s;
    }

    const petalShapeGeo = new THREE.ShapeGeometry(createRealisticPetalShape());
    const leafShapeGeo = new THREE.ShapeGeometry(createLeafShape());
    disposables.geo.push(petalShapeGeo, leafShapeGeo);

    function createCherryTree(
      baseX: number, baseZ: number, scale: number, branchDensity: number
    ): THREE.Group {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(baseX, 0, baseZ);

      const trunkHeight = 2.8 * scale;
      const bMat = new THREE.MeshLambertMaterial({
        color: 0x5d4037, emissive: 0x3e2723, emissiveIntensity: 0.05,
      });
      disposables.mat.push(bMat);

      const trunkGeo = new THREE.CylinderGeometry(0.08 * scale, 0.2 * scale, trunkHeight, 8);
      const trunk = new THREE.Mesh(trunkGeo, bMat);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.rotation.z = (Math.random() - 0.5) * 0.08;
      treeGroup.add(trunk);
      disposables.geo.push(trunkGeo);

      // ── Dense soft canopy dome (no exposed limbs) ──
      const canopyCenter = new THREE.Vector3(0, trunkHeight + 0.3 * scale, 0);
      const canopyRXZ = (1.8 + Math.random() * 0.6) * scale;
      const canopyRY = (1.0 + Math.random() * 0.3) * scale;

      const cloudCount = Math.floor(55 * Math.max(branchDensity, 0.5));
      for (let i = 0; i < cloudCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        const rFrac = 0.2 + Math.random() * 0.8;
        const blobSize = (0.15 + Math.random() * 0.3) * scale;
        const blobGeo = new THREE.SphereGeometry(blobSize, 6, 5);
        const blobMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.93 + Math.random() * 0.04, 0.4 + Math.random() * 0.25, 0.78 + Math.random() * 0.14),
          transparent: true, opacity: 0.55 + Math.random() * 0.35,
          emissive: 0xf48fb1, emissiveIntensity: 0.08,
        });
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.set(
          canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ * rFrac,
          canopyCenter.y + Math.cos(phi) * canopyRY * rFrac,
          canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ * rFrac
        );
        blob.scale.set(1, 0.5 + Math.random() * 0.3, 1);
        treeGroup.add(blob);
        disposables.geo.push(blobGeo);
        disposables.mat.push(blobMat);
      }

      // ── Detail flowers ──
      const flowerCount = Math.floor(10 * Math.max(branchDensity, 0.4));
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
            transparent: true, opacity: 0.88, emissive: 0xff69b4, emissiveIntensity: 0.12, side: THREE.DoubleSide,
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
        const stMat = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0xffab00, emissiveIntensity: 0.3 });
        fGroup.add(new THREE.Mesh(stGeo, stMat));
        disposables.geo.push(stGeo);
        disposables.mat.push(stMat);
        fGroup.lookAt(fx + (fx - canopyCenter.x), fy + (fy - canopyCenter.y) * 0.5, fz + (fz - canopyCenter.z));
        treeGroup.add(fGroup);
      }

      // ── Leaves ──
      const leafCount = Math.floor(12 * Math.max(branchDensity, 0.4));
      for (let i = 0; i < leafCount; i++) {
        const leafMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.28 + Math.random() * 0.1, 0.5, 0.3 + Math.random() * 0.15),
          transparent: true, opacity: 0.75, side: THREE.DoubleSide,
        });
        const leaf = new THREE.Mesh(leafShapeGeo, leafMat);
        disposables.mat.push(leafMat);
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
        treeGroup.add(leaf);
      }

      return treeGroup;
    }


    // ─── Place Trees at Various Distances ───
    // Camera orbits at radius 12, so all trees must be >14 units from origin
    const trees: THREE.Group[] = [];

    // Near trees (just outside camera orbit, detailed, large)
    trees.push(createCherryTree(14, 4, 1.2, 1.2));
    trees.push(createCherryTree(-13, 6, 1.1, 1.1));
    trees.push(createCherryTree(6, -14, 1.0, 1.0));
    trees.push(createCherryTree(-5, 14, 1.05, 1.0));

    // Mid-distance trees
    trees.push(createCherryTree(-16, -12, 0.9, 0.9));
    trees.push(createCherryTree(18, -10, 0.85, 0.8));
    trees.push(createCherryTree(0, -18, 0.95, 1.0));

    // Far trees (smaller, less detail, show depth)
    trees.push(createCherryTree(-22, -20, 0.6, 0.5));
    trees.push(createCherryTree(24, -18, 0.55, 0.5));
    trees.push(createCherryTree(-10, -26, 0.5, 0.4));
    trees.push(createCherryTree(17, -24, 0.45, 0.4));

    // Very far silhouette trees
    trees.push(createCherryTree(-28, -32, 0.35, 0.3));
    trees.push(createCherryTree(30, -30, 0.3, 0.3));

    trees.forEach(t => scene.add(t));

    // ─── Lotus Flowers on Water ───
    const lotusFlowers: THREE.Group[] = [];
    const reflectedLotus: THREE.Group[] = [];

    function createLotus(scale: number): THREE.Group {
      const lotusGroup = new THREE.Group();

      // Lily pad
      const padGeo = new THREE.CircleGeometry(0.9 * scale, 24);
      const padMat = new THREE.MeshLambertMaterial({
        color: 0x66bb6a,
        emissive: 0x388e3c,
        emissiveIntensity: 0.08,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      lotusGroup.add(pad);
      disposables.geo.push(padGeo);
      disposables.mat.push(padMat);

      // Petals arranged as real flower
      const petalLayers = [
        { count: 6, radius: 0.22, height: 0.08, tilt: 0.6, size: 0.7 },
        { count: 5, radius: 0.12, height: 0.14, tilt: 0.3, size: 0.5 },
      ];

      petalLayers.forEach(layer => {
        for (let p = 0; p < layer.count; p++) {
          const angle = (p / layer.count) * Math.PI * 2 + (layer.count === 5 ? 0.3 : 0);
          const petalMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0.93, 0.7, 0.85 + Math.random() * 0.1),
            transparent: true,
            opacity: 0.9,
            emissive: 0xf48fb1,
            emissiveIntensity: 0.15,
            side: THREE.DoubleSide,
          });
          const petal = new THREE.Mesh(petalShapeGeo, petalMat);
          disposables.mat.push(petalMat);

          petal.position.set(
            Math.cos(angle) * layer.radius * scale,
            layer.height * scale,
            Math.sin(angle) * layer.radius * scale
          );
          petal.rotation.set(-Math.PI / 2 + layer.tilt, angle, 0);
          petal.scale.setScalar(layer.size * scale);
          lotusGroup.add(petal);
        }
      });

      // Center stamen
      const cGeo = new THREE.SphereGeometry(0.06 * scale, 8, 6);
      const cMat = new THREE.MeshLambertMaterial({
        color: 0xfdd835,
        emissive: 0xf9a825,
        emissiveIntensity: 0.4,
      });
      const center = new THREE.Mesh(cGeo, cMat);
      center.position.y = 0.18 * scale;
      lotusGroup.add(center);
      disposables.geo.push(cGeo);
      disposables.mat.push(cMat);

      return lotusGroup;
    }

    // Center lotus
    const centerLotus = createLotus(1.3);
    centerLotus.position.set(0, 0.03, 2);
    scene.add(centerLotus);
    lotusFlowers.push(centerLotus);

    // Surrounding lotus
    const lotusPositions = [
      { x: -3, z: 4, s: 1.0 },
      { x: 4, z: 3, s: 0.9 },
      { x: -5, z: 0, s: 0.8 },
      { x: 6, z: -1, s: 0.85 },
      { x: -2, z: -3, s: 0.7 },
      { x: 3, z: 6, s: 0.95 },
      { x: -6, z: 5, s: 0.75 },
      { x: 7, z: 5, s: 0.8 },
    ];

    lotusPositions.forEach(lp => {
      const lotus = createLotus(lp.s);
      lotus.position.set(lp.x, 0.03, lp.z);
      scene.add(lotus);
      lotusFlowers.push(lotus);

      // Reflection
      const ref = createLotus(lp.s);
      ref.position.set(lp.x, -0.06, lp.z);
      ref.scale.y = -0.6;
      ref.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          const m = child.material as THREE.MeshLambertMaterial;
          m.opacity = Math.min(m.opacity, 0.25);
          m.transparent = true;
        }
      });
      scene.add(ref);
      reflectedLotus.push(ref);
    });

    // ─── Falling Petals (lifelike) ───
    const fallingPetals: THREE.Mesh[] = [];

    interface FallingPetalData {
      fallSpeed: number;
      swayFreq: number;
      swayAmp: number;
      spiralSpeed: number;
      spiralRadius: number;
      rotSpeed: THREE.Vector3;
      phase: number;
      flutterAmp: number;
    }

    for (let i = 0; i < 180; i++) {
      const hue = 0.91 + Math.random() * 0.08;
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(hue, 0.6 + Math.random() * 0.3, 0.8 + Math.random() * 0.15),
        transparent: true,
        opacity: 0.75 + Math.random() * 0.25,
        emissive: 0xff69b4,
        emissiveIntensity: 0.1,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(mat);

      const petal = new THREE.Mesh(petalShapeGeo, mat);
      const spread = 40;
      petal.position.set(
        (Math.random() - 0.5) * spread,
        5 + Math.random() * 20,
        (Math.random() - 0.5) * spread
      );
      const s = 0.15 + Math.random() * 0.35;
      petal.scale.setScalar(s);
      petal.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);

      petal.userData = {
        fallSpeed: 0.004 + Math.random() * 0.012,
        swayFreq: 0.3 + Math.random() * 0.5,
        swayAmp: 0.3 + Math.random() * 0.8,
        spiralSpeed: (Math.random() - 0.5) * 0.4,
        spiralRadius: 0.2 + Math.random() * 0.6,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.015,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.015
        ),
        phase: Math.random() * Math.PI * 2,
        flutterAmp: 0.5 + Math.random() * 1.5,
      } as FallingPetalData;

      scene.add(petal);
      fallingPetals.push(petal);
    }

    // ─── Floating Petals on Water ───
    const floatingPetals: THREE.Mesh[] = [];
    for (let i = 0; i < 35; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(0.92 + Math.random() * 0.06, 0.5, 0.85),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(mat);
      const petal = new THREE.Mesh(petalShapeGeo, mat);
      const a = Math.random() * Math.PI * 2;
      const d = 1 + Math.random() * 12;
      petal.position.set(Math.cos(a) * d, 0.01, Math.sin(a) * d);
      petal.scale.setScalar(0.12 + Math.random() * 0.18);
      petal.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
      scene.add(petal);
      floatingPetals.push(petal);
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
      const bGroup = new THREE.Group();
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.bezierCurveTo(0.06, 0.08, 0.15, 0.12, 0.14, 0.06);
      wingShape.bezierCurveTo(0.16, 0.02, 0.12, -0.04, 0.08, -0.06);
      wingShape.bezierCurveTo(0.04, -0.08, 0, -0.02, 0, 0);
      const wingGeo = new THREE.ShapeGeometry(wingShape);
      disposables.geo.push(wingGeo);

      const hue = Math.random() > 0.5 ? 0.75 + Math.random() * 0.2 : 0.05 + Math.random() * 0.1;
      const wingMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        transparent: true,
        opacity: 0.85,
        emissive: new THREE.Color().setHSL(hue, 0.9, 0.4),
        emissiveIntensity: 0.2,
        side: THREE.DoubleSide,
      });
      disposables.mat.push(wingMat);

      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.scale.set(1.5, 1.5, 1);
      bGroup.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.scale.set(-1.5, 1.5, 1);
      bGroup.add(rightWing);

      // Tiny body
      const bodyGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      bGroup.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      bGroup.scale.setScalar(0.8 + Math.random() * 0.4);
      return bGroup;
    }

    for (let i = 0; i < 8; i++) {
      const butterfly = createButterfly();
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 10;
      butterfly.position.set(Math.cos(angle) * dist, 2 + Math.random() * 5, Math.sin(angle) * dist);
      butterfly.userData = {
        orbitRadius: dist,
        orbitSpeed: 0.15 + Math.random() * 0.3,
        baseY: 2 + Math.random() * 5,
        vertSpeed: 0.5 + Math.random() * 1.0,
        wingSpeed: 6 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
      } as ButterflyData;
      scene.add(butterfly);
      butterflies.push(butterfly);
    }

    // ─── Dragonflies ───
    interface DragonflyData {
      speed: number;
      radius: number;
      baseY: number;
      phase: number;
      dartTimer: number;
      dartTarget: THREE.Vector3;
    }
    const dragonflies: THREE.Group[] = [];

    function createDragonfly(): THREE.Group {
      const dGroup = new THREE.Group();
      // Elongated body
      const bodyGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.15, 4);
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0x1565c0,
        emissive: 0x0d47a1,
        emissiveIntensity: 0.15,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      dGroup.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      // Four wings
      const wingGeo = new THREE.PlaneGeometry(0.12, 0.03);
      const wingMat = new THREE.MeshLambertMaterial({
        color: 0xbbdefb,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      disposables.geo.push(wingGeo);
      disposables.mat.push(wingMat);

      for (let w = 0; w < 4; w++) {
        const wing = new THREE.Mesh(wingGeo, wingMat);
        const side = w < 2 ? -1 : 1;
        const front = w % 2 === 0 ? 1 : -1;
        wing.position.set(side * 0.06, 0.005, front * 0.02);
        wing.rotation.z = side * 0.2;
        dGroup.add(wing);
      }

      return dGroup;
    }

    for (let i = 0; i < 4; i++) {
      const df = createDragonfly();
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 8;
      df.position.set(Math.cos(a) * r, 1.5 + Math.random() * 3, Math.sin(a) * r);
      df.userData = {
        speed: 0.3 + Math.random() * 0.5,
        radius: r,
        baseY: 1.5 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        dartTimer: Math.random() * 5,
        dartTarget: new THREE.Vector3(),
      } as DragonflyData;
      scene.add(df);
      dragonflies.push(df);
    }

    // ─── Fireflies (Points) ───
    const fireflyCount = 80;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    const fireflyPhases: number[] = [];
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3] = (Math.random() - 0.5) * 40;
      fireflyPos[i * 3 + 1] = 0.5 + Math.random() * 8;
      fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
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
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 50;
      sparkPos[i * 3 + 1] = 1 + Math.random() * 15;
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);
    disposables.geo.push(sparkGeo);
    disposables.mat.push(sparkMat);

    // ─── Zen Frogs ───
    function createFrog(): THREE.Group {
      const fg = new THREE.Group();
      const bodyGeo = new THREE.SphereGeometry(0.08, 10, 8);
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0x66bb6a,
        emissive: 0x388e3c,
        emissiveIntensity: 0.1,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(1, 0.65, 1);
      body.position.y = 0.06;
      fg.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      const headGeo = new THREE.SphereGeometry(0.06, 8, 6);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.1, 0.04);
      fg.add(head);
      disposables.geo.push(headGeo);

      for (let e = 0; e < 2; e++) {
        const eyeGeo = new THREE.SphereGeometry(0.012, 6, 4);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1b5e20 });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(e === 0 ? -0.025 : 0.025, 0.12, 0.06);
        fg.add(eye);
        disposables.geo.push(eyeGeo);
        disposables.mat.push(eyeMat);
      }

      return fg;
    }

    // Place frogs on some lotus
    [0, 2, 5].forEach(idx => {
      if (lotusFlowers[idx]) {
        const frog = createFrog();
        frog.position.y = 0.15;
        frog.rotation.y = Math.random() * Math.PI * 2;
        lotusFlowers[idx].add(frog);
      }
    });

    // ─── Camera: Low, intimate perspective ───
    camera.position.set(8, 2.5, 10);
    camera.lookAt(0, 1.5, 0);

    // Disable user interaction
    canvas.style.pointerEvents = 'none';

    // ─── Animation ───
    let animationId: number;
    const clock = new THREE.Clock();
    let rippleTimer = 0;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();

      // ── Water vertex displacement (waves + ripples) ──
      const wPos = waterGeo.attributes.position;
      for (let i = 0; i < wPos.count; i++) {
        const x = wPos.getX(i);
        const y = wPos.getY(i);
        const wave1 = Math.sin(x * 0.3 + t * 0.8) * 0.04;
        const wave2 = Math.sin(y * 0.4 + t * 1.1) * 0.03;
        const wave3 = Math.sin((x + y) * 0.2 + t * 0.6) * 0.02;

        // Ripple influence
        let rippleEffect = 0;
        for (const rip of ripples) {
          const dx = x - rip.x;
          const dz = y - rip.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const rippleRadius = rip.age * 2;
          const rippleWidth = 1.5;
          const envelope = Math.max(0, 1 - Math.abs(dist - rippleRadius) / rippleWidth);
          const fade = 1 - rip.age / rip.maxAge;
          rippleEffect += Math.sin(dist * 4 - t * 6) * envelope * fade * 0.06;
        }

        wPos.setZ(i, waterOriginalY[i] + wave1 + wave2 + wave3 + rippleEffect);
      }
      wPos.needsUpdate = true;
      waterGeo.computeVertexNormals();

      // ── Ripple lifecycle ──
      rippleTimer += dt;
      if (rippleTimer > 1.5 + Math.random() * 2) {
        rippleTimer = 0;
        spawnRipple((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.age += dt;
        const progress = rip.age / rip.maxAge;
        const scale = 1 + progress * 8;
        rip.mesh.scale.set(scale, scale, 1);
        (rip.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - progress);
        if (rip.age >= rip.maxAge) {
          scene.remove(rip.mesh);
          (rip.mesh.material as THREE.Material).dispose();
          ripples.splice(i, 1);
        }
      }

      // ── Falling Petals with lifelike physics ──
      fallingPetals.forEach(petal => {
        const d = petal.userData as FallingPetalData;
        // Gravity + air resistance
        petal.position.y -= d.fallSpeed;
        // Sway (wind-like)
        petal.position.x += Math.sin(t * d.swayFreq + d.phase) * d.swayAmp * 0.006;
        petal.position.z += Math.cos(t * d.swayFreq * 0.7 + d.phase) * d.swayAmp * 0.004;
        // Spiral descent
        const spiralAngle = t * d.spiralSpeed + d.phase;
        petal.position.x += Math.cos(spiralAngle) * d.spiralRadius * 0.003;
        petal.position.z += Math.sin(spiralAngle) * d.spiralRadius * 0.003;
        // Flutter rotation
        petal.rotation.x += d.rotSpeed.x + Math.sin(t * d.flutterAmp + d.phase) * 0.005;
        petal.rotation.y += d.rotSpeed.y;
        petal.rotation.z += d.rotSpeed.z + Math.cos(t * d.flutterAmp * 0.8 + d.phase) * 0.003;

        // Fade near water
        const mat = petal.material as THREE.MeshLambertMaterial;
        if (petal.position.y < 0.3) {
          mat.opacity = Math.max(0, mat.opacity - 0.008);
        }
        // Reset
        if (petal.position.y < -1 || mat.opacity <= 0) {
          petal.position.set(
            (Math.random() - 0.5) * 40,
            12 + Math.random() * 10,
            (Math.random() - 0.5) * 40
          );
          mat.opacity = 0.75 + Math.random() * 0.25;
        }
      });

      // ── Floating petals drift ──
      floatingPetals.forEach((petal, idx) => {
        petal.position.y = 0.01 + Math.sin(t * 0.3 + idx * 0.5) * 0.01;
        const r = Math.sqrt(petal.position.x ** 2 + petal.position.z ** 2);
        const a = Math.atan2(petal.position.z, petal.position.x) + 0.0008;
        petal.position.x = Math.cos(a) * r;
        petal.position.z = Math.sin(a) * r;
        petal.rotation.z += 0.001;
      });

      // ── Lotus float ──
      lotusFlowers.forEach((lotus, idx) => {
        const bob = Math.sin(t * 0.5 + idx * 0.7) * 0.015;
        const dist = Math.sqrt(lotus.position.x ** 2 + lotus.position.z ** 2);
        const wave = Math.sin(dist * 0.3 - t * 1.2) * 0.01;
        lotus.position.y = 0.03 + bob + wave;
        lotus.rotation.y += 0.001;
      });

      reflectedLotus.forEach((ref, idx) => {
        const orig = lotusFlowers[idx + 1]; // offset by 1 since center isn't reflected
        if (orig) {
          ref.position.y = -(orig.position.y) - 0.06;
          ref.rotation.y = orig.rotation.y;
        }
      });

      // ── Butterflies ──
      butterflies.forEach(bf => {
        const d = bf.userData as ButterflyData;
        const angle = t * d.orbitSpeed + d.phase;
        bf.position.x = Math.cos(angle) * d.orbitRadius + Math.sin(t * 0.3 + d.phase) * 1.5;
        bf.position.z = Math.sin(angle) * d.orbitRadius + Math.cos(t * 0.4 + d.phase) * 1.2;
        bf.position.y = d.baseY + Math.sin(t * d.vertSpeed + d.phase) * 1.0;
        // Wing flap
        const flap = Math.sin(t * d.wingSpeed) * 0.8;
        if (bf.children[0]) bf.children[0].rotation.y = flap;
        if (bf.children[1]) bf.children[1].rotation.y = -flap;
        // Face direction of travel
        const nextAngle = (t + 0.05) * d.orbitSpeed + d.phase;
        bf.rotation.y = Math.atan2(
          Math.sin(nextAngle) * d.orbitRadius - bf.position.z,
          Math.cos(nextAngle) * d.orbitRadius - bf.position.x
        );
      });

      // ── Dragonflies (darting motion) ──
      dragonflies.forEach(df => {
        const d = df.userData as DragonflyData;
        d.dartTimer -= dt;
        if (d.dartTimer <= 0) {
          d.dartTimer = 2 + Math.random() * 4;
          d.dartTarget.set(
            (Math.random() - 0.5) * 20,
            1 + Math.random() * 4,
            (Math.random() - 0.5) * 20
          );
        }
        // Smooth move toward target
        df.position.lerp(d.dartTarget, 0.01);
        // Quick wing buzz
        df.children.forEach((child, i) => {
          if (i > 0) child.rotation.z = Math.sin(t * 25 + i) * 0.5;
        });
        // Face direction
        const dir = d.dartTarget.clone().sub(df.position);
        if (dir.length() > 0.1) {
          df.rotation.y = Math.atan2(dir.x, dir.z);
        }
      });

      // ── Fireflies ──
      const fPos = fireflyGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < fireflyCount; i++) {
        const i3 = i * 3;
        fPos[i3] += Math.sin(t * 0.4 + fireflyPhases[i]) * 0.008;
        fPos[i3 + 1] += Math.sin(t * 0.5 + fireflyPhases[i] * 1.3) * 0.005;
        fPos[i3 + 2] += Math.cos(t * 0.35 + fireflyPhases[i] * 0.9) * 0.008;
        if (fPos[i3 + 1] < 0.3) fPos[i3 + 1] = 6;
        if (fPos[i3 + 1] > 9) fPos[i3 + 1] = 0.5;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      // Pulsing glow
      fireflyMat.opacity = 0.3 + Math.sin(t * 3) * 0.3 + Math.sin(t * 7.3) * 0.15;

      // ── Sparkles ──
      sparkMat.opacity = 0.2 + Math.sin(t * 2.5) * 0.3;

      // ── Camera: low orbit ──
      const camAngle = t * 0.05;
      const camRadius = 12;
      camera.position.x = Math.cos(camAngle) * camRadius;
      camera.position.z = Math.sin(camAngle) * camRadius;
      camera.position.y = 2.2 + Math.sin(t * 0.03) * 0.3;
      camera.lookAt(0, 1.2, 0);

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
      ripples.forEach(r => {
        (r.mesh.material as THREE.Material).dispose();
        scene.remove(r.mesh);
      });
      groundGeo.dispose();
      groundMat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas id="forest-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}
