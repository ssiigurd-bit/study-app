// Setter sammen en økt: forfalte repetisjoner først, så litt nytt stoff i små biter.
import type { IntroSpec } from '../content/schema';
import type { LoadedCourse, LoadedItem, LoadedTopic } from '../content/load';
import { mulberry32, shuffle } from '../content/instantiate';
import { isDue, type StoredCard } from './scheduler';

export type SessionStep =
  | { type: 'intro'; intro: IntroSpec; topicId: string }
  | { type: 'item'; item: LoadedItem; isNew: boolean; extra?: boolean };

export interface SessionOptions {
  /** Antall oppgaver (introkort kommer i tillegg). */
  size?: number;
  /** Begrens til ett tema (fra temalisten). */
  topicId?: string;
  /** Nye kort introdusert i dag, og grensen per dag. */
  newToday?: number;
  dailyNewLimit?: number;
  seenIntros?: Set<string>;
  seed?: number;
}

export const DEFAULT_SESSION_SIZE = 10;
export const DEFAULT_DAILY_NEW_LIMIT = 20;
/** Andel av et tema som må være påbegynt før temaer som bygger på det, regnes som åpne. */
export const PREREQ_STARTED_SHARE = 0.5;

export function topicStats(topic: LoadedTopic, cards: Map<string, StoredCard>) {
  const total = topic.items.length;
  let seen = 0;
  for (const it of topic.items) if (cards.has(it.key)) seen++;
  return { total, seen };
}

/** Et tema er åpent når forkunnskapene er godt i gang. Brukeren kan likevel velge det manuelt. */
export function isTopicOpen(course: LoadedCourse, topic: LoadedTopic, cards: Map<string, StoredCard>): boolean {
  return topic.prerequisites.every((pid) => {
    const p = course.topicById.get(pid);
    if (!p) return true;
    const s = topicStats(p, cards);
    return s.seen / s.total >= PREREQ_STARTED_SHARE;
  });
}

export function buildSession(
  course: LoadedCourse,
  cards: Map<string, StoredCard>,
  now: Date,
  opts: SessionOptions = {},
): SessionStep[] {
  const size = opts.size ?? DEFAULT_SESSION_SIZE;
  const rnd = mulberry32(opts.seed ?? now.getTime());
  const seenIntros = opts.seenIntros ?? new Set<string>();

  const topics = opts.topicId
    ? course.topics.filter((t) => t.id === opts.topicId)
    : course.topics.filter((t) => isTopicOpen(course, t, cards));
  const pool = topics.flatMap((t) => t.items);

  // 1. Forfalte repetisjoner, mest forsinket først.
  const due = pool
    .filter((it) => {
      const c = cards.get(it.key);
      return c && isDue(c, now);
    })
    .sort((a, b) => cards.get(a.key)!.due - cards.get(b.key)!.due);
  const reviews = shuffle(due.slice(0, size), rnd);

  // 2. Nytt stoff. Få repetisjoner → litt mer nytt.
  const maxNew = reviews.length < 3 ? 6 : 4;
  const dailyLeft = Math.max(0, (opts.dailyNewLimit ?? DEFAULT_DAILY_NEW_LIMIT) - (opts.newToday ?? 0));
  const newBudget = Math.max(0, Math.min(size - reviews.length, maxNew, dailyLeft));

  // Fortsett et påbegynt tema før et nytt startes; ellers følg emnets rekkefølge.
  const started = topics.filter((t) => t.items.some((i) => cards.has(i.key)));
  const ordered = [...started, ...topics.filter((t) => !started.includes(t))];
  const fresh: LoadedItem[] = [];
  for (const t of ordered) {
    for (const it of t.items) {
      if (fresh.length >= newBudget) break;
      if (!cards.has(it.key)) fresh.push(it);
    }
  }

  // 3. Ingenting å gjøre? Gi ekstra øving på det som snart forfaller.
  const extra: LoadedItem[] = [];
  if (reviews.length + fresh.length < 4) {
    const notDue = pool
      .filter((it) => {
        const c = cards.get(it.key);
        return c && !isDue(c, now);
      })
      .sort((a, b) => cards.get(a.key)!.due - cards.get(b.key)!.due);
    extra.push(...notDue.slice(0, Math.min(6, size) - reviews.length - fresh.length));
  }

  // Introkort rett før den nye oppgaven de hører til.
  const newSteps: SessionStep[] = [];
  for (const it of fresh) {
    const topic = course.topicById.get(it.topicId)!;
    for (const intro of topic.introBefore.get(it.id) ?? []) {
      if (!seenIntros.has(intro.id)) newSteps.push({ type: 'intro', intro, topicId: topic.id });
    }
    newSteps.push({ type: 'item', item: it, isNew: true });
  }

  const reviewSteps: SessionStep[] = reviews.map((item) => ({ type: 'item', item, isNew: false }));
  const extraSteps: SessionStep[] = extra.map((item) => ({ type: 'item', item, isNew: false, extra: true }));

  // To repetisjoner som oppvarming, så nytt stoff, så resten av repetisjonene.
  return [...reviewSteps.slice(0, 2), ...newSteps, ...reviewSteps.slice(2), ...extraSteps];
}
