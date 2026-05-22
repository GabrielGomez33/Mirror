import React from 'react';

export interface DevSectionProps {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Top-level section anchor. Header renders as a terminal-style rule with
 * a file-name (`section.md`) and an eyebrow that reads like a man-page
 * category. The id is the hash target used by the sidebar and TOC.
 */
const DevSection: React.FC<DevSectionProps> = ({ id, title, eyebrow, children }) => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      data-dev-section={id}
      className="dt-section scroll-mt-24 pt-10 first:pt-2"
    >
      <header className="mb-5">
        {/* ASCII rule like ───── eyebrow ─────────── id.md ────── */}
        <div
          className="flex items-baseline gap-2 text-[10.5px] uppercase tracking-widest"
          style={{ color: 'var(--dt-fg-dim)' }}
        >
          <span aria-hidden="true">═══</span>
          {eyebrow && <span style={{ color: 'var(--dt-magenta)' }}>{eyebrow}</span>}
          <span aria-hidden="true" className="flex-1 overflow-hidden">
            {''.padEnd(120, '─')}
          </span>
          <span style={{ color: 'var(--dt-fg-muted)' }}>{id}.md</span>
          <span aria-hidden="true">═══</span>
        </div>

        <h2
          id={`${id}-heading`}
          className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"
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

export default DevSection;
