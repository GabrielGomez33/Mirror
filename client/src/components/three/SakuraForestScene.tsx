// Function to create a cute zen frog
    function createZenFrog() {
      const frogGroup = new THREE.Group();

      // Frog body with cute sakura theme
      const bodyGeometry = new THREE.SphereGeometry(0.12, 12, 8);
      const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x98fb98, // Soft mint green
        transparent: true,
        opacity: 0.95,
        emissive: 0x90ee90,
        emissiveIntensity: 0.1
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.scale.set(1, 0.7, 1);
      body.position.y = 0.08;
      frogGroup.add(body);

      // Frog head
      const headGeometry = new THREE.SphereGeometry(0.08, 10, 6);
      const head = new THREE.Mesh(headGeometry, bodyMaterial);
      head.position.y = 0.14;
      head.position.z = 0.05;
      frogGroup.add(head);

      // Eyes
      for (let i = 0; i < 2; i++) {
        const eyeGeometry = new THREE.SphereGeometry(0.015, 6, 4);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        
        eye.position.x = i === 0 ? -0.03 : 0.03;
        eye.position.y = 0.16;
        eye.position.z = 0.08;
        
        frogGroup.add(eye);
      }

      return frogGroup;
    }// src/components/three/ZenPondScene.tsx
import { useEffect } from 'react';
import * as THREE from 'three';

