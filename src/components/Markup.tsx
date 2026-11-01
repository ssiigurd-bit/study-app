// Enkel tekstformatering for innholdsfilene:
//   **fet**            → fet skrift
//   «- » først i linje → punktliste
//   «$ » først i linje → formel i egen boks
//   tom linje          → nytt avsnitt
import { Fragment, type ReactNode } from 'react';

/** «1 000 kr» skal aldri deles over to linjer: bruk hardt mellomrom mellom siffergrupper. */
export function keepNumbersTogether(text: string): string {
  return text.replace(/(\d) (?=\d{3}(?!\d))/g, '$1 ');
}

export function Inline({ text }: { text: string }) {
  const parts = keepNumbersTogether(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="my-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-center font-medium tracking-tight text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100">
      {children}
    </div>
  );
}

export function Markup({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={className ?? 'space-y-3 leading-relaxed'}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.slice(2)} />
                </li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => l.startsWith('$ '))) {
          return (
            <div key={i}>
              {lines.map((l, j) => (
                <Formula key={j}>
                  <Inline text={l.slice(2)} />
                </Formula>
              ))}
            </div>
          );
        }
        return (
          <p key={i}>
            <Inline text={lines.join(' ')} />
          </p>
        );
      })}
    </div>
  );
}
