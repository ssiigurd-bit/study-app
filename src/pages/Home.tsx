// Hjem: én stor knapp. Klar til bruk med en gang – tallene fylles inn når de er lest.
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { getCourse } from '../content/load';
import { getCardMap, getProfile, getSettings } from '../db/db';
import { dayKey } from '../lib/dates';
import { displayedStreak, levelInfo } from '../lib/progress';
import { FlameIcon, SnowIcon } from '../components/Icons';

export default function Home() {
  const data = useLiveQuery(async () => {
    const settings = await getSettings();
    const course = getCourse(settings.courseId);
    const [cards, profile] = await Promise.all([getCardMap(course.spec.id), getProfile()]);
    const now = Date.now();
    let due = 0;
    for (const c of cards.values()) if (c.due <= now) due++;
    const total = course.itemByKey.size;
    return { settings, course, profile, due, unseen: total - cards.size };
  });

  const goal = data?.settings.dailyGoal ?? 10;
  const answered = data?.profile.dayAnswered ?? 0;
  const pct = Math.min(1, answered / goal);
  const streak = data ? displayedStreak(data.profile, dayKey()) : 0;
  const lvl = levelInfo(data?.profile.xp ?? 0);
  const goalMet = data?.profile.goalMetToday ?? false;

  return (
    <div className="mx-auto flex max-w-md flex-col px-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{data?.course.spec.code ?? ' '}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{data?.course.spec.title ?? ' '}</div>
        </div>
        <div className="flex items-center gap-2">
          {(data?.profile.freezes ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300" title="Streakfrys">
              <SnowIcon className="h-4 w-4" />
              {data!.profile.freezes}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
              streak > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800'
            }`}
            title="Streak"
          >
            <FlameIcon className="h-4 w-4" />
            {streak}
          </span>
        </div>
      </header>

      <section className="mt-10 flex flex-col items-center">
        <GoalRing pct={pct} answered={answered} goal={goal} />
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {goalMet ? 'Dagens mål er nådd. Alt videre er bonus.' : 'Dagens mål'}
        </p>
      </section>

      <Link
        to="/okt"
        className="mt-8 flex h-20 items-center justify-center rounded-3xl bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] dark:bg-indigo-500 motion-reduce:transition-none"
      >
        {goalMet ? 'Én økt til' : 'Start økt'}
      </Link>
      <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
        {data ? (
          <>
            {data.due} til repetisjon · {data.unseen} nye igjen · ca. 3 min
          </>
        ) : (
          ' '
        )}
      </p>

      <section className="card mt-10">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Nivå {lvl.level}</span>
          <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {lvl.into} / {lvl.span} XP
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
        </div>
        {data && data.profile.longestStreak > 0 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Lengste streak: {data.profile.longestStreak} dager</p>
        )}
      </section>
    </div>
  );
}

function GoalRing({ pct, answered, goal }: { pct: number; answered: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} strokeWidth="10" className="fill-none stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={r}
          strokeWidth="10"
          strokeLinecap="round"
          className={`fill-none transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none ${pct >= 1 ? 'stroke-emerald-500' : 'stroke-indigo-500'}`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{Math.min(answered, goal)}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">av {goal} oppgaver</span>
      </div>
    </div>
  );
}
