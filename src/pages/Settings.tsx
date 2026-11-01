import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { db, deleteReport, getSettings, resetAllData, saveSettings } from '../db/db';
import { getTheme, setTheme, type ThemeChoice } from '../lib/theme';

export default function Settings() {
  const settings = useLiveQuery(getSettings);
  const reports = useLiveQuery(() => db.reports.orderBy('ts').reverse().toArray());
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme());
  const [copied, setCopied] = useState(false);

  return (
    <div className="mx-auto max-w-md space-y-6 px-5">
      <h1 className="text-2xl font-bold tracking-tight">Innstillinger</h1>

      <Section title="Utseende">
        <Segmented
          value={theme}
          options={[
            ['system', 'System'],
            ['light', 'Lys'],
            ['dark', 'Mørk'],
          ]}
          onChange={(v) => {
            setTheme(v);
            setThemeState(v);
          }}
        />
      </Section>

      <Section title="Dagens mål" hint="Antall oppgaver per dag. Streaken teller dager du når målet.">
        <Segmented
          value={String(settings?.dailyGoal ?? 10)}
          options={[
            ['5', '5'],
            ['10', '10'],
            ['15', '15'],
            ['20', '20'],
          ]}
          onChange={(v) => saveSettings({ dailyGoal: Number(v) })}
        />
      </Section>

      <Section title="Om innholdet">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Alle oppgaver og forklaringer er generert og <strong>ikke kontrollert</strong> mot pensum (Terje Berg, «Grunnleggende
          økonomistyring») eller forelesningene. Bruk «Meld feil» når noe ser galt ut – notatene samles her.
        </p>
      </Section>

      <Section title={`Feilmeldinger (${reports?.length ?? 0})`}>
        {reports && reports.length > 0 ? (
          <>
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded-2xl bg-slate-100 p-3 text-sm dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(r.ts).toLocaleString('nb-NO')} · {r.key}
                  </div>
                  <div className="mt-1 line-clamp-2 text-slate-500 dark:text-slate-400">{r.context}</div>
                  <div className="mt-1 font-medium">{r.text}</div>
                  <button className="mt-1 text-xs text-rose-600 dark:text-rose-400" onClick={() => deleteReport(r.id!)}>
                    Slett
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="btn-secondary mt-3 w-full text-sm"
              onClick={async () => {
                const text = reports
                  .map((r) => `[${r.key}] ${new Date(r.ts).toLocaleString('nb-NO')}\nOppgave: ${r.context}\nNotat: ${r.text}`)
                  .join('\n\n');
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  alert(text);
                }
              }}
            >
              {copied ? 'Kopiert!' : 'Kopier alle som tekst'}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Ingen ennå.</p>
        )}
      </Section>

      <Section title="Data" hint="All fremgang lagres bare på denne enheten.">
        <button
          className="w-full rounded-2xl border border-rose-200 py-3 text-sm font-semibold text-rose-600 dark:border-rose-900 dark:text-rose-400"
          onClick={async () => {
            if (confirm('Slette all fremgang, streak og feilmeldinger på denne enheten? Dette kan ikke angres.')) {
              await resetAllData();
            }
          }}
        >
          Nullstill all fremgang
        </button>
      </Section>

      <p className="pb-4 text-center text-xs text-slate-400">Study App · versjon {__APP_VERSION__}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-2xl bg-slate-200/70 p-1 dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-xl py-2 text-sm font-semibold transition motion-reduce:transition-none ${
            value === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
