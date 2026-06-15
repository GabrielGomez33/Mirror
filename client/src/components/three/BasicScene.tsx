// src/components/three/BasicScene.tsx
//
// Animated sakura-petal background. Previously this unconditionally span
// up a 60-petal WebGL scene at 60fps, which on low-end Android devices
// (especially the ones we're trying to onboard via registration) could
// crash the canvas BEFORE the form even rendered — and on every device
// it ran a render loop that did nothing useful while the user was
// reading the form below.
//
// What this revision does differently:
//   1. Respects `prefers-reduced-motion: reduce` — users who've asked
//      for less motion get a static CSS gradient instead of an animated
//      WebGL canvas. (Accessibility win + a free performance win.)
//   2. Skips Three.js entirely when `WebGLRenderingContext` isn't
//      supported (older iOS Safari in lock-down mode, mobile browsers
//      with WebGL disabled, etc.).
//   3. Drops petal count + pixel ratio on small viewports and on devices
//      that self-report low memory / few cores, so the renderer doesn't
//      eat the GPU on a $80 Android phone.
//   4. Throttles the animation loop when the tab is hidden — the
//      previous version kept rAF running while the user was on another
//      tab, burning battery for no benefit.
//   5. Uses a ref (not getElementById) so two BasicScene instances on
//      the same page (e.g. a layout transition) can't grab the wrong
//      canvas.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTheme } from '../../context/ThemeContext';

// Petal/fog palettes per colorway. Sakura keeps the original pinks; cosmic
// recolors the falling petals to soft blues/violets and uses a dark fog so
// distant petals melt into the deep-indigo background instead of fading white.
const PETAL_PALETTES: Record<'sakura' | 'cosmic', { petals: number[]; emissive: number; fog: number }> = {
  sakura: {
    petals: [0xffb3d9, 0xffc0cb, 0xff69b4, 0xffa0c9, 0xff1493, 0xffb6c1, 0xffc1cc],
    emissive: 0xff69b4,
    fog: 0xffffff,
  },
  cosmic: {
    petals: [0xa5b4fc, 0x818cf8, 0xc4b5fd, 0x93c5fd, 0xddd6fe, 0xbfdbfe, 0xe0e7ff],
    emissive: 0x818cf8,
    fog: 0x1e1b4b,
  },
};

interface PetalUserData {
  fallSpeed: number;
  swaySpeed: number;
  swayAmount: number;
  rotationSpeed: THREE.Vector3;
  initialRotation: THREE.Euler;
  phase: number;
  scale: number;
}

// Lightweight capability sniff. Each check is cheap and only runs once on
// mount. We deliberately err on the side of *more* fallback — a static
// gradient that always renders is better than a WebGL canvas that crashes
// the page in the first 500ms.
function shouldSkipThree(): boolean {
  if (typeof window === 'undefined') return true;
  // 1. Accessibility preference
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch { /* matchMedia missing → not a reason to skip on its own */ }
  // 2. WebGL availability — try both modern and legacy contexts.
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
  } catch { return true; }
  return false;
}

// Petal density scales down on small viewports + low-spec devices. The
// previous fixed 60 was tuned for a desktop; on a 4-year-old Android
// phone with integrated GPU it routinely tanks the first paint.
function chooseDensity(): { count: number; pixelRatio: number } {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const cores = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) || 4;
  // `deviceMemory` is only set on Chromium browsers. Treat missing as
  // "unknown" (=> safe path).
  const memory = (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) || 4;

  const isSmall = w < 640;
  const isLowSpec = cores <= 4 || memory <= 2;

  if (isSmall && isLowSpec) return { count: 18, pixelRatio: Math.min(dpr, 1.5) };
  if (isSmall || isLowSpec) return { count: 32, pixelRatio: Math.min(dpr, 1.75) };
  return { count: 60, pixelRatio: Math.min(dpr, 2) };
}

