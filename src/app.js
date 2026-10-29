import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi, HttpError } from './api.js';
import { openStore } from './store.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

async function serveStatic(publicDir, pathname, res) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'Bad path');
  }
  if (relative.endsWith('/')) relative += 'index.html';
  const file = resolve(publicDir, `.${relative}`);
  const type = TYPES[extname(file)];
  if (!file.startsWith(publicDir + sep) || !type) throw new HttpError(404, 'Not found');
  let data;
  try {
    data = await readFile(file);
  } catch {
    throw new HttpError(404, 'Not found');
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(data);
}

export function createApp({ dbFile, publicDir = DEFAULT_PUBLIC_DIR }) {
  const store = openStore(dbFile);
  const api = createApi(store);
  const root = resolve(publicDir);

  const server = createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        await api(req, res, url);
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStatic(root, url.pathname, res);
      } else {
        throw new HttpError(405, 'Method not allowed');
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: status === 500 ? 'Something went wrong' : err.message }));
      } else {
        res.end();
      }
    }
  });

  server.on('close', () => store.close());
  return server;
}
