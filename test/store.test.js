import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/store.js';

let store;
let pid;

beforeEach(() => {
  store = openStore(':memory:');
  pid = store.createProfile({ name: 'Elsa', avatar: '🦊', accent: 'en-GB' }).id;
  store.addWord(pid, { sv: 'hund', en: 'dog', start_date: '2026-10-01', due_date: '2026-10-08' });
  store.addWord(pid, { sv: 'katt', en: 'cat', start_date: '2026-10-01', due_date: '2026-10-08' });
  store.addWord(pid, { sv: 'Jag har en hund.', en: 'I have a dog.', start_date: '2026-10-20', due_date: '2026-10-27' });
});

afterEach(() => store.close());

test('date range returns words whose period overlaps', () => {
  assert.equal(store.practiceWords(pid, { from: '2026-10-05', to: '2026-10-06' }).length, 2);
  assert.equal(store.practiceWords(pid, { from: '2026-10-08', to: '2026-10-20' }).length, 3);
  assert.equal(store.practiceWords(pid, { from: '2026-10-10', to: '2026-10-15' }).length, 0);
});

test('periods group words by their dates and can be ticked', () => {
  const periods = store.listPeriods(pid);
  assert.deepEqual(
    periods.map((p) => [p.start_date, p.due_date, p.count]),
    [
      ['2026-10-20', '2026-10-27', 1],
      ['2026-10-01', '2026-10-08', 2],
    ],
  );
  assert.equal(store.practiceWords(pid, { periods: [['2026-10-20', '2026-10-27']] }).length, 1);
});

test('kind filter separates words and sentences', () => {
  assert.equal(store.practiceWords(pid, { kind: 'word' }).length, 2);
  assert.equal(store.practiceWords(pid, { kind: 'sentence' }).length, 1);
  assert.equal(store.practiceWords(pid, { limit: 1 }).length, 1);
});

test('recordSession saves attempts, points, badges and hard words', () => {
  const words = store.listWords(pid);
  const dog = words.find((w) => w.en === 'dog');
  const cat = words.find((w) => w.en === 'cat');
  const result = store.recordSession(pid, {
    mode: 'type',
    results: [
      { word_id: dog.id, direction: 'sv-en', correct: true },
      { word_id: cat.id, direction: 'sv-en', correct: false },
      { word_id: cat.id, direction: 'sv-en', correct: true },
      { word_id: 99999, direction: 'sv-en', correct: true },
    ],
    points: 25,
    bestStreak: 2,
  });
  assert.equal(result.session.total, 2);
  assert.equal(result.session.correct, 1);
  assert.equal(result.profile.points, 25);
  assert.ok(result.newBadges.some((b) => b.code === 'first_session'));

  const { stats, hardWords } = store.stats(pid);
  assert.equal(stats.attempts, 3);
  assert.equal(stats.dayStreak, 1);
  assert.deepEqual(hardWords.map((w) => w.en), ['cat']);
  assert.deepEqual(store.practiceWords(pid, { hard: true }).map((w) => w.en), ['cat']);

  const again = store.recordSession(pid, { mode: 'type', results: [], points: 0, bestStreak: 0 });
  assert.equal(again.newBadges.some((b) => b.code === 'first_session'), false);
});

test('deleting a profile removes its words', () => {
  store.deleteProfile(pid);
  assert.equal(store.listWords(pid).length, 0);
});
