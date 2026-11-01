// Gjør en oppgave fra innholdsfilen om til en konkret oppgave med tall, svar og løsning.
import { evalList, evalNumber, evaluate, ExprError, type Scope } from '../lib/expr';
import { round } from '../lib/finance';
import { formatNumber, parseNumberInput, withinTolerance, type Tolerance } from '../lib/numbers';
import type { LoadedItem } from './load';
import type { FigureSpec } from './schema';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ResolvedFigure =
  | { kind: 'balance'; title?: string; assets: { label: string; value: number }[]; claims: { label: string; value: number; type: 'ek' | 'gjeld' }[] }
  | { kind: 'timeline'; title?: string; flows: number[]; rate?: number }
  | { kind: 'cvp'; title?: string; price: number; vc: number; fc: number; volume?: number };

interface Common {
  itemKey: string;
  seed: number;
  skillLevel: 1 | 2 | 3;
  verified: boolean;
  figure?: ResolvedFigure;
  figureShow: 'prompt' | 'feedback';
}

export type Rendered =
  | (Common & { kind: 'flashcard'; front: string; back: string })
  | (Common & {
      kind: 'mcq';
      prompt: string;
      options: { text: string; correct: boolean; feedback?: string }[];
      explanation?: string;
    })
  | (Common & {
      kind: 'numeric';
      prompt: string;
      answer: number;
      decimals: number;
      unit?: string;
      tolerance: Tolerance;
      steps: string[];
      explanation?: string;
      misconceptions: { value: number; feedback: string }[];
    })
  | (Common & { kind: 'truefalse'; statement: string; answer: boolean; explanation: string });

const MAX_ATTEMPTS = 500;

function sampleVar(spec: { min: number; max: number; step: number } | { choices: number[] }, rnd: () => number) {
  if ('choices' in spec) return spec.choices[Math.floor(rnd() * spec.choices.length)];
  const n = Math.floor((spec.max - spec.min) / spec.step + 1e-9) + 1;
  // Unngå flyttallsstøy som 0.07000000000000001.
  return round(spec.min + Math.floor(rnd() * n) * spec.step, 10);
}

/** Trekker tall til alle variabler og regner ut avledede verdier, til alle krav er oppfylt. */
export function generateScope(item: LoadedItem, seed: number): Scope {
  const rnd = mulberry32(seed);
  const varNames = Object.keys(item.vars);
  if (varNames.length === 0 && Object.keys(item.derived).length === 0) return {};
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const scope: Scope = {};
    for (const name of varNames) scope[name] = sampleVar(item.vars[name], rnd);
    for (const [name, expr] of Object.entries(item.derived)) scope[name] = evaluate(expr, scope);
    if (item.constraints.every((c) => evalNumber(c, scope) === 1)) return scope;
  }
  throw new ExprError(`Fant ikke tall som oppfyller kravene i oppgaven «${item.id}» etter ${MAX_ATTEMPTS} forsøk`);
}

/**
 * Setter inn verdier i tekst. «{{FK}}» gir formatert tall, «{{r:4}}» gir 4 desimaler,
 * og det går an å regne direkte: «{{P - VEK}}».
 */
export function fillTemplate(text: string, scope: Scope): string {
  return text.replace(/\{\{([^{}]+?)\}\}/g, (_, inner: string) => {
    const m = /^(.*?)(?::\s*(\d+))?\s*$/.exec(inner)!;
    const v = evaluate(m[1].trim(), scope);
    const d = m[2] !== undefined ? parseInt(m[2], 10) : undefined;
    return Array.isArray(v) ? v.map((x) => formatNumber(x, d)).join('; ') : formatNumber(v, d);
  });
}