export default function ZenPondScene() {
  useEffect(() => {
    const canvas = document.getElementById('forest-canvas') as HTMLCanvasElement;
    if (!canvas) return;

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

    // Soft sakura-themed lighting
    const ambientLight = new THREE.AmbientLight(0xffb3d9, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffc0e7, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Soft fill light with purple tint
    const fillLight = new THREE.DirectionalLight(0xe6ccff, 0.4);
    fillLight.position.set(-5, 8, -3);
    scene.add(fillLight);

    // Create magical mirror surface
    const mirrorRadius = 15;
    const mirrorGeometry = new THREE.CircleGeometry(mirrorRadius, 64);
    
    const mirrorMaterial = new THREE.MeshLambertMaterial({
      color: 0xffb3e6, // Soft sakura pink
      transparent: true,
      opacity: 0.15, // Almost transparent
      side: THREE.DoubleSide,
      emissive: 0xff69b4, // Neon pink glow
      emissiveIntensity: 0.1
    });

    const mirror = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -0.02;
    scene.add(mirror);

    // Create reflection layer with slightly different color
    const reflectionGeometry = new THREE.CircleGeometry(mirrorRadius * 0.98, 64);
    const reflectionMaterial = new THREE.MeshLambertMaterial({
      color: 0xd8a7ff, // Light purple reflection
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      emissive: 0xda70d6, // Purple glow
      emissiveIntensity: 0.05
    });

    const reflection = new THREE.Mesh(reflectionGeometry, reflectionMaterial);
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.y = -0.03;
    scene.add(reflection);

    // Create 7 lotus flowers (1 center + 6 around it)
    const lotusFlowers: THREE.Group[] = [];
    
    // Function to create a single lotus flower
    function createLotusFlower(scale = 1) {
      const lotusGroup = new THREE.Group();

      // Lotus base (lily pad) with sakura theme
      const padGeometry = new THREE.CircleGeometry(1.2 * scale, 12);
      const padMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x98fb98, // Soft mint green
        transparent: true,
        opacity: 0.9,
        emissive: 0x90ee90,
        emissiveIntensity: 0.1
      });
      const pad = new THREE.Mesh(padGeometry, padMaterial);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.05;
      lotusGroup.add(pad);

      // Lotus petals
      for (let i = 0; i < 8; i++) {
        const petalGeometry = new THREE.SphereGeometry(0.3 * scale, 8, 6);
        const petalMaterial = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color().setHSL(0.92, 0.7, 0.88), // Brighter sakura pink
          transparent: true,
          opacity: 0.95,
          emissive: 0xff69b4,
          emissiveIntensity: 0.15 // More neon glow
        });
        const petal = new THREE.Mesh(petalGeometry, petalMaterial);
        
        const angle = (i / 8) * Math.PI * 2;
        petal.position.x = Math.cos(angle) * 0.4 * scale;
        petal.position.z = Math.sin(angle) * 0.4 * scale;
        petal.position.y = 0.15 * scale;
        petal.scale.set(1, 0.5, 0.8);
        petal.rotation.y = angle;
        
        lotusGroup.add(petal);
      }

      // Center of lotus
      const centerGeometry = new THREE.SphereGeometry(0.15 * scale, 8, 6);
      const centerMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xffd1dc, // Soft pink center
        emissive: 0xffb6c1,
        emissiveIntensity: 0.3 // Bright neon glow
      });
      const center = new THREE.Mesh(centerGeometry, centerMaterial);
      center.position.y = 0.2 * scale;
      lotusGroup.add(center);

      return lotusGroup;
    }

    // Center lotus (largest)
    const centerLotus = createLotusFlower(1.2);
    scene.add(centerLotus);
    lotusFlowers.push(centerLotus);

    // 6 surrounding lotus flowers
    for (let i = 0; i < 6; i++) {
      const lotus = createLotusFlower(0.8 + Math.random() * 0.4); // Varied sizes
      
      const angle = (i / 6) * Math.PI * 2;
      const distance = 4 + Math.random() * 2; // Spread them out
      
      lotus.position.x = Math.cos(angle) * distance;
      lotus.position.z = Math.sin(angle) * distance;
      lotus.rotation.y = Math.random() * Math.PI * 2; // Random rotation
      
      // Add zen frogs to 3 random flowers
      if (i < 3) {
        const frog = createZenFrog();
        frog.position.y = 0.25; // Sit on top of lotus
        frog.rotation.y = Math.random() * Math.PI * 2;
        lotus.add(frog);
      }
      
      scene.add(lotus);
      lotusFlowers.push(lotus);
    }

    // Create subtle floating petals
    const floatingPetals: THREE.Mesh[] = [];
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.2, 0.1, 0.3, 0.3, 0.2, 0.5);
    petalShape.bezierCurveTo(0.1, 0.6, 0, 0.7, 0, 0.8);
    petalShape.bezierCurveTo(-0.1, 0.6, -0.2, 0.5, -0.3, 0.3);
    petalShape.bezierCurveTo(-0.2, 0.1, 0, 0, 0, 0);

    const floatingPetalGeometry = new THREE.ShapeGeometry(petalShape);

    for (let i = 0; i < 35; i++) {
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(0.92 + Math.random() * 0.05, 0.6, 0.85),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });

      const petal = new THREE.Mesh(floatingPetalGeometry, material);
      
      // Random positions closer to center for bigger appearance
      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.random() * 4; // Closer to center
      petal.position.x = Math.cos(angle) * distance;
      petal.position.z = Math.sin(angle) * distance;
      petal.position.y = 0.02;
      
      const scale = 0.2 + Math.random() * 0.25; // Bigger petals
      petal.scale.set(scale, scale, scale);
      petal.rotation.z = Math.random() * Math.PI * 2;
      
      scene.add(petal);
      floatingPetals.push(petal);
    }

    // Position camera for orbiting view
    const cameraRadius = 18;
    camera.position.set(cameraRadius, 8, 0);
    camera.lookAt(0, 0, 0);

    // Subtle sakura fog
    scene.fog = new THREE.Fog(0xffc0e7, 15, 35);

    // Animation loop
    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();


      // Gentle lotus floating motion with ripple effect
      lotusFlowers.forEach((lotus, index) => {
        // Base floating motion
        const baseFloat = Math.sin(elapsedTime * 0.8 + index * 0.5) * 0.02;
        
        // Calculate distance from center for ripple effect
        const distance = Math.sqrt(lotus.position.x ** 2 + lotus.position.z ** 2);
        
        // Create ripple waves that affect flower height
        const ripple1 = Math.sin(distance * 0.3 - elapsedTime * 2) * 0.03;
        const ripple2 = Math.sin(distance * 0.5 - elapsedTime * 1.5) * 0.02;
        
        lotus.position.y = 0.05 + baseFloat + ripple1 + ripple2;
        lotus.rotation.y += 0.0005 + index * 0.0002; // Slightly different rotation speeds
      });

      // Animate floating petals
      floatingPetals.forEach((petal, index) => {
        petal.rotation.z += 0.002;
        petal.position.y = 0.02 + Math.sin(elapsedTime * 0.5 + index) * 0.01;
        
        // Gentle circular motion
        const radius = Math.sqrt(petal.position.x ** 2 + petal.position.z ** 2);
        const angle = Math.atan2(petal.position.z, petal.position.x) + 0.0005;
        petal.position.x = Math.cos(angle) * radius;
        petal.position.z = Math.sin(angle) * radius;
      });

      // Orbiting camera movement
      const cameraAngle = elapsedTime * 0.1; // Peaceful rotation speed
      const cameraRadius = 18;
      camera.position.x = Math.cos(cameraAngle) * cameraRadius;
      camera.position.z = Math.sin(cameraAngle) * cameraRadius;
      camera.position.y = 8 + Math.sin(elapsedTime * 0.05) * 1; // Gentle vertical movement
      camera.lookAt(0, 1, 0);

      renderer.render(scene, camera);
    }

    animate();

    // Handle resize
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
      
      // Dispose geometry and materials
      mirrorGeometry.dispose();
      mirrorMaterial.dispose();
      reflectionGeometry.dispose();
      reflectionMaterial.dispose();
      floatingPetalGeometry.dispose();
      
      floatingPetals.forEach(petal => {
        (petal.material as THREE.Material).dispose();
      });
      
      lotusFlowers.forEach(lotus => {
        lotus.children.forEach(child => {
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
