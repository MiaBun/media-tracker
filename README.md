# Trackr

A personal media tracker in the style of Trakt.tv, covering three areas:

- **Manga & Books** — volumes/chapters with owned/reading/read tracking, a "recommended next" list, backlog, wishlist, and a release calendar.
- **Anime, Movies & TV** — shows/movies with a backlog → in progress → watched flow, timelines that automatically advance to the next movie or show once the current one is finished, and a calendar of upcoming episodes/releases.
- **Games** — franchises, multi-platform tracking (each platform's progress is independent), shared objective categories (main quests, side quests, etc.) that automatically apply to every platform of a game, and franchise-aware recommendations.

No login/auth — this is built for single-user personal use.

## Setup

Requires Node.js 18+.

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The SQLite database is created automatically at `db/trackr.sqlite` on first run — no separate database setup needed.

To reset all data, stop the server and delete `db/trackr.sqlite` (and any `-wal`/`-shm` files next to it).

## How the pieces fit together

- **Manga**: a manga title has volumes; a volume has chapters. Mark a volume `owned` and its status as `reading` to make it show up in "Currently reading." The checkmark on that card advances chapters one at a time — finishing the last chapter marks the volume `read` and automatically starts the next owned volume as `reading`.
- **Books**: books skip the volume level — chapters attach directly to the book and carry their own `owned`/status.
- **Timelines** (Anime/Movies/TV): create a timeline, then add shows/movies to it in watch order. The "in progress" section always shows the current unfinished item in the timeline; once a TV show's episodes are all watched (or a movie is marked watched), the timeline automatically moves to the next item.
- **Games**: each platform copy of a game (PC, Switch, PS5, etc.) tracks its own status and objective completion independently. Objective categories and objectives are defined once per game — adding a new one automatically creates an (incomplete) entry for every existing platform, and adding a new platform automatically inherits every existing objective.

## Project structure

```
server.js          Express app entry point
db/schema.sql       SQLite schema
db/index.js          DB connection + auto-migration on boot
routes/manga.js     Manga & Books routes + recommendation logic
routes/screen.js    Anime/Movies/TV routes + timeline logic
routes/games.js     Games routes + objective propagation logic
views/              EJS templates (layout + one folder per section)
public/css/style.css Dark/purple Trakt-inspired styling
```

Everything is editable from the UI — add new works/shows/games, volumes/episodes/platforms, franchises, timelines, and objective categories directly from each page's forms.
