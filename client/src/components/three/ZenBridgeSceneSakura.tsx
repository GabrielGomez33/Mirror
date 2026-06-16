// src/components/three/ZenBridgeSceneSakura.tsx (daytime sakura — rendered by ZenBridgeScene for sakura)
// Enterprise zen bridge scene: arched wooden bridge over koi pond,
// stone lanterns, cherry + maple trees, mossy rocks, waterfall,
// swimming koi fish, falling petals, fireflies & butterflies.
import { useEffect } from 'react';
import * as THREE from 'three';

interface PetalUserData {
  fallSpeed: number;
  swayFreq: number;
  swayAmp: number;
  spiralSpeed: number;
  rotSpeed: THREE.Vector3;
  phase: number;
  flutterAmp: number;
}

interface KoiData {
  velocity: THREE.Vector3;
  steering: THREE.Vector3;
  baseY: number;
  tailSpeed: number;
  size: number;
  speed: number;
  nextSteerTime: number;
  steerTarget: THREE.Vector3;
  phase: number;
}

interface ButterflyData {
  orbitRadius: number;
  orbitSpeed: number;
  baseY: number;
  vertSpeed: number;
  wingSpeed: number;
  phase: number;
}

export default function ZenBridgeSceneSakura() {
  useEffect(() => {
    const canvas = document.getElementById('zen-bridge-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // ─── Core Setup ───
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 250);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ─── Lighting ───
    const ambientLight = new THREE.AmbientLight(0xffd1dc, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffe8ec, 0.9);
    sunLight.position.set(8, 18, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xffc0e7, 0.3);
    fillLight.position.set(-8, 10, -6);
    scene.add(fillLight);

    const warmLight = new THREE.DirectionalLight(0xffcc80, 0.2);
    warmLight.position.set(0, 8, -12);
    scene.add(warmLight);

    const hemiLight = new THREE.HemisphereLight(0xfce4ec, 0x5d4037, 0.3);
    scene.add(hemiLight);

    // ─── Fog ───
    scene.fog = new THREE.FogExp2(0xf3e5f5, 0.011);

    // ─── Disposable tracking ───
    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[] } = { geo: [], mat: [] };

    // ─── Ground ───
    const groundGeo = new THREE.PlaneGeometry(150, 150);
    const groundMat = new THREE.MeshLambertMaterial({
      color: 0x6d8b74,
      emissive: 0x3e5f3e,
      emissiveIntensity: 0.06,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);
    disposables.geo.push(groundGeo);
    disposables.mat.push(groundMat);

    // ─── Pond (water surface with vertex ripples) ───
    const pondRadius = 10;
    const waterSegs = 64;
    const waterGeo = new THREE.CircleGeometry(pondRadius, waterSegs);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0xd1c9d2,
      transparent: false,
      opacity: 1.5,
      emissive: 0x4fc3f7,
      emissiveIntensity: 0.06,
      specular: 0xffffff,
      shininess: 200,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.05;
    water.receiveShadow = true;
    scene.add(water);
    disposables.geo.push(waterGeo);
    disposables.mat.push(waterMat);

    // Store original water vertex positions for wave animation
    const waterPositions = waterGeo.attributes.position;
    const waterOriginalZ = new Float32Array(waterPositions.count);
    for (let i = 0; i < waterPositions.count; i++) {
      waterOriginalZ[i] = waterPositions.getZ(i);
    }

    // ─── Pond bottom (dark bed visible through water) ───
    const bedGeo = new THREE.CircleGeometry(pondRadius + 0.3, 48);
    const bedMat = new THREE.MeshLambertMaterial({
      color: 0x3e5f50,
      emissive: 0x1b3028,
      emissiveIntensity: 0.05,
    });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = -0.55;
    scene.add(bed);
    disposables.geo.push(bedGeo);
    disposables.mat.push(bedMat);

    // ─── Ripple System ───
    interface Ripple {
      mesh: THREE.Mesh;
      age: number;
      maxAge: number;
      x: number;
      z: number;
    }
    const ripples: Ripple[] = [];
    const rippleGeo = new THREE.RingGeometry(0.03, 0.05, 16);
    disposables.geo.push(rippleGeo);

    function spawnRipple(x: number, z: number) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(rippleGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.01, z);
      scene.add(ring);
      disposables.mat.push(mat);
      ripples.push({ mesh: ring, age: 0, maxAge: 3 + Math.random() * 2, x, z });
    }

    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (pondRadius - 2);
      spawnRipple(Math.cos(a) * r, Math.sin(a) * r);
    }

    // ─── Arched Wooden Bridge ───
    function createBridge(): THREE.Group {
      const bridge = new THREE.Group();
      const bridgeLen = 12;
      const archHeight = 2.2;
      const bridgeWidth = 1.6;
      const plankCount = 28;

      const woodMat = new THREE.MeshLambertMaterial({
        color: 0x8b5e3c,
        emissive: 0x4e342e,
        emissiveIntensity: 0.06,
      });
      disposables.mat.push(woodMat);

      const darkWoodMat = new THREE.MeshLambertMaterial({
        color: 0x6d4c2e,
        emissive: 0x3e2723,
        emissiveIntensity: 0.08,
      });
      disposables.mat.push(darkWoodMat);

      // Bridge planks along the arch
      for (let i = 0; i < plankCount; i++) {
        const frac = i / (plankCount - 1);
        const x = (frac - 0.5) * bridgeLen;
        const y = Math.sin(frac * Math.PI) * archHeight;

        const plankGeo = new THREE.BoxGeometry(bridgeLen / plankCount + 0.02, 0.06, bridgeWidth);
        const plank = new THREE.Mesh(plankGeo, woodMat);
        plank.position.set(x, y, 0);

        // Tilt plank to follow arch slope
        const nextFrac = Math.min(1, (i + 1) / (plankCount - 1));
        const nextY = Math.sin(nextFrac * Math.PI) * archHeight;
        const prevFrac = Math.max(0, (i - 1) / (plankCount - 1));
        const prevY = Math.sin(prevFrac * Math.PI) * archHeight;
        const slope = Math.atan2(nextY - prevY, (2 * bridgeLen) / (plankCount - 1));
        plank.rotation.z = slope;

        plank.castShadow = true;
        bridge.add(plank);
        disposables.geo.push(plankGeo);
      }

      // Side rails (curved beams along both sides)
      const railSegments = 40;
      for (const side of [-1, 1]) {
        const railPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= railSegments; i++) {
          const frac = i / railSegments;
          const x = (frac - 0.5) * bridgeLen;
          const y = Math.sin(frac * Math.PI) * archHeight + 0.6;
          railPoints.push(new THREE.Vector3(x, y, side * bridgeWidth * 0.5));
        }

        // Rail as a tube along the curve
        const railCurve = new THREE.CatmullRomCurve3(railPoints);
        const railGeo = new THREE.TubeGeometry(railCurve, railSegments, 0.035, 6, false);
        const rail = new THREE.Mesh(railGeo, darkWoodMat);
        rail.castShadow = true;
        bridge.add(rail);
        disposables.geo.push(railGeo);

        // Bottom rail (structural beam)
        const bottomPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= railSegments; i++) {
          const frac = i / railSegments;
          const x = (frac - 0.5) * bridgeLen;
          const y = Math.sin(frac * Math.PI) * archHeight - 0.06;
          bottomPoints.push(new THREE.Vector3(x, y, side * (bridgeWidth * 0.48)));
        }
        const bottomCurve = new THREE.CatmullRomCurve3(bottomPoints);
        const bottomGeo = new THREE.TubeGeometry(bottomCurve, railSegments, 0.04, 6, false);
        const bottomRail = new THREE.Mesh(bottomGeo, darkWoodMat);
        bridge.add(bottomRail);
        disposables.geo.push(bottomGeo);

        // Vertical posts along the rails
        const postCount = 14;
        for (let i = 1; i < postCount - 1; i++) {
          const frac = i / (postCount - 1);
          const x = (frac - 0.5) * bridgeLen;
          const baseY = Math.sin(frac * Math.PI) * archHeight;
          const postH = 0.6;
          const postGeo = new THREE.CylinderGeometry(0.02, 0.025, postH, 6);
          const post = new THREE.Mesh(postGeo, darkWoodMat);
          post.position.set(x, baseY + postH / 2, side * bridgeWidth * 0.5);
          bridge.add(post);
          disposables.geo.push(postGeo);
        }
      }

      // Support beams under the bridge (extend from below water up to the arch)
      const supportBaseY = -0.6; // ground level
      for (const xOff of [-2.5, 0, 2.5]) {
        const archY = Math.sin(((xOff / bridgeLen) + 0.5) * Math.PI) * archHeight;
        const supportH = archY - supportBaseY;
        const supportGeo = new THREE.CylinderGeometry(0.06, 0.09, supportH, 8);
        const support = new THREE.Mesh(supportGeo, darkWoodMat);
        support.position.set(xOff, supportBaseY + supportH / 2, 0);
        support.castShadow = true;
        bridge.add(support);
        disposables.geo.push(supportGeo);
      }

      return bridge;
    }

    const bridge = createBridge();
    bridge.position.set(0, 0, 0);
    bridge.rotation.y = Math.PI * 0.15; // slight angle for visual interest
    scene.add(bridge);

    // ─── Stone Lanterns (tōrō) ───
    function createStoneLantern(x: number, z: number, scale: number): THREE.Group {
      const lantern = new THREE.Group();
      lantern.position.set(x, 0, z);

      const stoneMat = new THREE.MeshLambertMaterial({
        color: 0x9e9e9e,
        emissive: 0x616161,
        emissiveIntensity: 0.04,
      });
      disposables.mat.push(stoneMat);

      // Base (wide flat cylinder)
      const baseGeo = new THREE.CylinderGeometry(0.35 * scale, 0.4 * scale, 0.15 * scale, 8);
      const base = new THREE.Mesh(baseGeo, stoneMat);
      base.position.y = 0.075 * scale;
      lantern.add(base);
      disposables.geo.push(baseGeo);

      // Post (tall thin cylinder)
      const postGeo = new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 1.2 * scale, 8);
      const post = new THREE.Mesh(postGeo, stoneMat);
      post.position.y = 0.75 * scale;
      lantern.add(post);
      disposables.geo.push(postGeo);

      // Firebox (wider section with light)
      const fireboxGeo = new THREE.BoxGeometry(0.4 * scale, 0.35 * scale, 0.4 * scale);
      const firebox = new THREE.Mesh(fireboxGeo, stoneMat);
      firebox.position.y = 1.52 * scale;
      lantern.add(firebox);
      disposables.geo.push(fireboxGeo);

      // Inner glow
      const glowGeo = new THREE.SphereGeometry(0.12 * scale, 8, 6);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffcc80,
        transparent: true,
        opacity: 0.5,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.y = 1.52 * scale;
      lantern.add(glow);
      disposables.geo.push(glowGeo);
      disposables.mat.push(glowMat);

      // Roof (cone/pyramid)
      const roofGeo = new THREE.ConeGeometry(0.4 * scale, 0.35 * scale, 4);
      const roof = new THREE.Mesh(roofGeo, stoneMat);
      roof.position.y = 1.87 * scale;
      roof.rotation.y = Math.PI / 4;
      lantern.add(roof);
      disposables.geo.push(roofGeo);

      // Finial (small sphere on top)
      const finialGeo = new THREE.SphereGeometry(0.06 * scale, 6, 6);
      const finial = new THREE.Mesh(finialGeo, stoneMat);
      finial.position.y = 2.1 * scale;
      lantern.add(finial);
      disposables.geo.push(finialGeo);

      // Point light for warm glow
      const light = new THREE.PointLight(0xffcc80, 0.6 * scale, 5 * scale);
      light.position.y = 1.52 * scale;
      lantern.add(light);

      return lantern;
    }

    // Place lanterns at bridge entrances and around the pond
    scene.add(createStoneLantern(-6.5, -1.2, 1.0));
    scene.add(createStoneLantern(6.8, 1.0, 0.95));
    scene.add(createStoneLantern(-3, 9, 0.8));
    scene.add(createStoneLantern(8, -7, 0.75));

    // ─── Mossy Rocks Around Pond Edge ───
    function createMossyRock(x: number, z: number, size: number): THREE.Mesh {
      const geo = new THREE.SphereGeometry(size, 7, 5);
      // Deform the sphere to look rocky
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i);
        const ny = pos.getY(i);
        const nz = pos.getZ(i);
        const noise = 1 + (Math.sin(nx * 5) * Math.cos(ny * 3) * Math.sin(nz * 4)) * 0.2;
        pos.setXYZ(i, nx * noise, ny * (0.6 + Math.random() * 0.15), nz * noise);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(
          0.28 + Math.random() * 0.08,
          0.3 + Math.random() * 0.2,
          0.25 + Math.random() * 0.12
        ),
        emissive: 0x2e7d32,
        emissiveIntensity: 0.03,
      });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x, size * 0.2, z);
      rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.3);
      rock.castShadow = true;
      disposables.geo.push(geo);
      disposables.mat.push(mat);
      return rock;
    }

    // Place rocks along the pond perimeter
    const rockPositions = [
      { x: -9, z: 4, s: 0.7 }, { x: -8.5, z: 6, s: 0.5 }, { x: -10, z: 2, s: 0.6 },
      { x: 9, z: -3, s: 0.65 }, { x: 10, z: -1, s: 0.45 }, { x: 8, z: -5.5, s: 0.55 },
      { x: -5, z: -9, s: 0.5 }, { x: -3, z: -10, s: 0.4 }, { x: 3, z: 9.5, s: 0.55 },
      { x: 5, z: 8.5, s: 0.6 }, { x: -7, z: -7, s: 0.35 }, { x: 7, z: 7, s: 0.5 },
      { x: 0, z: -10, s: 0.45 }, { x: -9.5, z: -2, s: 0.5 },
    ];
    rockPositions.forEach(r => scene.add(createMossyRock(r.x, r.z, r.s)));

    // ─── Petal & Leaf Shapes ───
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

    // ─── Cherry Blossom Tree Builder (trunk + dense small-blob canopy) ───
    function createCherryTree(
      baseX: number, baseZ: number, scale: number, density: number
    ): THREE.Group {
      const tree = new THREE.Group();
      tree.position.set(baseX, 0, baseZ);

      const trunkH = 2.8 * scale;
      const bMat = new THREE.MeshLambertMaterial({
        color: 0x5d4037, emissive: 0x3e2723, emissiveIntensity: 0.05,
      });
      disposables.mat.push(bMat);

      const trunkGeo = new THREE.CylinderGeometry(0.08 * scale, 0.2 * scale, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, bMat);
      trunk.position.y = trunkH / 2;
      trunk.rotation.z = (Math.random() - 0.5) * 0.08;
      trunk.castShadow = true;
      tree.add(trunk);
      disposables.geo.push(trunkGeo);

      // Dense soft canopy dome (lowered center to overlap with trunk)
      const canopyCenter = new THREE.Vector3(0, trunkH - 0.1 * scale, 0);
      const canopyRXZ = (1.8 + Math.random() * 0.6) * scale;
      const canopyRY = (1.3 + Math.random() * 0.3) * scale;

      const cloudCount = Math.floor(55 * Math.max(density, 0.5));
      for (let c = 0; c < cloudCount; c++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.55;
        const rFrac = 0.2 + Math.random() * 0.8;
        const blobSize = (0.15 + Math.random() * 0.3) * scale;
        const blobGeo = new THREE.SphereGeometry(blobSize, 6, 5);
        const blobMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(
            0.93 + Math.random() * 0.04, 0.4 + Math.random() * 0.25, 0.78 + Math.random() * 0.14
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

      // Extra blobs around trunk-canopy junction to ensure no gap
      for (let c = 0; c < 8; c++) {
        const theta = (c / 8) * Math.PI * 2 + Math.random() * 0.4;
        const junctionBlobSize = (0.2 + Math.random() * 0.25) * scale;
        const jGeo = new THREE.SphereGeometry(junctionBlobSize, 6, 5);
        const jMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(
            0.93 + Math.random() * 0.04, 0.4 + Math.random() * 0.25, 0.78 + Math.random() * 0.14
          ),
          transparent: true,
          opacity: 0.6 + Math.random() * 0.3,
          emissive: 0xf48fb1,
          emissiveIntensity: 0.08,
        });
        const jBlob = new THREE.Mesh(jGeo, jMat);
        const jR = (0.3 + Math.random() * 0.4) * scale;
        jBlob.position.set(
          Math.cos(theta) * jR,
          trunkH - 0.2 * scale + Math.random() * 0.4 * scale,
          Math.sin(theta) * jR
        );
        jBlob.scale.set(1, 0.6, 1);
        tree.add(jBlob);
        disposables.geo.push(jGeo);
        disposables.mat.push(jMat);
      }

      // Detail 5-petal flowers
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
        fGroup.lookAt(
          fx + (fx - canopyCenter.x), fy + (fy - canopyCenter.y) * 0.5, fz + (fz - canopyCenter.z)
        );
        tree.add(fGroup);
      }

      // Leaves tucked in canopy
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

    // ─── Green Maple Tree Builder ───
    function createMapleTree(
      baseX: number, baseZ: number, scale: number, density: number
    ): THREE.Group {
      const tree = new THREE.Group();
      tree.position.set(baseX, 0, baseZ);

      const trunkH = 3.2 * scale;
      const bMat = new THREE.MeshLambertMaterial({
        color: 0x6d4c41, emissive: 0x4e342e, emissiveIntensity: 0.04,
      });
      disposables.mat.push(bMat);

      const trunkGeo = new THREE.CylinderGeometry(0.1 * scale, 0.24 * scale, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, bMat);
      trunk.position.y = trunkH / 2;
      trunk.rotation.z = (Math.random() - 0.5) * 0.06;
      trunk.castShadow = true;
      tree.add(trunk);
      disposables.geo.push(trunkGeo);

      // Green foliage canopy (lowered center to overlap with trunk)
      const canopyCenter = new THREE.Vector3(0, trunkH - 0.15 * scale, 0);
      const canopyRXZ = (2.0 + Math.random() * 0.8) * scale;
      const canopyRY = (1.4 + Math.random() * 0.4) * scale;

      const cloudCount = Math.floor(50 * Math.max(density, 0.5));
      for (let c = 0; c < cloudCount; c++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.55;
        const rFrac = 0.15 + Math.random() * 0.85;
        const blobSize = (0.18 + Math.random() * 0.35) * scale;
        const blobGeo = new THREE.SphereGeometry(blobSize, 6, 5);
        // Rich green with autumn tinges (some red/orange/yellow leaves)
        const isAutumn = Math.random() < 0.2;
        const hue = isAutumn
          ? (0.02 + Math.random() * 0.08) // red/orange
          : (0.25 + Math.random() * 0.12); // green
        const blobMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(
            hue, 0.45 + Math.random() * 0.2, isAutumn ? 0.45 + Math.random() * 0.15 : 0.3 + Math.random() * 0.18
          ),
          transparent: true,
          opacity: 0.6 + Math.random() * 0.3,
          emissive: isAutumn ? 0xff6f00 : 0x1b5e20,
          emissiveIntensity: 0.04,
        });
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.set(
          canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ * rFrac,
          canopyCenter.y + Math.cos(phi) * canopyRY * rFrac,
          canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ * rFrac
        );
        blob.scale.set(1, 0.45 + Math.random() * 0.3, 1);
        tree.add(blob);
        disposables.geo.push(blobGeo);
        disposables.mat.push(blobMat);
      }

      // Extra blobs around trunk-canopy junction to ensure no gap
      for (let c = 0; c < 8; c++) {
        const theta = (c / 8) * Math.PI * 2 + Math.random() * 0.4;
        const jBlobSize = (0.22 + Math.random() * 0.28) * scale;
        const jGeo = new THREE.SphereGeometry(jBlobSize, 6, 5);
        const isJAutumn = Math.random() < 0.15;
        const jHue = isJAutumn ? (0.02 + Math.random() * 0.08) : (0.25 + Math.random() * 0.12);
        const jMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(
            jHue, 0.45 + Math.random() * 0.2, isJAutumn ? 0.45 : 0.3 + Math.random() * 0.15
          ),
          transparent: true,
          opacity: 0.65 + Math.random() * 0.25,
          emissive: isJAutumn ? 0xff6f00 : 0x1b5e20,
          emissiveIntensity: 0.04,
        });
        const jBlob = new THREE.Mesh(jGeo, jMat);
        const jR = (0.35 + Math.random() * 0.45) * scale;
        jBlob.position.set(
          Math.cos(theta) * jR,
          trunkH - 0.3 * scale + Math.random() * 0.5 * scale,
          Math.sin(theta) * jR
        );
        jBlob.scale.set(1, 0.55, 1);
        tree.add(jBlob);
        disposables.geo.push(jGeo);
        disposables.mat.push(jMat);
      }

      // Maple leaves on canopy surface
      const leafCount = Math.floor(20 * Math.max(density, 0.4));
      for (let i = 0; i < leafCount; i++) {
        const isRed = Math.random() < 0.25;
        const lMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(
            isRed ? 0.02 + Math.random() * 0.06 : 0.28 + Math.random() * 0.1,
            isRed ? 0.7 : 0.55,
            isRed ? 0.4 : 0.3 + Math.random() * 0.12
          ),
          transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        });
        const leaf = new THREE.Mesh(leafShapeGeo, lMat);
        disposables.mat.push(lMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.6;
        const r = 0.5 + Math.random() * 0.5;
        leaf.position.set(
          canopyCenter.x + Math.sin(phi) * Math.cos(theta) * canopyRXZ * r,
          canopyCenter.y + Math.cos(phi) * canopyRY * r,
          canopyCenter.z + Math.sin(phi) * Math.sin(theta) * canopyRXZ * r
        );
        leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        leaf.scale.setScalar((0.25 + Math.random() * 0.3) * scale);
        tree.add(leaf);
      }

      return tree;
    }

    // ─── Place Trees (all outside camera orbit radius of 11) ───
    const allTrees: THREE.Group[] = [];

    // Cherry blossom trees
    allTrees.push(createCherryTree(14, 5, 1.15, 1.1));
    allTrees.push(createCherryTree(-13, 7, 1.1, 1.0));
    allTrees.push(createCherryTree(7, -14, 1.0, 1.0));
    allTrees.push(createCherryTree(-6, 14, 0.95, 0.9));
    allTrees.push(createCherryTree(-18, -14, 0.7, 0.6));
    allTrees.push(createCherryTree(20, -16, 0.6, 0.5));

    // Green maple trees (for variety, mixed with cherry)
    allTrees.push(createMapleTree(-14, -6, 1.0, 1.0));
    allTrees.push(createMapleTree(12, 12, 0.9, 0.9));
    allTrees.push(createMapleTree(-10, -14, 0.85, 0.8));
    allTrees.push(createMapleTree(16, 8, 0.8, 0.7));

    // Far silhouette trees
    allTrees.push(createCherryTree(-24, -22, 0.4, 0.3));
    allTrees.push(createMapleTree(26, -20, 0.35, 0.3));
    allTrees.push(createCherryTree(0, -28, 0.45, 0.3));

    allTrees.forEach(t => scene.add(t));

    // ─── Koi Fish ───
    // Spine runs along Z axis so lookAt() naturally orients the fish forward.
    // Body-bending vertex shader (inspired by spline-deformation technique)
    // creates natural swimming undulation without needing an STL model.
    function createKoiBodyGeo(totalLen: number): THREE.BufferGeometry {
      const slices = 24;
      const radialSegs = 14;

      // Spine profile: [t (0=tail,1=nose), widthRadius, heightRadius, yOffset]
      // Radii are fractions of totalLen — slimmer, longer fish
      const spine: [number, number, number, number][] = [
        [0.00, 0.00,  0.00,  0.00],   // tail tip
        [0.05, 0.02,  0.015, 0.00],   // tail peduncle (narrow)
        [0.12, 0.045, 0.035, 0.00],   // peduncle widens
        [0.22, 0.09,  0.07,  0.003],  // rear body
        [0.35, 0.13,  0.10,  0.005],  // belly thickens
        [0.48, 0.15,  0.12,  0.008],  // widest point
        [0.58, 0.14,  0.11,  0.005],  // past midpoint
        [0.68, 0.12,  0.09,  0.003],  // narrowing
        [0.78, 0.10,  0.08,  0.00],   // head start
        [0.86, 0.08,  0.07, -0.002],  // head
        [0.94, 0.05,  0.04, -0.003],  // snout
        [1.00, 0.015, 0.02, -0.005],  // mouth (blunt)
      ];

      const vertices: number[] = [];
      const indices: number[] = [];

      function lerpSpine(frac: number): { w: number; h: number; yo: number } {
        let i = 0;
        while (i < spine.length - 1 && spine[i + 1][0] < frac) i++;
        if (i >= spine.length - 1) {
          const s = spine[spine.length - 1];
          return { w: s[1] * totalLen, h: s[2] * totalLen, yo: s[3] * totalLen };
        }
        const a = spine[i], b = spine[i + 1];
        const t = (frac - a[0]) / (b[0] - a[0]);
        return {
          w: (a[1] + (b[1] - a[1]) * t) * totalLen,
          h: (a[2] + (b[2] - a[2]) * t) * totalLen,
          yo: (a[3] + (b[3] - a[3]) * t) * totalLen,
        };
      }

      // Generate vertices: spine along Z, cross-section in XY
      for (let s = 0; s <= slices; s++) {
        const frac = s / slices; // 0=tail, 1=nose
        const z = (frac - 0.5) * totalLen; // centered: tail at -len/2, nose at +len/2
        const { w, h, yo } = lerpSpine(frac);
        for (let r = 0; r <= radialSegs; r++) {
          const angle = (r / radialSegs) * Math.PI * 2;
          const x = Math.cos(angle) * w;
          const y = Math.sin(angle) * h + yo;
          vertices.push(x, y, z);
        }
      }

      // Generate triangle indices
      for (let s = 0; s < slices; s++) {
        for (let r = 0; r < radialSegs; r++) {
          const a = s * (radialSegs + 1) + r;
          const b = a + radialSegs + 1;
          indices.push(a, b, a + 1);
          indices.push(a + 1, b, b + 1);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    }

    // Uniforms stored per-fish so the animation loop can update uTime
    const koiUniforms: { uTime: { value: number }; uBodyHalfLen: { value: number } }[] = [];

    function createKoi(bodyColor: number, _patternColor: number, size: number): THREE.Group {
      const koi = new THREE.Group();
      const totalLen = size * 3.8; // longer, slimmer fish
      const halfLen = totalLen * 0.5;

      // Body geometry (spine along Z)
      const bodyGeo = createKoiBodyGeo(totalLen);

      // Body-bending shader uniforms
      const uTime = { value: 0 };
      const uBodyHalfLen = { value: halfLen };
      koiUniforms.push({ uTime, uBodyHalfLen });

      // Body material with swimming-undulation vertex shader
      const bodyMat = new THREE.MeshPhongMaterial({
        color: bodyColor,
        emissive: bodyColor,
        emissiveIntensity: 0.12,
        shininess: 90,
        specular: 0xffffff,
      });
      bodyMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uTime;
        shader.uniforms.uBodyHalfLen = uBodyHalfLen;
        // Inject uniforms before main()
        shader.vertexShader = `
          uniform float uTime;
          uniform float uBodyHalfLen;
        ` + shader.vertexShader;
        // Replace <begin_vertex> to add sinusoidal body bending
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          // Swimming undulation: sinusoidal wave along the spine (Z axis)
          // Amplitude increases from nose (+Z) to tail (-Z)
          float spineT = (transformed.z + uBodyHalfLen) / (2.0 * uBodyHalfLen); // 0=tail, 1=nose
          float tailFactor = pow(1.0 - spineT, 2.0); // quadratic falloff: strong at tail, zero at nose
          float wave = sin(transformed.z * 12.0 - uTime * 6.0) * uBodyHalfLen * 0.15 * tailFactor;
          transformed.x += wave;
          `
        );
      };
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      koi.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      // Shared fin material
      const finExtrude = { depth: totalLen * 0.025, bevelEnabled: false };
      const finMat = new THREE.MeshPhongMaterial({
        color: bodyColor, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, emissive: bodyColor, emissiveIntensity: 0.08,
        shininess: 40,
      });
      disposables.mat.push(finMat);

      // ── Tail fin (caudal — fan in XY plane at the tail end) ──
      const tailShape = new THREE.Shape();
      const ts = totalLen * 0.45;
      // Forked tail: two lobes spreading in ±X and ±Y
      tailShape.moveTo(0, 0);
      tailShape.bezierCurveTo(-ts * 0.2, ts * 0.15, -ts * 0.45, ts * 0.5, -ts * 0.3, ts * 0.75);
      tailShape.bezierCurveTo(-ts * 0.15, ts * 0.55, -ts * 0.05, ts * 0.35, 0, ts * 0.25);
      tailShape.bezierCurveTo(ts * 0.05, ts * 0.35, ts * 0.15, ts * 0.55, ts * 0.3, ts * 0.75);
      tailShape.bezierCurveTo(ts * 0.45, ts * 0.5, ts * 0.2, ts * 0.15, 0, 0);
      const tailGeo = new THREE.ExtrudeGeometry(tailShape, finExtrude);
      const tail = new THREE.Mesh(tailGeo, finMat);
      tail.name = 'koiTail';
      // Fan lies in XY, shift so base connects to tail tip, fan extends backward (-Z)
      tail.rotation.x = Math.PI; // flip so fan points backward
      tail.position.set(0, 0, -halfLen);
      koi.add(tail);
      disposables.geo.push(tailGeo);

      // ── Paired pectoral fins (sides, near the head — angled outward so visible from above) ──
      for (const side of [-1, 1]) {
        const pectShape = new THREE.Shape();
        const ps = totalLen * 0.18;
        pectShape.moveTo(0, 0);
        pectShape.bezierCurveTo(ps * 0.3, -ps * 0.5, ps * 0.7, -ps * 0.55, ps * 0.9, -ps * 0.15);
        pectShape.bezierCurveTo(ps * 0.7, ps * 0.05, ps * 0.3, ps * 0.05, 0, 0);
        const pectGeo = new THREE.ExtrudeGeometry(pectShape, { depth: totalLen * 0.015, bevelEnabled: false });
        const pectFin = new THREE.Mesh(pectGeo, finMat);
        // Lay fins nearly flat (visible from above), angled outward from body
        pectFin.position.set(side * totalLen * 0.08, -totalLen * 0.04, totalLen * 0.12);
        pectFin.rotation.x = -Math.PI * 0.45; // tilt forward-down so visible from above
        pectFin.rotation.z = side * 0.8; // angle outward
        koi.add(pectFin);
        disposables.geo.push(pectGeo);
      }

      // ── Paired anal fins (underside, rear — tilted so visible from above) ──
      for (const side of [-1, 1]) {
        const analShape = new THREE.Shape();
        const afs = totalLen * 0.12;
        analShape.moveTo(0, 0);
        analShape.bezierCurveTo(afs * 0.2, -afs * 0.45, afs * 0.6, -afs * 0.45, afs * 0.8, 0);
        analShape.lineTo(0, 0);
        const analGeo = new THREE.ExtrudeGeometry(analShape, { depth: totalLen * 0.012, bevelEnabled: false });
        const analFin = new THREE.Mesh(analGeo, finMat);
        analFin.position.set(side * totalLen * 0.05, -totalLen * 0.06, -totalLen * 0.1);
        analFin.rotation.x = -Math.PI * 0.4;
        analFin.rotation.z = side * 0.5;
        koi.add(analFin);
        disposables.geo.push(analGeo);
      }

      // ── Eyes (flush against the head) ──
      for (const side of [-1, 1]) {
        const eyeGeo = new THREE.SphereGeometry(totalLen * 0.022, 8, 6);
        const eyeMat = new THREE.MeshPhongMaterial({
          color: 0x111111, shininess: 200, specular: 0x666666,
        });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        // Tight against the head: small X offset, on the forward part of the body
        eye.position.set(side * totalLen * 0.055, totalLen * 0.035, totalLen * 0.36);
        koi.add(eye);
        disposables.geo.push(eyeGeo);
        disposables.mat.push(eyeMat);
      }

      // ── Mouth ──
      const mouthGeo = new THREE.SphereGeometry(totalLen * 0.02, 6, 4);
      mouthGeo.scale(1.0, 0.5, 0.3);
      const mouthMat = new THREE.MeshLambertMaterial({ color: 0x4a2020 });
      const mouth = new THREE.Mesh(mouthGeo, mouthMat);
      mouth.position.set(0, -totalLen * 0.005, totalLen * 0.48);
      koi.add(mouth);
      disposables.geo.push(mouthGeo);
      disposables.mat.push(mouthMat);

      return koi;
    }

    // Create koi fish with varied colors
    const koiSchemes: { body: number; pattern: number }[] = [
      { body: 0xff6f00, pattern: 0xffffff },  // orange & white
      { body: 0xf44336, pattern: 0xffffff },   // red & white (kohaku)
      { body: 0xffffff, pattern: 0xff6f00 },   // white & orange
      { body: 0xffd600, pattern: 0xff6f00 },   // gold & orange
      { body: 0x212121, pattern: 0xff6f00 },   // black & orange
      { body: 0xffffff, pattern: 0xf44336 },   // white & red
      { body: 0xff8f00, pattern: 0x212121 },   // orange & black
    ];

    // School state (average center & heading for cohesion/alignment)
    const schoolCenter = new THREE.Vector3();
    const schoolVel = new THREE.Vector3();
    const tv0 = new THREE.Vector3(); // temp vectors for koi math
    const tv1 = new THREE.Vector3();

    const kois: THREE.Group[] = [];
    for (let i = 0; i < 7; i++) {
      const scheme = koiSchemes[i % koiSchemes.length];
      const size = 0.15 + Math.random() * 0.12;
      const koi = createKoi(scheme.body, scheme.pattern, size);

      // Spawn at random positions within the pond
      const spawnAngle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const spawnR = 2 + Math.random() * 5;
      koi.position.set(
        Math.cos(spawnAngle) * spawnR,
        -0.15 - Math.random() * 0.12,
        Math.sin(spawnAngle) * spawnR
      );
      koi.rotation.y = Math.random() * Math.PI * 2;

      // Initial velocity in the direction the fish is facing
      const initSpeed = 0.3 + Math.random() * 0.4;
      const initVel = new THREE.Vector3(
        Math.sin(koi.rotation.y) * initSpeed,
        0,
        Math.cos(koi.rotation.y) * initSpeed
      );

      koi.userData = {
        velocity: initVel,
        steering: new THREE.Vector3(),
        baseY: koi.position.y,
        tailSpeed: 3 + Math.random() * 3,
        size,
        speed: initSpeed,
        nextSteerTime: Math.random() * 3,
        steerTarget: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          0,
          (Math.random() - 0.5) * 12
        ),
        phase: Math.random() * Math.PI * 2,
      } as KoiData;

      scene.add(koi);
      kois.push(koi);
    }

    // ─── Lily Pads ───
    function createLilyPad(x: number, z: number, size: number): THREE.Mesh {
      // Circle with a wedge cut out
      const shape = new THREE.Shape();
      const segs = 24;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 1.85 + 0.3;
        shape.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      }
      shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(0.3 + Math.random() * 0.05, 0.55, 0.3 + Math.random() * 0.1),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const pad = new THREE.Mesh(geo, mat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.02, z);
      pad.rotation.z = Math.random() * Math.PI * 2;
      disposables.geo.push(geo);
      disposables.mat.push(mat);
      return pad;
    }

    // Scatter lily pads
    // Positions kept clear of the bridge corridor (bridge runs ~27° from x-axis)
    const lilyPositions = [
      { x: -4, z: 6, s: 0.5 },  { x: -3, z: 7, s: 0.35 },
      { x: 5, z: -5.5, s: 0.45 }, { x: 4, z: -6.5, s: 0.3 },
      { x: -2, z: -7, s: 0.4 }, { x: 7, z: 4.5, s: 0.38 },
      { x: -7, z: -4, s: 0.42 }, { x: 3, z: 7.5, s: 0.35 },
    ];
    lilyPositions.forEach(l => scene.add(createLilyPad(l.x, l.z, l.s)));

    // ─── Small Lotus Flowers on Some Lily Pads ───
    function createLotus(x: number, z: number, scale: number): THREE.Group {
      const lotus = new THREE.Group();
      lotus.position.set(x, 0.06, z);

      for (let ring = 0; ring < 2; ring++) {
        const petCount = ring === 0 ? 6 : 8;
        const ringR = ring * 0.06 * scale;
        for (let p = 0; p < petCount; p++) {
          const pMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(
              ring === 0 ? 0.92 : 0.85, 0.5 + Math.random() * 0.2, 0.8 + Math.random() * 0.1
            ),
            transparent: true, opacity: 0.9, side: THREE.DoubleSide,
            emissive: 0xff69b4, emissiveIntensity: 0.08,
          });
          const pet = new THREE.Mesh(petalShapeGeo, pMat);
          disposables.mat.push(pMat);
          const pa = (p / petCount) * Math.PI * 2 + ring * 0.3;
          pet.position.set(
            Math.cos(pa) * (0.04 + ringR) * scale,
            ring * 0.02,
            Math.sin(pa) * (0.04 + ringR) * scale
          );
          pet.rotation.set(-Math.PI / 2 + 0.5 + ring * 0.3, pa, 0);
          pet.scale.setScalar((0.12 + ring * 0.04) * scale);
          lotus.add(pet);
        }
      }

      // Center pistil
      const cGeo = new THREE.SphereGeometry(0.03 * scale, 6, 4);
      const cMat = new THREE.MeshLambertMaterial({
        color: 0xffd54f, emissive: 0xffab00, emissiveIntensity: 0.4,
      });
      lotus.add(new THREE.Mesh(cGeo, cMat));
      disposables.geo.push(cGeo);
      disposables.mat.push(cMat);

      return lotus;
    }

    scene.add(createLotus(-4, 6, 1.2));
    scene.add(createLotus(5, -5.5, 1.0));
    scene.add(createLotus(-7, -4, 0.9));

    // ─── Small Waterfall (far side of pond) ───
    function createWaterfall(): THREE.Group {
      const wf = new THREE.Group();
      wf.position.set(0, 0, -pondRadius + 0.5);

      // Rock face behind waterfall
      for (let i = 0; i < 8; i++) {
        const rGeo = new THREE.SphereGeometry(0.4 + Math.random() * 0.5, 6, 5);
        const pos = rGeo.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          pos.setY(v, pos.getY(v) * (0.7 + Math.random() * 0.2));
        }
        rGeo.computeVertexNormals();
        const rMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.0, 0.0, 0.3 + Math.random() * 0.15),
          emissive: 0x333333, emissiveIntensity: 0.03,
        });
        const rock = new THREE.Mesh(rGeo, rMat);
        rock.position.set(
          (Math.random() - 0.5) * 2.5,
          Math.random() * 1.5,
          -0.5 + Math.random() * 0.5
        );
        wf.add(rock);
        disposables.geo.push(rGeo);
        disposables.mat.push(rMat);
      }

      // Water stream (animated thin planes)
      for (let s = 0; s < 3; s++) {
        const streamGeo = new THREE.PlaneGeometry(0.25 + Math.random() * 0.3, 1.8, 1, 8);
        const streamMat = new THREE.MeshPhongMaterial({
          color: 0xb3e5fc,
          transparent: true,
          opacity: 0.25 + Math.random() * 0.15,
          emissive: 0x81d4fa,
          emissiveIntensity: 0.1,
          side: THREE.DoubleSide,
          shininess: 100,
        });
        const stream = new THREE.Mesh(streamGeo, streamMat);
        stream.position.set((s - 1) * 0.35, 0.9, 0);
        stream.rotation.y = (Math.random() - 0.5) * 0.2;
        wf.add(stream);
        disposables.geo.push(streamGeo);
        disposables.mat.push(streamMat);
      }

      return wf;
    }

    const waterfall = createWaterfall();
    scene.add(waterfall);

    // ─── Falling Petals ───
    const petalColors = [0xffb3d9, 0xffc0cb, 0xff69b4, 0xffa0c9, 0xff1493, 0xffb6c1];
    const petals: THREE.Mesh[] = [];

    for (let i = 0; i < 70; i++) {
      const material = new THREE.MeshPhongMaterial({
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        transparent: true,
        opacity: 0.7 + Math.random() * 0.3,
        side: THREE.DoubleSide,
        shininess: 50,
        specular: 0xffffff,
        emissive: 0xff69b4,
        emissiveIntensity: 0.05,
      });
      disposables.mat.push(material);

      const petal = new THREE.Mesh(petalShapeGeo, material);
      petal.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 16 + 5,
        (Math.random() - 0.5) * 40
      );
      const scale = 0.22 + Math.random() * 0.45;
      petal.scale.setScalar(scale);
      petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      petal.userData = {
        fallSpeed: 0.005 + Math.random() * 0.012,
        swayFreq: 0.25 + Math.random() * 0.4,
        swayAmp: 0.3 + Math.random() * 0.6,
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
      petals.push(petal);
    }

    // ─── Butterflies ───
    const butterflies: THREE.Group[] = [];

    function createButterfly(): THREE.Group {
      const bg = new THREE.Group();
      const ws = new THREE.Shape();
      ws.moveTo(0, 0);
      ws.bezierCurveTo(0.06, 0.08, 0.15, 0.12, 0.14, 0.06);
      ws.bezierCurveTo(0.16, 0.02, 0.12, -0.04, 0.08, -0.06);
      ws.bezierCurveTo(0.04, -0.08, 0, -0.02, 0, 0);
      const wGeo = new THREE.ShapeGeometry(ws);
      disposables.geo.push(wGeo);

      const hue = Math.random() > 0.5 ? 0.75 + Math.random() * 0.2 : 0.05 + Math.random() * 0.1;
      const wMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        transparent: true, opacity: 0.85,
        emissive: new THREE.Color().setHSL(hue, 0.9, 0.4),
        emissiveIntensity: 0.15, side: THREE.DoubleSide,
      });
      disposables.mat.push(wMat);

      const lw = new THREE.Mesh(wGeo, wMat);
      lw.scale.set(1.5, 1.5, 1);
      bg.add(lw);
      const rw = new THREE.Mesh(wGeo, wMat);
      rw.scale.set(-1.5, 1.5, 1);
      bg.add(rw);

      const bodyGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      bg.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      bg.scale.setScalar(0.6 + Math.random() * 0.4);
      return bg;
    }

    for (let i = 0; i < 6; i++) {
      const bf = createButterfly();
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 8;
      bf.position.set(Math.cos(a) * r, 1.5 + Math.random() * 5, Math.sin(a) * r);
      bf.userData = {
        orbitRadius: r,
        orbitSpeed: 0.1 + Math.random() * 0.2,
        baseY: 1.5 + Math.random() * 5,
        vertSpeed: 0.4 + Math.random() * 0.7,
        wingSpeed: 6 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
      } as ButterflyData;
      scene.add(bf);
      butterflies.push(bf);
    }

    // ─── Dragonflies ───
    const dragonflies: THREE.Group[] = [];

    function createDragonfly(): THREE.Group {
      const dg = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.15, 5);
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0x1565c0, emissive: 0x0d47a1, emissiveIntensity: 0.2,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      dg.add(body);
      disposables.geo.push(bodyGeo);
      disposables.mat.push(bodyMat);

      // Four narrow wings
      const wingGeo = new THREE.PlaneGeometry(0.12, 0.025);
      const wingMat = new THREE.MeshLambertMaterial({
        color: 0xb3e5fc, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, emissive: 0x81d4fa, emissiveIntensity: 0.15,
      });
      disposables.geo.push(wingGeo);
      disposables.mat.push(wingMat);

      for (const [xOff, zOff] of [[0.06, 0.015], [-0.06, 0.015], [0.055, -0.015], [-0.055, -0.015]]) {
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.position.set(xOff, 0, zOff);
        dg.add(w);
      }

      dg.scale.setScalar(1.2);
      return dg;
    }

    for (let i = 0; i < 4; i++) {
      const df = createDragonfly();
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 6;
      df.position.set(Math.cos(a) * r, 0.8 + Math.random() * 3, Math.sin(a) * r);
      df.userData = {
        orbitRadius: r,
        orbitSpeed: 0.3 + Math.random() * 0.4,
        baseY: 0.8 + Math.random() * 3,
        vertSpeed: 0.8 + Math.random() * 1.0,
        wingSpeed: 15 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
      } as ButterflyData;
      scene.add(df);
      dragonflies.push(df);
    }

    // ─── Fireflies ───
    const fireflyCount = 40;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    const fireflyPhases: number[] = [];
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3] = (Math.random() - 0.5) * 30;
      fireflyPos[i * 3 + 1] = 0.3 + Math.random() * 8;
      fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      fireflyPhases.push(Math.random() * Math.PI * 2);
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
    const fireflyMat = new THREE.PointsMaterial({
      color: 0xffeb3b, size: 0.06, transparent: true,
      opacity: 0.5, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(fireflyGeo, fireflyMat));
    disposables.geo.push(fireflyGeo);
    disposables.mat.push(fireflyMat);

    // ─── Camera (low perspective, orbiting the bridge) ───
    const camOrbitRadius = 11;
    const camY = 2.0;
    camera.position.set(camOrbitRadius, camY, 0);
    camera.lookAt(0, 0.5, 0);

    // ─── Animation Loop ───
    let animationId: number;
    const clock = new THREE.Clock();
    let prevTime = 0;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const frameDt = Math.min(t - prevTime, 0.05) || 0.016;
      prevTime = t;

      // ── Water vertex ripples ──
      for (let i = 0; i < waterPositions.count; i++) {
        const x = waterPositions.getX(i);
        const y = waterPositions.getY(i);
        const wave =
          Math.sin(x * 0.8 + t * 1.2) * 0.04 +
          Math.sin(y * 0.6 + t * 0.9) * 0.03 +
          Math.sin((x + y) * 0.5 + t * 1.5) * 0.02;
        waterPositions.setZ(i, waterOriginalZ[i] + wave);
      }
      waterPositions.needsUpdate = true;
      waterGeo.computeVertexNormals();

      // ── Expanding ripple rings ──
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rp = ripples[r];
        rp.age += 0.016;
        const progress = rp.age / rp.maxAge;
        const scale = 0.2 + progress * 1.0;
        rp.mesh.scale.set(scale, scale, 1);
        (rp.mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 * (1 - progress);
        if (rp.age >= rp.maxAge) {
          scene.remove(rp.mesh);
          ripples.splice(r, 1);
        }
      }
      if (Math.random() < 0.01) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (pondRadius - 2);
        spawnRipple(Math.cos(a) * r, Math.sin(a) * r);
      }

      // ── Koi fish schooling (flocking behavior) ──
      const dt = frameDt;

      // 1. Compute school average center & velocity
      schoolCenter.set(0, 0, 0);
      schoolVel.set(0, 0, 0);
      kois.forEach(koi => {
        const d = koi.userData as KoiData;
        schoolCenter.add(koi.position);
        schoolVel.add(d.velocity);
      });
      schoolCenter.divideScalar(kois.length);
      schoolVel.divideScalar(kois.length);

      // 2. Update each koi with flocking forces
      kois.forEach(koi => {
        const d = koi.userData as KoiData;
        d.steering.set(0, 0, 0);

        // Cohesion: steer toward school center
        tv0.copy(schoolCenter).sub(koi.position);
        const distToCenter = tv0.length();
        if (distToCenter > 3) {
          tv0.normalize().multiplyScalar(0.15);
          d.steering.add(tv0);
        }

        // Separation: avoid nearby fish
        kois.forEach(other => {
          if (other === koi) return;
          tv0.copy(koi.position).sub(other.position);
          const dist = tv0.length();
          if (dist < 1.2 && dist > 0.001) {
            tv0.normalize().multiplyScalar(0.4 / dist);
            d.steering.add(tv0);
          }
        });

        // Alignment: match school heading
        tv0.copy(schoolVel).normalize().multiplyScalar(0.08);
        d.steering.add(tv0);

        // Random steering target (changes periodically like FishSwarm)
        if (t > d.nextSteerTime) {
          d.nextSteerTime = t + 2 + Math.random() * 5;
          const wanderAngle = Math.random() * Math.PI * 2;
          const wanderR = 2 + Math.random() * 5;
          d.steerTarget.set(
            Math.cos(wanderAngle) * wanderR,
            0,
            Math.sin(wanderAngle) * wanderR
          );
          d.speed = 0.25 + Math.random() * 0.45;
        }
        tv0.copy(d.steerTarget).sub(koi.position);
        tv0.y = 0;
        if (tv0.length() > 0.5) {
          tv0.normalize().multiplyScalar(0.1);
          d.steering.add(tv0);
        }

        // Pond boundary enforcement (keep fish within pond radius)
        const pondSafeR = pondRadius - 1.5;
        tv0.copy(koi.position);
        tv0.y = 0;
        const distFromCenter = tv0.length();
        if (distFromCenter > pondSafeR) {
          tv0.normalize().multiplyScalar(-0.6 * ((distFromCenter - pondSafeR) / 2));
          d.steering.add(tv0);
        }

        // Apply steering to velocity (smooth blending)
        d.velocity.add(d.steering.multiplyScalar(dt));

        // Clamp velocity to speed, keep in XZ plane
        d.velocity.y *= 0.9; // dampen vertical drift
        const currentSpeed = d.velocity.length();
        if (currentSpeed > d.speed) {
          d.velocity.multiplyScalar(d.speed / currentSpeed);
        } else if (currentSpeed < d.speed * 0.3) {
          d.velocity.normalize().multiplyScalar(d.speed * 0.3);
        }

        // Move the fish
        koi.position.addScaledVector(d.velocity, dt);
        koi.position.y = d.baseY + Math.sin(t * 0.5 + d.phase) * 0.03;

        // Face direction of travel (smooth lookAt like FishSwarm)
        tv1.copy(koi.position).add(d.velocity);
        tv1.y = koi.position.y;
        koi.lookAt(tv1);

        // Update body-bending shader time uniform
        const koiIdx = kois.indexOf(koi);
        if (koiIdx >= 0 && koiIdx < koiUniforms.length) {
          koiUniforms[koiIdx].uTime.value = t + d.phase;
        }

        // Tail wag (speed-dependent, now rotating around Y since spine is along Z)
        const swimSpeed = d.velocity.length();
        const tailMesh = koi.getObjectByName('koiTail');
        if (tailMesh) {
          const wagIntensity = 0.2 + swimSpeed * 0.6;
          const wagFreq = d.tailSpeed + swimSpeed * 4;
          tailMesh.rotation.y = Math.sin(t * wagFreq + d.phase) * wagIntensity;
        }

        // Koi-triggered ripples (more likely when moving fast)
        if (Math.random() < 0.002 + swimSpeed * 0.005) {
          spawnRipple(koi.position.x, koi.position.z);
        }
      });

      // ── Falling petals ──
      petals.forEach(petal => {
        const d = petal.userData as PetalUserData;
        petal.position.y -= d.fallSpeed * (1 + petal.position.y * 0.003);
        petal.position.x += Math.sin(t * d.swayFreq + d.phase) * d.swayAmp * 0.006;
        petal.position.z += Math.cos(t * d.swayFreq * 0.7 + d.phase) * d.swayAmp * 0.004;
        const spiral = t * d.spiralSpeed + d.phase;
        petal.position.x += Math.cos(spiral) * 0.002;
        petal.position.z += Math.sin(spiral) * 0.002;
        petal.rotation.x += d.rotSpeed.x + Math.sin(t * d.flutterAmp + d.phase) * 0.004;
        petal.rotation.y += d.rotSpeed.y;
        petal.rotation.z += d.rotSpeed.z + Math.cos(t * d.flutterAmp * 0.8 + d.phase) * 0.003;
        const mat = petal.material as THREE.MeshPhongMaterial;
        if (petal.position.y < -2) mat.opacity = Math.max(0, mat.opacity - 0.015);
        if (petal.position.y < -6 || mat.opacity <= 0) {
          petal.position.y = Math.random() * 5 + 14;
          petal.position.x = (Math.random() - 0.5) * 40;
          petal.position.z = (Math.random() - 0.5) * 40;
          mat.opacity = 0.7 + Math.random() * 0.3;
        }
      });

      // ── Butterflies ──
      butterflies.forEach(bf => {
        const d = bf.userData as ButterflyData;
        const a = t * d.orbitSpeed + d.phase;
        bf.position.x = Math.cos(a) * d.orbitRadius + Math.sin(t * 0.3 + d.phase) * 1.2;
        bf.position.z = Math.sin(a) * d.orbitRadius + Math.cos(t * 0.4 + d.phase) * 1.0;
        bf.position.y = d.baseY + Math.sin(t * d.vertSpeed + d.phase) * 0.8;
        const flap = Math.sin(t * d.wingSpeed) * 0.7;
        if (bf.children[0]) bf.children[0].rotation.y = flap;
        if (bf.children[1]) bf.children[1].rotation.y = -flap;
        const na = (t + 0.05) * d.orbitSpeed + d.phase;
        bf.rotation.y = Math.atan2(
          Math.sin(na) * d.orbitRadius - bf.position.z,
          Math.cos(na) * d.orbitRadius - bf.position.x
        );
      });

      // ── Dragonflies ──
      dragonflies.forEach(df => {
        const d = df.userData as ButterflyData;
        const a = t * d.orbitSpeed + d.phase;
        df.position.x = Math.cos(a) * d.orbitRadius + Math.sin(t * 0.5 + d.phase) * 2;
        df.position.z = Math.sin(a) * d.orbitRadius;
        df.position.y = d.baseY + Math.sin(t * d.vertSpeed + d.phase) * 0.5;
        df.rotation.y = a + Math.PI / 2;
      });

      // ── Fireflies ──
      const fPos = fireflyGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < fireflyCount; i++) {
        const i3 = i * 3;
        fPos[i3] += Math.sin(t * 0.4 + fireflyPhases[i]) * 0.005;
        fPos[i3 + 1] += Math.sin(t * 0.5 + fireflyPhases[i] * 1.3) * 0.003;
        fPos[i3 + 2] += Math.cos(t * 0.35 + fireflyPhases[i] * 0.9) * 0.005;
        if (fPos[i3 + 1] < 0.2) fPos[i3 + 1] = 7;
        if (fPos[i3 + 1] > 9) fPos[i3 + 1] = 0.3;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      fireflyMat.opacity = 0.2 + Math.sin(t * 3) * 0.18 + Math.sin(t * 7) * 0.08;

      // ── Camera orbit ──
      const camAngle = t * 0.06;
      camera.position.x = Math.cos(camAngle) * camOrbitRadius;
      camera.position.z = Math.sin(camAngle) * camOrbitRadius;
      camera.position.y = camY + Math.sin(t * 0.12) * 0.3;
      camera.lookAt(0, 0.5, 0);

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

  return <canvas id="zen-bridge-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" style={{}} />;
}