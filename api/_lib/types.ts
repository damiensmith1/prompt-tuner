/** Shared between the API routes and the client. */

/** The five things a draft prompt is graded on, in the order they're shown. */
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
  /** 0-4. */
  score: number;
  /** One sentence about this specific draft, not generic advice. */
  note: string;
};

export type Gap = {
  id: string;
  /** The question put to the writer. */
  question: string;
  /** Why answering it changes the result. */
  why: string;
  type: 'choice' | 'multiselect' | 'text' | 'list';
  options?: string[];
  placeholder?: string;
  /** The model's own best answer, so the writer can accept rather than compose. */
  suggested?: string;
};

export type Analysis = {
  /** What the draft appears to ask for, so a misread is caught early. */
  intent: string;
  /** e.g. "Marketing copy", "Code generation". */
  kind: string;
  verdict: 'weak' | 'workable' | 'strong';
  dimensions: Dimension[];
  gaps: Gap[];
};

export const MAX_SCORE = DIMENSIONS.length * 4;

export function totalScore(dimensions: Dimension[]): number {
  return dimensions.reduce((sum, d) => sum + Math.max(0, Math.min(4, d.score)), 0);
}

/** Separates the rewritten prompt from the model's notes on what it changed. */
export const CHANGES_MARKER = '<<<CHANGES>>>';
