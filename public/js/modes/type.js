import { h } from '../dom.js';
import { autoSpeak } from '../tts.js';
import { answerFeedback, answerInput, promptBlock, sides } from './common.js';

export const typeMode = {
  render(question, ctx, done) {
    const s = sides(question, ctx.accent);
    const input = answerInput();
    const check = h('button', { class: 'btn primary', type: 'submit' }, 'Check');
    const skip = h('button', { class: 'btn ghost', type: 'button' }, "I don't know");

    const finish = (given) => {
      input.disabled = check.disabled = skip.disabled = true;
      if (s.answerLang !== 'sv-SE') autoSpeak(s.answer, s.answerLang);
      const feedback = answerFeedback(given, s.answer);
      done(feedback.correct, feedback.el);
    };

    const form = h(
      'form',
      {
        class: 'answer-row',
        onsubmit: (e) => {
          e.preventDefault();
          if (input.disabled) return;
          if (!input.value.trim()) return input.focus();
          finish(input.value);
        },
      },
      input,
      check,
    );
    skip.addEventListener('click', () => finish(''));

    if (s.promptLang !== 'sv-SE') autoSpeak(s.prompt, s.promptLang);
    setTimeout(() => input.focus());
    return h('div', { class: 'question' }, promptBlock(s), form, h('div', { class: 'row center' }, skip));
  },
};
