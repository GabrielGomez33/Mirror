// src/components/ui/CosmicLoader.tsx
import { motion } from 'framer-motion';

/**
 * Shared cosmic loading animation used while personal analysis is being
 * synthesized (see ResultsStep) and while the astrological profile is being
 * generated (see AstroLogicalStep). Renders only the centered spinner and
 * status copy — wrap it in whatever layout/card the calling step provides.
 */
interface CosmicLoaderProps {
  /** Headline shown beneath the spinner. */
  title?: string;
  /** Rotating status lines revealed in sequence. */
  steps?: string[];
  className?: string;
}

const DEFAULT_STEPS = [
  'Analyzing personality patterns...',
  'Aligning celestial influences...',
  'Integrating cultural wisdom...',
  'Generating personalized insights...',
];

export default function CosmicLoader({
  title = 'Synthesizing Your Cosmic Profile',
  steps = DEFAULT_STEPS,
  className = '',
}: CosmicLoaderProps) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`text-center space-y-8 ${className}`}
    >
      {/* Cosmic Loading Animation */}
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-40 h-40 rounded-full border-4 border-white/10 border-t-purple-400 mx-auto"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-6 w-28 h-28 rounded-full border-4 border-white/10 border-r-blue-400"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-12 w-16 h-16 rounded-full border-4 border-white/10 border-l-pink-400"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
            ✨
          </motion.span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-3xl font-bold text-white">{title}</h2>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          {steps.map((text, index) => (
            <motion.p
              key={text}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.3 }}
              className="text-white/70"
            >
              {text}
            </motion.p>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}