import React from 'react';

export interface DevSectionProps {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Top-level section anchor. The id is the hash target used by the sidebar
 * and the table of contents. Sections are h2-level for accessibility; the
 * page-level h1 lives in DevPage itself.
 */
const DevSection: React.FC<DevSectionProps> = ({ id, title, eyebrow, children }) => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-28 pt-10 first:pt-2"
      data-dev-section={id}
    >
      <header className="mb-4 border-b border-white/10 pb-3">
        {eyebrow && (
          <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-fuchsia-300/80">
            {eyebrow}
          </p>
        )}
        <h2
          id={`${id}-heading`}
          className="text-3xl font-semibold tracking-tight text-white"
          style={{ fontFamily: 'Poppins, Inter, sans-serif' }}
        >
          <a
            href={`#${id}`}
            className="group inline-flex items-center gap-2 hover:text-fuchsia-200"
          >
            {title}
            <span
              aria-hidden="true"
              className="text-white/20 opacity-0 transition-opacity group-hover:opacity-100"
            >
              #
            </span>
          </a>
        </h2>
      </header>
      <div className="space-y-3 text-[15px] leading-relaxed text-white/85">
        {children}
      </div>
    </section>
  );
};

export default DevSection;
