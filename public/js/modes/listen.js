import { h } from '../dom.js';
import { speak } from '../tts.js';
import { answerFeedback, answerInput } from './common.js';

export const listenMode = {
  render(question, ctx, done) {
    const { en, sv } = question.word;
    const play = (slow) => speak(en, ctx.accent, { slow });
    const input = answerInput();
    const check = h('button', { class: 'btn primary', type: 'submit' }, 'Check');
    const hint = h('p', { class: 'hint', hidden: true }, 'In Swedish: ', h('strong', {}, sv));

    const form = h(
      'form',
      {
        class: 'answer-row',
        onsubmit: (e) => {
          e.preventDefault();
          if (input.disabled) return;
          if (!input.value.trim()) return input.focus();
          input.disabled = check.disabled = true;
          const feedback = answerFeedback(input.value, en);
          done(feedback.correct, feedback.el);
        },
      },
      input,
      check,
    );

    setTimeout(() => {
      play(false);
      input.focus();
    }, 300);

    return h(
      'div',
      { class: 'question' },
      h('div', { class: 'prompt-label' }, 'Listen and write it in English'),
      h(
        'div',
        { class: 'row center' },
        h('button', { type: 'button', class: 'btn big', onclick: () => play(false) }, '🔊 Play'),
        h('button', { type: 'button', class: 'btn', onclick: () => play(true) }, '🐢 Slowly'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => (hint.hidden = false) }, '💡 Hint'),
      ),
      hint,
      form,
    );
  },
};
