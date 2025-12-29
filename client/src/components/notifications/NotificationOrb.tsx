// src/components/notifications/NotificationOrb.tsx
// Beautiful sphere-inspired notification indicator
// Inspired by MagicalSphereNavigation - pervasive but unobtrusive

import { useState, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';

interface NotificationOrbProps {
  className?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function NotificationOrb({
  className = '',
  position = 'top-right',
}: NotificationOrbProps) {
  const { unreadCount, isPanelOpen, togglePanel, isConnected } = useNotifications();
  const [isHovered, setIsHovered] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // Dynamic pulse based on unread count
  useEffect(() => {
    if (unreadCount > 0) {
      const intensity = Math.min(unreadCount * 0.2, 1);
      setPulseIntensity(intensity);
    } else {
      setPulseIntensity(0);
    }
  }, [unreadCount]);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-20',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePanel();
    }
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40 ${className}`}
      style={{ perspective: '500px' }}
    >
      {/* Outer glow ring - only when unread */}
      {unreadCount > 0 && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            width: '52px',
            height: '52px',
            left: '-6px',
            top: '-6px',
            background: `radial-gradient(circle, rgba(147, 112, 219, ${0.3 + pulseIntensity * 0.3}) 0%, transparent 70%)`,
            animation: 'orbPulse 2s ease-in-out infinite',
            filter: 'blur(4px)',
          }}
        />
      )}

      {/* Main orb button */}
      <button
        onClick={togglePanel}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        className="relative w-10 h-10 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
        style={{
          background: isPanelOpen
            ? 'linear-gradient(135deg, rgba(147, 112, 219, 0.9) 0%, rgba(138, 43, 226, 0.9) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isConnected
            ? '1px solid rgba(147, 112, 219, 0.4)'
            : '1px solid rgba(255, 100, 100, 0.4)',
          boxShadow: isHovered || isPanelOpen
            ? `0 8px 32px rgba(147, 112, 219, 0.4),
               0 4px 16px rgba(0, 0, 0, 0.2),
               inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            : `0 4px 16px rgba(0, 0, 0, 0.2),
               inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
          transform: isHovered
            ? 'scale(1.1) rotateX(5deg)'
            : 'scale(1)',
        }}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isPanelOpen}
      >
        {/* Inner sphere highlight */}
        <div
          className="absolute rounded-full"
          style={{
            width: '12px',
            height: '12px',
            top: '6px',
            left: '8px',
            background: 'rgba(255, 255, 255, 0.4)',
            filter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        />

        {/* Bell icon */}
        <svg
          className="w-5 h-5 mx-auto transition-transform duration-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{
            color: isPanelOpen || unreadCount > 0 ? '#fff' : 'rgba(255, 255, 255, 0.8)',
            transform: unreadCount > 0 && !isPanelOpen ? 'rotate(-10deg)' : 'rotate(0deg)',
            animation: unreadCount > 0 && !isPanelOpen ? 'bellRing 2s ease-in-out infinite' : 'none',
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Connection status dot */}
        <div
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-gray-800"
          style={{
            background: isConnected
              ? 'linear-gradient(135deg, #4ade80, #22c55e)'
              : 'linear-gradient(135deg, #f87171, #ef4444)',
            boxShadow: isConnected
              ? '0 0 6px rgba(74, 222, 128, 0.6)'
              : '0 0 6px rgba(248, 113, 113, 0.6)',
          }}
        />
      </button>

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <div
          className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, #f472b6, #ec4899)',
            boxShadow: '0 2px 8px rgba(236, 72, 153, 0.4)',
            animation: 'badgePop 0.3s ease-out',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}

      {/* Tooltip */}
      {isHovered && !isPanelOpen && (
        <div
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {unreadCount > 0
            ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''}`
            : 'No notifications'}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes orbPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.15);
          }
        }

        @keyframes bellRing {
          0%, 100% {
            transform: rotate(0deg);
          }
          10% {
            transform: rotate(15deg);
          }
          20% {
            transform: rotate(-15deg);
          }
          30% {
            transform: rotate(10deg);
          }
          40% {
            transform: rotate(-10deg);
          }
          50% {
            transform: rotate(5deg);
          }
          60% {
            transform: rotate(0deg);
          }
        }

        @keyframes badgePop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
