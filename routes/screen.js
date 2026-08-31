const express = require('express');
const router = express.Router();
const db = require('../db');

// ---------- helpers ----------

function getShow(id) {
  return db.prepare('SELECT * FROM shows WHERE id = ?').get(id);
}

function episodesForShow(showId) {
  return db.prepare('SELECT * FROM episodes WHERE show_id = ? ORDER BY season, number').all(showId);
}

function nextEpisode(showId) {
  return db.prepare(`SELECT * FROM episodes WHERE show_id = ? AND watched = 0 ORDER BY season, number LIMIT 1`).get(showId);
}

function showIsComplete(showId) {
  const show = getShow(showId);
  if (show.type === 'movie') return show.status === 'watched';
  const eps = episodesForShow(showId);
  return eps.length > 0 && eps.every(e => e.watched);
}

function allTimelines() {
  const timelines = db.prepare('SELECT * FROM timelines').all();
  return timelines.map(t => {
    const items = db.prepare(`
      SELECT ti.*, s.title, s.type, s.cover_url, s.status
      FROM timeline_items ti JOIN shows s ON s.id = ti.show_id
      WHERE ti.timeline_id = ? ORDER BY ti.sort_order
    `).all(t.id);
    const current = items.find(i => !showIsComplete(i.show_id));
    let currentNextEpisode = null;
    if (current && current.type === 'tv') currentNextEpisode = nextEpisode(current.show_id);
    return { ...t, items, current, currentNextEpisode };
  });
}

function showIdsInAnyTimeline() {
  return new Set(db.prepare('SELECT DISTINCT show_id FROM timeline_items').all().map(r => r.show_id));
}

function getInProgress() {
  const inTimeline = showIdsInAnyTimeline();
  const shows = db.prepare("SELECT * FROM shows WHERE status = 'in_progress' ORDER BY title").all()
    .filter(s => !inTimeline.has(s.id))
    .map(s => ({ ...s, nextEp: s.type === 'tv' ? nextEpisode(s.id) : null }));
  return { standalone: shows, timelines: allTimelines() };
}

function getWatchNext() {
  const movies = db.prepare("SELECT * FROM shows WHERE type='movie' AND status='backlog' ORDER BY release_date").all();
  const tv = db.prepare("SELECT * FROM shows WHERE type='tv' AND status='backlog' ORDER BY title").all();
  return { movies, tv };
}

function getWatched() {
  return db.prepare("SELECT * FROM shows WHERE status='watched' ORDER BY title").all();
}

function getCalendar() {
  const movieDates = db.prepare(`
    SELECT id, title, release_date, 'movie' as kind FROM shows
    WHERE type='movie' AND release_date IS NOT NULL AND release_date >= date('now')
  `).all();
  const epDates = db.prepare(`
    SELECT e.id, s.title || ' - S' || e.season || 'E' || e.number as title, e.air_date as release_date, 'episode' as kind
    FROM episodes e JOIN shows s ON s.id = e.show_id
    WHERE e.air_date IS NOT NULL AND e.air_date >= date('now')
  `).all();
  return [...movieDates, ...epDates].sort((a, b) => a.release_date.localeCompare(b.release_date));
}

// when a show becomes fully watched, advance any timeline it belongs to
function advanceTimelinesFor(showId) {
  if (!showIsComplete(showId)) return;
  db.prepare("UPDATE shows SET status='watched' WHERE id=?").run(showId);
  const rows = db.prepare('SELECT * FROM timeline_items WHERE show_id = ?').all(showId);
  for (const row of rows) {
    const nextItem = db.prepare(`
      SELECT * FROM timeline_items WHERE timeline_id = ? AND sort_order > ? ORDER BY sort_order LIMIT 1
    `).get(row.timeline_id, row.sort_order);
    if (nextItem) {
      const nextShow = getShow(nextItem.show_id);
      if (nextShow.status === 'backlog') {
        db.prepare("UPDATE shows SET status='in_progress' WHERE id=?").run(nextShow.id);
      }
    }
  }
}

// ---------- routes ----------

router.get('/', (req, res) => {
  res.render('screen/index', {
    title: 'Anime, Movies & TV',
    section: 'screen',
    inProgress: getInProgress(),
    watchNext: getWatchNext(),
    watched: getWatched(),
    calendar: getCalendar(),
    timelines: db.prepare('SELECT * FROM timelines').all(),
    allShows: db.prepare('SELECT id, title, type, cover_url FROM shows ORDER BY title').all(),
  });
});

router.post('/shows', (req, res) => {
  const { type, title, cover_url, release_date, status } = req.body;
  const info = db.prepare('INSERT INTO shows (type, title, cover_url, release_date, status) VALUES (?,?,?,?,?)')
    .run(type, title, cover_url || null, release_date || null, status || 'backlog');
  res.redirect(`/screen/shows/${info.lastInsertRowid}`);
});

router.get('/shows/:id', (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).send('Not found');
  const episodes = show.type === 'tv' ? episodesForShow(show.id) : [];
  res.render('screen/show', { title: show.title, section: 'screen', show, episodes });
});

router.post('/shows/:id/episodes', (req, res) => {
  const { season, number, title, air_date } = req.body;
  db.prepare('INSERT INTO episodes (show_id, season, number, title, air_date) VALUES (?,?,?,?,?)')
    .run(req.params.id, season || 1, number, title || null, air_date || null);
  res.redirect(`/screen/shows/${req.params.id}`);
});

router.post('/shows/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE shows SET status = ? WHERE id = ?').run(status, req.params.id);
  res.redirect('back');
});

router.post('/episodes/:id/watched', (req, res) => {
  const ep = db.prepare('SELECT * FROM episodes WHERE id=?').get(req.params.id);
  db.prepare('UPDATE episodes SET watched = ? WHERE id = ?').run(ep.watched ? 0 : 1, req.params.id);
  advanceTimelinesFor(ep.show_id);
  res.redirect('back');
});

// checkmark: mark the next unwatched episode of a show as watched
router.post('/shows/:id/next-episode', (req, res) => {
  const ep = nextEpisode(req.params.id);
  if (ep) {
    db.prepare('UPDATE episodes SET watched = 1 WHERE id = ?').run(ep.id);
    advanceTimelinesFor(req.params.id);
  }
  res.redirect('back');
});

// mark a movie watched (also advances timelines)
router.post('/shows/:id/watch-movie', (req, res) => {
  db.prepare("UPDATE shows SET status='watched' WHERE id=?").run(req.params.id);
  advanceTimelinesFor(req.params.id);
  res.redirect('back');
});

router.post('/timelines', (req, res) => {
  const { name } = req.body;
  db.prepare('INSERT INTO timelines (name) VALUES (?)').run(name);
  res.redirect('/screen');
});

router.post('/timelines/:id/items', (req, res) => {
  const { show_id } = req.body;
  const max = db.prepare('SELECT MAX(sort_order) as m FROM timeline_items WHERE timeline_id = ?').get(req.params.id);
  const nextOrder = (max.m || 0) + 1;
  db.prepare('INSERT INTO timeline_items (timeline_id, show_id, sort_order) VALUES (?,?,?)')
    .run(req.params.id, show_id, nextOrder);
  // first item in a timeline should be in_progress if still backlog
  if (nextOrder === 1) {
    const show = getShow(show_id);
    if (show.status === 'backlog') db.prepare("UPDATE shows SET status='in_progress' WHERE id=?").run(show_id);
  }
  res.redirect('/screen');
});

module.exports = router;
