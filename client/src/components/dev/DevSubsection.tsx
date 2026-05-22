import React from 'react';

export interface DevSubsectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/**
 * Subsection anchor inside a DevSection. Header renders as a terminal
 * "## subsection" marker.
 */
const DevSubsection: React.FC<DevSubsectionProps> = ({ id, title, children }) => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      data-dev-subsection={id}
      className="dt-subsection scroll-mt-24 pt-7"
    >
      <h3
        id={`${id}-heading`}
        className="mb-3 text-lg font-semibold tracking-tight sm:text-xl"
        style={{ color: 'var(--dt-fg-strong)' }}
      >
        <a
          href={`#${id}`}
          className="group inline-flex items-baseline gap-2"
          style={{ color: 'inherit', borderBottom: 'none' }}
        >
          <span style={{ color: 'var(--dt-cyan)' }}>##</span>
          <span>{title}</span>
          <span
            aria-hidden="true"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--dt-fg-dim)' }}
          >
            ¶
          </span>
        </a>
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
};

export default DevSubsection;
