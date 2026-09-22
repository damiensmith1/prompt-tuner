export const DIMENSIONS = [
  { id: 'task', label: 'The ask', hint: 'Is it unambiguous what you want done?' },
  { id: 'context', label: 'Background', hint: 'Does the model know enough to do it well?' },
  { id: 'output', label: 'The deliverable', hint: 'Is the shape of the answer specified?' },
  { id: 'audience', label: 'Reader and voice', hint: 'Who is it for, and how should it sound?' },
  { id: 'guardrails', label: 'Limits', hint: 'What to avoid, and what to do when unsure.' },
] as const;

export type DimensionId = (typeof DIMENSIONS)[number]['id'];

export type Dimension = {
  id: DimensionId;
  score: number;
  note: string;
};

export type GapType = 'choice' | 'multiselect' | 'text' | 'list';

export type Gap = {
  id: string;
  question: string;
  why: string;
  type: GapType;
  options: string[];
  placeholder?: string;
  suggested?: string;
};

export type Analysis = {
  intent: string;
  kind: string;
  verdict: 'weak' | 'workable' | 'strong';
  dimensions: Dimension[];
  gaps: Gap[];
};

/** A gap answer is a single value, or several for a multiselect or list. */
export type AnswerValue = string | string[];

export const MAX_PER_DIMENSION = 4;
export const MAX_SCORE = DIMENSIONS.length * MAX_PER_DIMENSION;

export function totalScore(dimensions: Dimension[]): number {
  return dimensions.reduce(
    (sum, d) => sum + Math.max(0, Math.min(MAX_PER_DIMENSION, d.score)),
    0,
  );
}

export function answerToString(value: AnswerValue | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
}

export const CHANGES_MARKER = '<<<CHANGES>>>';

/** Splits the streamed rewrite into the prompt and the notes on what changed. */
export function splitRewrite(raw: string): { prompt: string; changes: string[] } {
  const at = raw.indexOf(CHANGES_MARKER);
  if (at === -1) return { prompt: raw.trimStart(), changes: [] };

  const changes = raw
    .slice(at + CHANGES_MARKER.length)
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);

  return { prompt: raw.slice(0, at).trim(), changes };
}
