// src/components/ui/GlassCard.tsx
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  breathing?: boolean;
  gradient?: boolean;
  enhanced?: boolean;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = '',
  hover = true,
  breathing = false,
  gradient = false,
  enhanced = false,
  onClick
}: GlassCardProps) {
  const baseClasses = enhanced ? 'glass-card-enhanced' : 'glass-card';
  
  return (
    <div 
      className={`
        ${baseClasses}
        p-6
        ${hover ? 'hover:scale-105 hover:shadow-2xl transform transition-all duration-300' : ''}
        ${breathing ? 'breathing' : ''}
        ${gradient ? 'sakura-gradient' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Inner highlight effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl pointer-events-none" />
      
      {/* Content with proper z-index */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// Additional glass components for specific use cases

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function GlassButton({ 
  children, 
  onClick, 
  disabled = false, 
  className = '' 
}: GlassButtonProps) {
  return (
    <button
      className={`glass-button ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

interface GlassOverlayProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function GlassOverlay({ children, onClose, className = '' }: GlassOverlayProps) {
  return (
    <div className={`glass-overlay ${className}`} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface GlassProgressProps {
  value: number;
  max: number;
  className?: string;
  showPercentage?: boolean;
}

export function GlassProgress({ 
  value, 
  max, 
  className = '', 
  showPercentage = false 
}: GlassProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className={`glass-progress-bg h-2 ${className}`}>
      <div 
        className="glass-progress-fill h-2"
        style={{ width: `${percentage}%` }}
      />
      {showPercentage && (
        <div className="text-white/70 text-sm mt-1">
          {percentage.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
