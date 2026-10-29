import { h } from '../dom.js';
import { alternatives, checkAnswer, isSentence, wordDiff } from '../text.js';
import { speakButton } from '../tts.js';

export function sides(question, accent) {
  const svToEn = question.dir === 'sv-en';
  const { sv, en } = question.word;
  return {
    prompt: svToEn ? sv : en,
    answer: svToEn ? en : sv,
    promptLang: svToEn ? 'sv-SE' : accent,
    answerLang: svToEn ? accent : 'sv-SE',
  };
}

export function promptBlock(s) {
  return [
    h('div', { class: 'prompt-label' }, s.promptLang === 'sv-SE' ? 'Translate to English' : 'Translate to Swedish'),
    h(
      'div',
      { class: `prompt${isSentence(s.prompt) ? ' sentence' : ''}` },
      h('span', {}, s.prompt),
      speakButton(s.prompt, s.promptLang),
    ),
  ];
}

export function answerInput() {
  return h('input', {
    class: 'answer',
    type: 'text',
    maxlength: 200,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    'aria-label': 'Your answer',
  });
}

export function answerFeedback(given, expected) {
  const result = checkAnswer(given, expected);
  const parts = [];
  if (result.correct) {
    if (alternatives(expected).length > 1) parts.push(h('p', { class: 'hint' }, 'All correct answers: ', expected));
  } else {
    if (result.almost) parts.push(h('p', { class: 'hint' }, 'So close! Check the spelling.'));
    if (isSentence(result.best) && given.trim()) {
      const diff = wordDiff(given, result.best);
      parts.push(
        h('p', { class: 'solution' }, 'Correct answer: ', diff.expected.map((t) => [h('span', { class: t.ok ? 'ok' : 'miss' }, t.text), ' '])),
      );
      if (diff.extra.length) {
        parts.push(h('p', { class: 'extra' }, 'Not in the sentence: ', diff.extra.map((t) => [h('span', { class: 'wrong' }, t), ' '])));
      }
    } else {
      parts.push(h('p', { class: 'solution' }, 'Correct answer: ', h('strong', {}, expected)));
    }
  }
  return { correct: result.correct, el: h('div', {}, parts) };
}
