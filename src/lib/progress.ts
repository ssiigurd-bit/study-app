// Streak, daglig mål, XP og nivåer. Rene funksjoner, så de er enkle å teste.
import { daysBetween } from './dates';

export interface Profile {
  xp: number;
  streak: number;
  longestStreak: number;
  /** Streakfrys: dekker en dag uten nådd mål. Tjenes hver 7. dag, maks 2. */
  freezes: number;
  lastGoalDay: string | null;
  /** Dagen tellerne under gjelder for. */
  day: string;
  dayAnswered: number;
  dayNew: number;
  dayXp: number;
  goalMetToday: boolean;
  totalAnswered: number;
  totalCorrect: number;
}

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export function defaultProfile(today: string): Profile {
  return {
    xp: 0,
    streak: 0,
    longestStreak: 0,
    freezes: 0,
    lastGoalDay: null,
    day: today,
    dayAnswered: 0,
    dayNew: 0,
    dayXp: 0,
    goalMetToday: false,
    totalAnswered: 0,
    totalCorrect: 0,
  };
}

/** Nullstiller dagstellerne når det er en ny dag. */
export function rollDay(p: Profile, today: string): Profile {
  if (p.day === today) return p;
  return { ...p, day: today, dayAnswered: 0, dayNew: 0, dayXp: 0, goalMetToday: false };
}

/** Kalles første gang dagens mål nås. Oppdaterer streak og bruker frys om nødvendig. */
export function applyGoalMet(p: Profile, today: string): Profile {
  if (p.lastGoalDay === today) return { ...p, goalMetToday: true };
  let { streak, freezes } = p;
  if (p.lastGoalDay === null) {
    streak = 1;
  } else {
    const gap = daysBetween(p.lastGoalDay, today);
    const missed = gap - 1;
    if (missed <= 0) streak += 1;
    else if (missed <= freezes) {
      freezes -= missed;
      streak += 1;
    } else streak = 1;
  }
  if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  return {
    ...p,
    streak,
    freezes,
    longestStreak: Math.max(p.longestStreak, streak),
    lastGoalDay: today,
    goalMetToday: true,
  };
}

/** Streaken slik den skal vises i dag (0 hvis den er brutt og frysene ikke dekker). */
export function displayedStreak(p: Profile, today: string): number {
  if (!p.lastGoalDay) return 0;
  const missed = daysBetween(p.lastGoalDay, today) - 1;
  if (missed <= 0) return p.streak;
  return missed <= p.freezes ? p.streak : 0;
}

/** Nivå n krever 50 · n · (n − 1) XP totalt: 0, 100, 300, 600, 1000 … */
export function levelInfo(xp: number) {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const start = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, into: xp - start, span: next - start };
}

export function xpFor(opts: { correct: boolean; skillLevel: number; kind: string; grade?: string }): number {
  if (opts.kind === 'flashcard') {
    return opts.grade === 'again' ? 1 : opts.grade === 'hard' ? 3 : 5;
  }
  return opts.correct ? 5 + 5 * opts.skillLevel : 2;
}

export const MASTERY_BONUS_XP = 25;
