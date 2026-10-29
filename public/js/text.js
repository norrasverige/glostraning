// Shared by the browser and the server.

const APOSTROPHES = /[\u2018\u2019\u02BC\u0060\u00B4]/g;
const QUOTES = /[\u201C\u201D\u201E"\u00AB\u00BB]/g;
const PUNCTUATION = /[.,!?;:\u00A1\u00BF()]/g;

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function alternatives(text) {
  const parts = String(text ?? '').split('/').map((t) => t.trim()).filter(Boolean);
  return parts.length ? parts : [String(text ?? '').trim()];
}

export function isSentence(text) {
  const t = String(text ?? '').trim();
  return /[.!?]$/.test(t) || t.split(/\s+/).length >= 3;
}

export function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function checkAnswer(answer, expected) {
  const given = normalize(answer);
  const alts = alternatives(expected);
  if (!given) return { correct: false, almost: false, best: alts[0] };

  let best = alts[0];
  let bestDistance = Infinity;
  for (const alt of alts) {
    const distance = levenshtein(given, normalize(alt));
    if (distance === 0) return { correct: true, almost: false, best: alt };
    if (distance < bestDistance) {
      bestDistance = distance;
      best = alt;
    }
  }
  const length = normalize(best).length;
  const almost = length >= 4 && bestDistance <= Math.max(1, Math.floor(length / 4));
  return { correct: false, almost, best };
}

// Marks which words of the expected sentence were found (in order) in the answer.
export function wordDiff(answer, expected) {
  const exp = String(expected).trim().split(/\s+/).filter(Boolean);
  const given = String(answer).trim().split(/\s+/).filter(Boolean);
  const e = exp.map(normalize);
  const g = given.map(normalize);
  const m = e.length;
  const n = g.length;

  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = e[i] === g[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const okExpected = new Array(m).fill(false);
  const okGiven = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (e[i] === g[j]) {
      okExpected[i] = okGiven[j] = true;
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return {
    expected: exp.map((text, k) => ({ text, ok: okExpected[k] })),
    extra: given.filter((_, k) => !okGiven[k]),
  };
}
