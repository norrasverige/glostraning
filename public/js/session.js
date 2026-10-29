const RETRY_GAP = 3;

function pickDirection(direction) {
  if (direction === 'mixed') return Math.random() < 0.5 ? 'sv-en' : 'en-sv';
  return direction;
}

export class Session {
  constructor(words, direction) {
    this.words = words;
    this.queue = words.map((word) => ({ word, dir: pickDirection(direction) }));
    this.total = words.length;
    this.done = 0;
    this.results = [];
    this.firstTry = new Map();
    this.points = 0;
    this.streak = 0;
    this.bestStreak = 0;
  }

  get current() {
    return this.queue[0];
  }

  get finished() {
    return this.queue.length === 0;
  }

  get firstTryCorrect() {
    return [...this.firstTry.values()].filter(Boolean).length;
  }

  get missedWords() {
    return this.words.filter((w) => this.firstTry.get(w.id) === false);
  }

  // Records one answer and returns the points earned for it.
  record(word, direction, correct) {
    this.results.push({ word_id: word.id, direction, correct });
    const first = !this.firstTry.has(word.id);
    if (first) this.firstTry.set(word.id, correct);
    if (!correct) {
      this.streak = 0;
      return 0;
    }
    this.done++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const gained = (first ? 10 : 5) + (this.streak >= 3 ? 5 : 0);
    this.points += gained;
    return gained;
  }

  // Wrong answers go back into the queue so the word is practised again soon.
  answer(correct) {
    const question = this.queue.shift();
    const gained = this.record(question.word, question.dir, correct);
    if (!correct) this.queue.splice(Math.min(RETRY_GAP, this.queue.length), 0, question);
    return gained;
  }
}
