import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternatives, checkAnswer, isSentence, normalize, wordDiff } from '../public/js/text.js';
import { dayStreak } from '../src/badges.js';

test('normalize ignores case, spacing, punctuation and apostrophe style', () => {
  assert.equal(normalize('  I  DON\u2019T know! '), "i don't know");
  assert.equal(normalize('Hello, world.'), 'hello world');
});

test('isSentence', () => {
  assert.equal(isSentence('dog'), false);
  assert.equal(isSentence('ice cream'), false);
  assert.equal(isSentence('I have a dog'), true);
  assert.equal(isSentence('Hi!'), true);
});

test('alternatives split on slash', () => {
  assert.deepEqual(alternatives('big / large'), ['big', 'large']);
  assert.deepEqual(alternatives('dog'), ['dog']);
});

test('checkAnswer accepts alternatives and lenient formatting', () => {
  assert.equal(checkAnswer('Large', 'big / large').correct, true);
  assert.equal(checkAnswer("i don't like it", 'I don\u2019t like it.').correct, true);
  assert.equal(checkAnswer('', 'dog').correct, false);
});

test('checkAnswer flags near misses as almost', () => {
  const r = checkAnswer('elefant', 'elephant');
  assert.equal(r.correct, false);
  assert.equal(r.almost, true);
  assert.equal(checkAnswer('cat', 'elephant').almost, false);
});

test('wordDiff marks missing and extra words', () => {
  const d = wordDiff('I has a red bike', 'I have a red bike.');
  assert.deepEqual(
    d.expected.map((t) => t.ok),
    [true, false, true, true, true],
  );
  assert.deepEqual(d.extra, ['has']);
});

test('dayStreak counts consecutive days ending today or yesterday', () => {
  assert.equal(dayStreak(['2026-10-29', '2026-10-28', '2026-10-27', '2026-10-25'], '2026-10-29'), 3);
  assert.equal(dayStreak(['2026-10-28', '2026-10-27'], '2026-10-29'), 2);
  assert.equal(dayStreak(['2026-10-26'], '2026-10-29'), 0);
});
