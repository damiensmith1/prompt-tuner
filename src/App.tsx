import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scorecard } from './components/Scorecard';
import { Questions } from './components/Questions';
import { Result } from './components/Result';
import { analyze, rewrite, TunerError } from './lib/api';
import {
  DIMENSIONS,
  answerToString,
  type Analysis,
  type AnswerValue,
  type Gap,
} from './lib/types';

type Stage = 'draft' | 'reviewed' | 'rewriting' | 'done';

const EXAMPLES = [
  'Write a marketing email that converts',
  'Summarise this call transcript',
  'Review my pull request',
  'Plan a week of dinners',
];

export default function App() {
  const [draft, setDraft] = useState('');
  const [stage, setStage] = useState<Stage>('draft');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const draftRef = useRef<HTMLTextAreaElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Grow the draft field with its content rather than scrolling inside a box.
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, stage]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runReview = useCallback(async () => {
    if (!draft.trim() || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError('');
    setAnalysis(null);
    setAnswers({});
    setOutput('');

    try {
      const result = await analyze(draft, controller.signal);
      setAnalysis(result);
      setStage('reviewed');
      requestAnimationFrame(() =>
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(message(err, "The review didn't complete. Try again."));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [draft, busy]);

  const runRewrite = useCallback(async () => {
    if (busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError('');
    setOutput('');
    setStage('rewriting');

    const asStrings = Object.fromEntries(
      (analysis?.gaps ?? [])
        .map((gap) => [gap.question, answerToString(answers[gap.id])] as const)
        .filter(([, value]) => value),
    );

    try {
      await rewrite(
        { prompt: draft, analysis, answers: asStrings },
        setOutput,
        controller.signal,
      );
      setStage('done');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(message(err, "The rewrite didn't complete. Try again."));
      setStage('reviewed');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [analysis, answers, draft, busy]);

  const reset = () => {
    abortRef.current?.abort();
    setDraft('');
    setStage('draft');
    setAnalysis(null);
    setAnswers({});
    setOutput('');
    setError('');
    setBusy(false);
  };

  const backToQuestions = () => {
    abortRef.current?.abort();
    setBusy(false);
    setOutput('');
    setStage('reviewed');
  };

  const weakNotes = useMemo(
    () =>
      (analysis?.dimensions ?? [])
        .filter((d) => d.score <= 2)
        .map((d) => ({
          label: DIMENSIONS.find((x) => x.id === d.id)?.label ?? d.id,
          note: d.note,
        })),
    [analysis],
  );

  const unfilled = useMemo(
    () => (analysis?.gaps ?? []).filter((g) => g.suggested && !hasAnswer(answers[g.id])),
    [analysis, answers],
  );

  const acceptAllReadings = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const gap of unfilled) next[gap.id] = expand(gap);
      return next;
    });
  };

  const showResult = stage === 'rewriting' || stage === 'done';

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl flex-wrap items-baseline gap-x-3 gap-y-1 px-6 pt-8">
        <span className="prose-serif text-[1.0625rem]">Prompt Tuner</span>
        <span className="text-micro text-muted">
          Read your draft, then rewrite it properly
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10">
        {stage === 'draft' && (
          <p className="prose-serif mb-8 max-w-[18ch] text-display font-light">
            What are you asking for?
          </p>
        )}

        {/* The draft itself is the hero: set large, in the serif, like a manuscript. */}
        <section className="max-w-[40rem]">
          <label htmlFor="draft" className="sr-only">
            Your draft prompt
          </label>
          <textarea
            id="draft"
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runReview();
            }}
            disabled={busy || showResult}
            rows={2}
            placeholder="Paste the prompt you were about to send…"
            className="prose-serif w-full resize-none overflow-hidden border-b border-rule bg-transparent pb-4 text-draft placeholder:text-muted focus:border-pencil focus:outline-none disabled:opacity-60"
          />

          {stage === 'draft' && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <button
                type="button"
                onClick={runReview}
                disabled={!draft.trim() || busy}
                className="rounded-sheet bg-ink px-5 py-2.5 text-small text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                {busy ? 'Reading…' : 'Read my draft'}
              </button>
              {!draft && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setDraft(example)}
                      className="text-small text-muted underline underline-offset-4 decoration-rule hover:text-ink hover:decoration-muted"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {error && (
          <p role="alert" className="mt-5 border-l-2 border-mark pl-3 text-small text-mark">
            {error}
          </p>
        )}

        {analysis && (
          <div
            ref={reviewRef}
            className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-14"
          >
            {/* The margin: the grade, kept beside the work rather than on top of it. */}
            <aside className="min-w-0 md:sticky md:top-8 md:self-start">
              <Scorecard analysis={analysis} />
            </aside>

            <div className="min-w-0">
              {showResult ? (
                <Result
                  raw={output}
                  streaming={stage === 'rewriting'}
                  onStartOver={reset}
                  onRevise={backToQuestions}
                />
              ) : (
                <>
                  {weakNotes.length > 0 && (
                    <section className="settle">
                      <h2 className="prose-serif text-title">What it's missing</h2>
                      <ul className="mt-4 space-y-3">
                        {weakNotes.map(({ label, note }) => (
                          <li key={label} className="max-w-measure text-base">
                            <span className="text-muted">{label}. </span>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {analysis.gaps.length > 0 && (
                    <section className={weakNotes.length ? 'mt-12' : ''}>
                      <h2 className="prose-serif text-title">Close the gaps</h2>
                      <p className="mt-2 max-w-measure text-small text-muted">
                        Answer what you can. Anything you skip becomes a placeholder
                        you can fill in later.
                      </p>
                      <div className="mt-7">
                        <Questions
                          gaps={analysis.gaps}
                          answers={answers}
                          onChange={(id, value) =>
                            setAnswers((prev) => ({ ...prev, [id]: value }))
                          }
                          disabled={busy}
                        />
                      </div>
                    </section>
                  )}

                  <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-rule pt-6">
                    <button
                      type="button"
                      onClick={runRewrite}
                      disabled={busy}
                      className="rounded-sheet bg-ink px-5 py-2.5 text-small text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
                    >
                      {busy ? 'Rewriting…' : 'Rewrite it'}
                    </button>

                    {unfilled.length > 0 && (
                      <button
                        type="button"
                        onClick={acceptAllReadings}
                        disabled={busy}
                        className="text-small text-pencil underline underline-offset-4 decoration-rule hover:decoration-pencil disabled:opacity-40"
                      >
                        Answer all {unfilled.length} for me
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={reset}
                      disabled={busy}
                      className="text-small text-muted underline underline-offset-4 decoration-rule hover:text-ink disabled:opacity-40"
                    >
                      Start over
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (!value) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

/** Multi-value gaps need the model's suggestion split back into its parts. */
function expand(gap: Gap): AnswerValue {
  const raw = gap.suggested ?? '';
  if (gap.type === 'multiselect' || gap.type === 'list') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

function message(err: unknown, fallback: string): string {
  return err instanceof TunerError ? err.message : fallback;
}
