// Kontrollerer alt innhold: skjema, kryssreferanser og at hver regnemal gir gyldige oppgaver.
import { describe, it, expect } from 'vitest';
import { courses, buildCourses, ContentError } from './load';
import { checkNumeric, instantiate } from './instantiate';
import { formatNumber } from '../lib/numbers';
import { withinTolerance } from '../lib/numbers';

const SEEDS = 1000;

function allText(r: ReturnType<typeof instantiate>): string[] {
  switch (r.kind) {
    case 'flashcard': return [r.front, r.back];
    case 'truefalse': return [r.statement, r.explanation];
    case 'mcq': return [r.prompt, r.explanation ?? '', ...r.options.flatMap((o) => [o.text, o.feedback ?? ''])];
    case 'numeric': return [r.prompt, r.explanation ?? '', ...r.steps, ...r.misconceptions.map((m) => m.feedback)];
  }
}

describe('innhold', () => {
  it('minst ett emne lastes', () => {
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0].spec.id).toBe('bok3430');
    expect(courses[0].topics.length).toBe(3);
  });

  for (const course of courses) {
    for (const topic of course.topics) {
      describe(`${course.spec.id} / ${topic.id}`, () => {
        for (const item of topic.items) {
          const isParam = Object.keys(item.vars).length > 0;
          const n = isParam ? SEEDS : 1;
          it(`${item.id} gir gyldige oppgaver (${n} varianter)`, () => {
            for (let seed = 1; seed <= n; seed++) {
              const r = instantiate(item, seed);
              for (const t of allText(r)) {
                expect(t, `${item.id} seed ${seed}`).not.toMatch(/\{\{|\}\}|NaN|Infinity|undefined/);
              }
              if (r.kind === 'mcq') {
                const correct = r.options.filter((o) => o.correct).length;
                expect(correct, `${item.id} seed ${seed}: antall riktige alternativ`).toBe(1);
                const texts = new Set(r.options.map((o) => o.text));
                expect(texts.size, `${item.id} seed ${seed}: like alternativ`).toBe(r.options.length);
              }
              if (r.kind === 'numeric') {
                expect(Number.isFinite(r.answer), `${item.id} seed ${seed}`).toBe(true);
                // Fasiten skrevet slik appen viser den må godkjennes av svarsjekken.
                const shown = formatNumber(r.answer, r.decimals);
                expect(checkNumeric(r, shown).status, `${item.id} seed ${seed}: ${shown}`).toBe('correct');
                for (const m of r.misconceptions) {
                  expect(withinTolerance(m.value, r.answer, r.tolerance)).toBe(false);
                }
              }
              if (r.figure?.kind === 'timeline') {
                expect(r.figure.flows.every(Number.isFinite)).toBe(true);
              }
              if (r.figure?.kind === 'balance') {
                const a = r.figure.assets.reduce((s, x) => s + x.value, 0);
                const c = r.figure.claims.reduce((s, x) => s + x.value, 0);
                expect(a, `${item.id}: balansen går ikke opp`).toBeCloseTo(c, 6);
              }
            }
          });
        }
      });
    }
  }

  it('introkort med balanse går opp', () => {
    for (const c of courses) for (const t of c.topics) for (const i of t.intro) {
      if (i.figure?.kind === 'balance') {
        const a = i.figure.assets.reduce((s, x) => s + Number(x.value), 0);
        const b = i.figure.claims.reduce((s, x) => s + Number(x.value), 0);
        expect(a, i.id).toBe(b);
      }
    }
  });
});

describe('innholdslaster', () => {
  const course = `id: test\ncode: T1\ntitle: Test\ndelemner:\n  - id: d1\n    title: D1\n    topics: [a]\n`;
  const topic = (extra = '') => `id: a\ntitle: A\n${extra}items:\n  - id: x\n    type: flashcard\n    front: F\n    back: B\n`;

  it('leser et gyldig minimumsemne', () => {
    const [c] = buildCourses({ '/content/courses/test/course.yaml': course, '/content/courses/test/a.yaml': topic() });
    expect(c.itemByKey.get('test:x')?.verified).toBe(false);
  });

  it('avviser ukjent forkunnskap', () => {
    expect(() =>
      buildCourses({ '/content/courses/test/course.yaml': course, '/content/courses/test/a.yaml': topic('prerequisites: [finnes-ikke]\n') }),
    ).toThrow(ContentError);
  });

  it('avviser tema som ikke finnes', () => {
    expect(() => buildCourses({ '/content/courses/test/course.yaml': course })).toThrow(ContentError);
  });

  it('avviser ugyldig oppgavetype med tydelig melding', () => {
    const bad = `id: a\ntitle: A\nitems:\n  - id: x\n    type: essay\n`;
    expect(() => buildCourses({ '/content/courses/test/course.yaml': course, '/content/courses/test/a.yaml': bad })).toThrow(/a\.yaml/);
  });
});
