import { api } from '../api.js';
import { h, segmented, toast } from '../dom.js';

const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐸', '🐙', '🦖', '🐱', '🐶', '🐵', '🦉', '🐧', '🐨', '🦁', '🐰', '🐢'];

function profileForm(app, existing, onDone) {
  const data = { name: existing?.name ?? '', avatar: existing?.avatar ?? AVATARS[0], accent: existing?.accent ?? 'en-GB' };
  const name = h('input', { type: 'text', maxlength: 30, value: data.name, placeholder: 'Your name', required: true });
  const avatarButtons = AVATARS.map((a) =>
    h('button', { type: 'button', class: `avatar-pick${a === data.avatar ? ' active' : ''}`, 'aria-label': `Avatar ${a}` }, a),
  );
  const avatars = h('div', { class: 'avatar-grid' }, avatarButtons);
  avatars.addEventListener('click', (e) => {
    const btn = e.target.closest('.avatar-pick');
    if (!btn) return;
    data.avatar = btn.textContent;
    avatarButtons.forEach((b) => b.classList.toggle('active', b === btn));
  });

  return h(
    'form',
    {
      class: 'card form',
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const body = { ...data, name: name.value };
          const saved = existing ? await api.updateProfile(existing.id, body) : await api.createProfile(body);
          onDone(saved);
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    h('h2', {}, existing ? 'Edit profile' : 'New profile'),
    h('label', {}, 'Name', name),
    h('div', { class: 'label' }, 'Pick an avatar'),
    avatars,
    h('div', { class: 'label' }, 'English accent for pronunciation'),
    segmented(
      [
        ['en-GB', '💂 British'],
        ['en-US', '🗽 American'],
      ],
      data.accent,
      (v) => (data.accent = v),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save' : 'Create'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => onDone(null) }, 'Cancel'),
    ),
  );
}

export async function profilesView(app) {
  const profiles = await api.profiles();
  const root = h('div', { class: 'view' });
  let editing = false;

  function render(formFor) {
    if (formFor !== undefined) {
      root.replaceChildren(
        profileForm(app, formFor, async (saved) => {
          if (saved && app.state.profile?.id === saved.id) app.setProfile(saved);
          if (saved && !formFor) return app.setProfile(saved, 'home');
          app.render();
        }),
      );
      return;
    }

    const cards = profiles.map((p) =>
      h(
        'div',
        { class: 'profile-card' },
        h(
          'button',
          { type: 'button', class: 'profile-pick', onclick: () => app.setProfile(p, 'home') },
          h('span', { class: 'avatar' }, p.avatar),
          h('span', { class: 'name' }, p.name),
          h('span', { class: 'pill' }, `⭐ ${p.points}`),
        ),
        editing &&
          h(
            'div',
            { class: 'row center' },
            h('button', { type: 'button', class: 'btn small', onclick: () => render(p) }, '✏️ Edit'),
            h(
              'button',
              {
                type: 'button',
                class: 'btn small bad',
                onclick: async () => {
                  if (!confirm(`Delete ${p.name} and all their words and results?`)) return;
                  try {
                    await api.deleteProfile(p.id);
                    if (app.state.profile?.id === p.id) app.setProfile(null);
                    app.render();
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                },
              },
              '🗑️ Delete',
            ),
          ),
      ),
    );

    root.replaceChildren(
      h('h1', { class: 'title' }, profiles.length ? 'Who is practising today?' : 'Welcome to Glosträning! 👋'),
      h(
        'div',
        { class: 'profile-grid' },
        cards,
        h(
          'button',
          { type: 'button', class: 'profile-card profile-new', onclick: () => render(null) },
          h('span', { class: 'avatar' }, '➕'),
          h('span', { class: 'name' }, 'New profile'),
        ),
      ),
      profiles.length > 0 &&
        h(
          'div',
          { class: 'row center' },
          h('button', { type: 'button', class: 'btn ghost', onclick: () => ((editing = !editing), render()) }, editing ? 'Done' : 'Manage profiles'),
        ),
    );
  }

  render(profiles.length ? undefined : null);
  return root;
}
