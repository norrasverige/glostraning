import { h } from '../dom.js';
import { isSentence } from '../text.js';
import { autoSpeak, speakButton } from '../tts.js';
import { sides } from './common.js';

export const flashcardsMode = {
  autoNext: true,

  render(question, ctx, done) {
    const s = sides(question, ctx.accent);
    const face = (label, text, lang, extraClass) =>
      h(
        'div',
        { class: `flash-face ${extraClass}` },
        h('small', {}, label),
        h('div', { class: `prompt${isSentence(text) ? ' sentence' : ''}` }, h('span', {}, text), speakButton(text, lang)),
      );

    const card = h(
      'div',
      { class: 'flashcard' },
      h(
        'div',
        { class: 'flash-inner' },
        face(s.promptLang === 'sv-SE' ? 'Swedish' : 'English', s.prompt, s.promptLang, 'front'),
        face(s.answerLang === 'sv-SE' ? 'Swedish' : 'English', s.answer, s.answerLang, 'back'),
      ),
    );

    const flipButton = h('button', { type: 'button', class: 'btn primary big' }, 'Flip the card');
    const knew = h('button', { type: 'button', class: 'btn good big', hidden: true }, '✓ I knew it');
    const notYet = h('button', { type: 'button', class: 'btn bad big', hidden: true }, '✗ Not yet');

    const flip = () => {
      if (card.classList.contains('flipped')) return;
      card.classList.add('flipped');
      flipButton.hidden = true;
      knew.hidden = notYet.hidden = false;
      if (s.answerLang !== 'sv-SE') autoSpeak(s.answer, s.answerLang);
    };
    const grade = (correct) => {
      knew.disabled = notYet.disabled = true;
      done(correct, null);
    };

    card.addEventListener('click', flip);
    flipButton.addEventListener('click', flip);
    knew.addEventListener('click', () => grade(true));
    notYet.addEventListener('click', () => grade(false));

    if (s.promptLang !== 'sv-SE') autoSpeak(s.prompt, s.promptLang);
    return h('div', { class: 'question' }, card, h('div', { class: 'row center' }, flipButton, knew, notYet));
  },
};
