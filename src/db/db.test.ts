import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { addReport, db, getCardMap, getProfile, getSeenIntros, markIntroSeen, recordAnswer, resetAllData, saveSettings } from './db';

const base = { courseId: 'k', topicId: 't', kind: 'numeric', skillLevel: 1, seed: 1, ms: 1000 };

describe('lagring', () => {
  beforeEach(async () => {
    await resetAllData();
  });

  it('lagrer svar, kort og logg med en gang', async () => {
    const now = new Date('2026-11-01T10:00:00');
    const r = await recordAnswer({ ...base, key: 'k:a', grade: 'good', correct: true, now });
    expect(r.xp).toBe(10);
    const cards = await getCardMap('k');
    expect(cards.get('k:a')?.reps).toBe(1);
    expect(await db.logs.count()).toBe(1);
    const p = await getProfile('2026-11-01');
    expect(p.dayAnswered).toBe(1);
    expect(p.dayNew).toBe(1);
    expect(p.totalCorrect).toBe(1);
  });

  it('daglig mål gir streak, og bare én gang', async () => {
    await saveSettings({ dailyGoal: 3 });
    const now = new Date('2026-11-01T10:00:00');
    const res = [];
    for (let i = 0; i < 4; i++) {
      res.push(await recordAnswer({ ...base, key: `k:${i}`, grade: 'good', correct: true, now }));
    }
    expect(res.map((r) => r.goalJustMet)).toEqual([false, false, true, false]);
    expect(res[3].profile.streak).toBe(1);
  });

  it('dagstellere nullstilles neste dag', async () => {
    await recordAnswer({ ...base, key: 'k:a', grade: 'good', correct: true, now: new Date('2026-11-01T10:00:00') });
    const p = await getProfile('2026-11-02');
    expect(p.dayAnswered).toBe(0);
    expect(p.totalAnswered).toBe(1);
  });

  it('introkort og feilmeldinger', async () => {
    await markIntroSeen('i1');
    await markIntroSeen('i1');
    expect([...(await getSeenIntros())]).toEqual(['i1']);
    await addReport({ key: 'k:a', text: 'Feil fortegn', context: 'Oppgave' });
    expect(await db.reports.count()).toBe(1);
  });
});
