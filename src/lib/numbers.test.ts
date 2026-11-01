import { describe, it, expect } from 'vitest';
import { formatNumber, parseNumberInput, withinTolerance } from './numbers';

describe('lesing av tall', () => {
  it.each([
    ['1250', 1250],
    ['1 250', 1250],
    ['1 250,50', 1250.5],
    ['1250.50', 1250.5],
    ['1250,5', 1250.5],
    ['1.250,50', 1250.5],
    ['1,250.50', 1250.5],
    ['1.250.000', 1250000],
    ['1 250 000', 1250000],
    ['1 250', 1250],
    ['1 250,-', 1250],
    ['kr 400', 400],
    ['400 kr', 400],
    ['−300', -300],
    ['-1 250,75', -1250.75],
    ['12,5 %', 12.5],
    ['12,5%', 12.5],
    [',5', 0.5],
    ['0,9091', 0.9091],
    ['0.909', 0.909],
  ])('«%s» → %d', (input, expected) => {
    expect(parseNumberInput(input)).toBeCloseTo(expected, 10);
  });

  it.each(['', '   ', 'abc', '12a', '1-2', '--5', ','])('«%s» er ikke et tall', (input) => {
    expect(parseNumberInput(input)).toBeNull();
  });
});

describe('formatering', () => {
  const sp = (x: string) => x.replace(/ /g, '\u00a0');
  it('norsk format', () => {
    expect(formatNumber(1250)).toBe(sp('1 250'));
    expect(formatNumber(1250.5)).toBe(sp('1 250,50'));
    expect(formatNumber(1234567)).toBe(sp('1 234 567'));
    expect(formatNumber(0.90909, 4)).toBe('0,9091');
    expect(formatNumber(-300)).toBe('−300');
    expect(formatNumber(-0.0001, 2)).toBe('0,00');
    expect(formatNumber(12.5, 1)).toBe('12,5');
  });

  it('formatert tall kan leses tilbake', () => {
    for (const x of [0, 1, -1, 1250.5, -98765.43, 1e6]) {
      expect(parseNumberInput(formatNumber(x, 2))).toBeCloseTo(x, 2);
    }
  });
});

describe('toleranse', () => {
  it('bruker det største av absolutt og relativt avvik', () => {
    expect(withinTolerance(101, 100)).toBe(true);
    expect(withinTolerance(102, 100)).toBe(false);
    expect(withinTolerance(100400, 100000)).toBe(true);
    expect(withinTolerance(100600, 100000)).toBe(false);
    expect(withinTolerance(12.4, 12.5, { abs: 0.1, rel: 0 })).toBe(true);
    expect(withinTolerance(12.3, 12.5, { abs: 0.1, rel: 0 })).toBe(false);
  });
});
