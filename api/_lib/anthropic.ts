import Anthropic from '@anthropic-ai/sdk';

export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Reviewing is frequent, short, and schema-constrained, so it runs on the
 * cheapest current model. The rewrite is the one artefact the writer keeps,
 * so it gets a stronger one.
 */
export const REVIEW_MODEL = 'claude-haiku-4-5';
export const REWRITE_MODEL = 'claude-sonnet-5';

/** Long enough that no realistic draft prompt is worth spending tokens on. */
export const MAX_DRAFT_CHARS = 6000;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

/** Turns an SDK failure into something worth showing a person. */
export function apiErrorResponse(err: unknown, fallback: string): Response {
  if (err instanceof Anthropic.RateLimitError) {
    return jsonError(503, 'The model is busy right now. Try again in a moment.');
  }
  if (err instanceof Anthropic.AuthenticationError) {
    console.error('Anthropic auth failed — check ANTHROPIC_API_KEY', err);
    return jsonError(500, 'The tuner is misconfigured. This one is on us.');
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`Anthropic API error ${err.status}`, err);
    return jsonError(502, fallback);
  }
  console.error(fallback, err);
  return jsonError(500, fallback);
}

/** Reads and validates the draft prompt out of a request body. */
export function readDraft(value: unknown): { draft: string } | { error: Response } {
  if (typeof value !== 'string' || !value.trim()) {
    return { error: jsonError(400, 'Write a prompt first.') };
  }
  if (value.length > MAX_DRAFT_CHARS) {
    return {
      error: jsonError(
        413,
        `That draft is ${value.length.toLocaleString()} characters. Trim it to ${MAX_DRAFT_CHARS.toLocaleString()} or fewer.`,
      ),
    };
  }
  return { draft: value.trim() };
}
