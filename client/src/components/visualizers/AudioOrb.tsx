// src/components/visualizers/AudioOrb.tsx
// A vibrant, flowy audio orb visualizer that reacts to overall level and spectrum.
// - Single <canvas> with DPR-aware rendering
// - Radial glow + hue shift over time
// - Orbiting particles that react to spectrum bins
// - Smoothed level to reduce jitter

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

type Props = {
  level: number;          // 0..1 (from analyser; already provided by VocalStep)
  spectrum?: number[];    // 0..1 per bin (optional; defaults to 32 zeros)
  active?: boolean;       // whether we’re currently “recording/animating”
  size?: number;          // CSS px box; canvas auto-scales for DPR. Default 240.
  className?: string;     // allow extra Tailwind utility styling
};

export default function AudioOrb({
  level,
  spectrum = new Array(32).fill(0),
  active = true,
  size = 240,
  className = ''
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef<number>(0);
  const smoothRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let running = true;

    const draw = () => {
      if (!running) return;
      tRef.current += 1; // ~frame counter
      // Exponential smoothing to keep it flowy
      smoothRef.current = smoothRef.current * 0.85 + level * 0.15;

      const t = tRef.current;
      const smoothed = smoothRef.current;

      // Canvas dims
      const W = size;
      const H = size;
      const cx = W / 2;
      const cy = H / 2;

      // Clear with gentle fade for trails (very subtle)
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0)';        // fully transparent
      ctx.clearRect(0, 0, W, H);

      // Background subtle bloom aura
      ctx.save();
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
      bgGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
      bgGrad.addColorStop(1, 'rgba(255,255,255,0.00)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // Core orb parameters
      const baseR = W * 0.22;                      // base radius
      const pulse = smoothed * (W * 0.20);         // grows with level
      const r = baseR + pulse;                     // final radius
      const hue = (t * 0.6 + smoothed * 180) % 360; // hue drift with level mod

      // Orb gradient (center bright → outer soft)
      const g = ctx.createRadialGradient(cx, cy, Math.max(1, r * 0.2), cx, cy, r * 1.25);
      const c1 = `hsla(${hue}, 90%, 65%, 0.95)`;   // inner glow
      const c2 = `hsla(${(hue + 40) % 360}, 90%, 55%, 0.75)`;
      const c3 = `hsla(${(hue + 90) % 360}, 90%, 50%, 0.00)`;
      g.addColorStop(0.0, c1);
      g.addColorStop(0.7, c2);
      g.addColorStop(1.0, c3);

      // Outer glow
      ctx.save();
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.55)`;
      ctx.shadowBlur = Math.max(20, 60 + smoothed * 60);

      // Draw orb
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();

      // Spectrum-reactive ring — small radial strokes around the orb
      const bins = 48;
      const ringR = r * 1.1;
      for (let i = 0; i < bins; i++) {
        const theta = (i / bins) * Math.PI * 2 + t * 0.01;
        const s = spectrum[i % spectrum.length] ?? 0;
        const k = 6 + s * 28; // stroke length
        const x1 = cx + Math.cos(theta) * (ringR - k * 0.5);
        const y1 = cy + Math.sin(theta) * (ringR - k * 0.5);
        const x2 = cx + Math.cos(theta) * (ringR + k * 0.5);
        const y2 = cy + Math.sin(theta) * (ringR + k * 0.5);

        ctx.strokeStyle = `hsla(${(hue + i * 4) % 360}, 95%, ${55 + s * 30}%, ${0.45 + s * 0.35})`;
        ctx.lineWidth = 1 + s * 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Orbiting particles — cluster that expands with level
      const particles = 24;
      const orbitR = r * (1.0 + 0.10 + smoothed * 0.25);
      for (let i = 0; i < particles; i++) {
        const base = (i / particles) * Math.PI * 2;
        const wobble = Math.sin(t * 0.03 + i * 1.7) * 0.15;
        const angle = base + wobble;
        const s = spectrum[(i * 2) % spectrum.length] ?? 0;

        const x = cx + Math.cos(angle) * orbitR;
        const y = cy + Math.sin(angle) * orbitR;

        const dotR = 1.6 + s * 3.8 + smoothed * 1.5;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${(hue + 120 + i * 8) % 360}, 95%, ${55 + s * 30}%, ${0.65 + smoothed * 0.25})`;
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    if (active) {
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, level, spectrum, size]);

  // Subtle scale pulse using Framer Motion (complements the canvas anim)
  const scale = 1 + Math.min(0.15, Math.max(0, level) * 0.25);

  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size, filter: 'drop-shadow(0 0 24px rgba(255,255,255,0.15))' }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, mass: 0.4 }}
    >
      <canvas ref={canvasRef} className="rounded-full" />
      {/* glass highlight overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/12 via-transparent to-transparent" />
    </motion.div>
  );
}
