// src/components/three/ZenPondScene.tsx
import { useEffect } from 'react';
import * as THREE from 'three';

export default function ZenPondScene() {
  useEffect(() => {
    const canvas = document.getElementById('forest-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true, 
      antialias: true 
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Professional lighting
    const ambientLight = new THREE.AmbientLight(0xffd1dc, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffe4e6, 1.2);
    directionalLight.position.set(8, 15, 8);
    scene.add(directionalLight);

    const rimLight = new THREE.DirectionalLight(0xff69b4, 0.6);
    rimLight.position.set(-8, 12, -5);
    scene.add(rimLight);

    // Water surface
    const waterGeometry = new THREE.CircleGeometry(20, 64);
    const waterMaterial = new THREE.MeshLambertMaterial({
      color: 0xffb3e6,
      transparent: true,
      opacity: 0.15,
      emissive: 0xff69b4,
      emissiveIntensity: 0.1
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // Arrays for scene elements
    const lotusFlowers: THREE.Group[] = [];
    const reflectedLotus: THREE.Group[] = [];
    const spinningPetals: THREE.Mesh[] = [];
    const floatingPetals: THREE.Mesh[] = [];
    const sparkles: THREE.Points[] = [];
    const birds: THREE.Group[] = [];

    // Create petal geometry
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.3, 0.1, 0.4, 0.4, 0.3, 0.7);
    petalShape.bezierCurveTo(0.2, 0.8, 0, 0.9, 0, 1.0);
    petalShape.bezierCurveTo(-0.2, 0.8, -0.3, 0.7, -0.4, 0.4);
    petalShape.bezierCurveTo(-0.3, 0.1, 0, 0, 0, 0);
    const petalGeometry = new THREE.ShapeGeometry(petalShape);

    // Zen frog function
    function createZenFrog() {
      const frogGroup = new THREE.Group();
      
      const bodyGeometry = new THREE.SphereGeometry(0.1, 12, 8);
      const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x98fb98,
        emissive: 0x90ee90,
        emissiveIntensity: 0.1
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.scale.set(1, 0.7, 1);
      body.position.y = 0.08;
      frogGroup.add(body);

      const headGeometry = new THREE.SphereGeometry(0.07, 10, 6);
      const head = new THREE.Mesh(headGeometry, bodyMaterial);
      head.position.set(0, 0.12, 0.04);
      frogGroup.add(head);

      // Eyes
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.01, 6, 4),
          new THREE.MeshLambertMaterial({ color: 0x000000 })
        );
        eye.position.set(i === 0 ? -0.025 : 0.025, 0.14, 0.07);
        frogGroup.add(eye);
      }

      return frogGroup;
    }

    // Lotus flower function
    function createLotusFlower(scale = 1) {
      const lotusGroup = new THREE.Group();

      // Lily pad
      const padGeometry = new THREE.CircleGeometry(1.2 * scale, 16);
      const padMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xdda0dd,
        emissive: 0xda70d6,
        emissiveIntensity: 0.15
      });
      const pad = new THREE.Mesh(padGeometry, padMaterial);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.05;
      lotusGroup.add(pad);

      // Petals
      for (let i = 0; i < 12; i++) {
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.35 * scale, 10, 8),
          new THREE.MeshLambertMaterial({ 
            color: new THREE.Color().setHSL(0.92, 0.8, 0.9),
            emissive: 0xff69b4,
            emissiveIntensity: 0.2
          })
        );
        
        const angle = (i / 12) * Math.PI * 2;
        petal.position.set(
          Math.cos(angle) * 0.45 * scale,
          0.18 * scale,
          Math.sin(angle) * 0.45 * scale
        );
        petal.scale.set(1, 0.6, 0.9);
        petal.rotation.y = angle;
        lotusGroup.add(petal);
      }

      // Center
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 * scale, 10, 8),
        new THREE.MeshLambertMaterial({ 
          color: 0xffd1dc,
          emissive: 0xffb6c1,
          emissiveIntensity: 0.4
        })
      );
      center.position.y = 0.25 * scale;
      lotusGroup.add(center);

      return lotusGroup;
    }

    // Create center lotus
    const centerLotus = createLotusFlower(1.4);
    centerLotus.position.y = 1;
    scene.add(centerLotus);
    lotusFlowers.push(centerLotus);

    // Center reflection
    const centerReflection = createLotusFlower(1.4);
    centerReflection.position.y = -1;
    centerReflection.scale.y = -1;
    centerReflection.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.MeshLambertMaterial).opacity = 0.5;
      }
    });
    scene.add(centerReflection);
    reflectedLotus.push(centerReflection);

    // Surrounding lotus flowers
    for (let i = 0; i < 8; i++) {
      const scale = 0.9 + Math.random() * 0.5;
      const angle = (i / 8) * Math.PI * 2;
      const distance = 5 + Math.random() * 3;
      const lotus = createLotusFlower(scale);
      
      lotus.position.set(
        Math.cos(angle) * distance,
        1,
        Math.sin(angle) * distance
      );
      
      if (i < 4) {
        const frog = createZenFrog();
        frog.position.y = 0.3;
        lotus.add(frog);
      }
      
      scene.add(lotus);
      lotusFlowers.push(lotus);

      // Reflection
      const reflection = createLotusFlower(scale);
      reflection.position.set(
        Math.cos(angle) * distance,
        -1,
        Math.sin(angle) * distance
      );
      reflection.scale.y = -1;
      reflection.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshLambertMaterial).opacity = 0.5;
        }
      });
      scene.add(reflection);
      reflectedLotus.push(reflection);
    }

    // 140 spinning petals above
    for (let i = 0; i < 140; i++) {
      const petal = new THREE.Mesh(
        petalGeometry,
        new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.91 + Math.random() * 0.08, 0.7, 0.85),
          transparent: true,
          opacity: 0.8,
          emissive: 0xff69b4,
          emissiveIntensity: 0.25,
          side: THREE.DoubleSide
        })
      );
      
      const distance = 2 + Math.random() * 25;
      const height = 8 + Math.random() * 12;
      const angle = Math.random() * Math.PI * 2;
      
      petal.position.set(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
      );
      
      const scale = 0.8 + Math.random() * 1.5;
      petal.scale.setScalar(scale);
      petal.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      scene.add(petal);
      spinningPetals.push(petal);
    }

    // Floating petals on water
    for (let i = 0; i < 25; i++) {
      const petal = new THREE.Mesh(
        petalGeometry,
        new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.92, 0.6, 0.85),
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        })
      );
      
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 6;
      petal.position.set(
        Math.cos(angle) * distance,
        0.05,
        Math.sin(angle) * distance
      );
      
      const scale = 0.25 + Math.random() * 0.3;
      petal.scale.setScalar(scale);
      petal.rotation.z = Math.random() * Math.PI * 2;
      
      scene.add(petal);
      floatingPetals.push(petal);
    }

    // Sparkle particles
    const sparkleCount = 200;
    const sparkleGeometry = new THREE.BufferGeometry();
    const sparklePositions = new Float32Array(sparkleCount * 3);
    const sparkleVelocities: number[] = [];
    
    for (let i = 0; i < sparkleCount; i++) {
      sparklePositions[i * 3] = (Math.random() - 0.5) * 50;
      sparklePositions[i * 3 + 1] = Math.random() * 20 + 1;
      sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      sparkleVelocities.push(Math.random() * Math.PI * 2);
    }
    
    sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
    
    const sparklePoints = new THREE.Points(
      sparkleGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      })
    );
    scene.add(sparklePoints);
    sparkles.push(sparklePoints);

    // Flying birds
    function createBird() {
      const birdGroup = new THREE.Group();
      
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x333333, opacity: 0.8, transparent: true })
      );
      body.scale.set(1.5, 1, 1);
      birdGroup.add(body);
      
      for (let i = 0; i < 2; i++) {
        const wing = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 6, 4),
          body.material
        );
        wing.position.x = i === 0 ? -0.15 : 0.15;
        wing.scale.set(0.3, 0.1, 1.2);
        birdGroup.add(wing);
      }
      
      return birdGroup;
    }
    
    for (let i = 0; i < 6; i++) {
      const bird = createBird();
      const angle = (i / 6) * Math.PI * 2;
      bird.position.set(
        Math.cos(angle) * 20,
        10 + Math.random() * 5,
        Math.sin(angle) * 20
      );
      scene.add(bird);
      birds.push(bird);
    }

    // Camera setup - closer and locked
    camera.position.set(12, 6, 0);
    camera.lookAt(0, 1, 0);

    // Disable user interaction
    canvas.style.pointerEvents = 'none';
    ['wheel', 'touchmove', 'mousedown', 'mousemove'].forEach(event => {
      canvas.addEventListener(event, (e) => e.preventDefault(), { passive: false });
    });

    // Fog
    scene.fog = new THREE.Fog(0xffc0e7, 20, 40);

    // Animation
    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Spinning petals
      spinningPetals.forEach((petal, index) => {
        petal.rotation.y += 0.015 + (index % 5) * 0.003;
        petal.rotation.x += 0.008;
        petal.rotation.z += 0.012;
        
        const baseY = 8 + (index % 12);
        petal.position.y = baseY + Math.sin(time * 0.6 + index * 0.4) * 0.3;
        
        const radius = Math.sqrt(petal.position.x ** 2 + petal.position.z ** 2);
        const angle = Math.atan2(petal.position.z, petal.position.x) + 0.005;
        petal.position.x = Math.cos(angle) * radius;
        petal.position.z = Math.sin(angle) * radius;
      });

      // Sparkles
      const positions = sparklePoints.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkleCount; i++) {
        const i3 = i * 3;
        positions[i3] += Math.sin(time * 0.3 + sparkleVelocities[i]) * 0.005;
        positions[i3 + 1] += Math.sin(time * 0.4 + sparkleVelocities[i] * 1.5) * 0.008;
        positions[i3 + 2] += Math.cos(time * 0.35 + sparkleVelocities[i] * 0.8) * 0.005;
        
        if (positions[i3] > 25) positions[i3] = -25;
        if (positions[i3] < -25) positions[i3] = 25;
        if (positions[i3 + 2] > 25) positions[i3 + 2] = -25;
        if (positions[i3 + 2] < -25) positions[i3 + 2] = 25;
        if (positions[i3 + 1] < 0.5) positions[i3 + 1] = 20;
        if (positions[i3 + 1] > 21) positions[i3 + 1] = 1;
      }
      sparklePoints.geometry.attributes.position.needsUpdate = true;
      
      // Sparkle twinkling
      (sparklePoints.material as THREE.PointsMaterial).opacity = 0.3 + Math.sin(time * 3) * 0.5;

      // Birds
      birds.forEach((bird, index) => {
        const angle = time * 0.02 + (index * Math.PI * 2) / 6;
        bird.position.x = Math.cos(angle) * 20;
        bird.position.z = Math.sin(angle) * 20;
        bird.position.y = 10 + Math.sin(time * 2 + index) * 0.5;
        bird.rotation.y = angle + Math.PI / 2;
        
        // Wing flapping
        bird.children.slice(1).forEach(wing => {
          wing.rotation.z = Math.sin(time * 8 + index * 2) * 0.3;
        });
      });

      // Lotus floating
      lotusFlowers.forEach((lotus, index) => {
        const float = Math.sin(time * 0.6 + index * 0.4) * 0.03;
        const distance = Math.sqrt(lotus.position.x ** 2 + lotus.position.z ** 2);
        const ripple = Math.sin(distance * 0.2 - time * 1.5) * 0.02;
        lotus.position.y = 1.05 + float + ripple;
        lotus.rotation.y += 0.003;
      });

      // Mirror reflections
      reflectedLotus.forEach((lotus, index) => {
        const original = lotusFlowers[index];
        if (original) {
          lotus.position.y = -(original.position.y - 1) - 1;
          lotus.rotation.y = original.rotation.y;
        }
      });

      // Floating petals
      floatingPetals.forEach((petal, index) => {
        petal.rotation.z += 0.003;
        petal.position.y = 0.05 + Math.sin(time * 0.4 + index) * 0.02;
        
        const radius = Math.sqrt(petal.position.x ** 2 + petal.position.z ** 2);
        const angle = Math.atan2(petal.position.z, petal.position.x) + 0.002;
        petal.position.x = Math.cos(angle) * radius;
        petal.position.z = Math.sin(angle) * radius;
      });

      // Camera orbit
      const cameraAngle = time * 0.08;
      camera.position.x = Math.cos(cameraAngle) * 12;
      camera.position.z = Math.sin(cameraAngle) * 12;
      camera.position.y = 6 + Math.sin(time * 0.03) * 0.5;
      camera.lookAt(0, 1, 0);

      renderer.render(scene, camera);
    }

    animate();

    // Resize handler
    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      
      // Dispose materials and geometries
      [waterGeometry, petalGeometry].forEach(geo => geo.dispose());
      [waterMaterial].forEach(mat => mat.dispose());
      
      [...spinningPetals, ...floatingPetals].forEach(petal => {
        (petal.material as THREE.Material).dispose();
      });
      
      sparkles.forEach(sparkle => {
        sparkle.geometry.dispose();
        (sparkle.material as THREE.Material).dispose();
      });
      
      [...lotusFlowers, ...reflectedLotus, ...birds].forEach(group => {
        group.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      });
      
      renderer.dispose();
    };
  }, []);

  return <canvas id="forest-canvas" className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}
