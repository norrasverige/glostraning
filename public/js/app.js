import { api } from './api.js';
import { h, toast } from './dom.js';
import { isMuted, setMuted } from './tts.js';
import { homeView } from './views/home.js';
import { playView } from './views/play.js';
import { practiceView } from './views/practice.js';
import { profilesView } from './views/profiles.js';
import { statsView } from './views/stats.js';
import { wordsView } from './views/words.js';

const VIEWS = { home: homeView, words: wordsView, practice: practiceView, play: playView, stats: statsView, profiles: profilesView };
const main = document.getElementById('app');
const nav = document.getElementById('nav');
const chip = document.getElementById('profile-chip');
const muteButton = document.getElementById('mute');
let renderId = 0;

const app = {
  state: { profile: null, practice: null, preset: null },

  go(route) {
    if (location.hash === `#/${route}`) app.render();
    else location.hash = `#/${route}`;
  },

  setProfile(profile, route) {
    app.state.profile = profile;
    if (profile) localStorage.setItem('profileId', String(profile.id));
    else localStorage.removeItem('profileId');
    app.updateHeader();
    if (route) app.go(route);
  },

  updateHeader() {
    const { profile } = app.state;
    nav.hidden = !profile;
    chip.replaceChildren(
      ...(profile ? [h('span', { class: 'avatar small' }, profile.avatar), h('span', {}, profile.name), h('span', { class: 'pill' }, `⭐ ${profile.points}`)] : []),
    );
    chip.hidden = !profile;
    const route = currentRoute();
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${route}`));
  },

  async render() {
    const id = ++renderId;
    let route = currentRoute();
    if (!app.state.profile && route !== 'profiles') route = 'profiles';
    app.updateHeader();
    try {
      const el = await (VIEWS[route] ?? homeView)(app);
      if (id === renderId) main.replaceChildren(el);
    } catch (err) {
      toast(err.message, 'error');
    }
  },
};

function currentRoute() {
  return location.hash.replace(/^#\/?/, '') || 'home';
}

function updateMuteButton() {
  const muted = isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.title = muted ? 'Automatic reading is off' : 'Automatic reading is on';
}

muteButton.addEventListener('click', () => {
  setMuted(!isMuted());
  updateMuteButton();
});
chip.addEventListener('click', () => app.go('profiles'));
window.addEventListener('hashchange', () => app.render());

async function init() {
  updateMuteButton();
  const savedId = Number(localStorage.getItem('profileId'));
  if (savedId) {
    try {
      const profiles = await api.profiles();
      app.state.profile = profiles.find((p) => p.id === savedId) ?? null;
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  if (currentRoute() === 'play') location.hash = '#/home';
  app.render();
}

init();
