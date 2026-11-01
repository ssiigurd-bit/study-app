// Repetisjonsplanlegging med FSRS (via ts-fsrs). Resten av appen bruker bare funksjonene her,
// så algoritmen kan byttes ut uten å røre andre filer.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

export type GradeName = 'again' | 'hard' | 'good' | 'easy';

export interface StoredCard {
  key: string;
  courseId: string;
  topicId: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
  lastCorrect?: boolean;
  /** Når kortet første gang ble mestret. */
  masteredAt?: number;
}

export const REQUEST_RETENTION = 0.9;
/** Et kort regnes som mestret når det huskes i minst så mange dager (og siste svar var riktig). */
export const MASTERY_STABILITY_DAYS = 10;

const scheduler = fsrs(
  generatorParameters({ request_retention: REQUEST_RETENTION, enable_fuzz: true, maximum_interval: 180 }),
);

const GRADES: Record<GradeName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toCard(c: StoredCard): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as State,
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  };
}

/** Automatisk rettede oppgaver: feil → «igjen», riktig → «bra». */
export function gradeForResult(correct: boolean): GradeName {
  return correct ? 'good' : 'again';
}

export function review(
  existing: StoredCard | undefined,
  meta: { key: string; courseId: string; topicId: string },
  grade: GradeName,
  now: Date,
): StoredCard {
  const card = existing ? toCard(existing) : createEmptyCard(now);
  const next = scheduler.next(card, now, GRADES[grade]).card;
  return {
    ...meta,
    masteredAt: existing?.masteredAt,
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: now.getTime(),
    lastCorrect: grade !== 'again',
  };
}

export function isMastered(c: StoredCard | undefined): boolean {
  return !!c && c.state === State.Review && c.stability >= MASTERY_STABILITY_DAYS && c.lastCorrect !== false;
}

export function isDue(c: StoredCard, now: Date): boolean {
  return c.due <= now.getTime();
}
