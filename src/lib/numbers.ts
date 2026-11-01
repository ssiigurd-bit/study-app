// Lesing og formatering av tall i norsk format.

const nbFormatters = new Map<number, Intl.NumberFormat>();

function formatter(decimals: number): Intl.NumberFormat {
  let f = nbFormatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('nb-NO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    });
    nbFormatters.set(decimals, f);
  }
  return f;
}

/**
 * Formaterer et tall på norsk: mellomrom som tusenskille, komma som desimaltegn.
 * Uten antall desimaler: heltall vises uten desimaler, andre tall med 2.
 */
export function formatNumber(x: number, decimals?: number): string {
  if (!Number.isFinite(x)) return String(x);
  const d = decimals ?? (Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 2);
  // Unngå «−0».
  const v = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x;
  // Hardt mellomrom som tusenskille, så «40 000» aldri deles over to linjer.
  return formatter(d).format(v).replace(/[\u00a0\u202f ]/g, '\u00a0');
}

/**
 * Leser et tall slik studenter skriver det.
 * Godtar «1 250,50», «1250.50», «1.250,50», «1 250,-», «−300», «12,5 %», «kr 400».
 * Returnerer null hvis teksten ikke er et tall.
 */
export function parseNumberInput(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/[−–—]/g, '-');
  s = s.replace(/^kr\.?|kr\.?$|nok/g, '');
  s = s.replace(/%/g, '');
  s = s.replace(/,-$/, '');
  s = s.replace(/[\s  ']/g, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Det siste skilletegnet er desimaltegnet.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandSep).join('');
    if (decimalSep === ',') s = s.replace(',', '.');
  } else if (hasComma) {
    const n = s.split(',').length - 1;
    s = n > 1 ? s.split(',').join('') : s.replace(',', '.');
  } else if (hasDot) {
    const n = s.split('.').length - 1;
    if (n > 1) s = s.split('.').join('');
  }

  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

export interface Tolerance {
  /** Største tillatte absolutte avvik. */
  abs: number;
  /** Største tillatte relative avvik (0.005 = 0,5 %). */
  rel: number;
}

export const DEFAULT_TOLERANCE: Tolerance = { abs: 1, rel: 0.005 };

export function withinTolerance(value: number, expected: number, tol: Tolerance = DEFAULT_TOLERANCE): boolean {
  const allowed = Math.max(tol.abs, tol.rel * Math.abs(expected));
  return Math.abs(value - expected) <= allowed + 1e-9;
}
