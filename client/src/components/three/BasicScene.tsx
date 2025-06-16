// src/components/three/BasicScene.tsx
import { useEffect } from 'react';
import * as THREE from 'three';

interface PetalUserData {
  fallSpeed: number;
  swaySpeed: number;
  swayAmount: number;
  rotationSpeed: number;
}

export default function BasicScene() {
  useEffect(() => {
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background

    // Create petal geometry (small planes)
    const petalGeometry = new THREE.PlaneGeometry(0.2, 0.3);
    const petalMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb3d9,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    // Create multiple petals
    const petals: THREE.Mesh[] = [];
    for (let i = 0; i < 50; i++) {
      const petal = new THREE.Mesh(petalGeometry, petalMaterial.clone());
      
      // Random starting positions
      petal.position.x = (Math.random() - 0.5) * 20;
      petal.position.y = Math.random() * 15 + 5;
      petal.position.z = (Math.random() - 0.5) * 10;
      
      // Random colors for variety
      const colors = [0xffb3d9, 0xffc0cb, 0xff69b4, 0xffa0c9, 0xff1493];
      (petal.material as THREE.MeshBasicMaterial).color.setHex(
        colors[Math.floor(Math.random() * colors.length)]
      );
      
      // Store initial properties for animation
      petal.userData = {
        fallSpeed: Math.random() * 0.02 + 0.01,
        swaySpeed: Math.random() * 0.5 + 0.5,
        swayAmount: Math.random() * 0.5 + 0.2,
        rotationSpeed: (Math.random() - 0.5) * 0.02
      } as PetalUserData;
      
      scene.add(petal);
      petals.push(petal);
    }

    camera.position.z = 5;

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);

      // Animate each petal
      petals.forEach(petal => {
        const userData = petal.userData as PetalUserData;
        
        // Fall down
        petal.position.y -= userData.fallSpeed;
        
        // Sway side to side
        petal.position.x += Math.sin(Date.now() * 0.001 * userData.swaySpeed) * userData.swayAmount * 0.01;
        
        // Rotate
        petal.rotation.z += userData.rotationSpeed;
        
        // Reset position when it falls below view
        if (petal.position.y < -8) {
          petal.position.y = Math.random() * 5 + 8;
          petal.position.x = (Math.random() - 0.5) * 20;
        }
      });

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
        scene.remove(petal);
        petal.geometry.dispose();
        (petal.material as THREE.Material).dispose();
      });
      
      petalGeometry.dispose();
      petalMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <canvas id="three-canvas" />
      {/* Debug indicator */}
      <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-none z-10">
      </div>
    </>
  );
}
