// All brukerdata lagres lokalt i nettleseren (IndexedDB via Dexie). Ingen server.
import Dexie, { type Table } from 'dexie';
import { dayKey } from '../lib/dates';
import {
  applyGoalMet,
  defaultProfile,
  MASTERY_BONUS_XP,
  rollDay,
  xpFor,
  type Profile,
} from '../lib/progress';
import { isMastered, review, type GradeName, type StoredCard } from '../lib/scheduler';

export interface ReviewLogRow {
  id?: number;
  key: string;
  courseId: string;
  topicId: string;
  ts: number;
  grade: GradeName;
  correct: boolean;
  /** Det brukeren svarte (tekst eller valgt alternativ). */
  response?: string;
  /** Frøet som ga tallene i oppgaven, så den kan gjenskapes. */
  seed: number;
  ms: number;
  isNew: boolean;
}

export interface ErrorReport {
  id?: number;
  /** Oppgave- eller introkort-nøkkel. */
  key: string;
  ts: number;
  text: string;
  /** Oppgaveteksten slik den ble vist (med tallene). */
  context: string;
}

export interface Settings {
  dailyGoal: number;
  courseId?: string;
}

export const DEFAULT_SETTINGS: Settings = { dailyGoal: 10 };

interface KV {
  key: string;
  value: unknown;
}

class StudyDB extends Dexie {
  cards!: Table<StoredCard, string>;
  logs!: Table<ReviewLogRow, number>;
  reports!: Table<ErrorReport, number>;
  kv!: Table<KV, string>;

  constructor() {
    super('study-app');
    this.version(1).stores({
      cards: '&key, courseId, topicId, due',
      logs: '++id, key, courseId, ts',
      reports: '++id, key, ts',
      kv: '&key',
    });
  }
}

export const db = new StudyDB();

async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

function putKV(key: string, value: unknown) {
  return db.kv.put({ key, value });
}

export async function getProfile(today = dayKey()): Promise<Profile> {
  return rollDay(await getKV('profile', defaultProfile(today)), today);
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getKV<Partial<Settings>>('settings', {})) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const s = await getSettings();
  await putKV('settings', { ...s, ...patch });
}

export async function getSeenIntros(): Promise<Set<string>> {
  return new Set(await getKV<string[]>('seenIntros', []));
}

export async function markIntroSeen(id: string) {
  await db.transaction('rw', db.kv, async () => {
    const seen = await getKV<string[]>('seenIntros', []);
    if (!seen.includes(id)) await putKV('seenIntros', [...seen, id]);
  });
}

export async function getCardMap(courseId: string): Promise<Map<string, StoredCard>> {
  const rows = await db.cards.where('courseId').equals(courseId).toArray();
  return new Map(rows.map((c) => [c.key, c]));
}

export interface AnswerInput {
  key: string;
  courseId: string;
  topicId: string;
  kind: string;
  skillLevel: number;
  grade: GradeName;
  correct: boolean;
  response?: string;
  seed: number;
  ms: number;
  now?: Date;
}

export interface AnswerResult {
  xp: number;
  masteredNow: boolean;
  goalJustMet: boolean;
  profile: Profile;
}

/** Lagrer ett svar med en gang: kortets nye plan, logg og fremgang. */
export async function recordAnswer(a: AnswerInput): Promise<AnswerResult> {
  const now = a.now ?? new Date();
  const today = dayKey(now);
  return db.transaction('rw', db.cards, db.logs, db.kv, async () => {
    const settings = await getSettings();
    let profile = await getProfile(today);
    const existing = await db.cards.get(a.key);
    const card = review(existing, { key: a.key, courseId: a.courseId, topicId: a.topicId }, a.grade, now);

    let xp = xpFor({ correct: a.correct, skillLevel: a.skillLevel, kind: a.kind, grade: a.grade });
    const masteredNow = !card.masteredAt && isMastered(card);
    if (masteredNow) {
      card.masteredAt = now.getTime();
      xp += MASTERY_BONUS_XP;
    }
    await db.cards.put(card);
    await db.logs.add({
      key: a.key,
      courseId: a.courseId,
      topicId: a.topicId,
      ts: now.getTime(),
      grade: a.grade,
      correct: a.correct,
      response: a.response,
      seed: a.seed,
      ms: a.ms,
      isNew: !existing,
    });

    profile = {
      ...profile,
      xp: profile.xp + xp,
      dayXp: profile.dayXp + xp,
      dayAnswered: profile.dayAnswered + 1,
      dayNew: profile.dayNew + (existing ? 0 : 1),
      totalAnswered: profile.totalAnswered + 1,
      totalCorrect: profile.totalCorrect + (a.correct ? 1 : 0),
    };
    let goalJustMet = false;
    if (!profile.goalMetToday && profile.dayAnswered >= settings.dailyGoal) {
      profile = applyGoalMet(profile, today);
      goalJustMet = true;
    }
    await putKV('profile', profile);
    return { xp, masteredNow, goalJustMet, profile };
  });
}

export async function addReport(r: Omit<ErrorReport, 'id' | 'ts'>) {
  await db.reports.add({ ...r, ts: Date.now() });
}

export async function deleteReport(id: number) {
  await db.reports.delete(id);
}

export async function resetAllData() {
  await db.transaction('rw', db.cards, db.logs, db.reports, db.kv, async () => {
    await Promise.all([db.cards.clear(), db.logs.clear(), db.reports.clear(), db.kv.clear()]);
  });
}
