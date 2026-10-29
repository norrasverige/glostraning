import { api } from '../api.js';
import { h, periodLabel, segmented, toast } from '../dom.js';
import { MEMORY_MAX_PAIRS } from '../modes/memory.js';
import { addDays, localDate } from '../util.js';

const MODES = [
  { key: 'type', icon: '⌨️', title: 'Type it', desc: 'Write the translation' },
  { key: 'choice', icon: '🔤', title: 'Pick one', desc: 'Choose the right answer' },
  { key: 'flashcards', icon: '🃏', title: 'Flashcards', desc: 'Flip and check yourself' },
  { key: 'listen', icon: '🎧', title: 'Listen & spell', desc: 'Hear it, write it' },
  { key: 'memory', icon: '🧠', title: 'Memory', desc: 'Find the matching pairs' },
];

function loadConfig() {
  const today = localDate();
  const defaults = { mode: 'type', direction: 'sv-en', kind: 'both', source: 'dates', from: addDays(today, -14), to: today, periods: [], count: '10' };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('practiceConfig')) };
  } catch {
    return defaults;
  }
}

export async function practiceView(app) {
  const { profile } = app.state;
  const periods = await api.periods(profile.id);
  const cfg = loadConfig();
  if (app.state.preset) {
    Object.assign(cfg, app.state.preset);
    app.state.preset = null;
  }
  const today = localDate();
  if (!cfg.periods.length) {
    cfg.periods = periods.filter((p) => p.start_date <= today && p.due_date >= today).map((p) => `${p.start_date}_${p.due_date}`);
  }

  const modeCards = MODES.map((m) =>
    h(
      'button',
      { type: 'button', class: `mode-card${m.key === cfg.mode ? ' active' : ''}`, 'data-key': m.key },
      h('span', { class: 'mode-icon' }, m.icon),
      h('b', {}, m.title),
      h('small', {}, m.desc),
    ),
  );
  const modeGrid = h('div', { class: 'mode-grid' }, modeCards);

  const directionBlock = h(
    'div',
    {},
    h('div', { class: 'label' }, 'Direction'),
    segmented(
      [
        ['sv-en', 'Swedish → English'],
        ['en-sv', 'English → Swedish'],
        ['mixed', 'Mixed'],
      ],
      cfg.direction,
      (v) => (cfg.direction = v),
    ),
  );

  const countBlock = h(
    'div',
    {},
    h('div', { class: 'label' }, 'How many?'),
    segmented(
      [
        ['5', '5'],
        ['10', '10'],
        ['20', '20'],
        ['all', 'All'],
      ],
      cfg.count,
      (v) => (cfg.count = v),
    ),
  );
  const memoryNote = h('p', { class: 'muted small' }, `Memory uses up to ${MEMORY_MAX_PAIRS} pairs.`);

  const updateModeOptions = () => {
    directionBlock.hidden = cfg.mode === 'listen' || cfg.mode === 'memory';
    countBlock.hidden = cfg.mode === 'memory';
    memoryNote.hidden = cfg.mode !== 'memory';
  };
  modeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    cfg.mode = card.dataset.key;
    modeCards.forEach((c) => c.classList.toggle('active', c === card));
    updateModeOptions();
  });
  updateModeOptions();

  const from = h('input', { type: 'date', value: cfg.from, 'aria-label': 'From' });
  const to = h('input', { type: 'date', value: cfg.to, 'aria-label': 'To' });
  from.addEventListener('change', () => (cfg.from = from.value));
  to.addEventListener('change', () => (cfg.to = to.value));

  const sourcePanels = {
    dates: h(
      'div',
      { class: 'panel' },
      h('p', { class: 'muted small' }, 'All words whose homework period overlaps these dates.'),
      h('div', { class: 'row' }, h('label', {}, 'From', from), h('label', {}, 'To', to)),
    ),
    periods: h(
      'div',
      { class: 'panel' },
      periods.length
        ? h(
            'div',
            { class: 'period-list' },
            periods.map((p) => {
              const key = `${p.start_date}_${p.due_date}`;
              const box = h('input', { type: 'checkbox', checked: cfg.periods.includes(key) });
              box.addEventListener('change', () => {
                cfg.periods = box.checked ? [...cfg.periods, key] : cfg.periods.filter((k) => k !== key);
              });
              return h('label', { class: 'check' }, box, periodLabel(p.start_date, p.due_date), h('span', { class: 'muted' }, ` · ${p.count}`));
            }),
          )
        : h('p', { class: 'muted' }, 'No homework yet.'),
    ),
    hard: h('div', { class: 'panel' }, h('p', { class: 'muted small' }, 'Practise the words you have found hardest so far. 💪')),
  };
  const showSource = () => Object.entries(sourcePanels).forEach(([k, el]) => (el.hidden = k !== cfg.source));
  showSource();

  async function start() {
    const params = { kind: cfg.kind };
    if (cfg.source === 'dates') {
      if (!cfg.from || !cfg.to || cfg.from > cfg.to) return toast('Pick a valid date range.', 'warn');
      Object.assign(params, { from: cfg.from, to: cfg.to });
    } else if (cfg.source === 'periods') {
      if (!cfg.periods.length) return toast('Tick at least one homework.', 'warn');
      params.periods = cfg.periods.join(',');
    } else {
      params.hard = '1';
    }
    if (cfg.mode === 'memory') params.limit = MEMORY_MAX_PAIRS;
    else if (cfg.count !== 'all') params.limit = cfg.count;

    try {
      localStorage.setItem('practiceConfig', JSON.stringify(cfg));
      const words = await api.practice(profile.id, params);
      if (!words.length) return toast('No words found. Try other dates or add more words!', 'warn');
      if (cfg.mode === 'memory' && words.length < 2) return toast('Memory needs at least 2 words.', 'warn');
      const pool = cfg.mode === 'choice' ? await api.words(profile.id) : words;
      app.state.practice = { mode: cfg.mode, direction: cfg.direction, words, pool };
      app.go('play');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return h(
    'div',
    { class: 'view' },
    h('h1', { class: 'title' }, '🚀 Practise'),
    h('div', { class: 'card' }, h('h2', {}, 'Choose a game'), modeGrid),
    h(
      'div',
      { class: 'card form' },
      h('h2', {}, 'Which words?'),
      segmented(
        [
          ['dates', '📅 Date range'],
          ['periods', '✅ Pick homework'],
          ['hard', '💪 Hard words'],
        ],
        cfg.source,
        (v) => {
          cfg.source = v;
          showSource();
        },
      ),
      Object.values(sourcePanels),
      h('div', { class: 'label' }, 'Words or sentences?'),
      segmented(
        [
          ['word', 'Words'],
          ['sentence', 'Sentences'],
          ['both', 'Both'],
        ],
        cfg.kind,
        (v) => (cfg.kind = v),
      ),
      directionBlock,
      countBlock,
      memoryNote,
    ),
    h('div', { class: 'row center' }, h('button', { type: 'button', class: 'btn primary huge', onclick: start }, "Let's go! 🚀")),
  );
}
