import { api } from '../api.js';
import { h, periodLabel, toast } from '../dom.js';
import { speakButton } from '../tts.js';
import { addDays, localDate } from '../util.js';

function loadLastDates() {
  try {
    const saved = JSON.parse(localStorage.getItem('lastDates'));
    if (saved?.start && saved?.due) return saved;
  } catch {
    // ignore corrupt value
  }
  const today = localDate();
  return { start: today, due: addDays(today, 7) };
}

export async function wordsView(app) {
  const { profile } = app.state;
  let words = await api.words(profile.id);
  let editingId = null;
  let filter = '';
  const recent = new Set();

  const dates = loadLastDates();
  const start = h('input', { type: 'date', value: dates.start, required: true });
  const due = h('input', { type: 'date', value: dates.due, required: true });
  const sv = h('input', { type: 'text', maxlength: 200, placeholder: 'e.g. hund  or  Jag har en hund.', autocomplete: 'off' });
  const en = h('input', { type: 'text', maxlength: 200, placeholder: 'e.g. dog  or  I have a dog.', autocomplete: 'off' });
  const list = h('div', { class: 'word-groups' });
  const heading = h('h2', {});
  const search = h('input', { type: 'search', placeholder: 'Search…', 'aria-label': 'Search words' });
  search.addEventListener('input', () => {
    filter = search.value.trim().toLowerCase();
    renderList();
  });

  const saveDates = () => localStorage.setItem('lastDates', JSON.stringify({ start: start.value, due: due.value }));
  start.addEventListener('change', () => {
    if (due.value < start.value) due.value = addDays(start.value, 7);
    saveDates();
  });
  due.addEventListener('change', saveDates);

  async function add(e) {
    e.preventDefault();
    if (!sv.value.trim()) return sv.focus();
    if (!en.value.trim()) return en.focus();
    try {
      const word = await api.addWord(profile.id, { sv: sv.value, en: en.value, start_date: start.value, due_date: due.value });
      words = [word, ...words];
      recent.add(word.id);
      sv.value = en.value = '';
      sv.focus();
      renderList();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function editRow(w) {
    const f = {
      sv: h('input', { type: 'text', maxlength: 200, value: w.sv, 'aria-label': 'Swedish' }),
      en: h('input', { type: 'text', maxlength: 200, value: w.en, 'aria-label': 'English' }),
      start: h('input', { type: 'date', value: w.start_date, 'aria-label': 'Homework date' }),
      due: h('input', { type: 'date', value: w.due_date, 'aria-label': 'Deadline' }),
    };
    return h(
      'form',
      {
        class: 'word-row editing',
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            const updated = await api.updateWord(w.id, { sv: f.sv.value, en: f.en.value, start_date: f.start.value, due_date: f.due.value });
            words = words.map((x) => (x.id === w.id ? updated : x));
            editingId = null;
            renderList();
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      },
      f.sv,
      f.en,
      f.start,
      f.due,
      h('button', { type: 'submit', class: 'btn small primary' }, 'Save'),
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => ((editingId = null), renderList()) }, 'Cancel'),
    );
  }

  function viewRow(w) {
    return h(
      'div',
      { class: `word-row${recent.has(w.id) ? ' recent' : ''}` },
      h('span', { class: 'sv' }, w.sv, speakButton(w.sv, 'sv-SE')),
      h('span', { class: 'en' }, w.en, speakButton(w.en, profile.accent)),
      h(
        'span',
        { class: 'row-actions' },
        h('button', { type: 'button', class: 'icon-btn', title: 'Edit', 'aria-label': 'Edit', onclick: () => ((editingId = w.id), renderList()) }, '✏️'),
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            title: 'Delete',
            'aria-label': 'Delete',
            onclick: async () => {
              if (!confirm(`Delete "${w.sv} – ${w.en}"?`)) return;
              try {
                await api.deleteWord(w.id);
                words = words.filter((x) => x.id !== w.id);
                renderList();
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          },
          '🗑️',
        ),
      ),
    );
  }

  function renderList() {
    heading.textContent = `All words (${words.length})`;
    const shown = filter ? words.filter((w) => `${w.sv} ${w.en}`.toLowerCase().includes(filter)) : words;
    const groups = new Map();
    for (const w of shown) {
      const key = `${w.start_date}_${w.due_date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(w);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
    list.replaceChildren(
      ...(sorted.length
        ? sorted.map(([key, items]) => {
            const [s, d] = key.split('_');
            return h(
              'section',
              { class: 'word-group' },
              h('h3', {}, `📅 ${periodLabel(s, d)}`, h('span', { class: 'muted' }, ` · ${items.length}`)),
              items.map((w) => (w.id === editingId ? editRow(w) : viewRow(w))),
            );
          })
        : [h('p', { class: 'muted' }, filter ? 'No matches.' : 'No words yet. Add your first one above!')]),
    );
  }

  renderList();
  setTimeout(() => sv.focus());

  return h(
    'div',
    { class: 'view' },
    h('h1', { class: 'title' }, '✏️ Add words'),
    h(
      'form',
      { class: 'card form', onsubmit: add },
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Homework date', start),
        h('label', {}, 'Deadline', due),
      ),
      h(
        'div',
        { class: 'row add-row' },
        h('label', { class: 'grow' }, 'Swedish', sv),
        h('label', { class: 'grow' }, 'English', en),
        h('button', { type: 'submit', class: 'btn primary' }, 'Add ➕'),
      ),
      h('p', { class: 'muted small' }, 'Tip: several correct answers can be separated with / (e.g. big / large). Sentences work too!'),
    ),
    h('div', { class: 'card' }, h('div', { class: 'row spread' }, heading, search), list),
  );
}
