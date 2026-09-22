import {
  client,
  REWRITE_MODEL,
  apiErrorResponse,
  jsonError,
  jsonResponse,
  readDraft,
} from './_lib/anthropic';
import { REWRITE_SYSTEM, rewriteUser } from './_lib/prompts';
import { rateLimit, clientIp } from './_lib/ratelimit';
import type { Analysis } from './_lib/types';

export const config = { runtime: 'edge' };

const LIMIT = 15;
const WINDOW_SEC = 3600;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError(405, 'Use POST.');

  let body: { prompt?: unknown; analysis?: Analysis | null; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Malformed request.');
  }

  const parsed = readDraft(body.prompt);
  if ('error' in parsed) return parsed.error;

  const answers = coerceAnswers(body.answers);

  const { allowed, retryAfter } = await rateLimit(
    `rewrite:${clientIp(req)}`,
    LIMIT,
    WINDOW_SEC,
  );
  if (!allowed) {
    return jsonResponse(
      {
        error: `That's ${LIMIT} rewrites this hour. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      },
      429,
    );
  }

  try {
    // Thinking stays off: a silent pause before the first token is worse here
    // than the marginal quality, and the system prompt carries the quality.
    const stream = client.messages.stream({
      model: REWRITE_MODEL,
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      system: REWRITE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: rewriteUser(parsed.draft, body.analysis ?? null, answers),
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          // The response is already streaming, so a failure here can't become
          // an HTTP status. Surface it in-band and let the client show it.
          console.error('rewrite stream failed', err);
          controller.enqueue(
            encoder.encode('\n\n[The rewrite was cut short. Try again.]'),
          );
          controller.close();
        }
      },
      cancel() {
        void stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "The rewrite didn't complete. Try that again.");
  }
}

/** Answers arrive keyed by question text; keep only usable string pairs. */
function coerceAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
    else if (Array.isArray(v) && v.length) out[k] = v.filter(Boolean).join(', ');
  }
  return out;
}
