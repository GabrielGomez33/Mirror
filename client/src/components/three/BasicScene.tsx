// src/components/three/BasicScene.tsx
import { useEffect } from 'react';
import * as THREE from 'three';

interface PetalUserData {
  fallSpeed: number;
  swaySpeed: number;
  swayAmount: number;
  rotationSpeed: THREE.Vector3;
  initialRotation: THREE.Euler;
  phase: number;
  scale: number;
}

export default function BasicScene() {
  useEffect(() => {
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Add directional light for depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create petal shape using shape geometry
    function createPetalGeometry() {
      const shape = new THREE.Shape();
      
      // Draw petal shape
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.3, 0.1, 0.4, 0.3, 0.3, 0.5);
      shape.bezierCurveTo(0.2, 0.7, 0.1, 0.8, 0, 1);
      shape.bezierCurveTo(-0.1, 0.8, -0.2, 0.7, -0.3, 0.5);
      shape.bezierCurveTo(-0.4, 0.3, -0.3, 0.1, 0, 0);
      
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.center();
      
      return geometry;
    }

    // Create petal material with gradient effect
    const petalColors = [
      0xffb3d9, // Light pink
      0xffc0cb, // Pink
      0xff69b4, // Hot pink
      0xffa0c9, // Light hot pink
      0xff1493, // Deep pink
      0xffb6c1, // Light pink
      0xffc1cc  // Pale pink
    ];

    // Create multiple petals
    const petals: THREE.Mesh[] = [];
    const petalGeometry = createPetalGeometry();

    for (let i = 0; i < 60; i++) {
      const material = new THREE.MeshPhongMaterial({
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        transparent: true,
        opacity: 0.7 + Math.random() * 0.3,
        side: THREE.DoubleSide,
        shininess: 100,
        specular: 0xffffff,
        emissive: 0xff69b4,
        emissiveIntensity: 0.02
      });

      const petal = new THREE.Mesh(petalGeometry, material);
      
      // Random starting positions
      petal.position.x = (Math.random() - 0.5) * 25;
      petal.position.y = Math.random() * 20 + 5;
      petal.position.z = (Math.random() - 0.5) * 15 - 5;
      
      // Random scale for variety
      const scale = 0.5 + Math.random() * 0.8;
      petal.scale.set(scale, scale, scale);
      
      // Random initial rotation
      petal.rotation.x = Math.random() * Math.PI;
      petal.rotation.y = Math.random() * Math.PI;
      petal.rotation.z = Math.random() * Math.PI;
      
      // Store animation properties
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
        scale: scale
      } as PetalUserData;
      
      scene.add(petal);
      petals.push(petal);
    }

    // Position camera
    camera.position.z = 8;
    camera.position.y = 0;

    // Add fog for depth
    scene.fog = new THREE.Fog(0xffffff, 10, 30);

    // Animation loop
    let animationId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Animate each petal
      petals.forEach((petal, index) => {
        const userData = petal.userData as PetalUserData;
        
        // Fall down with slight acceleration
        petal.position.y -= userData.fallSpeed * (1 + petal.position.y * 0.01);
        
        // Complex swaying motion
        const swayX = Math.sin(elapsedTime * userData.swaySpeed + userData.phase) * userData.swayAmount;
        const swayZ = Math.cos(elapsedTime * userData.swaySpeed * 0.7 + userData.phase) * userData.swayAmount * 0.5;
        
        petal.position.x += swayX * 0.01;
        petal.position.z += swayZ * 0.01;
        
        // Realistic rotation
        petal.rotation.x += userData.rotationSpeed.x;
        petal.rotation.y += userData.rotationSpeed.y;
        petal.rotation.z += userData.rotationSpeed.z;
        
        // Add slight tumbling effect
        const tumble = Math.sin(elapsedTime * 0.5 + index) * 0.001;
        petal.rotation.x += tumble;
        
        // Fade out as it falls
        const material = petal.material as THREE.MeshPhongMaterial;
        if (petal.position.y < -5) {
          material.opacity = Math.max(0, material.opacity - 0.02);
        }
        
        // Reset position when it falls below view
        if (petal.position.y < -10 || material.opacity <= 0) {
          petal.position.y = Math.random() * 5 + 15;
          petal.position.x = (Math.random() - 0.5) * 25;
          petal.position.z = (Math.random() - 0.5) * 15 - 5;
          material.opacity = 0.7 + Math.random() * 0.3;
        }
      });

      // Subtle camera movement
      camera.position.x = Math.sin(elapsedTime * 0.1) * 0.5;
      camera.position.y = Math.cos(elapsedTime * 0.15) * 0.3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    animate();

    // Handle window resize
    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      
      // Dispose of Three.js resources
      petals.forEach(petal => {
        petal.geometry.dispose();
        (petal.material as THREE.Material).dispose();
        scene.remove(petal);
      });
      
      petalGeometry.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas id="three-canvas" />;
}
