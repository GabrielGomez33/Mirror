import React from 'react';

export interface FieldRow {
  name: string;
  type?: string;
  required?: boolean;
  description: React.ReactNode;
  defaultValue?: string;
}

export interface DevFieldListProps {
  rows: FieldRow[];
  caption?: string;
}

/**
 * DevFieldList — man-page style key/value list. The name column is
 * monospace and tight; the description column wraps. Renders as a
 * semantic <dl> so screen readers announce key/value pairs correctly.
 */
const DevFieldList: React.FC<DevFieldListProps> = ({ rows, caption }) => {
  return (
    <div
      className="my-5 overflow-hidden"
      style={{
        background: 'var(--dt-bg-elevated)',
        border: '1px solid var(--dt-border)',
        borderRadius: '4px',
      }}
    >
      {caption && (
        <div
          className="px-3 py-2 text-[11px] uppercase tracking-widest"
          style={{
            color: 'var(--dt-fg-muted)',
            background: 'var(--dt-bg-soft)',
            borderBottom: '1px solid var(--dt-border)',
          }}
        >
          <span style={{ color: 'var(--dt-green)' }}>$</span>{' '}
          <span style={{ color: 'var(--dt-fg)' }}>{caption}</span>
        </div>
      )}
      <dl>
        {rows.map((row, i) => (
          <div
            key={`${row.name}-${i}`}
            className="grid grid-cols-1 gap-1 px-3 py-3 sm:grid-cols-[minmax(180px,280px)_1fr] sm:gap-5"
            style={{
              borderTop: i === 0 ? 'none' : '1px solid var(--dt-border-soft)',
            }}
          >
            <dt className="min-w-0">
              <code
                className="break-all"
                style={{
                  color: 'var(--dt-fg-strong)',
                  fontSize: '0.85rem',
                }}
              >
                {row.name}
              </code>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px]">
                {row.type && (
                  <span style={{ color: 'var(--dt-amber)' }}>{row.type}</span>
                )}
                {row.required && (
                  <span
                    style={{
                      color: 'var(--dt-red)',
                      border: '1px solid var(--dt-red)',
                      padding: '0 0.3rem',
                      borderRadius: '2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    required
                  </span>
                )}
                {row.defaultValue !== undefined && (
                  <span style={{ color: 'var(--dt-fg-dim)' }}>
                    default: <span style={{ color: 'var(--dt-fg-muted)' }}>{row.defaultValue}</span>
                  </span>
                )}
              </div>
            </dt>
            <dd
              className="text-sm leading-relaxed"
              style={{ color: 'var(--dt-fg)' }}
            >
              {row.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default DevFieldList;
