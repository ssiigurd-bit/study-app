// En økt: 2–5 minutter, kan avbrytes når som helst – hvert svar er lagret med en gang.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCourse, type LoadedCourse } from '../content/load';
import { instantiate, randomSeed, type Rendered } from '../content/instantiate';
import { getCardMap, getProfile, getSeenIntros, getSettings, markIntroSeen, recordAnswer, type AnswerResult } from '../db/db';
import { buildSession, type SessionStep } from '../lib/session';
import { displayedStreak } from '../lib/progress';
import { dayKey } from '../lib/dates';
import { ItemPlayer, type Outcome } from '../components/ItemPlayer';
import { IntroView } from '../components/IntroView';
import { ReportSheet } from '../components/ReportSheet';
import { CheckIcon, CloseIcon, FlameIcon } from '../components/Icons';

type PlayStep = SessionStep & { uid: string; seed: number; requeued?: boolean };

interface Stats {
  answered: number;
  correct: number;
  xp: number;
  mastered: number;
  goalJustMet: boolean;
  streak: number;
  dayAnswered: number;
  dailyGoal: number;
}

/** Hvor mange steg senere en feilbesvart oppgave kommer igjen i samme økt. */
const REQUEUE_GAP = 3;

export default function Session() {
  const [params] = useSearchParams();
  const topicId = params.get('tema') ?? undefined;
  // Forhåndsvisning av én oppgave (for deg som skriver innhold). Lagrer ingenting.
  const previewId = params.get('oppgave') ?? undefined;
  const navigate = useNavigate();
  const [course, setCourse] = useState<LoadedCourse | null>(null);
  const [steps, setSteps] = useState<PlayStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState<Stats>({ answered: 0, correct: 0, xp: 0, mastered: 0, goalJustMet: false, streak: 0, dayAnswered: 0, dailyGoal: 10 });
  const [report, setReport] = useState<{ key: string; context: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getSettings();
      const c = getCourse(settings.courseId);
      const [cards, seenIntros, profile] = await Promise.all([getCardMap(c.spec.id), getSeenIntros(), getProfile()]);
      const previewItem = previewId ? c.itemByKey.get(`${c.spec.id}:${previewId}`) : undefined;
      const built: SessionStep[] = previewId
        ? previewItem
          ? [{ type: 'item', item: previewItem, isNew: false }]
          : []
        : buildSession(c, cards, new Date(), { topicId, newToday: profile.dayNew, seenIntros });
      if (cancelled) return;
      setCourse(c);
      // Unik id per lasting, så en ny økt aldri gjenbruker forrige oppgave på skjermen.
      const loadId = Date.now().toString(36);
      setSteps(built.map((s, i) => ({ ...s, uid: `${loadId}-${i}`, seed: randomSeed() })));
      setIndex(0);
      setStats((st) => ({ ...st, streak: displayedStreak(profile, dayKey()), dayAnswered: profile.dayAnswered, dailyGoal: settings.dailyGoal }));
    })();
    return () => {
      cancelled = true;
    };
  }, [round, topicId, previewId]);

  const step = steps?.[index];
  const rendered = useMemo<Rendered | Error | null>(() => {
    if (!step || step.type !== 'item') return null;
    try {
      return instantiate(step.item, step.seed);
    } catch (e) {
      return e as Error;
    }
  }, [step?.uid]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [step?.uid]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!steps || !course) return <div className="min-h-[100dvh]" />;

  const finished = index >= steps.length;
  const progress = steps.length ? Math.min(1, index / steps.length) : 1;

  async function handleSubmit(o: Outcome): Promise<AnswerResult> {
    if (!step || step.type !== 'item') throw new Error('Ingen oppgave');
    if (previewId) return { xp: 0, masteredNow: false, goalJustMet: false, profile: await getProfile() };
    const r = await recordAnswer({
      key: step.item.key,
      courseId: step.item.courseId,
      topicId: step.item.topicId,
      kind: step.item.type,
      skillLevel: step.item.skillLevel,
      grade: o.grade,
      correct: o.correct,
      response: o.response,
      seed: step.seed,
      ms: Date.now() - shownAt.current,
    });
    setStats((s) => ({
      ...s,
      answered: s.answered + 1,
      correct: s.correct + (o.correct ? 1 : 0),
      xp: s.xp + r.xp,
      mastered: s.mastered + (r.masteredNow ? 1 : 0),
      goalJustMet: s.goalJustMet || r.goalJustMet,
      streak: r.profile.streak > 0 && r.profile.goalMetToday ? r.profile.streak : s.streak,
      dayAnswered: r.profile.dayAnswered,
    }));
    return r;
  }

  function handleNext(o: Outcome) {
    if (step && step.type === 'item' && !o.correct && !step.requeued) {
      // Prøv igjen litt senere i økta, med nye tall.
      const again: PlayStep = { ...step, uid: step.uid + 'r', seed: randomSeed(), requeued: true, isNew: false };
      setSteps((prev) => {
        const next = [...prev!];
        next.splice(Math.min(index + 1 + REQUEUE_GAP, next.length), 0, again);
        return next;
      });
    }
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="safe-top px-4 pb-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Avslutt økta"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <CloseIcon />
          </button>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </header>

      {finished ? (
        <Done stats={stats} empty={steps.length === 0} onHome={() => navigate('/')} onMore={() => setRound((r) => r + 1)} />
      ) : step!.type === 'intro' ? (
        <IntroView
          key={step!.uid}
          intro={step!.intro}
          onDone={() => {
            markIntroSeen(step!.intro.id);
            setIndex((i) => i + 1);
          }}
          onReport={() => setReport({ key: `${course.spec.id}:intro:${step!.intro.id}`, context: step!.intro.title })}
        />
      ) : rendered instanceof Error ? (
        <div className="mx-auto max-w-md flex-1 px-5">
          <div className="card text-sm">
            <p className="font-semibold">Denne oppgaven har en feil i innholdsfilen.</p>
            <p className="mt-2 text-slate-500">{rendered.message}</p>
            <button className="btn-primary mt-4 w-full" onClick={() => setIndex((i) => i + 1)}>
              Hopp over
            </button>
          </div>
        </div>
      ) : (
        rendered && (
          <ItemPlayer
            key={step!.uid}
            r={rendered}
            onSubmit={handleSubmit}
            onNext={handleNext}
            onReport={(context) => step!.type === 'item' && setReport({ key: step!.item.key, context })}
          />
        )
      )}

      {report && (
        <ReportSheet
          itemKey={report.key}
          context={report.context}
          onClose={(saved) => {
            setReport(null);
            if (saved) setToast('Lagret. Takk!');
          }}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center motion-safe:animate-pop">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-slate-900">{toast}</div>
        </div>
      )}
    </div>
  );
}

