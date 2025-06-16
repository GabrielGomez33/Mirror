//import React from 'react';
import BasicScene from '../components/three/BasicScene';
import GlassCard from '../components/ui/GlassCard';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-rose-200 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-light text-gray-800 text-center">
          Mirror UI Foundation Test
        </h1>
        
        {/* Test Three.js */}
        <GlassCard>
          <h2 className="text-xl font-medium text-white mb-4">
            Three.js Test - Rotating Cube
          </h2>
          <BasicScene />
          <p className="text-white/80 text-sm mt-4">
            If you see a rotating pink cube, Three.js is working!
          </p>
        </GlassCard>
        
        {/* Test Glass Morphism */}
        <div className="grid md:grid-cols-3 gap-6">
          <GlassCard hover>
            <h3 className="text-lg font-medium text-white mb-2">Hover Effect</h3>
            <p className="text-white/70">Hover over this card</p>
          </GlassCard>
          
          <GlassCard breathing>
            <h3 className="text-lg font-medium text-white mb-2">Breathing</h3>
            <p className="text-white/70">This card has subtle breathing animation</p>
          </GlassCard>
          
          <GlassCard className="sakura-gradient">
            <h3 className="text-lg font-medium text-white mb-2">Sakura Theme</h3>
            <p className="text-white/70">With sakura gradient overlay</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
