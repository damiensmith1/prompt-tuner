import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  client,
  REVIEW_MODEL,
  apiErrorResponse,
  jsonError,
  jsonResponse,
  readDraft,
} from './_lib/anthropic';
import { ANALYZE_SYSTEM, analyzeUser } from './_lib/prompts';
import { rateLimit, clientIp } from './_lib/ratelimit';

export const config = { runtime: 'edge' };

const LIMIT = 15;
const WINDOW_SEC = 3600;

/**
 * The schema is enforced by the API rather than parsed out of prose, so the
 * old "JSON.parse the model's reply and hope" failure mode is gone.
 */
const AnalysisSchema = z.object({
  intent: z.string(),
  kind: z.string(),
  verdict: z.enum(['weak', 'workable', 'strong']),
  dimensions: z.array(
    z.object({
      id: z.enum(['task', 'context', 'output', 'audience', 'guardrails']),
      score: z.number().int().min(0).max(4),
      note: z.string(),
    }),
  ),
  gaps: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      why: z.string(),
      type: z.enum(['choice', 'multiselect', 'text', 'list']),
      options: z.array(z.string()),
      placeholder: z.string(),
      suggested: z.string(),
    }),
  ),
});

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError(405, 'Use POST.');

  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Malformed request.');
  }

  const parsed = readDraft(body.prompt);
  if ('error' in parsed) return parsed.error;

  const { allowed, retryAfter } = await rateLimit(
    `analyze:${clientIp(req)}`,
    LIMIT,
    WINDOW_SEC,
  );
  if (!allowed) {
    return jsonResponse(
      {
        error: `That's ${LIMIT} reviews this hour. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      },
      429,
    );
  }

  try {
    const message = await client.messages.parse({
      model: REVIEW_MODEL,
      max_tokens: 2000,
      system: ANALYZE_SYSTEM,
      messages: [{ role: 'user', content: analyzeUser(parsed.draft) }],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });

    if (!message.parsed_output) {
      return jsonError(502, 'The review came back unreadable. Try that again.');
    }

    return jsonResponse(normalise(message.parsed_output));
  } catch (err) {
    return apiErrorResponse(err, "The review didn't complete. Try that again.");
  }
}

/**
 * Structured output guarantees the shape but not the substance: a model can
 * still return four dimensions instead of five, or empty option lists on a
 * choice. Fill the gaps here so the client can render without guarding.
 */
function normalise(analysis: z.infer<typeof AnalysisSchema>) {
  const ids = ['task', 'context', 'output', 'audience', 'guardrails'] as const;

  const dimensions = ids.map((id) => {
    const found = analysis.dimensions.find((d) => d.id === id);
    return found ?? { id, score: 0, note: 'Not assessed.' };
  });

  const gaps = analysis.gaps
    .filter((gap) => {
      // A choice with nothing to choose between is not a usable question.
      const needsOptions = gap.type === 'choice' || gap.type === 'multiselect';
      return !needsOptions || gap.options.length >= 2;
    })
    .slice(0, 4)
    .map((gap, i) => ({
      ...gap,
      id: gap.id || `gap-${i}`,
      options: gap.options ?? [],
    }));

  return { ...analysis, dimensions, gaps };
}
