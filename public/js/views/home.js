import { api } from '../api.js';
import { h, periodLabel } from '../dom.js';
import { localDate } from '../util.js';

export async function homeView(app) {
  const { profile } = app.state;
  const [periods, { stats }] = await Promise.all([api.periods(profile.id), api.stats(profile.id)]);
  const today = localDate();
  const active = periods.filter((p) => p.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const practisePeriod = (p) => {
    app.state.preset = { source: 'periods', periods: [`${p.start_date}_${p.due_date}`] };
    app.go('practice');
  };

  return h(
    'div',
    { class: 'view' },
    h('h1', { class: 'title' }, `Hi ${profile.name}! ${profile.avatar}`),
    h(
      'div',
      { class: 'tiles' },
      h('div', { class: 'tile' }, h('b', {}, `⭐ ${stats.points}`), 'points'),
      h('div', { class: 'tile' }, h('b', {}, `📅 ${stats.dayStreak}`), stats.dayStreak === 1 ? 'day in a row' : 'days in a row'),
      h('div', { class: 'tile' }, h('b', {}, `📚 ${stats.words}`), 'words'),
    ),
    h(
      'div',
      { class: 'big-actions' },
      h('button', { type: 'button', class: 'action practise', onclick: () => app.go('practice') }, h('span', {}, '🚀'), 'Practise'),
      h('button', { type: 'button', class: 'action words', onclick: () => app.go('words') }, h('span', {}, '✏️'), 'Add words'),
      h('button', { type: 'button', class: 'action stats', onclick: () => app.go('stats') }, h('span', {}, '🏅'), 'My badges'),
    ),
    h(
      'div',
      { class: 'card' },
      h('h2', {}, 'Homework'),
      active.length
        ? h(
            'ul',
            { class: 'homework-list' },
            active.map((p) =>
              h(
                'li',
                {},
                h('span', {}, periodLabel(p.start_date, p.due_date)),
                h('span', { class: 'muted' }, `${p.count} ${p.count === 1 ? 'word' : 'words'}`),
                p.due_date === today && h('span', { class: 'pill due' }, 'Due today!'),
                h('button', { type: 'button', class: 'btn small primary', onclick: () => practisePeriod(p) }, 'Practise'),
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'No homework with an upcoming deadline. Add words under "Add words".'),
    ),
  );
}
