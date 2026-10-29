import { api } from '../api.js';
import { h } from '../dom.js';
import { speakButton } from '../tts.js';

export async function statsView(app) {
  const { profile } = app.state;
  const { stats, badges, hardWords } = await api.stats(profile.id);
  const accuracy = stats.attempts ? Math.round((100 * stats.correct) / stats.attempts) : 0;

  return h(
    'div',
    { class: 'view' },
    h('h1', { class: 'title' }, '🏅 My badges & stats'),
    h(
      'div',
      { class: 'tiles' },
      h('div', { class: 'tile' }, h('b', {}, `⭐ ${stats.points}`), 'points'),
      h('div', { class: 'tile' }, h('b', {}, `🔥 ${stats.bestStreak}`), 'best streak'),
      h('div', { class: 'tile' }, h('b', {}, `📅 ${stats.dayStreak}`), 'days in a row'),
      h('div', { class: 'tile' }, h('b', {}, `${accuracy}%`), 'correct'),
      h('div', { class: 'tile' }, h('b', {}, stats.sessions), 'rounds played'),
    ),
    h(
      'div',
      { class: 'card' },
      h('h2', {}, `Badges (${badges.filter((b) => b.earned).length}/${badges.length})`),
      h(
        'div',
        { class: 'badge-grid' },
        badges.map((b) =>
          h(
            'div',
            { class: `badge${b.earned ? ' earned' : ''}`, title: b.desc },
            h('span', { class: 'badge-icon' }, b.earned ? b.icon : '🔒'),
            h('b', {}, b.title),
            h('small', {}, b.desc),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'row spread' },
        h('h2', {}, '💪 Hard words'),
        hardWords.length > 0 &&
          h(
            'button',
            {
              type: 'button',
              class: 'btn primary',
              onclick: () => {
                app.state.preset = { source: 'hard' };
                app.go('practice');
              },
            },
            'Practise these',
          ),
      ),
      hardWords.length
        ? h(
            'table',
            { class: 'hard-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Swedish'), h('th', {}, 'English'), h('th', {}, 'Right'))),
            h(
              'tbody',
              {},
              hardWords.map((w) =>
                h(
                  'tr',
                  {},
                  h('td', {}, w.sv),
                  h('td', {}, w.en, ' ', speakButton(w.en, profile.accent)),
                  h('td', {}, `${w.correct_count}/${w.tries}`),
                ),
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'No hard words right now – great work! 🎉'),
    ),
  );
}
