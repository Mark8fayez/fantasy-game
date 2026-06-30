# Fantasy 5 ⚽

A small Fantasy-Football-style game. Each manager builds a team of **5 players**
within a budget. Points are earned from events (goals, assists, cards) and
leaderboards update automatically.

## What's inside
- `index.js` — the server (website + API)
- `db.js` — tiny database (stored in `data.json`)
- `scoring.js` — the points rules (edit to re-balance)
- `public/` — the web pages (home, play, admin, leaderboard)

## Run it
```
npm install
npm start
```
Then open http://localhost:3000

## Admin
Go to `/admin`. The password is whatever you set in the `ADMIN_PASSWORD`
environment variable (Replit: add it under **Secrets**). Default is `admin123`.

## Scoring (default)
Goal +3 · Assist +2 · Clean sheet +2 · Yellow card −1 · Red card −3
