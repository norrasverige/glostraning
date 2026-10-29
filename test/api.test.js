import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  server = createApp({ dbFile: ':memory:' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const json = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

test('creates a profile and words with validation', async () => {
  const profile = await (await json('POST', '/api/profiles', { name: 'Elsa', avatar: '🦊', accent: 'en-US' })).json();
  assert.equal(profile.name, 'Elsa');

  const ok = await json('POST', `/api/profiles/${profile.id}/words`, { sv: ' hund ', en: 'dog', start_date: '2026-10-27', due_date: '2026-11-03' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).sv, 'hund');

  const badDates = await json('POST', `/api/profiles/${profile.id}/words`, { sv: 'a', en: 'b', start_date: '2026-11-04', due_date: '2026-11-03' });
  assert.equal(badDates.status, 400);

  const empty = await json('POST', `/api/profiles/${profile.id}/words`, { sv: '', en: 'b', start_date: '2026-11-01', due_date: '2026-11-03' });
  assert.equal(empty.status, 400);

  const practice = await (await json('GET', `/api/profiles/${profile.id}/practice?from=2026-10-30&to=2026-10-30`)).json();
  assert.equal(practice.length, 1);
});

test('rejects non-JSON bodies and unknown profiles', async () => {
  const res = await fetch(`${base}/api/profiles`, { method: 'POST', body: 'name=x' });
  assert.equal(res.status, 415);
  assert.equal((await json('GET', '/api/profiles/9999/words')).status, 404);
});

test('serves the app and blocks path traversal', async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await fetch(`${base}/..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e/src/app.js`)).status, 404);
});
