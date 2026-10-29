import { h, toast } from './dom.js';
import { isSentence } from './text.js';

// Uses the browser's built-in voices (Web Speech API). A cloud provider can replace speak() later.
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const LABELS = { 'sv-SE': 'Swedish', 'en-GB': 'British English', 'en-US': 'American English' };
const warned = new Set();
let voices = [];

const loadVoices = () => (voices = synth?.getVoices() ?? []);
if (synth) {
  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);
}

const langOf = (voice) => voice.lang.toLowerCase().replace('_', '-');

function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  toast(message, 'warn');
}

export function findVoice(lang) {
  if (!voices.length) loadVoices();
  const wanted = lang.toLowerCase();
  const exact = voices.filter((v) => langOf(v) === wanted);
  const pool = exact.length ? exact : voices.filter((v) => langOf(v).startsWith(wanted.slice(0, 2)));
  return pool.find((v) => /natural|online|neural/i.test(v.name)) ?? pool.find((v) => !v.localService) ?? pool[0] ?? null;
}

export function isMuted() {
  return localStorage.getItem('muted') === '1';
}

export function setMuted(muted) {
  localStorage.setItem('muted', muted ? '1' : '0');
  if (muted) synth?.cancel();
}

export function speak(text, lang, { slow = false } = {}) {
  if (!synth) {
    warnOnce('unsupported', 'This browser cannot read words aloud. Try Edge or Chrome.');
    return false;
  }
  const voice = findVoice(lang);
  if (!voice) {
    warnOnce(lang, `No ${LABELS[lang] ?? lang} voice is installed on this computer.`);
    return false;
  }
  if (langOf(voice) !== lang.toLowerCase()) {
    warnOnce(`${lang}-fallback`, `No ${LABELS[lang] ?? lang} voice found – using ${voice.lang} instead.`);
  }
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, ', '));
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = slow ? 0.6 : isSentence(text) ? 0.9 : 1;
  synth.speak(utterance);
  return true;
}

export function autoSpeak(text, lang) {
  if (!isMuted()) speak(text, lang);
}

export function speakButton(text, lang) {
  return h(
    'button',
    {
      type: 'button',
      class: 'icon-btn',
      title: `Listen (${LABELS[lang] ?? lang})`,
      'aria-label': 'Listen',
      onclick: (e) => {
        e.stopPropagation();
        speak(text, lang);
      },
    },
    '🔊',
  );
}
