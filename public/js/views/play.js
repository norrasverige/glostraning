import { api } from '../api.js';
import { confetti } from '../confetti.js';
import { h, toast } from '../dom.js';
import { Session } from '../session.js';
import { choiceMode } from '../modes/choice.js';
import { flashcardsMode } from '../modes/flashcards.js';
import { listenMode } from '../modes/listen.js';
import { runMemory } from '../modes/memory.js';
import { runQuiz } from '../modes/runner.js';
import { typeMode } from '../modes/type.js';
import { shuffle } from '../util.js';

const QUIZ_MODES = { type: typeMode, choice: choiceMode, flashcards: flashcardsMode, listen: listenMode };
const SESSION_DIRECTION = { listen: 'listen', memory: 'match' };

async function showSummary(root, session, app) {
  const practice = app.state.practice;
  root.replaceChildren(h('div', { class: 'card center' }, h('p', {}, 'Saving…')));

  let newBadges = [];
  try {
    const saved = await api.saveSession(app.state.profile.id, {
      mode: practice.mode,
      results: session.results,
      points: session.points,
      best_streak: session.bestStreak,
    });
    newBadges = saved.newBadges;
    app.setProfile(saved.profile);
  } catch (err) {
    toast(`Could not save your results: ${err.message}`, 'error');
  }

  const right = session.firstTryCorrect;
  const share = session.total ? right / session.total : 0;
  const stars = share >= 0.9 ? 3 : share >= 0.6 ? 2 : 1;
  const missed = session.missedWords;
  confetti(stars * 70, { x: 0.5, y: 0.5 });
  if (newBadges.length) setTimeout(() => confetti(150, { x: 0.5, y: 0.3 }), 700);

  const restart = (words) => {
    app.state.practice = { ...practice, words: shuffle(words) };
    app.render();
  };

  root.replaceChildren(
    h(
      'div',
      { class: 'card summary' },
      h('h1', {}, ['Good effort!', 'Well done!', 'Amazing!'][stars - 1]),
      h('div', { class: 'stars' }, [1, 2, 3].map((n) => h('span', { class: n <= stars ? 'on' : 'off' }, '⭐'))),
      h(
        'div',
        { class: 'tiles' },
        h('div', { class: 'tile' }, h('b', {}, `${right}/${session.total}`), 'right first time'),
        h('div', { class: 'tile' }, h('b', {}, `+${session.points}`), 'points'),
        h('div', { class: 'tile' }, h('b', {}, `🔥 ${session.bestStreak}`), 'best streak'),
      ),
      newBadges.length > 0 &&
        h(
          'div',
          { class: 'new-badges' },
          h('h2', {}, 'New badge!'),
          newBadges.map((b) => h('div', { class: 'badge earned pop' }, h('span', { class: 'badge-icon' }, b.icon), h('b', {}, b.title), h('small', {}, b.desc))),
        ),
      h(
        'div',
        { class: 'row center' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => restart(practice.words) }, '🔁 Play again'),
        missed.length > 0 && h('button', { type: 'button', class: 'btn', onclick: () => restart(missed) }, `💪 Practise ${missed.length} missed`),
        h('button', { type: 'button', class: 'btn', onclick: () => app.go('practice') }, '🎮 Other game'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => app.go('home') }, '🏠 Home'),
      ),
    ),
  );
}

export function playView(app) {
  const practice = app.state.practice;
  if (!practice) {
    app.go('practice');
    return h('div');
  }
  const root = h('div', { class: 'view play' });
  const session = new Session(practice.words, SESSION_DIRECTION[practice.mode] ?? practice.direction);
  const ctx = { accent: app.state.profile.accent, pool: practice.pool };
  const finish = () => showSummary(root, session, app);

  if (practice.mode === 'memory') runMemory(root, session, ctx, finish);
  else runQuiz(root, session, QUIZ_MODES[practice.mode], ctx, finish);
  return root;
}
