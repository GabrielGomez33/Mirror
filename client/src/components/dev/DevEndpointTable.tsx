import React from 'react';
import DevBadge from './DevBadge';

export interface EndpointRow {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS' | 'QUEUE';
  path: string;
  /** Plain-text description. Keep to a single line where possible. */
  description: string;
  /** Optional auth/access tag, e.g. "Public", "JWT", "Premium", "Admin". */
  access?: string;
  /** Optional notes column (rate limits, gates, etc.). */
  notes?: string;
}

export interface DevEndpointTableProps {
  rows: EndpointRow[];
  /** Hide the Access column entirely (e.g. for internal queue tables). */
  hideAccess?: boolean;
  /** Hide the Notes column entirely. */
  hideNotes?: boolean;
  caption?: string;
}

const METHOD_TONE: Record<EndpointRow['method'], React.ComponentProps<typeof DevBadge>['tone']> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  WS: 'ws',
  QUEUE: 'queue',
};

const accessTone = (
  access?: string
): React.ComponentProps<typeof DevBadge>['tone'] => {
  if (!access) return 'neutral';
  const a = access.toLowerCase();
  if (a.includes('public')) return 'public';
  if (a.includes('admin')) return 'admin';
  if (a.includes('premium')) return 'premium';
  if (a.includes('jwt') || a.includes('auth')) return 'auth';
  return 'neutral';
};

/**
 * DevEndpointTable — semantic table for API endpoints, WS events, and queue jobs.
 *
 * Always horizontally scrollable on narrow screens. The path column is the
 * widest column and uses font-mono. Method/access cells use DevBadge for
 * visual scanning.
 */
const DevEndpointTable: React.FC<DevEndpointTableProps> = ({
  rows,
  hideAccess,
  hideNotes,
  caption,
}) => {
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-white/10 bg-white/4 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          {caption && (
            <caption className="bg-white/5 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white/70">
              {caption}
            </caption>
          )}
          <thead className="bg-white/4 text-[11px] uppercase tracking-wider text-white/55">
            <tr>
              <th scope="col" className="w-[90px] px-3 py-2 font-semibold">Method</th>
              <th scope="col" className="px-3 py-2 font-semibold">Path</th>
              <th scope="col" className="px-3 py-2 font-semibold">Description</th>
              {!hideAccess && (
                <th scope="col" className="w-[110px] px-3 py-2 font-semibold">Access</th>
              )}
              {!hideNotes && (
                <th scope="col" className="w-[160px] px-3 py-2 font-semibold">Notes</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.method}-${row.path}-${i}`}
                className="border-t border-white/6 align-top"
              >
                <td className="px-3 py-2">
                  <DevBadge tone={METHOD_TONE[row.method]} ariaLabel={`HTTP ${row.method}`}>
                    {row.method}
                  </DevBadge>
                </td>
                <td className="px-3 py-2 font-mono text-[12.5px] text-white/90 break-all">
                  {row.path}
                </td>
                <td className="px-3 py-2 text-white/80">{row.description}</td>
                {!hideAccess && (
                  <td className="px-3 py-2">
                    {row.access ? (
                      <DevBadge tone={accessTone(row.access)}>{row.access}</DevBadge>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>
                )}
                {!hideNotes && (
                  <td className="px-3 py-2 text-xs text-white/65">
                    {row.notes || <span className="text-white/40">—</span>}
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
