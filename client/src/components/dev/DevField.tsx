import React from 'react';

export interface FieldRow {
  name: string;
  type?: string;
  required?: boolean;
  description: React.ReactNode;
  /** Optional default value displayed in muted text after the type. */
  defaultValue?: string;
}

export interface DevFieldListProps {
  rows: FieldRow[];
  caption?: string;
}

/**
 * DevFieldList — structured key/value list for parameters, env vars, payload
 * shapes, or DB columns. Renders as a definition list for screen readers and
 * a styled grid visually.
 */
const DevFieldList: React.FC<DevFieldListProps> = ({ rows, caption }) => {
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-white/10 bg-white/4 backdrop-blur-md">
      {caption && (
        <div className="border-b border-white/8 bg-white/4 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/70">
          {caption}
        </div>
      )}
      <dl className="divide-y divide-white/6">
        {rows.map((row, i) => (
          <div
            key={`${row.name}-${i}`}
            className="grid grid-cols-[1fr] gap-1 px-4 py-3 sm:grid-cols-[minmax(180px,260px)_1fr] sm:gap-4"
          >
            <dt className="min-w-0">
              <code className="break-all font-mono text-[13px] text-white/95">{row.name}</code>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                {row.type && (
                  <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-white/75">
                    {row.type}
                  </span>
                )}
                {row.required && (
                  <span className="rounded bg-rose-400/15 px-1.5 py-0.5 font-mono uppercase tracking-wider text-rose-200">
                    required
                  </span>
                )}
                {row.defaultValue !== undefined && (
                  <span className="font-mono text-white/50">
                    default: <span className="text-white/70">{row.defaultValue}</span>
                  </span>
                )}
              </div>
            </dt>
            <dd className="text-sm leading-relaxed text-white/80 [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
              {row.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default DevFieldList;
