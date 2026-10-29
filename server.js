import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';

const port = Number(process.env.PORT) || 3000;
// Use HOST=0.0.0.0 to allow tablets on the home network to connect.
const host = process.env.HOST || '127.0.0.1';
const dbFile = process.env.DB_FILE || fileURLToPath(new URL('./data/glosor.db', import.meta.url));

createApp({ dbFile }).listen(port, host, () => {
  console.log(`Glosträning is running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
