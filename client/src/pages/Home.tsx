import { useNavigate } from 'react-router-dom';
import GlassCard, { GlassButton } from '../components/ui/GlassCard';
import BasicScene from '../components/three/BasicScene';
import MirrorLogo from '../assets/logos/mirror-sakura.svg';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-100 via-pink-50 to-orange-100" />

      {/* Three.js background layer */}
      <div className="absolute inset-0 z-0">
        <BasicScene />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-8">
        {/* Hero section */}
        <div className="text-center space-y-8 max-w-4xl">
          
            <img src={MirrorLogo} alt="Mirror Logo" className="w-60 h-auto " />
          

          <p className="text-xl md:text-2xl text-white/90 font-light leading-relaxed max-w-2xl mx-auto">
            Your personal sanctuary in the digital realm. Store, share, and synchronize with the grace of falling petals.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlassButton onClick={() => navigate('/login')}>
              ENTER The Mirror
            </GlassButton>
            <GlassButton onClick={() => navigate('/intake/visual')}>
              LOOK into The Mirror
            </GlassButton>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl w-full">
          <GlassCard hover className="text-center">
            <div className="text-3xl mb-4">🌸</div>
            <h3 className="text-white font-medium text-lg mb-2">Secure</h3>
            <p className="text-white/70">End-to-end encryption protects your digital sanctuary</p>
          </GlassCard>

          <GlassCard hover breathing className="text-center">
            <div className="text-3xl mb-4">✨</div>
            <h3 className="text-white font-medium text-lg mb-2">Beautiful</h3>
            <p className="text-white/70">Designed for serenity and mindful interaction</p>
          </GlassCard>

          <GlassCard hover gradient className="text-center">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-white font-medium text-lg mb-2">Fast</h3>
            <p className="text-white/70">Lightning-quick sync across all your devices</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
