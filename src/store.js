import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isSentence } from '../public/js/text.js';
import { localDate, shuffle } from '../public/js/util.js';
import { BADGES, dayStreak, evaluateBadges, publicBadge } from './badges.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'en-GB',
  points INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sv TEXT NOT NULL,
  en TEXT NOT NULL,
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_words_profile_dates ON words(profile_id, start_date, due_date);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  total INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  points INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  direction TEXT NOT NULL,
  correct INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_word ON attempts(word_id);
CREATE TABLE IF NOT EXISTS badges (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (profile_id, code)
);
`;

// A word is "hard" while less than 80 % of its answers are correct.
const HARD_WORD_IDS = `
  SELECT word_id FROM attempts WHERE profile_id = ?
  GROUP BY word_id HAVING 1.0 * SUM(correct) / COUNT(*) < 0.8`;

const WORD_COLUMNS = 'id, sv, en, start_date, due_date';

export function openStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  const transaction = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  const getProfile = (id) =>
    db.prepare('SELECT id, name, avatar, accent, points, best_streak FROM profiles WHERE id = ?').get(id);

  const getWord = (id) => db.prepare(`SELECT profile_id, ${WORD_COLUMNS} FROM words WHERE id = ?`).get(id);

  function stats(profileId) {
    const profile = getProfile(profileId);
    const words = db.prepare('SELECT COUNT(*) AS n FROM words WHERE profile_id = ?').get(profileId).n;
    const attempts = db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS c FROM attempts WHERE profile_id = ?')
      .get(profileId);
    const sessions = db
      .prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT mode) AS modes FROM sessions WHERE profile_id = ?')
      .get(profileId);
    const days = db
      .prepare('SELECT DISTINCT date(created_at) AS d FROM sessions WHERE profile_id = ?')
      .all(profileId)
      .map((r) => r.d);
    return {
      points: profile.points,
      bestStreak: profile.best_streak,
      words,
      attempts: attempts.n,
      correct: attempts.c,
      sessions: sessions.n,
      modesTried: sessions.modes,
      dayStreak: dayStreak(days, localDate()),
    };
  }

  function hardWords(profileId, limit = 20) {
    return db
      .prepare(
        `SELECT w.id, w.sv, w.en, w.start_date, w.due_date,
                COUNT(a.id) AS tries, SUM(a.correct) AS correct_count,
                ROUND(1.0 * SUM(a.correct) / COUNT(a.id), 2) AS accuracy
         FROM words w JOIN attempts a ON a.word_id = w.id
         WHERE w.profile_id = ? AND w.id IN (${HARD_WORD_IDS})
         GROUP BY w.id
         ORDER BY accuracy ASC, tries DESC
         LIMIT ?`,
      )
      .all(profileId, profileId, limit);
  }

  return {
    close: () => db.close(),

    listProfiles: () =>
      db.prepare('SELECT id, name, avatar, accent, points, best_streak FROM profiles ORDER BY name').all(),

    getProfile,

    createProfile({ name, avatar, accent }) {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO profiles (name, avatar, accent) VALUES (?, ?, ?)')
        .run(name, avatar, accent);
      return getProfile(lastInsertRowid);
    },

    updateProfile(id, { name, avatar, accent }) {
      db.prepare('UPDATE profiles SET name = ?, avatar = ?, accent = ? WHERE id = ?').run(name, avatar, accent, id);
      return getProfile(id);
    },

    deleteProfile: (id) => db.prepare('DELETE FROM profiles WHERE id = ?').run(id).changes > 0,

    listWords: (profileId) =>
      db
        .prepare(`SELECT ${WORD_COLUMNS} FROM words WHERE profile_id = ? ORDER BY start_date DESC, due_date DESC, id DESC`)
        .all(profileId),

    getWord,

    addWord(profileId, { sv, en, start_date, due_date }) {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO words (profile_id, sv, en, start_date, due_date) VALUES (?, ?, ?, ?, ?)')
        .run(profileId, sv, en, start_date, due_date);
      return getWord(lastInsertRowid);
    },

    updateWord(id, { sv, en, start_date, due_date }) {
      db.prepare('UPDATE words SET sv = ?, en = ?, start_date = ?, due_date = ? WHERE id = ?').run(
        sv,
        en,
        start_date,
        due_date,
        id,
      );
      return getWord(id);
    },

    deleteWord: (id) => db.prepare('DELETE FROM words WHERE id = ?').run(id).changes > 0,

    listPeriods: (profileId) =>
      db
        .prepare(
          `SELECT start_date, due_date, COUNT(*) AS count FROM words WHERE profile_id = ?
           GROUP BY start_date, due_date ORDER BY start_date DESC, due_date DESC`,
        )
        .all(profileId),

    practiceWords(profileId, { from, to, periods, kind = 'both', limit, hard = false } = {}) {
      let sql = `SELECT ${WORD_COLUMNS} FROM words WHERE profile_id = ?`;
      const params = [profileId];
      if (hard) {
        sql += ` AND id IN (${HARD_WORD_IDS})`;
        params.push(profileId);
      }
      if (periods?.length) {
        sql += ` AND (${periods.map(() => '(start_date = ? AND due_date = ?)').join(' OR ')})`;
        params.push(...periods.flat());
      } else if (from || to) {
        // Overlap: the homework started before the range ends and is due after the range starts.
        sql += ' AND start_date <= ? AND due_date >= ?';
        params.push(to || '9999-12-31', from || '0000-01-01');
      }
      let rows = db.prepare(sql).all(...params);
      if (kind !== 'both') {
        rows = rows.filter((w) => (isSentence(w.sv) || isSentence(w.en)) === (kind === 'sentence'));
      }
      rows = shuffle(rows);
      return limit ? rows.slice(0, limit) : rows;
    },

    recordSession(profileId, { mode, results, points, bestStreak }) {
      return transaction(() => {
        const own = new Set(
          db.prepare('SELECT id FROM words WHERE profile_id = ?').all(profileId).map((r) => r.id),
        );
        const valid = results.filter((r) => own.has(r.word_id));
        const firstTry = new Map();
        for (const r of valid) if (!firstTry.has(r.word_id)) firstTry.set(r.word_id, r.correct);
        const total = firstTry.size;
        const correct = [...firstTry.values()].filter(Boolean).length;

        const sessionId = db
          .prepare(
            'INSERT INTO sessions (profile_id, mode, total, correct, points, best_streak) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(profileId, mode, total, correct, points, bestStreak).lastInsertRowid;

        const insertAttempt = db.prepare(
          'INSERT INTO attempts (profile_id, word_id, session_id, mode, direction, correct) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const r of valid) insertAttempt.run(profileId, r.word_id, sessionId, mode, r.direction, r.correct ? 1 : 0);

        db.prepare('UPDATE profiles SET points = points + ?, best_streak = MAX(best_streak, ?) WHERE id = ?').run(
          points,
          bestStreak,
          profileId,
        );

        const earned = new Set(
          db.prepare('SELECT code FROM badges WHERE profile_id = ?').all(profileId).map((r) => r.code),
        );
        const fresh = evaluateBadges(stats(profileId), { total, correct }).filter((b) => !earned.has(b.code));
        const insertBadge = db.prepare('INSERT INTO badges (profile_id, code) VALUES (?, ?)');
        for (const b of fresh) insertBadge.run(profileId, b.code);

        return {
          session: { id: sessionId, total, correct, points },
          newBadges: fresh.map(publicBadge),
          profile: getProfile(profileId),
        };
      });
    },

    stats(profileId) {
      const earned = new Map(
        db
          .prepare('SELECT code, earned_at FROM badges WHERE profile_id = ?')
          .all(profileId)
          .map((r) => [r.code, r.earned_at]),
      );
      return {
        stats: stats(profileId),
        badges: BADGES.map((b) => ({ ...publicBadge(b), earned: earned.has(b.code), earned_at: earned.get(b.code) ?? null })),
        hardWords: hardWords(profileId),
      };
    },
  };
}