function resolveFigure(f: FigureSpec, scope: Scope): ResolvedFigure {
  switch (f.kind) {
    case 'balance':
      return {
        kind: 'balance',
        title: f.title && fillTemplate(f.title, scope),
        assets: f.assets.map((a) => ({ label: fillTemplate(a.label, scope), value: evalNumber(a.value, scope) })),
        claims: f.claims.map((c) => ({ label: fillTemplate(c.label, scope), value: evalNumber(c.value, scope), type: c.type })),
      };
    case 'timeline':
      return {
        kind: 'timeline',
        title: f.title && fillTemplate(f.title, scope),
        flows: evalList(f.flows, scope),
        rate: f.rate === undefined ? undefined : evalNumber(f.rate, scope),
      };
    case 'cvp':
      return {
        kind: 'cvp',
        title: f.title && fillTemplate(f.title, scope),
        price: evalNumber(f.price, scope),
        vc: evalNumber(f.vc, scope),
        fc: evalNumber(f.fc, scope),
        volume: f.volume === undefined ? undefined : evalNumber(f.volume, scope),
      };
  }
}

/** Figur uten tilfeldige tall (introkort). */
export function instantiateFigure(f: FigureSpec): ResolvedFigure {
  return resolveFigure(f, {});
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function truthy(v: boolean | string, scope: Scope): boolean {
  return typeof v === 'boolean' ? v : evalNumber(v, scope) === 1;
}

export function instantiate(item: LoadedItem, seed: number): Rendered {
  const scope = generateScope(item, seed);
  const fill = (s: string) => fillTemplate(s, scope);
  const common: Common = {
    itemKey: item.key,
    seed,
    skillLevel: item.skillLevel,
    verified: item.verified,
    figure: item.figure && resolveFigure(item.figure, scope),
    figureShow: item.figureShow,
  };

  switch (item.type) {
    case 'flashcard':
      return { ...common, kind: 'flashcard', front: item.front, back: item.back };
    case 'truefalse':
      return {
        ...common,
        kind: 'truefalse',
        statement: fill(item.statement),
        answer: truthy(item.answer, scope),
        explanation: fill(item.explanation),
      };
    case 'mcq': {
      // Egen tallrekke for stokking, så samme frø gir samme rekkefølge.
      const rnd = mulberry32(seed ^ 0x9e3779b9);
      const options = item.options.map((o) => ({
        text: fill(o.text),
        correct: truthy(o.correct, scope),
        feedback: o.feedback && fill(o.feedback),
      }));
      return {
        ...common,
        kind: 'mcq',
        prompt: fill(item.prompt),
        options: shuffle(options, rnd),
        explanation: item.explanation && fill(item.explanation),
      };
    }
    case 'numeric': {
      const decimals = item.answer.decimals;
      const answer = round(evalNumber(item.answer.expr, scope), decimals);
      const tolerance: Tolerance = {
        abs: item.tolerance?.abs !== undefined ? evalNumber(item.tolerance.abs, scope) : Math.pow(10, -decimals),
        rel: item.tolerance?.rel ?? 0.005,
      };
      const misconceptions = item.misconceptions
        .map((m) => ({ value: evalNumber(m.expr, scope), feedback: fill(m.feedback) }))
        // En feiltolkning som gir samme tall som fasiten er ikke til hjelp.
        .filter((m) => Number.isFinite(m.value) && !withinTolerance(m.value, answer, tolerance));
      return {
        ...common,
        kind: 'numeric',
        prompt: fill(item.prompt),
        answer,
        decimals,
        unit: item.answer.unit,
        tolerance,
        steps: item.steps.map(fill),
        explanation: item.explanation && fill(item.explanation),
        misconceptions,
      };
    }
  }
}

export type NumericResult =
  | { status: 'invalid' }
  | { status: 'correct'; value: number }
  | { status: 'wrong'; value: number; misconception?: string };

export function checkNumeric(r: Extract<Rendered, { kind: 'numeric' }>, input: string): NumericResult {
  const value = parseNumberInput(input);
  if (value === null) return { status: 'invalid' };
  if (withinTolerance(value, r.answer, r.tolerance)) return { status: 'correct', value };
  const m = r.misconceptions.find((mc) => withinTolerance(value, mc.value, r.tolerance));
  return { status: 'wrong', value, misconception: m?.feedback };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
