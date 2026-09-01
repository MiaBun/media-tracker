const express = require('express');
const router = express.Router();
const db = require('../db');

// ---------- helpers ----------

function getWork(id) {
  return db.prepare('SELECT * FROM works WHERE id = ?').get(id);
}

function volumesForWork(workId) {
  return db.prepare('SELECT * FROM volumes WHERE work_id = ? ORDER BY number').all(workId);
}

function chaptersForWork(workId) {
  return db.prepare('SELECT * FROM chapters WHERE work_id = ? ORDER BY number').all(workId);
}

function chaptersForVolume(volumeId) {
  return db.prepare('SELECT * FROM chapters WHERE volume_id = ? ORDER BY number').all(volumeId);
}

// Recommended next volume/chapter to consume, based on what's currently being read,
// sorted so already-owned items come first.
function getRecommendedNext() {
  const recs = [];

  // Manga: for each work with a volume in "reading" (or the highest "read" volume),
  // recommend the next unread volume.
  const mangaWorks = db.prepare("SELECT * FROM works WHERE type = 'manga'").all();
  for (const work of mangaWorks) {
    const vols = volumesForWork(work.id);
    if (!vols.length) continue;
    const reading = vols.find(v => v.status === 'reading');
    const lastRead = [...vols].reverse().find(v => v.status === 'read');
    const anchor = reading || lastRead;
    if (!anchor) continue;
    const next = vols.find(v => v.number > anchor.number && v.status !== 'read');
    if (next && next.id !== (reading && reading.id)) {
      recs.push({ work, type: 'manga', volume: next });
    }
  }

  // Books: for each book with a chapter in "reading" or the last "read" chapter,
  // recommend the next unread chapter.
  const books = db.prepare("SELECT * FROM works WHERE type = 'book'").all();
  for (const book of books) {
    const chaps = chaptersForWork(book.id);
    if (!chaps.length) continue;
    const reading = chaps.find(c => c.status === 'reading');
    const lastRead = [...chaps].reverse().find(c => c.status === 'read');
    const anchor = reading || lastRead;
    if (!anchor) continue;
    const next = chaps.find(c => c.number > anchor.number && c.status !== 'read');
    if (next && next.id !== (reading && reading.id)) {
      recs.push({ work: book, type: 'book', chapter: next });
    }
  }

  // owned items first
  recs.sort((a, b) => {
    const aOwned = a.volume ? a.volume.owned : a.chapter.owned;
    const bOwned = b.volume ? b.volume.owned : b.chapter.owned;
    return bOwned - aOwned;
  });
  return recs;
}

function getInProgress() {
  const mangaVols = db.prepare(`
    SELECT v.*, w.title as work_title, w.cover_url as work_cover, w.id as work_id
    FROM volumes v JOIN works w ON w.id = v.work_id
    WHERE v.status = 'reading' ORDER BY w.title
  `).all().map(v => ({ ...v, chapters: chaptersForVolume(v.id) }));

  const bookChaps = db.prepare(`
    SELECT c.*, w.title as work_title, w.cover_url as work_cover, w.id as work_id
    FROM chapters c JOIN works w ON w.id = c.work_id
    WHERE c.status = 'reading' AND w.type = 'book' ORDER BY w.title
  `).all();

  return { mangaVols, bookChaps };
}

function getBacklog() {
  const mangaVols = db.prepare(`
    SELECT v.*, w.title as work_title, w.cover_url as work_cover
    FROM volumes v JOIN works w ON w.id = v.work_id
    WHERE v.owned = 1 AND v.status = 'unread' ORDER BY w.title, v.number
  `).all();
  const bookChaps = db.prepare(`
    SELECT c.*, w.title as work_title, w.cover_url as work_cover
    FROM chapters c JOIN works w ON w.id = c.work_id
    WHERE c.owned = 1 AND c.status = 'unread' AND w.type = 'book' ORDER BY w.title, c.number
  `).all();
  return { mangaVols, bookChaps };
}

