# Prompt Tuner

Quick little utility I made to help me write better prompts in day-to-day AI use.
Try it here: https://prompt-tuner.vercel.app/

Paste a draft prompt. It gets read and graded, you're asked only for what's
genuinely missing, and you get a rewritten prompt back with notes on what
changed.

## How it works

Two edge functions, both under `api/`:

- **`analyze`** — grades the draft 0–4 on five dimensions (the ask, background,
  the deliverable, reader and voice, limits), writes a note on each, and picks at
  most four gaps worth closing. Each gap carries a suggested answer, so you can
  accept the model's reading instead of composing one. Runs on Claude Haiku 4.5
  with a structured output schema, so the response can't come back unparseable.
- **`rewrite`** — takes the draft, the review, and your answers, and streams back
  a tuned prompt followed by a short list of what changed. Runs on Claude
  Sonnet 5.

The draft is always passed as data inside `<draft>` tags, and both system prompts
say it is material under review rather than instructions — a prompt tuner is
otherwise an open invitation to prompt injection.

## Setup

```sh
npm install
cp .env.example .env   # then fill it in
vercel dev             # needed for the api/ routes; plain `npm run dev` won't serve them
```

`ANTHROPIC_API_KEY` is required. `DATABASE_URL` is optional — without it the app
runs fine and rate limiting is off.

### Why Neon and not Redis

Rate limiting used to run on Upstash Redis, whose free-tier databases get reaped
after a stretch of inactivity — which is exactly what this app has, so limiting
kept breaking and taking requests down with it. Neon parks its compute when idle
and wakes it on the next connection instead of disappearing. The wake costs a few
hundred milliseconds on the first request after a quiet period, which is nothing
next to the model call behind it.

The limiter creates its own `rate_limits` table on first use, sweeps expired rows
occasionally, and fails open: if the database is unreachable the request goes
through. A rate limiter that takes the app down with it is worse than none.

Limits are 15 reviews and 15 rewrites per IP per hour.
