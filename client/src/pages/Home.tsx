// src/pages/Home.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard, { GlassButton, GlassOverlay, GlassProgress } from '../components/ui/GlassCard';
import BasicScene from '../components/three/BasicScene';

export default function Home() {
  const navigate = useNavigate();
  const [showDashboard, setShowDashboard] = useState(false);

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
          <h1 className="text-6xl md:text-8xl font-light text-white text-shadow-soft">
            Mirror
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light leading-relaxed max-w-2xl mx-auto">
            Your personal sanctuary in the digital realm. Store, share, and synchronize with the grace of falling petals.
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlassButton onClick={() => navigate('/login')}>
              ENTER The Mirror
            </GlassButton>
            <GlassButton onClick={() => navigate('/intake/welcome')}>
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

      {/* Dashboard overlay */}
      {showDashboard && (
        <>
          <GlassOverlay 
            className="fixed inset-0 z-40"
            onClose={() => setShowDashboard(false)}
          >
            <div />
          </GlassOverlay>
          <div className="fixed top-0 right-0 h-full w-96 z-50 transform transition-transform duration-500">
            <div className="h-full m-4 flex flex-col">
              <GlassCard enhanced className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-light text-white">Quick Dashboard</h2>
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="text-white/60 hover:text-white text-2xl transition-colors"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4 flex-1">
                  <GlassCard className="p-4">
                    <h3 className="text-white font-medium mb-2">Storage</h3>
                    <GlassProgress 
                      value={2.1} 
                      max={10} 
                      showPercentage={false}
                      className="mb-2"
                    />
                    <p className="text-white/70 text-sm mt-2">2.1 GB of 10 GB used</p>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <h3 className="text-white font-medium mb-2">Quick Actions</h3>
                    <div className="space-y-2">
                      <button className="w-full text-left p-2 text-white/80 hover:bg-white/10 rounded transition-colors glass-interactive">
                        📁 New Folder
                      </button>
                      <button className="w-full text-left p-2 text-white/80 hover:bg-white/10 rounded transition-colors glass-interactive">
                        📤 Upload File
                      </button>
                      <button className="w-full text-left p-2 text-white/80 hover:bg-white/10 rounded transition-colors glass-interactive">
                        🔗 Share Link
                      </button>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <h3 className="text-white font-medium mb-2">Recent Activity</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-white/70">
                        <span>📄</span>
                        <span>document.pdf uploaded</span>
                      </div>
                      <div className="flex items-center space-x-2 text-white/70">
                        <span>🖼️</span>
                        <span>image.jpg shared</span>
                      </div>
                      <div className="flex items-center space-x-2 text-white/70">
                        <span>📁</span>
                        <span>Projects folder created</span>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
