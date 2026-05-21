import React, { useCallback, useMemo, useState } from 'react';

export interface DevCodeBlockProps {
  /** Code body. Leading/trailing newlines are trimmed for layout. */
  code: string;
  /** Display language tag (purely visual — no runtime tokenization). */
  language?: string;
  /** Optional caption shown above the block (e.g. file path). */
  caption?: string;
  /** Highlight specific 1-indexed line numbers. */
  highlightLines?: number[];
  /** Hide line numbers (useful for shell snippets). */
  noLineNumbers?: boolean;
}

/**
 * DevCodeBlock — read-only code presentation.
 *
 * Intentionally does not run a syntax highlighter: pulling a tokenizer would
 * bloat the bundle and the Mirror docs prioritize layout over color accuracy.
 * Copy-to-clipboard fails open if the API is unavailable (HTTP context, older
 * browsers) and surfaces a "Copy unavailable" hint instead of throwing.
 */
const DevCodeBlock: React.FC<DevCodeBlockProps> = ({
  code,
  language,
  caption,
  highlightLines,
  noLineNumbers,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle');

  const trimmed = useMemo(() => code.replace(/^\n+|\n+$/g, ''), [code]);
  const lines = useMemo(() => trimmed.split('\n'), [trimmed]);
  const highlightSet = useMemo(() => new Set(highlightLines || []), [highlightLines]);

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
    <figure className="my-5 overflow-hidden rounded-xl border border-white/10 bg-[#0c0a1e]/80 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/8 bg-white/4 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {language && (
            <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70">
              {language}
            </span>
          )}
          {caption && (
            <span className="truncate font-mono text-xs text-white/60" title={caption}>
              {caption}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="rounded border border-white/12 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/50"
        >
          {copyState === 'copied'
            ? 'Copied'
            : copyState === 'unavailable'
              ? 'Copy unavailable'
              : 'Copy'}
        </button>
      </header>
      <pre className="m-0 overflow-x-auto p-0 font-mono text-[12.5px] leading-[1.55] text-white/90">
        <code className="block">
          {lines.map((ln, idx) => {
            const n = idx + 1;
            const highlighted = highlightSet.has(n);
            return (
              <span
                key={n}
                className={
                  'flex min-h-[1.55em] items-start px-4 ' +
                  (highlighted
                    ? 'bg-fuchsia-300/8 border-l-2 border-fuchsia-300/60 -ml-[2px]'
                    : '')
                }
              >
                {!noLineNumbers && (
                  <span
                    aria-hidden="true"
                    className="mr-4 w-8 select-none text-right text-white/30"
                  >
                    {n}
                  </span>
                )}
                <span className="whitespace-pre">{ln || ' '}</span>
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
};

export default DevCodeBlock;
