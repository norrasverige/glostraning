import { h } from '../dom.js';
import { confetti } from '../confetti.js';
import { isSentence } from '../text.js';
import { autoSpeak } from '../tts.js';
import { shuffle } from '../util.js';
import { statusBar } from './runner.js';

export const MEMORY_MAX_PAIRS = 8;

export function runMemory(root, session, ctx, onFinish) {
  const words = session.words;
  const cards = shuffle(
    words.flatMap((w) => [
      { key: `${w.id}-sv`, partner: `${w.id}-en`, word: w, text: w.sv, lang: 'sv-SE' },
      { key: `${w.id}-en`, partner: `${w.id}-sv`, word: w, text: w.en, lang: ctx.accent },
    ]),
  );
  const status = statusBar(session);
  const seen = new Set();
  let open = [];
  let locked = false;
  let matched = 0;

  function flip(card) {
    if (locked || card.matched || open.includes(card)) return;
    card.el.classList.add('open');
    if (card.lang !== 'sv-SE') autoSpeak(card.text, card.lang);
    open.push(card);
    if (open.length < 2) return;

    const [a, b] = open;
    if (a.word.id === b.word.id) {
      a.matched = b.matched = true;
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      open = [];
      session.record(a.word, 'match', true);
      matched++;
      confetti(25, { x: 0.5, y: 0.4 });
      status.update();
      if (matched === words.length) setTimeout(onFinish, 900);
    } else {
      // Only count a miss when the matching card had already been shown.
      if (seen.has(a.partner)) session.record(a.word, 'match', false);
      status.update();
      locked = true;
      setTimeout(() => {
        a.el.classList.remove('open');
        b.el.classList.remove('open');
        open = [];
        locked = false;
      }, 1200);
    }
    seen.add(a.key);
    seen.add(b.key);
  }

  const grid = h(
    'div',
    { class: 'memory-grid' },
    cards.map((card) => {
      card.el = h(
        'button',
        { type: 'button', class: 'memory-card', 'aria-label': 'Hidden card' },
        h('span', { class: 'memory-face memory-back' }, '?'),
        h(
          'span',
          { class: `memory-face memory-front${isSentence(card.text) ? ' small' : ''}` },
          h('small', {}, card.lang === 'sv-SE' ? 'Swedish' : 'English'),
          card.text,
        ),
      );
      card.el.addEventListener('click', () => flip(card));
      return card.el;
    }),
  );

  root.replaceChildren(status.el, h('div', { class: 'card' }, h('div', { class: 'prompt-label' }, 'Find the pairs!'), grid));
}
