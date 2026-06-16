// src/components/three/SakuraForestSceneCosmic.tsx
//
// Nighttime "cosmic" MyMirror scene. The daytime magical-mirror pond becomes a
// still, reflective dark mirror beneath a galaxy: a procedural nebula sky dome,
// dense twinkling stars, named constellations and a glowing moon overhead, with
// the moon glinting on the mirror surface. Keeps this scene's identity — the
// circular mirror, the 7 lotus flowers, the zen frogs and floating petals —
// recolored to cool moonlit tones. Rendered by SakuraForestScene for cosmic.
import { useEffect } from 'react';
import * as THREE from 'three';

// Procedural galaxy/nebula texture for the sky dome (dark base + colored clouds
// + bright core + dense stars).
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

// A cute zen frog, recolored to a cool moonlit jade for the night scene.
function createZenFrog(): THREE.Group {
  const frogGroup = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x5fae9b,
    transparent: true,
    opacity: 0.95,
    emissive: 0x2f6f6a,
    emissiveIntensity: 0.25,
    roughness: 0.7,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), bodyMaterial);
  body.scale.set(1, 0.7, 1);
  body.position.y = 0.08;
  frogGroup.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), bodyMaterial);
  head.position.y = 0.14;
  head.position.z = 0.05;
  frogGroup.add(head);

  for (let i = 0; i < 2; i++) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, emissive: 0x9fb4ff, emissiveIntensity: 0.3 }),
    );
    eye.position.set(i === 0 ? -0.03 : 0.03, 0.16, 0.08);
    frogGroup.add(eye);
  }
  return frogGroup;
}

