import {
  DIMENSIONS,
  MAX_PER_DIMENSION,
  MAX_SCORE,
  totalScore,
  type Analysis,
} from '../lib/types';

/**
 * The grade, kept glanceable. Tally marks rather than a progress bar: five
 * separate judgements don't average into one number honestly, and a bar
 * invites the reader to chase 100% instead of reading the review.
 */
export function Scorecard({ analysis }: { analysis: Analysis }) {
  const total = totalScore(analysis.dimensions);

  return (
    <div className="settle">
      <p className="text-micro text-muted">Reads as</p>
      <p className="prose-serif mt-1 text-[1.0625rem] leading-snug">{analysis.intent}</p>
      <p className="mt-2 text-micro text-muted">{analysis.kind}</p>

      <div className="mt-6 border-t border-rule pt-4">
        <ul className="space-y-2.5">
          {DIMENSIONS.map(({ id, label, hint }) => {
            const dim = analysis.dimensions.find((d) => d.id === id);
            const score = dim?.score ?? 0;
            return (
              <li key={id} className="flex items-baseline justify-between gap-3">
                <span className="text-small text-muted" title={hint}>
                  {label}
                </span>
                <Tally score={score} label={`${label}: ${score} of ${MAX_PER_DIMENSION}`} />
              </li>
            );
          })}
        </ul>

        <p className="mt-4 border-t border-rule pt-3 text-small text-muted">
          <span className="text-ink">{total}</span> of {MAX_SCORE}
        </p>
      </div>
    </div>
  );
}

function Tally({ score, label }: { score: number; label: string }) {
  // Red is reserved for things that are actually wrong, as it would be on a proof.
  const filled = score <= 1 ? 'bg-mark' : 'bg-pencil';

  return (
    <span className="flex shrink-0 gap-[3px]" role="img" aria-label={label}>
      {Array.from({ length: MAX_PER_DIMENSION }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-[3px] ${i < score ? filled : 'bg-rule'}`}
        />
      ))}
    </span>
  );
}
