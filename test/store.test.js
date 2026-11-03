import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from '../src/store.js';

let store;
let pid;

beforeEach(() => {
  store = openStore(':memory:');
  pid = store.createProfile({ name: 'Elsa', avatar: '🦊', accent: 'en-GB' }).id;
  store.addWord(pid, { homework_name: 'Animals', sv: 'hund', en: 'dog', start_date: '2026-10-01', due_date: '2026-10-08' });
  store.addWord(pid, { homework_name: 'Animals', sv: 'katt', en: 'cat', start_date: '2026-10-01', due_date: '2026-10-08' });
  store.addWord(pid, { homework_name: 'Sentences', sv: 'Jag har en hund.', en: 'I have a dog.', start_date: '2026-10-20', due_date: '2026-10-27' });
});

afterEach(() => store.close());

test('upgrades an existing database with the default homework name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glostraning-migration-'));
  const file = join(dir, 'legacy.db');
  const legacyDb = new DatabaseSync(file);
  legacyDb.exec(`
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      accent TEXT NOT NULL DEFAULT 'en-GB',
      points INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE words (
      id INTEGER PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      sv TEXT NOT NULL,
      en TEXT NOT NULL,
      start_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    INSERT INTO profiles (id, name, avatar) VALUES (1, 'Elsa', 'fox');
    INSERT INTO words (profile_id, sv, en, start_date, due_date)
    VALUES (1, 'hund', 'dog', '2026-10-01', '2026-10-08');
  `);
  legacyDb.close();

  try {
    const migratedStore = openStore(file);
    try {
      assert.deepEqual(
        migratedStore.listWords(1).map(({ id, homework_name, sv, en }) => [id, homework_name, sv, en]),
        [[1, 'Homework', 'hund', 'dog']],
      );
    } finally {
      migratedStore.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('date range returns words whose period overlaps', () => {
  assert.equal(store.practiceWords(pid, { from: '2026-10-05', to: '2026-10-06' }).length, 2);
  assert.equal(store.practiceWords(pid, { from: '2026-10-08', to: '2026-10-20' }).length, 3);
  assert.equal(store.practiceWords(pid, { from: '2026-10-10', to: '2026-10-15' }).length, 0);
});

test('homework groups words by name and dates and can be selected independently', () => {
  store.addWord(pid, { homework_name: 'Food', sv: 'äpple', en: 'apple', start_date: '2026-10-01', due_date: '2026-10-08' });
  const periods = store.listPeriods(pid);
  assert.deepEqual(
    periods.map((p) => [p.homework_name, p.start_date, p.due_date, p.count]),
    [
      ['Sentences', '2026-10-20', '2026-10-27', 1],
      ['Animals', '2026-10-01', '2026-10-08', 2],
      ['Food', '2026-10-01', '2026-10-08', 1],
    ],
  );
  assert.equal(store.practiceWords(pid, { periods: [['Animals', '2026-10-01', '2026-10-08']] }).length, 2);
  assert.equal(store.practiceWords(pid, { periods: [['2026-10-01', '2026-10-08']] }).length, 3);
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
