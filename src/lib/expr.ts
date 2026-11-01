// En liten, sikker formelmotor for oppgavemaler i innholdsfilene.
// Ingen eval: formelen tolkes til et tre og regnes ut med en fast liste funksjoner.
//
// Støtter: tall, variabler, + − * / ^, parenteser, lister [a, b, c],
// sammenligning (== != < <= > >=), && || ! og funksjonskall.
// Sannhetsverdier er 1 (sann) og 0 (usann).

import * as fin from './finance';

export type Value = number | number[];
export type Scope = Record<string, Value>;

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; name: string; args: Node[] }
  | { t: 'list'; items: Node[] };

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

export class ExprError extends Error {}

const OPS = ['==', '!=', '<=', '>=', '&&', '||', '+', '-', '*', '/', '^', '(', ')', '[', ']', ',', '<', '>', '!'];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new ExprError(`Ugyldig tall ved posisjon ${i} i "${src}"`);
      out.push({ k: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_æøåÆØÅ]/.test(c)) {
      const m = /^[A-Za-z_æøåÆØÅ][A-Za-z0-9_æøåÆØÅ]*/.exec(src.slice(i))!;
      out.push({ k: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`Ukjent tegn "${c}" i "${src}"`);
    out.push({ k: 'op', v: op });
    i += op.length;
  }
  return out;
}

// Bindestyrke for binære operatorer (høyere = binder sterkere).
const BIN: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3,
  '+': 4, '-': 4,
  '*': 5, '/': 5,
  '^': 7,
};
const UNARY_BP = 6;

class Parser {
  private p = 0;
  constructor(private toks: Tok[], private src: string) {}

  parse(): Node {
    const n = this.expr(0);
    if (this.p < this.toks.length) throw new ExprError(`Uventet innhold i "${this.src}"`);
    return n;
  }

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }

  private expect(op: string) {
    const t = this.toks[this.p++];
    if (!t || t.k !== 'op' || t.v !== op) throw new ExprError(`Forventet "${op}" i "${this.src}"`);
  }

  private expr(minBp: number): Node {
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      if (!t || t.k !== 'op' || !(t.v in BIN)) break;
      const bp = BIN[t.v];
      if (bp < minBp) break;
      this.p++;
      // ^ er høyreassosiativ, resten venstreassosiative.
      const right = this.expr(t.v === '^' ? bp : bp + 1);
      left = { t: 'bin', op: t.v, a: left, b: right };
    }
    return left;
  }

  private list(close: string): Node[] {
    const items: Node[] = [];
    const t = this.peek();
    if (t && t.k === 'op' && t.v === close) {
      this.p++;
      return items;
    }
    for (;;) {
      items.push(this.expr(0));
      const n = this.toks[this.p++];
      if (n && n.k === 'op' && n.v === close) return items;
      if (!n || n.k !== 'op' || n.v !== ',') throw new ExprError(`Forventet "," eller "${close}" i "${this.src}"`);
    }
  }

  private prefix(): Node {
    const t = this.toks[this.p++];
    if (!t) throw new ExprError(`Formelen slutter for tidlig: "${this.src}"`);
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      const n = this.peek();
      if (n && n.k === 'op' && n.v === '(') {
        this.p++;
        return { t: 'call', name: t.v, args: this.list(')') };
      }
      return { t: 'var', name: t.v };
    }
    if (t.v === '(') {
      const e = this.expr(0);
      this.expect(')');
      return e;
    }
    if (t.v === '[') return { t: 'list', items: this.list(']') };
    if (t.v === '-' || t.v === '+' || t.v === '!') {
      return { t: 'un', op: t.v, a: this.expr(UNARY_BP) };
    }
    throw new ExprError(`Uventet "${t.v}" i "${this.src}"`);
  }
}

const cache = new Map<string, Node>();

export function parse(src: string): Node {
  let n = cache.get(src);
  if (!n) {
    n = new Parser(tokenize(src), src).parse();
    cache.set(src, n);
  }
  return n;
}

