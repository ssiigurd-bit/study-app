// Viser én oppgave, tar imot svaret og gir forklarende tilbakemelding.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { checkNumeric, type Rendered } from '../content/instantiate';
import type { AnswerResult } from '../db/db';
import { formatNumber } from '../lib/numbers';
import type { GradeName } from '../lib/scheduler';
import { Figure } from './figures/Figure';
import { CheckIcon, CloseIcon, FlagIcon, StarIcon } from './Icons';
import { Inline, Markup } from './Markup';

export interface Outcome {
  correct: boolean;
  grade: GradeName;
  response?: string;
}

interface Props {
  r: Rendered;
  onSubmit: (o: Outcome) => Promise<AnswerResult>;
  onNext: (o: Outcome) => void;
  onReport: (context: string) => void;
}

type Phase =
  | { t: 'answering' }
  | { t: 'feedback'; outcome: Outcome; result?: AnswerResult; misconception?: string; chosen?: number; value?: number };

export function promptText(r: Rendered): string {
  switch (r.kind) {
    case 'flashcard': return `${r.front} → ${r.back}`;
    case 'truefalse': return r.statement;
    default: return r.prompt;
  }
}

export function ItemPlayer({ r, onSubmit, onNext, onReport }: Props) {
  const [phase, setPhase] = useState<Phase>({ t: 'answering' });
  const [flipped, setFlipped] = useState(false);
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const submitting = useRef(false);

  async function submit(o: Outcome, extra: Omit<Extract<Phase, { t: 'feedback' }>, 't' | 'outcome' | 'result'> = {}) {
    if (submitting.current) return;
    submitting.current = true;
    setPhase({ t: 'feedback', outcome: o, ...extra });
    const result = await onSubmit(o);
    setPhase({ t: 'feedback', outcome: o, result, ...extra });
  }

  const answered = phase.t === 'feedback';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mx-auto max-w-md motion-safe:animate-slideup">
          <Meta r={r} />

          {r.kind === 'flashcard' && (
            <div className="card mt-3 text-center">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Begrep</div>
              <div className="mt-2 text-xl font-semibold">
                <Inline text={r.front} />
              </div>
              {flipped && (
                <div className="mt-5 border-t border-slate-200 pt-5 text-lg leading-relaxed motion-safe:animate-pop dark:border-slate-700">
                  <Markup text={r.back} />
                </div>
              )}
            </div>
          )}

          {r.kind !== 'flashcard' && (
            <div className="mt-3 text-lg leading-relaxed">
              <Markup text={r.kind === 'truefalse' ? r.statement : r.prompt} />
            </div>
          )}

          {r.figure && r.figureShow === 'prompt' && <Figure figure={r.figure} />}

          {r.kind === 'mcq' && (
            <div className="mt-5 space-y-2.5">
              {r.options.map((o, i) => {
                const state = !answered
                  ? chosen === i
                    ? 'selected'
                    : 'idle'
                  : o.correct
                    ? 'correct'
                    : chosen === i
                      ? 'wrong'
                      : 'dim';
                const cls = {
                  idle: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                  selected: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-950/50',
                  correct: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                  wrong: 'border-rose-500 bg-rose-50 motion-safe:animate-shake dark:bg-rose-950/40',
                  dim: 'border-slate-200 bg-white opacity-50 dark:border-slate-800 dark:bg-slate-900',
                }[state];
                return (
                  <button
                    key={i}
                    disabled={answered}
                    onClick={() => setChosen(i)}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] leading-snug transition motion-reduce:transition-none ${cls}`}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold opacity-60">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>
                      <Inline text={o.text} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {r.kind === 'truefalse' && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[true, false].map((v) => {
                const isChosen = answered && phase.outcome.response === String(v);
                const isRight = answered && r.answer === v;
                const cls = !answered
                  ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  : isRight
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                    : isChosen
                      ? 'border-rose-500 bg-rose-50 motion-safe:animate-shake dark:bg-rose-950/40'
                      : 'border-slate-200 opacity-50 dark:border-slate-800';
                return (
                  <button
                    key={String(v)}
                    disabled={answered}
                    onClick={() => submit({ correct: v === r.answer, grade: v === r.answer ? 'good' : 'again', response: String(v) })}
                    className={`rounded-2xl border-2 py-5 text-lg font-semibold transition motion-reduce:transition-none ${cls}`}
                  >
                    {v ? 'Sant' : 'Usant'}
                  </button>
                );
              })}
            </div>
          )}

          {r.kind === 'numeric' && (
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (answered) return;
                const res = checkNumeric(r, input);
                if (res.status === 'invalid') {
                  setInvalid(true);
                  return;
                }
                const correct = res.status === 'correct';
                submit(
                  { correct, grade: correct ? 'good' : 'again', response: input },
                  { misconception: res.status === 'wrong' ? res.misconception : undefined, value: res.value },
                );
              }}
            >
              <div
                className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-3 py-1.5 dark:bg-slate-900 ${
                  answered
                    ? phase.outcome.correct
                      ? 'border-emerald-500'
                      : 'border-rose-500 motion-safe:animate-shake'
                    : invalid
                      ? 'border-amber-500'
                      : 'border-slate-200 focus-within:border-indigo-500 dark:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  disabled={answered}
                  aria-label="Bytt fortegn"
                  onClick={() => setInput((v) => (v.trim().startsWith('-') || v.trim().startsWith('−') ? v.trim().slice(1) : '-' + v.trim()))}
                  className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 text-lg font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  ±
                </button>
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setInvalid(false);
                  }}
                  disabled={answered}
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder="Svar"
                  aria-label="Ditt svar"
                  className="min-w-0 flex-1 bg-transparent py-2 text-xl font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                {r.unit && <span className="shrink-0 text-slate-500">{r.unit}</span>}
              </div>
              {invalid && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">Skriv et tall, f.eks. 1 250,50 eller 12,5.</p>}
              {!answered && (
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    className="btn-secondary flex-1 text-sm"
                    onClick={() => submit({ correct: false, grade: 'again', response: '(vis løsning)' })}
                  >
                    Vis løsning
                  </button>
                  <button type="submit" className="btn-primary flex-[2]" disabled={!input.trim()}>
                    Sjekk svar
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Handlinger nederst */}
      {!answered && r.kind === 'mcq' && (
        <BottomBar>
          <button
            className="btn-primary w-full"
            disabled={chosen === null}
            onClick={() => {
              if (chosen === null) return;
              const correct = r.options[chosen].correct;
              submit({ correct, grade: correct ? 'good' : 'again', response: r.options[chosen].text }, { chosen });
            }}
          >
            Sjekk svar
          </button>
        </BottomBar>
      )}

      {r.kind === 'flashcard' && (
        <BottomBar>
          {!flipped ? (
            <button className="btn-primary w-full" onClick={() => setFlipped(true)}>
              Vis svar
            </button>
          ) : (
            <div>
              <p className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">Hvor godt husket du det?</p>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['again', 'Glemt', 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'],
                    ['hard', 'Vanskelig', 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'],
                    ['good', 'Bra', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'],
                    ['easy', 'Lett', 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'],
                  ] as const
                ).map(([g, label, cls]) => (
                  <button
                    key={g}
                    className={`rounded-xl py-3 text-sm font-semibold transition active:scale-95 motion-reduce:transition-none ${cls}`}
                    onClick={async () => {
                      const o: Outcome = { correct: g !== 'again', grade: g, response: g };
                      if (submitting.current) return;
                      submitting.current = true;
                      await onSubmit(o);
                      onNext(o);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </BottomBar>
      )}

      {answered && r.kind !== 'flashcard' && (
        <FeedbackSheet r={r} phase={phase} onNext={() => onNext(phase.outcome)} onReport={() => onReport(promptText(r))} />
      )}
    </div>
  );
}

function Meta({ r }: { r: Rendered }) {
  const level = ['', 'Bruk verktøyet', 'Velg verktøyet', 'Rotete case'][r.skillLevel];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
      {r.kind !== 'flashcard' && (
        <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Nivå {r.skillLevel} · {level}
        </span>
      )}
      {!r.verified && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          Ikke kontrollert
        </span>
      )}
    </div>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="safe-bottom border-t border-slate-200 bg-slate-50/95 px-5 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

function FeedbackSheet({
  r,
  phase,
  onNext,
  onReport,
}: {
  r: Exclude<Rendered, { kind: 'flashcard' }>;
  phase: Extract<Phase, { t: 'feedback' }>;
  onNext: () => void;
  onReport: () => void;
}) {
  const { outcome, result } = phase;
  const ok = outcome.correct;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  const shownSolution = outcome.response === '(vis løsning)';

  return (
    <div
      className={`safe-bottom max-h-[72vh] overflow-y-auto rounded-t-3xl border-t-4 px-5 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] motion-safe:animate-slideup ${
        ok
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
          : 'border-rose-500 bg-rose-50 dark:bg-[#2a0d14]'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {ok ? <CheckIcon /> : <CloseIcon />}
          </span>
          <h2 className={`text-xl font-bold ${ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200'}`}>
            {ok ? 'Riktig!' : shownSolution ? 'Slik løses den' : 'Ikke helt'}
          </h2>
          {result && result.xp > 0 && (
            <span className="ml-auto rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-semibold text-indigo-700 motion-safe:animate-pop dark:bg-black/30 dark:text-indigo-300">
              +{result.xp} XP
            </span>
          )}
        </div>

        {result?.masteredNow && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 motion-safe:animate-pop dark:bg-amber-900/40 dark:text-amber-200">
            <StarIcon className="h-4 w-4" /> Mestret! Du har husket denne over tid.
          </div>
        )}

        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
          {r.kind === 'numeric' && (
            <p>
              {!ok && phase.value !== undefined && (
                <>
                  Ditt svar: <strong className="tabular-nums">{formatNumber(phase.value)}</strong>.{' '}
                </>
              )}
              Riktig svar: <strong className="tabular-nums">{formatNumber(r.answer, r.decimals)}{r.unit ? ` ${r.unit}` : ''}</strong>
            </p>
          )}

          {r.kind === 'numeric' && phase.misconception && (
            <div className="rounded-xl bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              <Inline text={phase.misconception} />
            </div>
          )}

          {r.kind === 'mcq' && phase.chosen !== undefined && (
            <>
              {r.options[phase.chosen].feedback && (
                <div className={ok ? '' : 'rounded-xl bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'}>
                  <Inline text={r.options[phase.chosen].feedback!} />
                </div>
              )}
              {!ok && (
                <p>
                  Riktig svar: <strong><Inline text={r.options.find((o) => o.correct)!.text} /></strong>
                  {r.options.find((o) => o.correct)!.feedback && (
                    <>
                      {' – '}
                      <Inline text={r.options.find((o) => o.correct)!.feedback!.replace(/^Riktig\.\s*/, '')} />
                    </>
                  )}
                </p>
              )}
            </>
          )}

          {r.kind === 'truefalse' && (
            <p>
              Påstanden er <strong>{r.answer ? 'sann' : 'usann'}</strong>. <Inline text={r.explanation} />
            </p>
          )}

          {r.kind === 'numeric' && r.steps.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Løsning</div>
              <ol className="space-y-1.5">
                {r.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-[11px] font-semibold text-slate-500 dark:bg-black/30">
                      {i + 1}
                    </span>
                    <span className="tabular-nums">
                      <Inline text={s} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(r.kind === 'numeric' || r.kind === 'mcq') && r.explanation && <Markup text={r.explanation} />}

          {r.figure && r.figureShow === 'feedback' && <Figure figure={r.figure} />}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onReport}
            className="flex items-center gap-1.5 rounded-xl px-2 py-3 text-sm text-slate-500 dark:text-slate-400"
          >
            <FlagIcon className="h-4 w-4" /> Meld feil
          </button>
          <button ref={btn} onClick={onNext} className={`btn-primary flex-1 ${ok ? '!bg-emerald-600' : '!bg-rose-600'}`}>
            Fortsett
          </button>
        </div>
      </div>
    </div>
  );
}