export default function BasicScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  // We render the fallback in JSX so SSR / fail-paths still get something.
  const [skipThree] = useState<boolean>(() => shouldSkipThree());

  useEffect(() => {
    if (skipThree) return;
    const palette = PETAL_PALETTES[theme];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { count: PETAL_COUNT, pixelRatio } = chooseDensity();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,        // antialias off saves ~30% GPU on mobile
        powerPreference: 'low-power',
      });
    } catch {
      // If renderer construction throws (driver crash, context-loss
      // refusal, etc.) we bail silently — the JSX gradient stays.
      return;
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    function createPetalGeometry() {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.3, 0.1, 0.4, 0.3, 0.3, 0.5);
      shape.bezierCurveTo(0.2, 0.7, 0.1, 0.8, 0, 1);
      shape.bezierCurveTo(-0.1, 0.8, -0.2, 0.7, -0.3, 0.5);
      shape.bezierCurveTo(-0.4, 0.3, -0.3, 0.1, 0, 0);
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.center();
      return geometry;
    }

    const petalColors = palette.petals;

    const petals: THREE.Mesh[] = [];
    const petalGeometry = createPetalGeometry();

    for (let i = 0; i < PETAL_COUNT; i++) {
      const material = new THREE.MeshPhongMaterial({
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        transparent: true,
        opacity: 0.7 + Math.random() * 0.3,
        side: THREE.DoubleSide,
        shininess: 100,
        specular: 0xffffff,
        emissive: palette.emissive,
        emissiveIntensity: 0.02,
      });

      const petal = new THREE.Mesh(petalGeometry, material);
      petal.position.x = (Math.random() - 0.5) * 25;
      petal.position.y = Math.random() * 20 + 5;
      petal.position.z = (Math.random() - 0.5) * 15 - 5;

      const scale = 0.5 + Math.random() * 0.8;
      petal.scale.set(scale, scale, scale);

      petal.rotation.x = Math.random() * Math.PI;
      petal.rotation.y = Math.random() * Math.PI;
      petal.rotation.z = Math.random() * Math.PI;

      petal.userData = {
        fallSpeed: Math.random() * 0.015 + 0.008,
        swaySpeed: Math.random() * 0.3 + 0.2,
        swayAmount: Math.random() * 0.8 + 0.3,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.01
        ),
        initialRotation: petal.rotation.clone(),
        phase: Math.random() * Math.PI * 2,
        scale: scale,
      } as PetalUserData;

      scene.add(petal);
      petals.push(petal);
    }

    camera.position.z = 8;
    camera.position.y = 0;
    scene.fog = new THREE.Fog(palette.fog, 10, 30);

    // ---- Animation loop with tab-visibility throttle ----------------------
    let animationId: number | null = null;
    let contextLost = false;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);

      // Don't burn cycles while the tab is hidden. The clock keeps running
      // so the next visible frame doesn't snap the petals forward.
      if (document.visibilityState === 'hidden' || contextLost) return;

      const elapsedTime = clock.getElapsedTime();

      petals.forEach((petal, index) => {
        const userData = petal.userData as PetalUserData;
        petal.position.y -= userData.fallSpeed * (1 + petal.position.y * 0.01);

        const swayX = Math.sin(elapsedTime * userData.swaySpeed + userData.phase) * userData.swayAmount;
        const swayZ = Math.cos(elapsedTime * userData.swaySpeed * 0.7 + userData.phase) * userData.swayAmount * 0.5;

        petal.position.x += swayX * 0.01;
        petal.position.z += swayZ * 0.01;

        petal.rotation.x += userData.rotationSpeed.x;
        petal.rotation.y += userData.rotationSpeed.y;
        petal.rotation.z += userData.rotationSpeed.z;

        const tumble = Math.sin(elapsedTime * 0.5 + index) * 0.001;
        petal.rotation.x += tumble;

        const material = petal.material as THREE.MeshPhongMaterial;
        if (petal.position.y < -5) {
          material.opacity = Math.max(0, material.opacity - 0.02);
        }
        if (petal.position.y < -10 || material.opacity <= 0) {
          petal.position.y = Math.random() * 5 + 15;
          petal.position.x = (Math.random() - 0.5) * 25;
          petal.position.z = (Math.random() - 0.5) * 15 - 5;
          material.opacity = 0.7 + Math.random() * 0.3;
        }
      });

      camera.position.x = Math.sin(elapsedTime * 0.1) * 0.5;
      camera.position.y = Math.cos(elapsedTime * 0.15) * 0.3;
      camera.lookAt(0, 0, 0);

      try {
        renderer.render(scene, camera);
      } catch {
        // A WebGL context loss event between rAF callbacks can make render
        // throw. We swallow it, set the flag, and the visibility-gated
        // path above stops calling render until we're restored.
        contextLost = true;
      }
    }

    animate();

    // ---- Resize handler ---------------------------------------------------
    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    // ---- WebGL context-loss recovery -------------------------------------
    const onContextLost = (e: Event) => { e.preventDefault(); contextLost = true; };
    const onContextRestored = () => { contextLost = false; };
    canvas.addEventListener('webglcontextlost', onContextLost as EventListener);
    canvas.addEventListener('webglcontextrestored', onContextRestored as EventListener);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', onContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onContextRestored as EventListener);
      if (animationId !== null) cancelAnimationFrame(animationId);
      petals.forEach((petal) => {
        (petal.material as THREE.Material).dispose();
        scene.remove(petal);
      });
      petalGeometry.dispose();
      renderer.dispose();
    };
  }, [skipThree, theme]);

  // Static fallback (renders BEHIND the canvas always — if WebGL works
  // it's hidden under the transparent canvas; if WebGL is skipped we
  // present a soft sakura gradient instead).
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10"
        style={{ background: 'var(--scene-grad)' }}
      />
      {!skipThree && <canvas ref={canvasRef} id="three-canvas" />}
    </>
  );
}