import React from 'react';
import DevBadge, { type BadgeTone } from './DevBadge';

export interface EndpointRow {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS' | 'QUEUE';
  path: string;
  description: string;
  /** Optional auth/access tag, e.g. "Public", "JWT", "Premium", "Admin". */
  access?: string;
  notes?: string;
}

export interface DevEndpointTableProps {
  rows: EndpointRow[];
  hideAccess?: boolean;
  hideNotes?: boolean;
  caption?: string;
}

const METHOD_TONE: Record<EndpointRow['method'], BadgeTone> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  WS: 'ws',
  QUEUE: 'queue',
};

const accessTone = (access?: string): BadgeTone => {
  if (!access) return 'neutral';
  const a = access.toLowerCase();
  if (a.includes('public')) return 'public';
  if (a.includes('admin')) return 'admin';
  if (a.includes('premium')) return 'premium';
  if (a.includes('jwt') || a.includes('auth') || a.includes('token') || a.includes('service'))
    return 'auth';
  return 'neutral';
};

/**
 * DevEndpointTable — terminal-styled, horizontally-scrollable endpoint
 * table. Renders as a semantic <table> for assistive tech.
 *
 * On screens narrower than `sm`, the table is still scrollable rather
 * than reflowing into cards. Stacked card layouts hide the column
 * relationship which is the whole point of an endpoint catalog.
 */
const DevEndpointTable: React.FC<DevEndpointTableProps> = ({
  rows,
  hideAccess,
  hideNotes,
  caption,
}) => {
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr
              className="text-[10px] uppercase tracking-widest"
              style={{
                color: 'var(--dt-fg-dim)',
                background: 'var(--dt-bg-soft)',
              }}
            >
              <th scope="col" className="w-[88px] px-3 py-2 font-semibold">Method</th>
              <th scope="col" className="px-3 py-2 font-semibold">Path</th>
              <th scope="col" className="px-3 py-2 font-semibold">Description</th>
              {!hideAccess && (
                <th scope="col" className="w-[120px] px-3 py-2 font-semibold">Access</th>
              )}
              {!hideNotes && (
                <th scope="col" className="w-[170px] px-3 py-2 font-semibold">Notes</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.method}-${row.path}-${i}`}
                className="align-top"
                style={{ borderTop: '1px solid var(--dt-border-soft)' }}
              >
                <td className="px-3 py-2">
                  <DevBadge tone={METHOD_TONE[row.method]} ariaLabel={`HTTP ${row.method}`}>
                    {row.method}
                  </DevBadge>
                </td>
                <td
                  className="px-3 py-2 break-all"
                  style={{ color: 'var(--dt-fg-strong)' }}
                >
                  {row.path}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--dt-fg)' }}>
                  {row.description}
                </td>
                {!hideAccess && (
                  <td className="px-3 py-2">
                    {row.access ? (
                      <DevBadge tone={accessTone(row.access)}>{row.access}</DevBadge>
                    ) : (
                      <span style={{ color: 'var(--dt-fg-dim)' }}>—</span>
                    )}
                  </td>
                )}
                {!hideNotes && (
                  <td
                    className="px-3 py-2 text-xs"
                    style={{ color: 'var(--dt-fg-muted)' }}
                  >
                    {row.notes || <span style={{ color: 'var(--dt-fg-dim)' }}>—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DevEndpointTable;
