import { useNavigate } from 'react-router-dom';
import  { GlassButton } from '../components/ui/GlassCard';
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
          
            <img src={MirrorLogo} alt="Mirror Logo" className="w-80 h-auto " />
          

          <p className="text-xl md:text-2xl text-white/90 font-light leading-relaxed max-w-2xl mx-auto">
				See yourself in the world, and the world in you.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlassButton onClick={() => navigate('/dashboard')}>
              ENTER The Mirror
            </GlassButton>
            <GlassButton onClick={() => navigate('/intake/register')}>
              LOOK into The Mirror
            </GlassButton>
          </div>

          {/* Students: free Premium. Carry intent through signup. */}
          <button
            type="button"
            onClick={() => { try { localStorage.setItem('student_intent', '1'); } catch { /* ignore */ } navigate('/intake/register'); }}
            className="text-white/80 hover:text-white text-sm underline underline-offset-4"
          >
            🎓 Student? Get Premium free →
          </button>
        </div>
      </div>
    </div>
  );
}
