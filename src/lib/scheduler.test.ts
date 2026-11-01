import { describe, it, expect } from 'vitest';
import { gradeForResult, isDue, isMastered, review, type StoredCard } from './scheduler';

const meta = { key: 'c:x', courseId: 'c', topicId: 't' };
const DAY = 86400000;

describe('FSRS-planlegging', () => {
  it('nytt kort med feil svar kommer tilbake raskt', () => {
    const now = new Date('2026-11-01T10:00:00');
    const c = review(undefined, meta, 'again', now);
    expect(c.due - now.getTime()).toBeLessThan(15 * 60000);
    expect(c.lastCorrect).toBe(false);
    expect(c.reps).toBe(1);
  });

  it('riktige svar over tid gir stadig lengre intervaller', () => {
    let now = new Date('2026-11-01T10:00:00');
    let c: StoredCard | undefined;
    const gaps: number[] = [];
    for (let i = 0; i < 6; i++) {
      c = review(c, meta, 'good', now);
      gaps.push(c.due - now.getTime());
      now = new Date(c.due);
    }
    for (let i = 2; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    expect(isMastered(c)).toBe(true);
  });

  it('ikke mestret etter ett riktig svar', () => {
    const c = review(undefined, meta, 'good', new Date());
    expect(isMastered(c)).toBe(false);
  });

  it('feil svar på et modent kort gir glemt-tilstand og kort intervall', () => {
    let now = new Date('2026-11-01T10:00:00');
    let c: StoredCard | undefined;
    for (let i = 0; i < 5; i++) {
      c = review(c, meta, 'good', now);
      now = new Date(c.due);
    }
    const before = c!;
    c = review(c, meta, 'again', now);
    expect(c.lapses).toBe(before.lapses + 1);
    expect(c.due - now.getTime()).toBeLessThan(DAY);
    expect(isMastered(c)).toBe(false);
  });

  it('beholder tidspunkt for mestring', () => {
    const c = review({ ...review(undefined, meta, 'good', new Date()), masteredAt: 123 }, meta, 'good', new Date());
    expect(c.masteredAt).toBe(123);
  });

  it('forfall og karaktermapping', () => {
    const now = new Date();
    const c = review(undefined, meta, 'good', now);
    expect(isDue(c, now)).toBe(false);
    expect(isDue(c, new Date(c.due + 1))).toBe(true);
    expect(gradeForResult(true)).toBe('good');
    expect(gradeForResult(false)).toBe('again');
  });
});
