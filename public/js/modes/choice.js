import { h } from '../dom.js';
import { isSentence, normalize } from '../text.js';
import { autoSpeak } from '../tts.js';
import { shuffle } from '../util.js';
import { promptBlock, sides } from './common.js';

function distractors(question, pool, answer) {
  const field = question.dir === 'sv-en' ? 'en' : 'sv';
  const sentence = isSentence(answer);
  const others = shuffle(pool.filter((w) => w.id !== question.word.id));
  // Prefer options of the same kind (word vs. sentence) so the answer doesn't stand out.
  const ordered = [...others.filter((w) => isSentence(w[field]) === sentence), ...others.filter((w) => isSentence(w[field]) !== sentence)];
  const seen = new Set([normalize(answer)]);
  const picks = [];
  for (const w of ordered) {
    const key = normalize(w[field]);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(w[field]);
    if (picks.length === 3) break;
  }
  return picks;
}

export const choiceMode = {
  render(question, ctx, done) {
    const s = sides(question, ctx.accent);
    const options = shuffle([s.answer, ...distractors(question, ctx.pool, s.answer)]);

    const choose = (button, text) => {
      buttons.forEach((b) => {
        b.disabled = true;
        if (b.dataset.answer === '1') b.classList.add('right');
      });
      const correct = text === s.answer;
      if (!correct) button.classList.add('wrong');
      if (s.answerLang !== 'sv-SE') autoSpeak(s.answer, s.answerLang);
      done(correct, null);
    };

    const buttons = options.map((text) => {
      const button = h('button', { type: 'button', class: 'option', 'data-answer': text === s.answer ? '1' : '0' }, text);
      button.addEventListener('click', () => choose(button, text));
      return button;
    });

    if (s.promptLang !== 'sv-SE') autoSpeak(s.prompt, s.promptLang);
    return h('div', { class: 'question' }, promptBlock(s), h('div', { class: 'options' }, buttons));
  },
};
