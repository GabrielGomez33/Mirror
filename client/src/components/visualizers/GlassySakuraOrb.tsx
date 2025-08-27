import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export type GlassySakuraOrbProps = {
  /** Overall audio level, normalized 0..1 (use your existing RMS → 0..1) */
  level: number;
  /** Optional spectrum bins 0..1; if omitted, ring animates gently */
  spectrum?: number[];
  /** Animate internals; set true while recording */
  active?: boolean;
  /** Square size in CSS pixels (canvas scales for DPR) */
  size?: number;
  /** Extra classes (e.g., margin) */
  className?: string;
};

/**
 * GlassySakuraOrb
 * - DPR-aware <canvas> renderer with a foggy sakura aesthetic
 * - Base orb (radial gradient), bloom, spectrum ring, orbiters, and “pulse” ripples
 * - Keeps itself purely presentational—no mic access here
 */
const GlassySakuraOrb: React.FC<GlassySakuraOrbProps> = ({
  level,
  spectrum,
  active = true,
  size = 260,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // internal smoothness + pulse state
  const smoothRef = useRef(0);
  const lastPulseAtRef = useRef(0);
  const [pulseList, setPulseList] = useState<{ id: number; t0: number; life: number }[]>([]);
  const pulseIdRef = useRef(1);

  // persistent fog “wisps”
  const fog = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        // positions in unit space, drift velocity very small
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0006,
        vy: (Math.random() - 0.5) * 0.0006,
        r: 0.18 + Math.random() * 0.22, // relative radius
        a: 0.04 + Math.random() * 0.06, // alpha base
        hueJitter: (i * 11) % 360,
      })),
    []
  );

  // sakura palette (soft blossom → lavender)
  const palette = useMemo(
    () => ({
      inner: 'rgba(255, 225, 240, 1.0)', // #FFE1F0
      mid: 'rgba(249, 179, 209, 0.95)',  // #F9B3D1
      outer: 'rgba(216, 180, 254, 0.80)',// #D8B4FE
      edge: 'rgba(216, 180, 254, 0.00)',
      ringPink: (a: number) => `rgba(249,179,209,${a})`,
      ringLav:  (a: number) => `rgba(216,180,254,${a})`,
      glow: (a: number) => `rgba(216,180,254,${a})`,
      fog:  (a: number) => `rgba(255,255,255,${a})`,
      pulse: (a: number) => `rgba(249,179,209,${a})`,
      pulseEdge: (a: number) => `rgba(216,180,254,${a})`,
      highlight: 'rgba(255,255,255,0.12)',
    }),
    []
  );

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = size;
    const H = size;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let running = true;

    const loop = () => {
      if (!running) return;

      // smooth level for organic feel
      smoothRef.current = smoothRef.current * 0.85 + Math.max(0, Math.min(1, level)) * 0.15;
      const smooth = smoothRef.current;

      // pulse generation (threshold + refractory)
      const now = performance.now();
      const threshold = 0.08;
      const refractoryMs = 120;
      if (level > threshold && now - lastPulseAtRef.current > refractoryMs && active) {
        lastPulseAtRef.current = now;
        setPulseList((prev) => [
          ...prev,
          { id: pulseIdRef.current++, t0: now, life: 1200 }, // 1.2s
        ]);
      }
      // purge old pulses
      setPulseList((prev) => prev.filter((p) => now - p.t0 < p.life));

      // CLEAR (keep transparent for page backdrop)
      ctx.clearRect(0, 0, W, H);

      // BACKGROUND: faint wash to help the “glass” stand out
      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
      bgGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
      bgGrad.addColorStop(1, 'rgba(255,255,255,0.00)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // FOG wisps (very soft, blurry)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      fog.forEach((f) => {
        f.x += f.vx;
        f.y += f.vy;
        if (f.x < -0.2) f.x = 1.2;
        if (f.x > 1.2) f.x = -0.2;
        if (f.y < -0.2) f.y = 1.2;
        if (f.y > 1.2) f.y = -0.2;

        const cx = f.x * W;
        const cy = f.y * H;
        const rr = f.r * Math.max(W, H);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, palette.fog(0.045));
        g.addColorStop(1, palette.fog(0.0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // ORB core
      const cx = W / 2;
      const cy = H / 2;
      const baseR = W * 0.22;
      const pulseR = smooth * (W * 0.20);
      const r = baseR + pulseR;

      // bloom glow
      ctx.save();
      ctx.shadowBlur = 50 + smooth * 70;
      ctx.shadowColor = palette.glow(0.55);
      const orbGrad = ctx.createRadialGradient(cx, cy, Math.max(1, r * 0.22), cx, cy, r * 1.25);
      orbGrad.addColorStop(0.00, palette.inner);
      orbGrad.addColorStop(0.60, palette.mid);
      orbGrad.addColorStop(0.92, palette.outer);
      orbGrad.addColorStop(1.00, palette.edge);
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Spectrum ring
      const ringR = r * (1.08 + smooth * 0.08);
      const bins = 48;
      const src = spectrum && spectrum.length ? spectrum : Array.from({ length: bins }, (_, i) => 0.25 + 0.15 * Math.sin((now / 900) + i * 0.35));
      for (let i = 0; i < bins; i++) {
        const s = src[i % src.length];
        const len = 6 + s * 26;
        const theta = (i / bins) * Math.PI * 2 + now * 0.0005;
        const x1 = cx + Math.cos(theta) * (ringR - len * 0.5);
        const y1 = cy + Math.sin(theta) * (ringR - len * 0.5);
        const x2 = cx + Math.cos(theta) * (ringR + len * 0.5);
        const y2 = cy + Math.sin(theta) * (ringR + len * 0.5);

        ctx.strokeStyle = (i % 2 === 0)
          ? palette.ringPink(0.55 + s * 0.35)
          : palette.ringLav(0.55 + s * 0.35);
        ctx.lineWidth = 1 + s * 2.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Orbiters (subtle glass beads)
      const nDots = 18;
      const orbitR = r * (1.15 + smooth * 0.18);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < nDots; i++) {
        const a = (i / nDots) * Math.PI * 2 + now * 0.0009 * (i % 3 === 0 ? 1 : -1);
        const b = src[(i * 3) % src.length] ?? 0.15;
        const x = cx + Math.cos(a) * orbitR;
        const y = cy + Math.sin(a) * orbitR;
        const dotR = 1.6 + b * 3.6 + smooth * 1.2;

        const g = ctx.createRadialGradient(x, y, 0, x, y, dotR * (1.6 + smooth));
        g.addColorStop(0, palette.ringPink(0.95));
        g.addColorStop(1, palette.ringLav(0.0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Pulses (ripples)
      pulseList.forEach((p) => {
        const t = (now - p.t0) / p.life; // 0..1
        const rr = r * (1.0 + t * 1.6);
        const op = Math.max(0, 0.35 * (1 - t));
        ctx.strokeStyle = palette.pulse(op);
        ctx.lineWidth = Math.max(1, 3 - t * 2.5);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();

        // subtle second edge
        ctx.strokeStyle = palette.pulseEdge(op * 0.8);
        ctx.lineWidth = Math.max(0.5, 2 - t * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, rr * 1.04, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Glass highlight cap
      const highlightGrad = ctx.createRadialGradient(cx, cy - r * 0.35, 0, cx, cy - r * 0.35, r);
      highlightGrad.addColorStop(0, palette.highlight);
      highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(loop);
    };

    if (active || true /* still animate softly when inactive for fog */) {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, level, spectrum, size, fog, palette]);

  // subtle physical scale tied to level (does not change the canvas backing res)
  const scale = 1 + Math.min(0.22, Math.max(0, smoothRef.current) * 0.30);

  return (
    <motion.div
      className={`relative rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        // “frosted glass” feel on top of whatever background you have
        // (backdrop-filter softens whatever is behind the orb container)
        backdropFilter: 'blur(10px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(10px) saturate(1.1)',
      }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 150, damping: 18, mass: 0.4 }}
    >
      <canvas ref={canvasRef} className="w-full h-full rounded-full" />
      {/* extra glass sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/14 via-transparent to-transparent" />
    </motion.div>
  );
};

export default GlassySakuraOrb;
