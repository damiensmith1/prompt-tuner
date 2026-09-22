import type { Analysis } from './types';

/** Thrown for anything the person should see rather than a console. */
export class TunerError extends Error {}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Non-JSON error body; fall through.
  }
  return fallback;
}

export async function analyze(prompt: string, signal?: AbortSignal): Promise<Analysis> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!res.ok) {
    throw new TunerError(await readError(res, "The review didn't complete. Try again."));
  }
  return res.json();
}

/**
 * Streams the rewrite, handing each accumulated chunk to `onChunk` so the
 * page can render it as it lands.
 */
export async function rewrite(
  args: {
    prompt: string;
    analysis: Analysis | null;
    answers: Record<string, string>;
  },
  onChunk: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal,
  });

  if (!res.ok) {
    throw new TunerError(await readError(res, "The rewrite didn't complete. Try again."));
  }
  if (!res.body) throw new TunerError('The rewrite came back empty. Try again.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }
  accumulated += decoder.decode();
  onChunk(accumulated);

  return accumulated;
}
