import { neon } from '@neondatabase/serverless';

/**
 * Fixed-window rate limiting on Neon Postgres.
 *
 * Neon replaced Upstash here because a Neon branch parks its compute when idle
 * and wakes on the next connection — it is never reaped for inactivity, which
 * is what kept taking the old Redis instance down. The wake costs a few hundred
 * milliseconds on the first request after a quiet spell, which is noise next to
 * the model call that follows it.
 */

type Sql = ReturnType<typeof neon>;

let cached: Sql | null = null;

/**
 * Built on first use rather than at import time: `neon()` throws on a missing
 * connection string, and a config mistake should cost the rate limit, not the
 * whole endpoint.
 */
function getSql(): Sql | null {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = neon(url);
  return cached;
}

const TABLE = `
  create table if not exists rate_limits (
    bucket       text primary key,
    count        integer not null,
    window_start timestamptz not null
  )
`;

/** Postgres: relation does not exist. */
const UNDEFINED_TABLE = '42P01';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window rolls over. Only meaningful when blocked. */
  retryAfter: number;
};

/**
 * Counts one hit against `bucket` and reports whether it is within `limit`.
 *
 * Fails open: if the database is unreachable the request is allowed through.
 * A rate limiter that takes the whole app down with it is worse than no limiter
 * on a tool this size.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const sql = getSql();
  if (!sql) {
    console.warn('rate limit: DATABASE_URL is unset, limits are off');
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  try {
    return await consume(sql, bucket, limit, windowSec);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === UNDEFINED_TABLE) {
      try {
        await sql.query(TABLE);
        return await consume(sql, bucket, limit, windowSec);
      } catch (retryErr) {
        console.error('rate limit: table creation failed', retryErr);
        return { allowed: true, remaining: limit, retryAfter: 0 };
      }
    }
    console.error('rate limit: unavailable, failing open', err);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

/**
 * One round trip: insert the bucket, or bump it — resetting the counter first
 * if its window has already elapsed. Doing the reset inside the upsert keeps
 * the read and the write in a single atomic statement.
 */
async function consume(
  sql: Sql,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const rows = (await sql`
    insert into rate_limits (bucket, count, window_start)
    values (${bucket}, 1, now())
    on conflict (bucket) do update set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSec})
        then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSec})
        then now()
        else rate_limits.window_start
      end
    returning count, extract(epoch from now() - window_start)::int as age
  `) as { count: number; age: number }[];

  const { count, age } = rows[0];

  // Sweep expired buckets now and then so the table stays small without a cron.
  if (Math.random() < 0.02) void sweep(sql, windowSec);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: Math.max(1, windowSec - age),
  };
}

async function sweep(sql: Sql, windowSec: number): Promise<void> {
  try {
    await sql`
      delete from rate_limits
      where window_start < now() - make_interval(secs => ${windowSec * 2})
    `;
  } catch {
    // Housekeeping only — never worth surfacing.
  }
}

/** Best-effort client identity. Vercel puts the real client first in this list. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
