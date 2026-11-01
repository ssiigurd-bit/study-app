// Formler for bedriftsøkonomi og finans. Renter oppgis som desimaltall (7 % = 0.07).

/** Diskonteringsfaktor: 1 / (1 + r)^n */
export function df(r: number, n: number): number {
  return 1 / Math.pow(1 + r, n);
}

/** Fremtidsverdi: K · (1 + r)^n */
export function fv(k: number, r: number, n: number): number {
  return k * Math.pow(1 + r, n);
}

/** Nåverdi av ett beløp: K / (1 + r)^n */
export function pv(k: number, r: number, n: number): number {
  return k / Math.pow(1 + r, n);
}

/** Annuitetsfaktor (nåverdi av 1 kr per år i n år): (1 − (1 + r)^−n) / r */
export function af(r: number, n: number): number {
  if (r === 0) return n;
  return (1 - Math.pow(1 + r, -n)) / r;
}

/** Netto nåverdi. flows[0] er år 0 (diskonteres ikke), flows[t] er år t. */
export function npv(r: number, flows: number[]): number {
  return flows.reduce((sum, c, t) => sum + c / Math.pow(1 + r, t), 0);
}

/** Internrente (IRR) funnet ved halvering. Krever ett fortegnsskifte i intervallet. */
export function irr(flows: number[], lo = -0.99, hi = 10): number {
  let fLo = npv(lo, flows);
  const fHi = npv(hi, flows);
  if (Number.isNaN(fLo) || fLo * fHi > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-9) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Effektiv årlig rente fra nominell rente med m terminer per år. */
export function effRate(nominal: number, m: number): number {
  return Math.pow(1 + nominal / m, m) - 1;
}

/** Avrund til d desimaler (halvparten opp, også for negative tall). */
export function round(x: number, d = 0): number {
  const f = Math.pow(10, d);
  // toPrecision fjerner flyttallsstøy (1.005 * 100 = 100.49999…).
  return (Math.sign(x) * Math.round(Number((Math.abs(x) * f).toPrecision(12)))) / f;
}
