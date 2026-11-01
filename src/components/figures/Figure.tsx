// Figurer som kobler tall og bilde (dobbel koding): balanse, kontantstrøm og nullpunkt.
import type { ResolvedFigure } from '../../content/instantiate';
import { formatNumber } from '../../lib/numbers';

export function Figure({ figure }: { figure: ResolvedFigure }) {
  return (
    <figure className="my-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-950/50 dark:ring-slate-800">
      {figure.title && <figcaption className="mb-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{figure.title}</figcaption>}
      {figure.kind === 'balance' && <BalanceFigure f={figure} />}
      {figure.kind === 'timeline' && <TimelineFigure f={figure} />}
      {figure.kind === 'cvp' && <CvpFigure f={figure} />}
    </figure>
  );
}

const fmt = (x: number) => formatNumber(Math.round(x));

function BalanceFigure({ f }: { f: Extract<ResolvedFigure, { kind: 'balance' }> }) {
  const sumA = f.assets.reduce((s, a) => s + a.value, 0);
  const sumC = f.claims.reduce((s, c) => s + c.value, 0);
  const total = Math.max(sumA, sumC, 1);
  const H = 200;
  const col = (rows: { label: string; value: number; cls: string }[], sum: number, title: string) => (
    <div className="flex-1">
      <div className="mb-1 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</div>
      <div className="flex flex-col gap-0.5 overflow-hidden rounded-xl">
        {rows
          .filter((r) => r.value > 0)
          .map((r) => (
            <div
              key={r.label}
              className={`flex items-center justify-between gap-1 px-2 text-[11px] leading-tight ${r.cls}`}
              style={{ minHeight: 28, height: (r.value / total) * H }}
            >
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums">{fmt(r.value)}</span>
            </div>
          ))}
      </div>
      <div className="mt-1 text-center text-xs font-semibold tabular-nums">Sum {fmt(sum)}</div>
    </div>
  );
  return (
    <div className="flex gap-2">
      {col(
        f.assets.map((a) => ({ ...a, cls: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-100' })),
        sumA,
        'Eiendeler',
      )}
      {col(
        f.claims.map((c) => ({
          ...c,
          cls:
            c.type === 'ek'
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
        })),
        sumC,
        'Egenkapital og gjeld',
      )}
    </div>
  );
}

function TimelineFigure({ f }: { f: Extract<ResolvedFigure, { kind: 'timeline' }> }) {
  const W = 320;
  const n = f.flows.length;
  const max = Math.max(...f.flows.map(Math.abs), 1);
  const axisY = 82;
  const barMax = 46;
  const x = (t: number) => 34 + (t * (W - 68)) / Math.max(n - 1, 1);
  return (
    <svg viewBox={`0 0 ${W} 170`} className="w-full" role="img" aria-label="Kontantstrøm over tid">
      {f.rate !== undefined && (
        <text x={4} y={12} className="fill-slate-500 text-[10px] dark:fill-slate-400">
          r = {formatNumber(f.rate * 100, f.rate * 100 === Math.round(f.rate * 100) ? 0 : 1)} %
        </text>
      )}
      <line x1={14} x2={W - 14} y1={axisY} y2={axisY} className="stroke-slate-400" strokeWidth={1.5} />
      {f.flows.map((v, t) => {
        const h = (Math.abs(v) / max) * barMax;
        const pos = v >= 0;
        return (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={axisY - 3} y2={axisY + 3} className="stroke-slate-400" />
            {v !== 0 && (
              <rect
                x={x(t) - 9}
                width={18}
                y={pos ? axisY - h : axisY}
                height={h}
                rx={3}
                className={pos ? 'fill-emerald-500' : 'fill-rose-500'}
              />
            )}
            {v !== 0 && (
              <text
                x={x(t)}
                y={pos ? axisY - h - 5 : axisY + h + 12}
                textAnchor="middle"
                className="fill-slate-700 text-[9.5px] tabular-nums dark:fill-slate-200"
              >
                {formatNumber(Math.round(v))}
              </text>
            )}
            <text x={x(t)} y={164} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">
              År {t}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CvpFigure({ f }: { f: Extract<ResolvedFigure, { kind: 'cvp' }> }) {
  const W = 320;
  const H = 200;
  const m = { l: 14, r: 12, t: 14, b: 24 };
  const db = f.price - f.vc;
  const x0 = db > 0 ? f.fc / db : NaN;
  const xMax = Math.max(f.volume ?? 0, Number.isFinite(x0) ? x0 : 0) * 1.35 || 100;
  const yMax = Math.max(f.price * xMax, f.fc + f.vc * xMax) * 1.05;
  const sx = (v: number) => m.l + (v / xMax) * (W - m.l - m.r);
  const sy = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Kostnad-volum-resultat-diagram">
        {f.volume !== undefined && Number.isFinite(x0) && f.volume > x0 && (
          <rect x={sx(x0)} y={m.t} width={sx(f.volume) - sx(x0)} height={H - m.t - m.b} className="fill-emerald-500/10" />
        )}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="stroke-slate-400" />
        <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} className="stroke-slate-400" />
        <line x1={sx(0)} y1={sy(f.fc)} x2={sx(xMax)} y2={sy(f.fc)} className="stroke-slate-400" strokeDasharray="4 4" />
        <line x1={sx(0)} y1={sy(f.fc)} x2={sx(xMax)} y2={sy(f.fc + f.vc * xMax)} className="stroke-rose-500" strokeWidth={2.5} />
        <line x1={sx(0)} y1={sy(0)} x2={sx(xMax)} y2={sy(f.price * xMax)} className="stroke-indigo-500" strokeWidth={2.5} />
        {Number.isFinite(x0) && (
          <g>
            <line x1={sx(x0)} x2={sx(x0)} y1={sy(f.price * x0)} y2={H - m.b} className="stroke-slate-400" strokeDasharray="2 3" />
            <circle cx={sx(x0)} cy={sy(f.price * x0)} r={4.5} className="fill-amber-400 stroke-white dark:stroke-slate-900" strokeWidth={1.5} />
            <text x={sx(x0) - 6} y={sy(f.price * x0) - 8} textAnchor="end" className="fill-slate-700 text-[10px] font-semibold dark:fill-slate-200">
              Nullpunkt {formatNumber(Math.round(x0))}
            </text>
          </g>
        )}
        {f.volume !== undefined && (
          <g>
            <line x1={sx(f.volume)} x2={sx(f.volume)} y1={m.t} y2={H - m.b} className="stroke-emerald-600" strokeDasharray="4 3" />
            <text x={sx(f.volume) - 4} y={m.t + 10} textAnchor="end" className="fill-emerald-700 text-[10px] dark:fill-emerald-400">
              Budsjett {formatNumber(f.volume)}
            </text>
          </g>
        )}
        <text x={W - m.r} y={H - m.b + 12} textAnchor="end" className="fill-slate-500 text-[9px]">Mengde →</text>
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
        <Legend cls="bg-indigo-500" label="Inntekter" />
        <Legend cls="bg-rose-500" label="Totale kostnader" />
        <Legend cls="bg-slate-400" label="Faste kostnader" />
        {f.volume !== undefined && <Legend cls="bg-emerald-500/40" label="Sikkerhetsmargin" />}
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-3 rounded-sm ${cls}`} />
      {label}
    </span>
  );
}
