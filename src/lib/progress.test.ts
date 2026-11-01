import { describe, it, expect } from 'vitest';
import { applyGoalMet, defaultProfile, displayedStreak, levelInfo, rollDay, xpFor } from './progress';
import { dayKey, daysBetween } from './dates';

describe('datoer', () => {
  it('dagnøkkel og dager mellom', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(daysBetween('2026-01-05', '2026-01-06')).toBe(1);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // over sommertid
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });
});

describe('streak', () => {
  it('første dag gir streak 1', () => {
    const p = applyGoalMet(defaultProfile('2026-11-01'), '2026-11-01');
    expect(p.streak).toBe(1);
    expect(displayedStreak(p, '2026-11-01')).toBe(1);
  });

  it('samme dag to ganger teller én gang', () => {
    let p = applyGoalMet(defaultProfile('2026-11-01'), '2026-11-01');
    p = applyGoalMet(p, '2026-11-01');
    expect(p.streak).toBe(1);
  });

  it('påfølgende dager øker streaken', () => {
    let p = defaultProfile('2026-11-01');
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) p = applyGoalMet(rollDay(p, d), d);
    expect(p.streak).toBe(3);
    expect(p.longestStreak).toBe(3);
  });

  it('streaken vises som 0 når en dag er hoppet over uten frys', () => {
    const p = applyGoalMet(defaultProfile('2026-11-01'), '2026-11-01');
    expect(displayedStreak(p, '2026-11-02')).toBe(1); // i dag er ikke over ennå
    expect(displayedStreak(p, '2026-11-03')).toBe(0);
    expect(applyGoalMet(p, '2026-11-03').streak).toBe(1);
  });

  it('frys tjenes hver 7. dag og dekker en tapt dag', () => {
    let p = defaultProfile('2026-11-01');
    for (let i = 1; i <= 7; i++) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      p = applyGoalMet(rollDay(p, d), d);
    }
    expect(p.streak).toBe(7);
    expect(p.freezes).toBe(1);
    // Hopper over 8. november.
    expect(displayedStreak(p, '2026-11-09')).toBe(7);
    p = applyGoalMet(p, '2026-11-09');
    expect(p.streak).toBe(8);
    expect(p.freezes).toBe(0);
  });

  it('maks to frys', () => {
    let p = defaultProfile('2026-01-01');
    for (let i = 0; i < 28; i++) {
      const d = dayKey(new Date(2026, 0, 1 + i));
      p = applyGoalMet(rollDay(p, d), d);
    }
    expect(p.freezes).toBe(2);
  });

  it('ny dag nullstiller dagstellere', () => {
    const p = { ...defaultProfile('2026-11-01'), dayAnswered: 12, goalMetToday: true };
    const q = rollDay(p, '2026-11-02');
    expect(q.dayAnswered).toBe(0);
    expect(q.goalMetToday).toBe(false);
  });
});

describe('XP og nivå', () => {
  it('nivågrenser', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
    expect(levelInfo(350)).toEqual({ level: 3, into: 50, span: 300 });
  });

  it('XP belønner riktige svar på høyere nivå', () => {
    expect(xpFor({ correct: true, skillLevel: 1, kind: 'numeric' })).toBe(10);
    expect(xpFor({ correct: true, skillLevel: 2, kind: 'mcq' })).toBe(15);
    expect(xpFor({ correct: false, skillLevel: 2, kind: 'mcq' })).toBe(2);
    expect(xpFor({ correct: true, skillLevel: 1, kind: 'flashcard', grade: 'easy' })).toBe(5);
  });
});