function num(v: Value, ctx: string): number {
  if (typeof v !== 'number') throw new ExprError(`Forventet et tall, fikk en liste (${ctx})`);
  return v;
}

function list(v: Value, ctx: string): number[] {
  if (!Array.isArray(v)) throw new ExprError(`Forventet en liste (${ctx})`);
  return v;
}

const FUNCS: Record<string, (args: Value[]) => Value> = {
  df: ([r, n]) => fin.df(num(r, 'df'), num(n, 'df')),
  fv: ([k, r, n]) => fin.fv(num(k, 'fv'), num(r, 'fv'), num(n, 'fv')),
  pv: ([k, r, n]) => fin.pv(num(k, 'pv'), num(r, 'pv'), num(n, 'pv')),
  af: ([r, n]) => fin.af(num(r, 'af'), num(n, 'af')),
  npv: ([r, flows]) => fin.npv(num(r, 'npv'), list(flows, 'npv')),
  irr: ([flows]) => fin.irr(list(flows, 'irr')),
  effRate: ([r, m]) => fin.effRate(num(r, 'effRate'), num(m, 'effRate')),
  round: ([x, d]) => fin.round(num(x, 'round'), d === undefined ? 0 : num(d, 'round')),
  ceil: ([x]) => { const v = num(x, 'ceil'); return Math.ceil(v - 1e-9 * Math.max(1, Math.abs(v))); },
  floor: ([x]) => { const v = num(x, 'floor'); return Math.floor(v + 1e-9 * Math.max(1, Math.abs(v))); },
  abs: ([x]) => Math.abs(num(x, 'abs')),
  sqrt: ([x]) => Math.sqrt(num(x, 'sqrt')),
  min: (a) => Math.min(...a.map((x) => num(x, 'min'))),
  max: (a) => Math.max(...a.map((x) => num(x, 'max'))),
  sum: ([l]) => list(l, 'sum').reduce((s, x) => s + x, 0),
};

export const FUNCTION_NAMES = Object.keys(FUNCS);

function ev(n: Node, scope: Scope): Value {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var':
      if (!Object.prototype.hasOwnProperty.call(scope, n.name)) throw new ExprError(`Ukjent variabel "${n.name}"`);
      return scope[n.name];
    case 'list':
      return n.items.map((i) => num(ev(i, scope), 'listeelement'));
    case 'call': {
      if (!Object.prototype.hasOwnProperty.call(FUNCS, n.name)) throw new ExprError(`Ukjent funksjon "${n.name}"`);
      return FUNCS[n.name](n.args.map((a) => ev(a, scope)));
    }
    case 'un': {
      const a = num(ev(n.a, scope), n.op);
      if (n.op === '-') return -a;
      if (n.op === '!') return a ? 0 : 1;
      return a;
    }
    case 'bin': {
      const a = num(ev(n.a, scope), n.op);
      const b = num(ev(n.b, scope), n.op);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
        case '==': return Math.abs(a - b) < 1e-9 ? 1 : 0;
        case '!=': return Math.abs(a - b) >= 1e-9 ? 1 : 0;
        case '<': return a < b ? 1 : 0;
        case '<=': return a <= b + 1e-9 ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '>=': return a >= b - 1e-9 ? 1 : 0;
        case '&&': return a && b ? 1 : 0;
        case '||': return a || b ? 1 : 0;
      }
    }
  }
  throw new ExprError('Ukjent node');
}

export function evaluate(src: string, scope: Scope = {}): Value {
  return ev(parse(src), scope);
}

export function evalNumber(src: string | number, scope: Scope = {}): number {
  if (typeof src === 'number') return src;
  return num(evaluate(src, scope), src);
}

export function evalList(src: string | number[], scope: Scope = {}): number[] {
  if (Array.isArray(src)) return src;
  return list(evaluate(src, scope), src);
}
