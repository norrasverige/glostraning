export const MODES = ['type', 'choice', 'flashcards', 'listen', 'memory'];
const DIRECTIONS = ['sv-en', 'en-sv', 'listen', 'match'];
const ACCENTS = ['en-GB', 'en-US'];
const KINDS = ['word', 'sentence', 'both'];
const MAX_TEXT = 200;
const MAX_BODY_BYTES = 100_000;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => {
  throw new HttpError(400, message);
};

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function text(value, field, max) {
  if (typeof value !== 'string') bad(`${field} is required`);
  const t = value.trim().replace(/\s+/g, ' ');
  if (!t) bad(`${field} is required`);
  if (t.length > max) bad(`${field} is too long (max ${max} characters)`);
  return t;
}

function profileInput(body) {
  const name = text(body?.name, 'Name', 30);
  const avatar = text(body?.avatar, 'Avatar', 16);
  if (!ACCENTS.includes(body?.accent)) bad('Accent must be en-GB or en-US');
  return { name, avatar, accent: body.accent };
}

export function wordInput(body) {
  const sv = text(body?.sv, 'Swedish', MAX_TEXT);
  const en = text(body?.en, 'English', MAX_TEXT);
  if (!isDate(body?.start_date)) bad('Homework date is not a valid date');
  if (!isDate(body?.due_date)) bad('Deadline is not a valid date');
  if (body.start_date > body.due_date) bad('The deadline must be on or after the homework date');
  return { sv, en, start_date: body.start_date, due_date: body.due_date };
}

function sessionInput(body) {
  if (!MODES.includes(body?.mode)) bad('Unknown mode');
  if (!Array.isArray(body.results) || body.results.length > 2000) bad('Invalid results');
  const results = body.results.map((r) => {
    if (!Number.isInteger(r?.word_id) || !DIRECTIONS.includes(r.direction) || typeof r.correct !== 'boolean') {
      bad('Invalid result');
    }
    return { word_id: r.word_id, direction: r.direction, correct: r.correct };
  });
  const clamp = (v, max) => (Number.isInteger(v) ? Math.min(Math.max(v, 0), max) : 0);
  return {
    mode: body.mode,
    results,
    points: clamp(body.points, results.length * 30),
    bestStreak: clamp(body.best_streak, results.length),
  };
}

function practiceQuery(q) {
  const from = q.get('from') || undefined;
  const to = q.get('to') || undefined;
  if (from && !isDate(from)) bad('Invalid from date');
  if (to && !isDate(to)) bad('Invalid to date');
  const periods = (q.get('periods') || '')
    .split(',')
    .filter(Boolean)
    .map((p) => {
      const [start, due] = p.split('_');
      if (!isDate(start) || !isDate(due)) bad('Invalid homework period');
      return [start, due];
    });
  if (periods.length > 200) bad('Too many homework periods');
  const kind = q.get('kind') || 'both';
  if (!KINDS.includes(kind)) bad('Invalid kind');
  const limit = q.get('limit') ? Number(q.get('limit')) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) bad('Invalid limit');
  return { from, to, periods, kind, limit, hard: q.get('hard') === '1' };
}

async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) {
    throw new HttpError(415, 'Expected application/json');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function createApi(store) {
  const routes = [];
  const route = (method, path, handler) =>
    routes.push({ method, re: new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>\\d+)')}$`), handler });

  const profile = (id) => store.getProfile(id) ?? (() => { throw new HttpError(404, 'Profile not found'); })();
  const word = (id) => store.getWord(id) ?? (() => { throw new HttpError(404, 'Word not found'); })();

  route('GET', '/api/profiles', () => store.listProfiles());
  route('POST', '/api/profiles', ({ body }) => store.createProfile(profileInput(body)));
  route('PUT', '/api/profiles/:id', ({ params, body }) => {
    profile(params.id);
    return store.updateProfile(params.id, profileInput(body));
  });
  route('DELETE', '/api/profiles/:id', ({ params }) => {
    profile(params.id);
    store.deleteProfile(params.id);
  });

  route('GET', '/api/profiles/:id/words', ({ params }) => {
    profile(params.id);
    return store.listWords(params.id);
  });
  route('POST', '/api/profiles/:id/words', ({ params, body }) => {
    profile(params.id);
    return store.addWord(params.id, wordInput(body));
  });
  route('GET', '/api/profiles/:id/periods', ({ params }) => {
    profile(params.id);
    return store.listPeriods(params.id);
  });
  route('GET', '/api/profiles/:id/practice', ({ params, query }) => {
    profile(params.id);
    return store.practiceWords(params.id, practiceQuery(query));
  });
  route('POST', '/api/profiles/:id/sessions', ({ params, body }) => {
    profile(params.id);
    return store.recordSession(params.id, sessionInput(body));
  });
  route('GET', '/api/profiles/:id/stats', ({ params }) => {
    profile(params.id);
    return store.stats(params.id);
  });

  route('PUT', '/api/words/:id', ({ params, body }) => {
    word(params.id);
    return store.updateWord(params.id, wordInput(body));
  });
  route('DELETE', '/api/words/:id', ({ params }) => {
    word(params.id);
    store.deleteWord(params.id);
  });

  return async function handle(req, res, url) {
    for (const r of routes) {
      const match = r.re.exec(url.pathname);
      if (!match || r.method !== req.method) continue;
      const params = Object.fromEntries(Object.entries(match.groups ?? {}).map(([k, v]) => [k, Number(v)]));
      const body = req.method === 'POST' || req.method === 'PUT' ? await readJson(req) : undefined;
      const result = await r.handler({ params, query: url.searchParams, body });
      if (result === undefined) {
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      }
      return;
    }
    throw new HttpError(404, 'Not found');
  };
}
