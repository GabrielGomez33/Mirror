import React from 'react';

export interface LegalSectionProps {
  id: string;
  /** Section number, rendered zero-padded (e.g. 4 → "04"). */
  n: number;
  title: string;
  children: React.ReactNode;
}

/**
 * A numbered legal section, styled to match the terminal aesthetic used
 * across /dev and /map. Renders a "§ NN ──── terms" rule followed by the
 * section heading. The id is the hash anchor used by the jump index and
 * by cross-links from /dev.
 */
const LegalSection: React.FC<LegalSectionProps> = ({ id, n, title, children }) => {
  const num = String(n).padStart(2, '0');
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      data-legal-section={id}
      className="scroll-mt-24 pt-10 first:pt-2"
    >
      <header className="mb-4">
        <div
          className="flex items-baseline gap-2 text-[10.5px] uppercase tracking-widest"
          style={{ color: 'var(--dt-fg-dim)' }}
        >
          <span style={{ color: 'var(--dt-amber)' }}>§ {num}</span>
          <span aria-hidden="true" className="flex-1 overflow-hidden">
            {''.padEnd(120, '─')}
          </span>
          <span style={{ color: 'var(--dt-fg-muted)' }}>terms</span>
        </div>
        <h2
          id={`${id}-heading`}
          className="mt-3 text-xl font-bold tracking-tight sm:text-2xl"
          style={{ color: 'var(--dt-fg-strong)' }}
        >
          <a
            href={`#${id}`}
            className="group inline-flex items-baseline gap-2"
            style={{ color: 'inherit', borderBottom: 'none' }}
          >
            <span style={{ color: 'var(--dt-green)' }}>#</span>
            <span>{title}</span>
            <span
              aria-hidden="true"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--dt-fg-dim)' }}
            >
              ¶
            </span>
          </a>
        </h2>
      </header>
      <div
        className="space-y-3 text-[14.5px] leading-[1.75]"
        style={{ color: 'var(--dt-fg)' }}
      >
        {children}
      </div>
    </section>
  );
};

export default LegalSection;