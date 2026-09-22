import { useState } from 'react';
import type { AnswerValue, Gap } from '../lib/types';

type Props = {
  gaps: Gap[];
  answers: Record<string, AnswerValue>;
  onChange: (gapId: string, value: AnswerValue) => void;
  disabled?: boolean;
};

export function Questions({ gaps, answers, onChange, disabled }: Props) {
  return (
    <ol className="space-y-8">
      {gaps.map((gap, i) => (
        <li key={gap.id} className="settle" style={{ animationDelay: `${i * 60}ms` }}>
          <p className="prose-serif text-[1.0625rem] leading-snug">{gap.question}</p>
          <p className="mt-1 max-w-measure text-small text-muted">{gap.why}</p>

          <div className="mt-3 max-w-measure">
            <Field
              gap={gap}
              value={answers[gap.id]}
              onChange={(v) => onChange(gap.id, v)}
              disabled={disabled}
            />
          </div>

          {gap.suggested && !isAnswered(answers[gap.id]) && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(gap.id, suggestionFor(gap))}
              className="mt-2 max-w-measure text-left text-small text-pencil underline underline-offset-4 decoration-rule hover:decoration-pencil disabled:opacity-40"
            >
              Use my reading: {gap.suggested}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function isAnswered(value: AnswerValue | undefined): boolean {
  if (!value) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

/** Multi-value fields need the suggestion split back into its parts. */
function suggestionFor(gap: Gap): AnswerValue {
  const raw = gap.suggested ?? '';
  if (gap.type === 'multiselect' || gap.type === 'list') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

const CHIP =
  'rounded-sheet border px-3 py-1.5 text-small transition-colors disabled:opacity-40';
const CHIP_ON = 'border-pencil bg-pencil-wash text-pencil';
const CHIP_OFF = 'border-rule text-muted hover:border-muted hover:text-ink';

const TEXT_FIELD =
  'w-full rounded-sheet border border-rule bg-paper-sunk px-3 py-2 text-base ' +
  'focus:border-pencil focus:outline-none focus:ring-0 disabled:opacity-40';

function Field({
  gap,
  value,
  onChange,
  disabled,
}: {
  gap: Gap;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
}) {
  if (gap.type === 'choice') {
    return (
      <div className="flex flex-wrap gap-2">
        {gap.options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            aria-pressed={value === opt}
            onClick={() => onChange(value === opt ? '' : opt)}
            className={`${CHIP} ${value === opt ? CHIP_ON : CHIP_OFF}`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (gap.type === 'multiselect') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {gap.options.map((opt) => {
          const on = picked.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() =>
                onChange(on ? picked.filter((p) => p !== opt) : [...picked, opt])
              }
              className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (gap.type === 'text') {
    return (
      <input
        type="text"
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={gap.placeholder}
        className={TEXT_FIELD}
      />
    );
  }

  return <ListField gap={gap} value={value} onChange={onChange} disabled={disabled} />;
}

function ListField({
  gap,
  value,
  onChange,
  disabled,
}: {
  gap: Gap;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
}) {
  const items = Array.isArray(value) ? value : [];
  const [entry, setEntry] = useState('');

  const add = () => {
    const next = entry.trim();
    if (!next) return;
    onChange([...items, next]);
    setEntry('');
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="flex items-baseline justify-between gap-3 border-b border-rule pb-1"
            >
              <span className="text-base">{item}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                className="shrink-0 text-micro text-muted hover:text-mark disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          disabled={disabled}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={gap.placeholder}
          className={TEXT_FIELD}
        />
        <button
          type="button"
          disabled={disabled || !entry.trim()}
          onClick={add}
          className="shrink-0 rounded-sheet border border-rule px-3 text-small text-muted hover:border-muted hover:text-ink disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
