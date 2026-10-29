# glostraning
Ett program för att träna glosor.

## Run

Requires Node.js 22.13 or later (no npm packages needed).

```
npm start
```

Open http://localhost:3000 in Edge or Chrome (they have the best built-in voices for pronunciation).

To use it from a tablet on the home network, start with `$env:HOST="0.0.0.0"; npm start` and open `http://<computer-ip>:3000`.

Words are stored in `data/glosor.db` (SQLite). Back up that file to keep the words and results.

## Test

```
npm test
```
