// src/components/home/RetractableNavBar.tsx
import { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface RetractableNavBarProps {
  activePanel: string;
  onPanelChange: (panelId: string) => void;
}

const navItems: NavItem[] = [
  {
    id: 'mymirror',
    label: 'MyMirror',
    icon: '🪞',
    color: 'rgba(255, 182, 193, 0.3)'
  },
  {
    id: 'truthstream',
    label: 'TruthStream',
    icon: '🌊',
    color: 'rgba(255, 255, 255, 0.3)'
  },
  {
    id: 'mirrorgroups',
    label: 'MirrorGroups',
    icon: '👥',
    color: 'rgba(142, 68, 173, 0.3)'
  }
];

export default function RetractableNavBar({ activePanel, onPanelChange }: RetractableNavBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto-collapse after inactivity
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastActivity > 3000 && isExpanded) {
        setIsExpanded(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastActivity, isExpanded]);

  // Update activity timestamp on any interaction
  const handleActivity = () => {
    setLastActivity(Date.now());
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    handleActivity();
  };

  const handlePanelSelect = (panelId: string) => {
    onPanelChange(panelId);
    handleActivity();
    // Keep expanded briefly after selection, then auto-collapse
    setTimeout(() => setIsExpanded(false), 1500);
  };

  const activeItem = navItems.find(item => item.id === activePanel);

  if (!isExpanded) {
    return (
      <div 
        className={`glass-nav-sphere ${activePanel ? 'pulsing' : ''}`}
        onClick={toggleExpanded}
        onMouseEnter={handleActivity}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        aria-label="Open navigation menu"
      >
        <div 
          className="text-2xl transition-all duration-300"
          style={{ 
            filter: `drop-shadow(0 2px 4px ${activeItem?.color || 'rgba(255, 255, 255, 0.3)'})` 
          }}
        >
          {activeItem?.icon || '🌸'}
        </div>
      </div>
    );
  }

  return (
    <nav 
      className="glass-nav-expanded"
      onMouseEnter={handleActivity}
      onMouseLeave={() => {
        // Start countdown when mouse leaves
        setLastActivity(Date.now() - 2000);
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${activePanel === item.id ? 'active' : ''}`}
          onClick={() => handlePanelSelect(item.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePanelSelect(item.id);
            }
          }}
          aria-label={`Switch to ${item.label}`}
          aria-pressed={activePanel === item.id}
        >
          <div 
            className="nav-item-icon text-2xl"
            style={{ 
              filter: activePanel === item.id 
                ? `drop-shadow(0 2px 8px ${item.color})` 
                : 'none'
            }}
          >
            {item.icon}
          </div>
          <span className="nav-item-label">
            {item.label}
          </span>
        </div>
      ))}
      
      {/* Close indicator */}
      <div
        className="nav-item opacity-60"
        onClick={() => setIsExpanded(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(false);
          }
        }}
        aria-label="Close navigation menu"
      >
        <div className="nav-item-icon text-xl">
          ✕
        </div>
        <span className="nav-item-label text-xs">
          Close
        </span>
      </div>
    </nav>
  );
}