function getWishlist() {
  const mangaVols = db.prepare(`
    SELECT v.*, w.title as work_title, w.cover_url as work_cover
    FROM volumes v JOIN works w ON w.id = v.work_id
    WHERE v.owned = 0 ORDER BY w.title, v.number
  `).all();
  const bookChaps = db.prepare(`
    SELECT c.*, w.title as work_title, w.cover_url as work_cover
    FROM chapters c JOIN works w ON w.id = c.work_id
    WHERE c.owned = 0 AND w.type = 'book' ORDER BY w.title, c.number
  `).all();
  return { mangaVols, bookChaps };
}

function getRead() {
  const mangaVols = db.prepare(`
    SELECT v.*, w.title as work_title, w.cover_url as work_cover
    FROM volumes v JOIN works w ON w.id = v.work_id
    WHERE v.status = 'read' ORDER BY w.title, v.number
  `).all();
  const bookChaps = db.prepare(`
    SELECT c.*, w.title as work_title, w.cover_url as work_cover
    FROM chapters c JOIN works w ON w.id = c.work_id
    WHERE c.status = 'read' AND w.type = 'book' ORDER BY w.title, c.number
  `).all();
  return { mangaVols, bookChaps };
}

function getCalendar() {
  const volReleases = db.prepare(`
    SELECT v.id, v.number, v.release_date, w.title as work_title, w.id as work_id, 'volume' as kind
    FROM volumes v JOIN works w ON w.id = v.work_id
    WHERE v.release_date IS NOT NULL AND v.release_date >= date('now')
  `).all();
  const chapReleases = db.prepare(`
    SELECT c.id, c.number, c.release_date, w.title as work_title, w.id as work_id, 'chapter' as kind
    FROM chapters c JOIN works w ON w.id = c.work_id
    WHERE c.release_date IS NOT NULL AND c.release_date >= date('now')
  `).all();
  return [...volReleases, ...chapReleases].sort((a, b) => a.release_date.localeCompare(b.release_date));
}

// ---------- routes ----------

router.get('/', (req, res) => {
  res.render('manga/index', {
    title: 'Manga & Books',
    section: 'manga',
    recommended: getRecommendedNext(),
    inProgress: getInProgress(),
    backlog: getBacklog(),
    wishlist: getWishlist(),
    read: getRead(),
    calendar: getCalendar(),
    allWorks: db.prepare('SELECT * FROM works ORDER BY title').all(),
  });
});

router.post('/works', (req, res) => {
  const { type, title, author, cover_url } = req.body;
  const info = db.prepare('INSERT INTO works (type, title, author, cover_url) VALUES (?,?,?,?)')
    .run(type, title, author || null, cover_url || null);
  res.redirect(`/manga/works/${info.lastInsertRowid}`);
});

router.patch('/works/:id', (req, res) => {
  const { title, author, cover_url } = req.body;
  db.prepare('UPDATE works SET title = ?, author = ?, cover_url = ? WHERE id = ?')
    .run(title, author || null, cover_url || null, req.params.id);
  res.redirect(`/manga/works/${req.params.id}`);
});

router.delete('/works/:id', (req, res) => {
  db.prepare('DELETE FROM works WHERE id = ?').run(req.params.id);
  res.redirect('/manga');
});

router.get('/works/:id', (req, res) => {
  const work = getWork(req.params.id);
  if (!work) return res.status(404).send('Not found');
  if (work.type === 'manga') {
    const volumes = volumesForWork(work.id).map(v => ({ ...v, chapters: chaptersForVolume(v.id) }));
    res.render('manga/work', { title: work.title, section: 'manga', work, volumes, chapters: null });
  } else {
    const chapters = chaptersForWork(work.id);
    res.render('manga/work', { title: work.title, section: 'manga', work, volumes: null, chapters });
  }
});

router.post('/works/:id/volumes', (req, res) => {
  const { number, title, cover_url, release_date } = req.body;
  db.prepare('INSERT INTO volumes (work_id, number, title, cover_url, release_date) VALUES (?,?,?,?,?)')
    .run(req.params.id, number, title || null, cover_url || null, release_date || null);
  res.redirect(`/manga/works/${req.params.id}`);
});

