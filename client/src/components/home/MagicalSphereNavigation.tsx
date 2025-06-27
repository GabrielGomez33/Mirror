// src/components/home/MagicalSphereNavigation.tsx
import { useState, useEffect } from 'react';

interface NavigationOption {
  id: string;
  label: string;
  className: string;
}

interface MagicalSphereNavigationProps {
  activePanel: string;
  onPanelChange: (panelId: string) => void;
}

const navigationOptions: NavigationOption[] = [
  { id: 'mymirror', label: 'MyMirror', className: 'mymirror' },
  { id: 'truthstream', label: 'TruthStream', className: 'truthstream' },
  { id: 'mirrorgroups', label: 'MirrorGroups', className: 'mirrorgroups' }
];

export default function MagicalSphereNavigation({ activePanel, onPanelChange }: MagicalSphereNavigationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastActivity > 4000 && isExpanded) {
        setIsExpanded(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastActivity, isExpanded]);

  const handleActivity = () => {
    setLastActivity(Date.now());
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    handleActivity();
  };

  const handleOptionSelect = (optionId: string) => {
    onPanelChange(optionId);
    handleActivity();
    setTimeout(() => setIsExpanded(false), 2000);
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="sphere-nav-container">
      {/* Main sphere - no icons, just pure sphere */}
      <div
        className={`sphere-nav-main ${isExpanded ? 'expanded' : ''}`}
        onClick={toggleExpanded}
        onMouseEnter={handleActivity}
        onKeyDown={(e) => handleKeyDown(e, toggleExpanded)}
        tabIndex={0}
        role="button"
        aria-label={isExpanded ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isExpanded}
      />

      {/* Option spheres - no icons, just pure spheres with labels */}
      {navigationOptions.map((option, index) => {
        const isActive = option.id === activePanel;
        return (
          <div
            key={option.id}
            className={`sphere-option ${option.className} ${isExpanded ? 'visible' : ''} ${isActive ? 'active' : ''}`}
            onClick={() => handleOptionSelect(option.id)}
            onKeyDown={(e) => handleKeyDown(e, () => handleOptionSelect(option.id))}
            tabIndex={isExpanded ? 0 : -1}
            role="button"
            aria-label={`Switch to ${option.label}${isActive ? ' (currently active)' : ''}`}
            style={{
              transitionDelay: isExpanded ? `${index * 0.1}s` : '0s',
              zIndex: isExpanded ? 1001 : 999,
              // Active state styling
              boxShadow: isActive 
                ? '0 15px 40px rgba(255, 105, 180, 0.4), 0 0 20px rgba(255, 105, 180, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.4)'
                : undefined,
              transform: isActive && isExpanded
                ? 'scale(1.15) translate(-50%, -50%)'
                : isExpanded 
                  ? 'scale(1) translate(-50%, -50%)'
                  : 'scale(0) translate(-50%, -50%)',
              border: isActive 
                ? '2px solid rgba(255, 105, 180, 0.8)'
                : '2px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            {/* Highlight effect inside sphere - enhanced for active state */}
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '15px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: isActive 
                ? 'rgba(255, 255, 255, 0.7)'
                : 'rgba(255, 255, 255, 0.4)',
              filter: 'blur(6px)',
              pointerEvents: 'none'
            }} />
            
            {/* Active indicator pulse */}
            {isActive && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ff69b4',
                transform: 'translate(-50%, -50%)',
                animation: 'pulse 2s infinite',
                boxShadow: '0 0 10px rgba(255, 105, 180, 0.8)'
              }} />
            )}
            
            {/* Label tooltip */}
            <div style={{
              position: 'absolute',
              bottom: '-35px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: isActive ? 'rgba(255, 105, 180, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              opacity: isExpanded ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
              fontFamily: 'Inter, sans-serif'
            }}>
              {option.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