function Done({ stats, empty, onHome, onMore }: { stats: Stats; empty: boolean; onHome: () => void; onMore: () => void }) {
  const pct = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  return (
    <div className="flex-1 overflow-y-auto px-5">
      <div className="mx-auto flex max-w-md flex-col items-center pt-6 text-center motion-safe:animate-pop">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <CheckIcon className="h-10 w-10" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">{empty ? 'Alt er gjort' : 'Ferdig for nå'}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {empty
            ? 'Ingenting å øve på akkurat nå. Repetisjonene kommer tilbake når de er nyttige.'
            : 'Fint å stoppe her. Det du har øvd på, kommer tilbake akkurat når det er nyttig å repetere.'}
        </p>

        {!empty && (
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <Stat label="Oppgaver" value={String(stats.answered)} />
            <Stat label="Riktige" value={`${pct} %`} />
            <Stat label="XP" value={`+${stats.xp}`} />
            <Stat label="Mestret nå" value={String(stats.mastered)} highlight={stats.mastered > 0} />
          </div>
        )}

        <div className="mt-4 w-full rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {stats.goalJustMet ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <FlameIcon className="h-4 w-4" /> Dagens mål er nådd! Streak: {stats.streak} {stats.streak === 1 ? 'dag' : 'dager'}
            </span>
          ) : stats.dayAnswered >= stats.dailyGoal ? (
            <span>Dagens mål er allerede nådd. Bra jobba.</span>
          ) : (
            <span>
              {stats.dayAnswered} av {stats.dailyGoal} oppgaver mot dagens mål.
            </span>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 pb-8">
          <button className="btn-primary w-full" onClick={onHome} autoFocus>
            Ferdig
          </button>
          {!empty && (
            <button className="btn-secondary w-full" onClick={onMore}>
              Én runde til
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card !p-4 ${highlight ? '!ring-amber-400' : ''}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