router.patch('/volumes/:id', (req, res) => {
  const { number, title, cover_url, release_date } = req.body;
  const vol = db.prepare('SELECT * FROM volumes WHERE id=?').get(req.params.id);
  db.prepare('UPDATE volumes SET number = ?, title = ?, cover_url = ?, release_date = ? WHERE id = ?')
    .run(number, title || null, cover_url || null, release_date || null, req.params.id);
  res.redirect(`/manga/works/${vol.work_id}`);
});

router.delete('/volumes/:id', (req, res) => {
  const vol = db.prepare('SELECT * FROM volumes WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM volumes WHERE id = ?').run(req.params.id);
  res.redirect(`/manga/works/${vol.work_id}`);
});

router.post('/works/:id/chapters', (req, res) => {
  const { number, title, release_date, volume_id } = req.body;
  db.prepare('INSERT INTO chapters (work_id, volume_id, number, title, release_date) VALUES (?,?,?,?,?)')
    .run(req.params.id, volume_id || null, number, title || null, release_date || null);
  res.redirect(`/manga/works/${req.params.id}`);
});

router.patch('/chapters/:id', (req, res) => {
  const { number, title, release_date } = req.body;
  const ch = db.prepare('SELECT * FROM chapters WHERE id=?').get(req.params.id);
  db.prepare('UPDATE chapters SET number = ?, title = ?, release_date = ? WHERE id = ?')
    .run(number, title || null, release_date || null, req.params.id);
  res.redirect(`/manga/works/${ch.work_id}`);
});

router.delete('/chapters/:id', (req, res) => {
  const ch = db.prepare('SELECT * FROM chapters WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
  res.redirect(`/manga/works/${ch.work_id}`);
});

router.post('/volumes/:id/owned', (req, res) => {
  const vol = db.prepare('SELECT * FROM volumes WHERE id=?').get(req.params.id);
  db.prepare('UPDATE volumes SET owned = ? WHERE id = ?').run(vol.owned ? 0 : 1, req.params.id);
  res.redirect(req.get('Referer') || '/');
});

router.post('/volumes/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE volumes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.redirect(req.get('Referer') || '/');
});

router.post('/chapters/:id/owned', (req, res) => {
  const ch = db.prepare('SELECT * FROM chapters WHERE id=?').get(req.params.id);
  db.prepare('UPDATE chapters SET owned = ? WHERE id = ?').run(ch.owned ? 0 : 1, req.params.id);
  res.redirect(req.get('Referer') || '/');
});

router.post('/chapters/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE chapters SET status = ? WHERE id = ?').run(status, req.params.id);
  res.redirect(req.get('Referer') || '/');
});

// mark the next unread chapter of a volume as read (checkmark in "in progress")
router.post('/volumes/:id/next-chapter', (req, res) => {
  const chaps = chaptersForVolume(req.params.id);
  const next = chaps.find(c => c.status !== 'read');
  if (next) {
    db.prepare("UPDATE chapters SET status = 'read' WHERE id = ?").run(next.id);
    const stillUnread = chaptersForVolume(req.params.id).some(c => c.status !== 'read');
    if (!stillUnread) {
      db.prepare("UPDATE volumes SET status = 'read' WHERE id = ?").run(req.params.id);
      // auto-start next owned volume in the series
      const vol = db.prepare('SELECT * FROM volumes WHERE id=?').get(req.params.id);
      const siblings = volumesForWork(vol.work_id);
      const upNext = siblings.find(v => v.number > vol.number && v.owned && v.status === 'unread');
      if (upNext) db.prepare("UPDATE volumes SET status = 'reading' WHERE id = ?").run(upNext.id);
    }
  }
  res.redirect(req.get('Referer') || '/');
});

// mark next unread chapter of a book as read
router.post('/works/:id/next-chapter', (req, res) => {
  const chaps = chaptersForWork(req.params.id);
  const next = chaps.find(c => c.status !== 'read');
  if (next) db.prepare("UPDATE chapters SET status = 'read' WHERE id = ?").run(next.id);
  res.redirect(req.get('Referer') || '/');
});

module.exports = router;
