// «Meld feil / Jeg er uenig»: lagrer et notat lokalt, så du kan sjekke mot pensum senere.
import { useState } from 'react';
import { addReport } from '../db/db';

export function ReportSheet({ itemKey, context, onClose }: { itemKey: string; context: string; onClose: (saved: boolean) => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 motion-safe:animate-pop" onClick={() => onClose(false)}>
      <div
        className="safe-bottom w-full rounded-t-3xl bg-white px-5 pt-5 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <div className="mx-auto max-w-md">
          <h2 id="report-title" className="text-lg font-bold">Meld feil / Jeg er uenig</h2>
          <p className="mt-1 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{context}</p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Hva er feil? F.eks. «Berg bruker en annen formel» eller «svaret skal være …»"
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[15px] outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lagres bare på denne enheten. Du finner notatene under Innstillinger.</p>
          <div className="mt-3 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => onClose(false)}>
              Avbryt
            </button>
            <button
              className="btn-primary flex-1"
              disabled={!text.trim() || saving}
              onClick={async () => {
                setSaving(true);
                await addReport({ key: itemKey, text: text.trim(), context });
                onClose(true);
              }}
            >
              Lagre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
