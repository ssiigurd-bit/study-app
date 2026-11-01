// Kort forklaring før nytt stoff: én idé per kort.
import type { IntroSpec } from '../content/schema';
import { instantiateFigure } from '../content/instantiate';
import { Figure } from './figures/Figure';
import { FlagIcon } from './Icons';
import { Markup } from './Markup';

export function IntroView({ intro, onDone, onReport }: { intro: IntroSpec; onDone: () => void; onReport: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mx-auto max-w-md motion-safe:animate-slideup">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Nytt</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Ikke kontrollert</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{intro.title}</h2>
          <Markup text={intro.body} className="mt-3 space-y-3 text-[17px] leading-relaxed" />
          {intro.figure && <Figure figure={instantiateFigure(intro.figure)} />}
        </div>
      </div>
      <div className="safe-bottom border-t border-slate-200 px-5 pt-3 dark:border-slate-800">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button onClick={onReport} className="flex items-center gap-1.5 px-2 py-3 text-sm text-slate-500 dark:text-slate-400">
            <FlagIcon className="h-4 w-4" /> Meld feil
          </button>
          <button onClick={onDone} className="btn-primary flex-1" autoFocus>
            Skjønner – videre
          </button>
        </div>
      </div>
    </div>
  );
}
