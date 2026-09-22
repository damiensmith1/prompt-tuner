import { useEffect, useState } from 'react';
import { splitRewrite } from '../lib/types';

type Props = {
  raw: string;
  streaming: boolean;
  onStartOver: () => void;
  onRevise: () => void;
};

export function Result({ raw, streaming, onStartOver, onRevise }: Props) {
  const { prompt, changes } = splitRewrite(raw);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-live="polite">
      <h2 className="prose-serif text-title">Your tuned prompt</h2>

      {streaming && !prompt && (
        <p className="mt-4 text-small text-muted">
          <span className="dots">Writing</span>
        </p>
      )}

      {prompt && (
        <div className="mt-4 border-l-2 border-pencil bg-paper-sunk py-4 pl-5 pr-4">
          <p
            className={`prose-serif whitespace-pre-wrap text-draft ${streaming ? 'caret' : ''}`}
          >
            {prompt}
          </p>
        </div>
      )}

      {!streaming && prompt && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-sheet bg-ink px-4 py-2 text-small text-paper hover:opacity-90"
          >
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
          <button
            type="button"
            onClick={onRevise}
            className="text-small text-pencil underline underline-offset-4 decoration-rule hover:decoration-pencil"
          >
            Change an answer
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="text-small text-muted underline underline-offset-4 decoration-rule hover:text-ink"
          >
            Start over
          </button>
        </div>
      )}

      {changes.length > 0 && (
        <div className="mt-10 border-t border-rule pt-5">
          <h3 className="text-small text-muted">What changed, and why</h3>
          <ul className="mt-3 space-y-2.5">
            {changes.map((change, i) => (
              <li key={i} className="flex max-w-measure gap-3 text-base">
                <span aria-hidden className="mt-[0.55em] h-px w-3 shrink-0 bg-pencil" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