export default function SakuraForestSceneCosmic() {
  useEffect(() => {
    const canvas = document.getElementById('forest-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[]; tex: THREE.Texture[] } = { geo: [], mat: [], tex: [] };

    // ─── Night lighting (cool moonlight) ───
    scene.add(new THREE.AmbientLight(0x3a4675, 0.55));
    const moonLight = new THREE.DirectionalLight(0xc8d4ff, 0.85);
    moonLight.position.set(-8, 16, -6);
    scene.add(moonLight);
    const fillLight = new THREE.DirectionalLight(0x5b6bd6, 0.25);
    fillLight.position.set(6, 8, 6);
    scene.add(fillLight);
    scene.fog = new THREE.Fog(0x0a1030, 18, 42);

    // ─── Galaxy nebula sky dome ───
    const nebulaTex = makeNebulaTexture();
    disposables.tex.push(nebulaTex);
    const skyGeo = new THREE.SphereGeometry(220, 48, 24);
    const skyMat = new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.BackSide, depthWrite: false, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    disposables.geo.push(skyGeo);
    disposables.mat.push(skyMat);

    // ─── Starfield (two twinkling layers) ───
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

    // ─── Constellations (line patterns + bright nodes) ───
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
    const MOON_POS = new THREE.Vector3(-11, 15, -22);
    const moonGeo = new THREE.SphereGeometry(3.2, 48, 48);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xeaf0ff, emissive: 0xc4d2ff, emissiveIntensity: 1.1, roughness: 0.9 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.copy(MOON_POS);
    scene.add(moon);
    disposables.geo.push(moonGeo);
    disposables.mat.push(moonMat);
    const haloGeo = new THREE.SphereGeometry(4.6, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb9c9ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(MOON_POS);
    scene.add(halo);
    disposables.geo.push(haloGeo);
    disposables.mat.push(haloMat);

    // ─── Magical Mirror surface (dark, reflective — mirrors the cosmos) ───
    const mirrorRadius = 15;
    const mirrorGeometry = new THREE.CircleGeometry(mirrorRadius, 64);
    const mirrorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1430,
      metalness: 0.9,
      roughness: 0.16,
      emissive: 0x0a1838,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });
    const mirror = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -0.02;
    scene.add(mirror);
    disposables.geo.push(mirrorGeometry);
    disposables.mat.push(mirrorMaterial);

    // Faint violet reflection ring under the mirror (kept from the day scene)
    const reflectionGeometry = new THREE.CircleGeometry(mirrorRadius * 0.98, 64);
    const reflectionMaterial = new THREE.MeshBasicMaterial({ color: 0x3b2f6b, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const reflection = new THREE.Mesh(reflectionGeometry, reflectionMaterial);
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.y = -0.03;
    scene.add(reflection);
    disposables.geo.push(reflectionGeometry);
    disposables.mat.push(reflectionMaterial);

    // Moon reflection glitter on the mirror, beneath the moon
    const glintCount = 80;
    const glintGeo = new THREE.BufferGeometry();
    const glintPos = new Float32Array(glintCount * 3);
    const glintPhases: number[] = [];
    for (let i = 0; i < glintCount; i++) {
      const along = (i / glintCount) * 13;
      glintPos[i * 3] = MOON_POS.x * 0.4 + (Math.random() - 0.5) * (0.8 + along * 0.25);
      glintPos[i * 3 + 1] = 0.02;
      glintPos[i * 3 + 2] = -along - 1 + (Math.random() - 0.5) * 0.5;
      glintPhases.push(Math.random() * Math.PI * 2);
    }
    glintGeo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
    const glintMat = new THREE.PointsMaterial({ color: 0xdbe6ff, size: 0.13, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(glintGeo, glintMat));
    disposables.geo.push(glintGeo);
    disposables.mat.push(glintMat);

    // ─── 7 Lotus flowers (moonlit) with zen frogs ───
    const lotusFlowers: THREE.Group[] = [];
    function createLotusFlower(scale = 1): THREE.Group {
      const lotusGroup = new THREE.Group();
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(1.2 * scale, 12),
        new THREE.MeshStandardMaterial({ color: 0x16324a, transparent: true, opacity: 0.92, emissive: 0x10324a, emissiveIntensity: 0.25, roughness: 0.7, metalness: 0.2 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.05;
      lotusGroup.add(pad);
      disposables.geo.push(pad.geometry);
      disposables.mat.push(pad.material as THREE.Material);

      for (let i = 0; i < 8; i++) {
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.3 * scale, 8, 6),
          new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.62, 0.45, 0.8), transparent: true, opacity: 0.95, emissive: 0x9fb4ff, emissiveIntensity: 0.4, roughness: 0.6 }),
        );
        const angle = (i / 8) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.4 * scale, 0.15 * scale, Math.sin(angle) * 0.4 * scale);
        petal.scale.set(1, 0.5, 0.8);
        petal.rotation.y = angle;
        lotusGroup.add(petal);
        disposables.geo.push(petal.geometry);
        disposables.mat.push(petal.material as THREE.Material);
      }

      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * scale, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xdbe6ff, emissive: 0xaebfff, emissiveIntensity: 0.7, roughness: 0.5 }),
      );
      center.position.y = 0.2 * scale;
      lotusGroup.add(center);
      disposables.geo.push(center.geometry);
      disposables.mat.push(center.material as THREE.Material);
      return lotusGroup;
    }

    const centerLotus = createLotusFlower(1.2);
    scene.add(centerLotus);
    lotusFlowers.push(centerLotus);
    for (let i = 0; i < 6; i++) {
      const lotus = createLotusFlower(0.8 + Math.random() * 0.4);
      const angle = (i / 6) * Math.PI * 2;
      const distance = 4 + Math.random() * 2;
      lotus.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
      lotus.rotation.y = Math.random() * Math.PI * 2;
      if (i < 3) {
        const frog = createZenFrog();
        frog.position.y = 0.25;
        frog.rotation.y = Math.random() * Math.PI * 2;
        lotus.add(frog);
      }
      scene.add(lotus);
      lotusFlowers.push(lotus);
    }

    // ─── Floating petals (pale moonlit) ───
    const floatingPetals: THREE.Mesh[] = [];
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.2, 0.1, 0.3, 0.3, 0.2, 0.5);
    petalShape.bezierCurveTo(0.1, 0.6, 0, 0.7, 0, 0.8);
    petalShape.bezierCurveTo(-0.1, 0.6, -0.2, 0.5, -0.3, 0.3);
    petalShape.bezierCurveTo(-0.2, 0.1, 0, 0, 0, 0);
    const floatingPetalGeometry = new THREE.ShapeGeometry(petalShape);
    disposables.geo.push(floatingPetalGeometry);

    for (let i = 0; i < 35; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.6 + Math.random() * 0.05, 0.4, 0.82),
        transparent: true,
        opacity: 0.6,
        emissive: 0x6f86d9,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      });
      const petal = new THREE.Mesh(floatingPetalGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.random() * 4;
      petal.position.set(Math.cos(angle) * distance, 0.02, Math.sin(angle) * distance);
      const scale = 0.2 + Math.random() * 0.25;
      petal.scale.set(scale, scale, scale);
      petal.rotation.z = Math.random() * Math.PI * 2;
      scene.add(petal);
      floatingPetals.push(petal);
      disposables.mat.push(material);
    }

    // ─── Camera (orbiting) ───
    const cameraRadius = 18;
    camera.position.set(cameraRadius, 8, 0);
    camera.lookAt(0, 0, 0);

    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      lotusFlowers.forEach((lotus, index) => {
        const baseFloat = Math.sin(t * 0.8 + index * 0.5) * 0.02;
        const distance = Math.sqrt(lotus.position.x ** 2 + lotus.position.z ** 2);
        const ripple1 = Math.sin(distance * 0.3 - t * 2) * 0.03;
        const ripple2 = Math.sin(distance * 0.5 - t * 1.5) * 0.02;
        lotus.position.y = 0.05 + baseFloat + ripple1 + ripple2;
        lotus.rotation.y += 0.0005 + index * 0.0002;
      });

      floatingPetals.forEach((petal, index) => {
        petal.rotation.z += 0.002;
        petal.position.y = 0.02 + Math.sin(t * 0.5 + index) * 0.01;
        const radius = Math.sqrt(petal.position.x ** 2 + petal.position.z ** 2);
        const angle = Math.atan2(petal.position.z, petal.position.x) + 0.0005;
        petal.position.x = Math.cos(angle) * radius;
        petal.position.z = Math.sin(angle) * radius;
      });

      // Sky drift, twinkle, moon halo, mirror shimmer, glints
      sky.rotation.y = t * 0.004;
      starsFar.opacity = 0.6 + Math.sin(t * 1.3) * 0.12;
      starsNear.opacity = 0.8 + Math.sin(t * 2.1 + 1) * 0.15;
      cNodeMat.opacity = 0.85 + Math.sin(t * 1.7) * 0.12;
      halo.scale.setScalar(1 + Math.sin(t * 0.4) * 0.04);
      haloMat.opacity = 0.1 + Math.sin(t * 0.4) * 0.03;
      mirrorMaterial.emissiveIntensity = 0.3 + Math.sin(t * 0.5) * 0.08;
      glintMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.3;

      const cameraAngle = t * 0.1;
      camera.position.x = Math.cos(cameraAngle) * cameraRadius;
      camera.position.z = Math.sin(cameraAngle) * cameraRadius;
      camera.position.y = 8 + Math.sin(t * 0.05) * 1;
      camera.lookAt(0, 1, 0);

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