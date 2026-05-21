import React from 'react';

export interface DevSubsectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

const DevSubsection: React.FC<DevSubsectionProps> = ({ id, title, children }) => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-28 pt-6"
      data-dev-subsection={id}
    >
      <h3
        id={`${id}-heading`}
        className="mb-3 text-xl font-semibold tracking-tight text-white/95"
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
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
};

export default DevSubsection;
