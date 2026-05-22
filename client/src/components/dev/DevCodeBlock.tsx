import React, { useCallback, useMemo, useState } from 'react';

export interface DevCodeBlockProps {
  /** Code body. Leading/trailing blank lines are trimmed for layout. */
  code: string;
  /** Display language tag (purely visual — no tokenizer is shipped). */
  language?: string;
  /** Optional caption shown in the title bar (e.g. file path). */
  caption?: string;
  /** Highlight specific 1-indexed lines. */
  highlightLines?: number[];
  /** Hide line numbers (useful for ASCII diagrams and short shell snippets). */
  noLineNumbers?: boolean;
  /** Render as a terminal "session": each line prefixed with $ unless it
   *  starts with whitespace or '#'. Implies noLineNumbers. */
  shellSession?: boolean;
}

/**
 * DevCodeBlock — read-only, terminal-style code panel.
 *
 * Layout:
 *   ┌─ caption ─────────────────────[ lang ]─[ copy ]─┐
 *   │  01 │ line of code                              │
 *   │  02 │ line of code                              │
 *   └─────┴───────────────────────────────────────────┘
 *
 * We deliberately do not bundle a syntax highlighter — the cost outweighs
 * the benefit on a docs-only page. Clipboard copy falls back to a "Copy
 * unavailable" hint when the API is missing (HTTP context, older browsers).
 */
const DevCodeBlock: React.FC<DevCodeBlockProps> = ({
  code,
  language,
  caption,
  highlightLines,
  noLineNumbers,
  shellSession,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle');

  const trimmed = useMemo(() => code.replace(/^\n+|\n+$/g, ''), [code]);
  const lines = useMemo(() => trimmed.split('\n'), [trimmed]);
  const highlightSet = useMemo(() => new Set(highlightLines || []), [highlightLines]);
  const lineNumberWidth = useMemo(() => String(lines.length).length, [lines.length]);
  const hideLineNumbers = noLineNumbers || shellSession;

  const handleCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyState('unavailable');
      window.setTimeout(() => setCopyState('idle'), 1500);
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('unavailable');
      window.setTimeout(() => setCopyState('idle'), 1500);
    }
  }, [trimmed]);

  return (
    <figure
      className="my-5 overflow-hidden"
      style={{
        background: 'var(--dt-bg-code)',
        border: '1px solid var(--dt-border)',
        borderRadius: '4px',
      }}
    >
      <header
        className="flex items-center justify-between gap-2 px-3 py-1.5"
        style={{
          background: 'var(--dt-bg-elevated)',
          borderBottom: '1px solid var(--dt-border)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* Three "traffic light" dots — pure visual cue, classic terminal feel. */}
          <span aria-hidden="true" className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f56' }} />
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#27c93f' }} />
          </span>
          {caption && (
            <span
              className="truncate text-xs"
              style={{ color: 'var(--dt-fg-muted)' }}
              title={caption}
            >
              {caption}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {language && (
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--dt-fg-dim)' }}
            >
              {language}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
            className="text-[11px] transition-colors"
            style={{
              color: copyState === 'copied' ? 'var(--dt-green)' : 'var(--dt-fg-muted)',
              border: `1px solid var(--dt-border-hi)`,
              padding: '0.1rem 0.45rem',
              borderRadius: '3px',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {copyState === 'copied'
              ? '✓ copied'
              : copyState === 'unavailable'
                ? 'unavailable'
                : 'copy'}
          </button>
        </div>
      </header>
      <pre
        className="m-0 overflow-x-auto p-0 text-[12.5px] leading-[1.6]"
        style={{ color: 'var(--dt-fg)' }}
      >
        <code className="block">
          {lines.map((ln, idx) => {
            const n = idx + 1;
            const highlighted = highlightSet.has(n);
            // Heuristic for shell session: lines that don't start with whitespace,
            // '#', or a redirect/pipe char get a "$ " prefix.
            const isShellComment = shellSession && /^\s*#/.test(ln);
            const showPrompt =
              shellSession &&
              !isShellComment &&
              ln.length > 0 &&
              !/^\s/.test(ln);
            return (
              <span
                key={n}
                className="flex items-start"
                style={{
                  background: highlighted ? 'var(--dt-amber-dim)' : 'transparent',
                  borderLeft: highlighted
                    ? '2px solid var(--dt-amber)'
                    : '2px solid transparent',
                  paddingLeft: '0.75rem',
                  paddingRight: '0.75rem',
                  minHeight: '1.6em',
                }}
              >
                {!hideLineNumbers && (
                  <span
                    aria-hidden="true"
                    className="select-none text-right"
                    style={{
                      width: `${lineNumberWidth + 1}ch`,
                      color: 'var(--dt-fg-dim)',
                      marginRight: '1rem',
                    }}
                  >
                    {String(n).padStart(lineNumberWidth, ' ')}
                  </span>
                )}
                {showPrompt && (
                  <span
                    aria-hidden="true"
                    style={{ color: 'var(--dt-green)', marginRight: '0.5rem' }}
                  >
                    $
                  </span>
                )}
                <span
                  className="whitespace-pre"
                  style={{
                    color: isShellComment ? 'var(--dt-fg-dim)' : 'inherit',
                  }}
                >
                  {ln || ' '}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
};

export default DevCodeBlock;
