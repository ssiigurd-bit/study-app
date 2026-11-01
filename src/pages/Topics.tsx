// Temaer per delemne med fremgang. Her kan du også velge å øve på ett bestemt tema.
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { getCourse } from '../content/load';
import { getCardMap, getSettings } from '../db/db';
import { isMastered } from '../lib/scheduler';

export default function Topics() {
  const data = useLiveQuery(async () => {
    const settings = await getSettings();
    const course = getCourse(settings.courseId);
    return { course, cards: await getCardMap(course.spec.id) };
  });
  if (!data) return null;
  const { course, cards } = data;
  const now = Date.now();

  return (
    <div className="mx-auto max-w-md px-5">
      <h1 className="text-2xl font-bold tracking-tight">Temaer</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Mestret = husket riktig over tid (minst ca. 10 dager). Alt innhold er ennå ikke kontrollert mot pensum.
      </p>
      {course.delemner.map((d, di) => (
        <section key={d.id} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Delemne {di + 1} · {d.title}
          </h2>
          <div className="mt-2 space-y-3">
            {d.topics.map((t) => {
              const total = t.items.length;
              let seen = 0;
              let mastered = 0;
              let due = 0;
              for (const it of t.items) {
                const c = cards.get(it.key);
                if (!c) continue;
                seen++;
                if (isMastered(c)) mastered++;
                if (c.due <= now) due++;
              }
              return (
                <div key={t.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{t.title}</h3>
                      {t.summary && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.summary}</p>}
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
                    <div className="relative h-full" style={{ width: `${(seen / total) * 100}%` }}>
                      <div className="absolute inset-0 rounded-full bg-indigo-300 dark:bg-indigo-800" />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: seen ? `${(mastered / seen) * 100}%` : 0 }} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {seen}/{total} startet · {mastered} mestret{due ? ` · ${due} forfalt` : ''}
                    </span>
                    <Link to={`/okt?tema=${t.id}`} className="rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Øv på dette
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
