export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'value') el.value = value;
    else if (key === 'style') Object.assign(el.style, value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

let toastTimer;
export function toast(message, kind = 'info') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3500);
}

export function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function periodLabel(start, due) {
  return `${formatDate(start)} → ${formatDate(due)}`;
}

// Segmented control: one active option at a time.
export function segmented(options, value, onChange) {
  const buttons = options.map(([key, label]) =>
    h('button', { type: 'button', class: `seg${key === value ? ' active' : ''}`, 'data-key': key }, label),
  );
  const el = h('div', { class: 'segmented', role: 'group' }, buttons);
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button.seg');
    if (!btn) return;
    buttons.forEach((b) => b.classList.toggle('active', b === btn));
    onChange(btn.dataset.key);
  });
  return el;
}
