import { addDays } from '../public/js/util.js';

export const BADGES = [
  { code: 'first_session', icon: '🎉', title: 'First practice', desc: 'Finish your first practice round', test: (s) => s.sessions >= 1 },
  { code: 'perfect_round', icon: '💯', title: 'Perfect!', desc: 'Get every word right the first time (at least 5 words)', test: (s, last) => !!last && last.total >= 5 && last.correct === last.total },
  { code: 'streak_10', icon: '🔥', title: 'On fire', desc: '10 correct answers in a row', test: (s) => s.bestStreak >= 10 },
  { code: 'streak_25', icon: '☄️', title: 'Unstoppable', desc: '25 correct answers in a row', test: (s) => s.bestStreak >= 25 },
  { code: 'answers_100', icon: '📚', title: 'Bookworm', desc: 'Answer 100 questions', test: (s) => s.attempts >= 100 },
  { code: 'answers_500', icon: '🏆', title: 'Word champion', desc: 'Answer 500 questions', test: (s) => s.attempts >= 500 },
  { code: 'days_3', icon: '📅', title: 'Three days in a row', desc: 'Practise three days in a row', test: (s) => s.dayStreak >= 3 },
  { code: 'days_7', icon: '🌟', title: 'A whole week', desc: 'Practise seven days in a row', test: (s) => s.dayStreak >= 7 },
  { code: 'all_modes', icon: '🎮', title: 'Explorer', desc: 'Try all five game modes', test: (s) => s.modesTried >= 5 },
  { code: 'collector_50', icon: '✏️', title: 'Word collector', desc: 'Add 50 words or sentences', test: (s) => s.words >= 50 },
  { code: 'points_1000', icon: '💎', title: '1000 points', desc: 'Collect 1000 points', test: (s) => s.points >= 1000 },
];

export function publicBadge({ code, icon, title, desc }) {
  return { code, icon, title, desc };
}

export function evaluateBadges(stats, lastSession) {
  return BADGES.filter((b) => b.test(stats, lastSession));
}

// A streak is still alive if the last practice day was yesterday.
export function dayStreak(dates, today) {
  const days = new Set(dates);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
