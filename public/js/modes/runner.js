import { h } from '../dom.js';
import { confetti } from '../confetti.js';

const PRAISE = ['Great job!', 'Awesome!', 'You rock!', 'Super!', 'Brilliant!', 'Fantastic!', 'Well done!', 'Nailed it!'];
const COMFORT = ['Not quite – this one comes back soon!', "Almost! You'll get it next time.", 'Good try! Practice makes perfect.'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function statusBar(session) {
  const bar = h('div', { class: 'progress-fill' });
  const points = h('span', { class: 'pill' });
  const streak = h('span', { class: 'pill streak' });
  const el = h('div', { class: 'status' }, h('div', { class: 'progress' }, bar), points, streak);
  const update = () => {
    bar.style.width = `${session.total ? (100 * session.done) / session.total : 0}%`;
    points.textContent = `⭐ ${session.points}`;
    streak.textContent = `🔥 ${session.streak}`;
    streak.classList.toggle('hot', session.streak >= 3);
  };
  update();
  return { el, update };
}

export function runQuiz(root, session, mode, ctx, onFinish) {
  const status = statusBar(session);
  const stage = h('div', { class: 'card stage' });
  root.replaceChildren(status.el, stage);

  function next() {
    if (session.finished) return onFinish();
    status.update();
    const question = session.current;
    let answered = false;
    stage.replaceChildren(
      mode.render(question, ctx, (correct, details) => {
        if (answered) return;
        answered = true;
        const gained = session.answer(correct);
        status.update();
        if (correct) {
          const milestone = session.streak > 0 && session.streak % 5 === 0;
          confetti(milestone ? 120 : 30, { x: 0.5, y: 0.4 });
        }
        if (mode.autoNext) {
          setTimeout(next, correct ? 500 : 900);
          return;
        }
        const nextButton = h('button', { class: 'btn primary big', type: 'button', onclick: next }, session.finished ? 'See results 🎉' : 'Next →');
        const message = correct
          ? `${pick(PRAISE)} +${gained}${session.streak >= 3 ? ` · ${session.streak} in a row!` : ''}`
          : pick(COMFORT);
        stage.append(h('div', { class: `feedback ${correct ? 'good' : 'bad'}` }, h('p', { class: 'feedback-title' }, message), details, nextButton));
        nextButton.focus();
      }),
    );
  }

  next();
}
