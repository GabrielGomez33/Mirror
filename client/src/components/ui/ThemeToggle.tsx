// src/components/ui/ThemeToggle.tsx
//
// Segmented control for the app colorway (sakura ↔ cosmic). Reads/writes the
// ThemeContext, which persists the choice and applies it app-wide via the
// `data-theme` attribute. Styled with inline styles to match the dashboard
// drawer's light palette.
import { useTheme, type Theme } from '../../context/ThemeContext';

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'sakura', label: 'Sakura', icon: '🌸' },
  { value: 'cosmic', label: 'Cosmic', icon: '🌌' },
];

const ACCENT = '#c6469b';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <p
        style={{
          color: '#6b4050',
          fontSize: '0.72rem',
          lineHeight: 1.5,
          margin: '0 0 10px',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Choose your colorway. Applies across the whole app and is saved on this device.
      </p>

      <div
        role="radiogroup"
        aria-label="Color theme"
        style={{
          display: 'inline-flex',
          gap: 6,
          padding: 4,
          borderRadius: 10,
          background: 'rgba(61, 20, 40, 0.06)',
          border: '1px solid rgba(61, 20, 40, 0.12)',
        }}
      >
        {OPTIONS.map((o) => {
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? 'rgba(198, 70, 155, 0.5)' : 'transparent',
                background: active ? 'rgba(198, 70, 155, 0.15)' : 'transparent',
                color: active ? ACCENT : '#3d1428',
                fontWeight: 600,
                fontSize: '0.75rem',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span aria-hidden="true">{o.icon}</span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}