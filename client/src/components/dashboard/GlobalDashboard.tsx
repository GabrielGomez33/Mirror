// src/components/dashboard/GlobalDashboard.tsx
import { useState } from 'react';
import GlassCard, { GlassOverlay, GlassProgress } from '../ui/GlassCard';

export default function GlobalDashboard() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      {/* Dashboard toggle button - floating action button */}
      <button
        onClick={() => setShowDashboard(true)}
        className="fixed top-6 right-6 z-30 w-14 h-14 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 shadow-lg"
        title="Open Dashboard"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

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

                  <GlassCard className="p-4">
                    <h3 className="text-white font-medium mb-2">System Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Sync Status</span>
                        <span className="text-green-400 text-sm">✅ Online</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Last Backup</span>
                        <span className="text-white/70 text-sm">2 hours ago</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Connection</span>
                        <span className="text-blue-400 text-sm">🌐 Secure</span>
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs text-white/50">
                    <span>Mirror Dashboard v1.0</span>
                    <span>Online</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </>
  );
}
