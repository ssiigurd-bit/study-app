import { describe, it, expect } from 'vitest';
import { evaluate, evalNumber, ExprError } from './expr';

describe('formelmotor', () => {
  it('regner med riktig presedens', () => {
    expect(evalNumber('2 + 3 * 4')).toBe(14);
    expect(evalNumber('(2 + 3) * 4')).toBe(20);
    expect(evalNumber('10 - 4 - 3')).toBe(3);
    expect(evalNumber('100 / 10 / 2')).toBe(5);
    expect(evalNumber('2 ^ 3 ^ 2')).toBe(512);
    expect(evalNumber('-2 ^ 2')).toBe(-4);
    expect(evalNumber('2 * -3')).toBe(-6);
    expect(evalNumber('1.5e3')).toBe(1500);
  });

  it('bruker variabler', () => {
    expect(evalNumber('FK / (P - VEK)', { FK: 120000, P: 50, VEK: 20 })).toBe(4000);
    expect(evalNumber('kostnad_år1 * 2', { kostnad_år1: 5 })).toBe(10);
  });

  it('sammenligning og logikk gir 1 eller 0', () => {
    expect(evalNumber('3 > 2 && 1 < 2')).toBe(1);
    expect(evalNumber('3 > 2 && 1 > 2')).toBe(0);
    expect(evalNumber('0 || 1')).toBe(1);
    expect(evalNumber('!0')).toBe(1);
    expect(evalNumber('0.1 + 0.2 == 0.3')).toBe(1);
    expect(evalNumber('5 >= 5')).toBe(1);
  });

  it('lister og finansfunksjoner', () => {
    expect(evaluate('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(evalNumber('npv(0.1, [-1000, 500, 500, 500])')).toBeCloseTo(243.43, 2);
    expect(evalNumber('af(r, 5)', { r: 0.1 })).toBeCloseTo(3.7908, 4);
    expect(evalNumber('sum([1, 2, 3])')).toBe(6);
    expect(evalNumber('max(1, 7, 3)')).toBe(7);
    expect(evalNumber('round(3.14159, 2)')).toBe(3.14);
    expect(evalNumber('ceil(4000.0000001)')).toBe(4000);
    expect(evalNumber('ceil(4000.2)')).toBe(4001);
  });

  it('avviser ukjente navn og ugyldig syntaks', () => {
    expect(() => evaluate('x + 1')).toThrow(ExprError);
    expect(() => evaluate('constructor(1)')).toThrow(ExprError);
    expect(() => evaluate('toString', {})).toThrow(ExprError);
    expect(() => evaluate('2 +')).toThrow(ExprError);
    expect(() => evaluate('(2 + 3')).toThrow(ExprError);
    expect(() => evaluate('2 $ 3')).toThrow(ExprError);
    expect(() => evaluate('1 2')).toThrow(ExprError);
  });
});
