import type { Analysis, AnswerValue } from './types';

/**
 * A tune survives a refresh. Reviews cost a model call and the rewritten prompt
 * is the thing worth keeping, so losing both to an accidental reload is the
 * most annoying thing this page could do.
 *
 * The key carries a version: if the stored shape ever stops matching what the
 * app expects, bump it rather than trying to migrate, and old entries are
 * simply ignored.
 */
const KEY = 'prompt-tuner:v1';

/** Only settled stages persist — see `save` for why 'rewriting' never does. */
export type PersistedStage = 'draft' | 'reviewed' | 'done';

export type Persisted = {
  draft: string;
  stage: PersistedStage;
  analysis: Analysis | null;
  answers: Record<string, AnswerValue>;
  output: string;
};

export function load(): Persisted | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null; // Private mode, blocked storage, or no storage at all.
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Persisted;
    if (!isUsable(parsed)) {
      clear();
      return null;
    }
    return parsed;
  } catch {
    clear();
    return null;
  }
}

export function save(state: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or blocked storage. Persistence is a convenience, never a
    // requirement, so a failure here must not reach the page.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do.
  }
}

/**
 * Guards against a stored entry written by an older build. Anything that isn't
 * the shape the app renders is discarded rather than crashing a component
 * halfway down the tree.
 */
function isUsable(value: unknown): value is Persisted {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Persisted>;

  if (typeof v.draft !== 'string' || typeof v.output !== 'string') return false;
  if (v.stage !== 'draft' && v.stage !== 'reviewed' && v.stage !== 'done') return false;
  if (!v.answers || typeof v.answers !== 'object') return false;

  if (v.analysis !== null) {
    const a = v.analysis as Partial<Analysis> | undefined;
    if (!a || !Array.isArray(a.dimensions) || !Array.isArray(a.gaps)) return false;
    if (typeof a.intent !== 'string' || typeof a.kind !== 'string') return false;
  }

  // A stage past the draft needs an analysis to render against.
  if (v.stage !== 'draft' && !v.analysis) return false;

  return true;
}
