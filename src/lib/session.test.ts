import { describe, it, expect } from 'vitest';
import { buildCourses } from '../content/load';
import { buildSession, isTopicOpen } from './session';
import { review, type StoredCard } from './scheduler';

function makeCourse() {
  const items = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => `  - id: ${prefix}-${i}\n    type: flashcard\n    front: F\n    back: B\n`).join('');
  return buildCourses({
    '/content/courses/k/course.yaml':
      'id: k\ncode: K\ntitle: K\ndelemner:\n  - id: d\n    title: D\n    topics: [a, b, c]\n',
    '/content/courses/k/a.yaml':
      'id: a\ntitle: A\nintro:\n  - id: a-intro\n    title: I\n    body: B\n  - id: a-intro2\n    before: a-3\n    title: I2\n    body: B\nitems:\n' + items('a', 10),
    '/content/courses/k/b.yaml': 'id: b\ntitle: B\nitems:\n' + items('b', 10),
    '/content/courses/k/c.yaml': 'id: c\ntitle: C\nprerequisites: [a]\nitems:\n' + items('c', 4),
  })[0];
}

const now = new Date('2026-11-01T12:00:00');
const past = new Date('2026-10-01T12:00:00');

function itemsOf(steps: ReturnType<typeof buildSession>) {
  return steps.filter((s) => s.type === 'item').map((s) => (s.type === 'item' ? s.item.id : ''));
}

describe('øktbygger', () => {
  it('første økt: introkort og inntil 6 nye fra første tema', () => {
    const course = makeCourse();
    const steps = buildSession(course, new Map(), now, { seed: 1 });
    expect(steps[0]).toMatchObject({ type: 'intro', intro: { id: 'a-intro' } });
    expect(itemsOf(steps)).toEqual(['a-0', 'a-1', 'a-2', 'a-3', 'a-4', 'a-5']);
    // Introkort nr. 2 rett før a-3.
    const idx = steps.findIndex((s) => s.type === 'intro' && s.intro.id === 'a-intro2');
    expect(steps[idx + 1]).toMatchObject({ type: 'item', item: { id: 'a-3' } });
  });

  it('sette introkort vises ikke igjen', () => {
    const steps = buildSession(makeCourse(), new Map(), now, { seenIntros: new Set(['a-intro', 'a-intro2']) });
    expect(steps.every((s) => s.type === 'item')).toBe(true);
  });

  it('forfalte kort kommer med, og nytt stoff begrenses', () => {
    const course = makeCourse();
    const cards = new Map<string, StoredCard>();
    for (const it of course.topicById.get('a')!.items.slice(0, 5)) {
      cards.set(it.key, review(undefined, { key: it.key, courseId: 'k', topicId: 'a' }, 'good', past));
    }
    const steps = buildSession(course, cards, now, { seed: 2 });
    const ids = itemsOf(steps);
    expect(ids.length).toBe(9); // 5 repetisjoner + 4 nye
    expect(ids.filter((id) => ['a-0', 'a-1', 'a-2', 'a-3', 'a-4'].includes(id)).length).toBe(5);
    expect(ids).toContain('a-5');
  });

  it('respekterer daglig grense for nytt stoff', () => {
    const steps = buildSession(makeCourse(), new Map(), now, { newToday: 18, dailyNewLimit: 20 });
    expect(itemsOf(steps).length).toBe(2);
  });

  it('økta er aldri større enn størrelsen', () => {
    const course = makeCourse();
    const cards = new Map<string, StoredCard>();
    for (const t of course.topics) for (const it of t.items) {
      cards.set(it.key, review(undefined, { key: it.key, courseId: 'k', topicId: t.id }, 'good', past));
    }
    expect(itemsOf(buildSession(course, cards, now, { size: 10 })).length).toBe(10);
  });

  it('gir ekstra øving når ingenting forfaller', () => {
    const course = makeCourse();
    const cards = new Map<string, StoredCard>();
    for (const t of course.topics) for (const it of t.items) {
      cards.set(it.key, review(undefined, { key: it.key, courseId: 'k', topicId: t.id }, 'good', now));
    }
    const steps = buildSession(course, cards, now);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.type === 'item' && s.extra)).toBe(true);
  });

  it('tema med forkunnskap åpnes når forkunnskapen er godt i gang', () => {
    const course = makeCourse();
    const c = course.topicById.get('c')!;
    const cards = new Map<string, StoredCard>();
    expect(isTopicOpen(course, c, cards)).toBe(false);
    for (const it of course.topicById.get('a')!.items.slice(0, 5)) {
      cards.set(it.key, review(undefined, { key: it.key, courseId: 'k', topicId: 'a' }, 'good', now));
    }
    expect(isTopicOpen(course, c, cards)).toBe(true);
  });

  it('valgt tema gir bare oppgaver fra det temaet', () => {
    const steps = buildSession(makeCourse(), new Map(), now, { topicId: 'b' });
    expect(itemsOf(steps).every((id) => id.startsWith('b-'))).toBe(true);
  });
});
