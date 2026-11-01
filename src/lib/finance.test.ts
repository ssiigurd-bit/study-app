import { describe, it, expect } from 'vitest';
import { af, df, effRate, fv, irr, npv, pv, round } from './finance';

// Kontrollverdier er regnet ut for hånd / fra standard rentetabeller.
describe('finansformler', () => {
  it('diskonteringsfaktor', () => {
    expect(df(0.08, 3)).toBeCloseTo(0.7938, 4);
    expect(df(0.1, 1)).toBeCloseTo(0.9091, 4);
    expect(df(0.05, 0)).toBe(1);
  });

  it('fremtidsverdi med renters rente', () => {
    expect(fv(10000, 0.05, 2)).toBeCloseTo(11025, 6);
    expect(fv(1000, 0.1, 10)).toBeCloseTo(2593.74, 2);
  });

  it('nåverdi av ett beløp', () => {
    expect(pv(11025, 0.05, 2)).toBeCloseTo(10000, 6);
    expect(pv(100, 0.1, 2)).toBeCloseTo(82.64, 2);
  });

  it('annuitetsfaktor', () => {
    expect(af(0.1, 5)).toBeCloseTo(3.7908, 4);
    expect(af(0.08, 10)).toBeCloseTo(6.7101, 4);
    expect(af(0.06, 3)).toBeCloseTo(2.6730, 4);
    expect(af(0, 4)).toBe(4);
  });

  it('annuitetsfaktor er lik summen av diskonteringsfaktorene', () => {
    const r = 0.07;
    const sumDf = [1, 2, 3, 4, 5, 6].reduce((s, t) => s + df(r, t), 0);
    expect(af(r, 6)).toBeCloseTo(sumDf, 10);
  });

  it('netto nåverdi – år 0 diskonteres ikke', () => {
    expect(npv(0.1, [-1000, 500, 500, 500])).toBeCloseTo(243.43, 2);
    expect(npv(0.1, [-1000])).toBe(-1000);
  });

  it('internrente', () => {
    expect(irr([-1000, 500, 500, 500])).toBeCloseTo(0.2338, 4);
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8);
    // NNV ved internrenten er null.
    const flows = [-250000, 60000, 80000, 90000, 70000];
    expect(npv(irr(flows), flows)).toBeCloseTo(0, 4);
  });

  it('internrente uten fortegnsskifte gir NaN', () => {
    expect(irr([100, 100])).toBeNaN();
  });

  it('effektiv rente', () => {
    expect(effRate(0.12, 12)).toBeCloseTo(0.126825, 6);
    expect(effRate(0.06, 2)).toBeCloseTo(0.0609, 6);
    expect(effRate(0.05, 1)).toBeCloseTo(0.05, 10);
  });

  it('avrunding halvparten opp', () => {
    expect(round(2.5)).toBe(3);
    expect(round(-2.5)).toBe(-3);
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(3.79079, 4)).toBe(3.7908);
  });
});
