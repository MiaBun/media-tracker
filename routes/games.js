const express = require('express');
const router = express.Router();
const db = require('../db');

// ---------- helpers ----------

function getGame(id) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id);
}

function platformsForGame(gameId) {
  return db.prepare('SELECT * FROM game_platforms WHERE game_id = ? ORDER BY platform_name').all(gameId);
}

function categoriesWithObjectives(gameId, platformId) {
  const cats = db.prepare('SELECT * FROM objective_categories WHERE game_id = ? ORDER BY name').all(gameId);
  return cats.map(cat => {
    const objs = db.prepare('SELECT * FROM objectives WHERE category_id = ? ORDER BY id').all(cat.id)
      .map(o => {
        const comp = db.prepare('SELECT completed FROM objective_completion WHERE objective_id=? AND platform_id=?')
          .get(o.id, platformId);
        return { ...o, completed: comp ? !!comp.completed : false };
      });
    return { ...cat, objectives: objs };
  });
}

function progressFor(gameId, platformId) {
  const rows = db.prepare(`
    SELECT oc.completed FROM objective_completion oc
    JOIN objectives o ON o.id = oc.objective_id
    JOIN objective_categories c ON c.id = o.category_id
    WHERE c.game_id = ? AND oc.platform_id = ?
  `).all(gameId, platformId);
  const total = rows.length;
  const done = rows.filter(r => r.completed).length;
  return { done, total };
}

function franchiseHasStartedGame(franchiseId, excludeGameId) {
  if (!franchiseId) return false;
  const row = db.prepare(`
    SELECT COUNT(*) as c FROM game_platforms gp JOIN games g ON g.id = gp.game_id
    WHERE g.franchise_id = ? AND g.id != ? AND gp.status IN ('in_progress','played')
  `).get(franchiseId, excludeGameId);
  return row.c > 0;
}

function getInProgress() {
  return db.prepare(`
    SELECT gp.*, g.title, g.cover_url, g.id as game_id, f.name as franchise_name
    FROM game_platforms gp JOIN games g ON g.id = gp.game_id
    LEFT JOIN franchises f ON f.id = g.franchise_id
    WHERE gp.status = 'in_progress' ORDER BY g.title
  `).all().map(gp => ({ ...gp, progress: progressFor(gp.game_id, gp.id) }));
}

function getBacklog() {
  return db.prepare(`
    SELECT gp.*, g.title, g.cover_url, g.id as game_id, f.name as franchise_name
    FROM game_platforms gp JOIN games g ON g.id = gp.game_id
    LEFT JOIN franchises f ON f.id = g.franchise_id
    WHERE gp.status = 'backlog' ORDER BY g.title
  `).all();
}

function getPlayed() {
  return db.prepare(`
    SELECT gp.*, g.title, g.cover_url, g.id as game_id, f.name as franchise_name
    FROM game_platforms gp JOIN games g ON g.id = gp.game_id
    LEFT JOIN franchises f ON f.id = g.franchise_id
    WHERE gp.status = 'played' ORDER BY g.title
  `).all().map(gp => ({ ...gp, progress: progressFor(gp.game_id, gp.id) }));
}

function getRecommendedNext() {
  const backlog = getBacklog();
  const scored = backlog.map(gp => ({
    ...gp,
    franchiseStarted: franchiseHasStartedGame(
      db.prepare('SELECT franchise_id FROM games WHERE id=?').get(gp.game_id).franchise_id,
      gp.game_id
    ),
  }));
  scored.sort((a, b) => (b.franchiseStarted - a.franchiseStarted));
  return scored;
}

function getCalendar() {
  return db.prepare(`
    SELECT id, title, release_date FROM games
    WHERE release_date IS NOT NULL AND release_date >= date('now') ORDER BY release_date
  `).all();
}

// ---------- routes ----------

router.get('/', (req, res) => {
  res.render('games/index', {
    title: 'Games',
    section: 'games',
    inProgress: getInProgress(),
    backlog: getBacklog(),
    played: getPlayed(),
    recommended: getRecommendedNext(),
    calendar: getCalendar(),
    franchises: db.prepare('SELECT * FROM franchises ORDER BY name').all(),
    allGames: db.prepare(`
      SELECT g.*, f.name as franchise_name FROM games g LEFT JOIN franchises f ON f.id = g.franchise_id ORDER BY g.title
    `).all(),
  });
});

router.post('/franchises', (req, res) => {
  const { name } = req.body;
  db.prepare('INSERT INTO franchises (name) VALUES (?)').run(name);
  res.redirect('/games');
});

router.patch('/franchises/:id', (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE franchises SET name = ? WHERE id = ?').run(name, req.params.id);
  res.redirect('/games');
});

router.delete('/franchises/:id', (req, res) => {
  db.prepare('DELETE FROM franchises WHERE id = ?').run(req.params.id);
  res.redirect('/games');
});

router.post('/games', (req, res) => {
  const { title, cover_url, release_date, franchise_id, platform_name } = req.body;
  const info = db.prepare('INSERT INTO games (franchise_id, title, cover_url, release_date) VALUES (?,?,?,?)')
    .run(franchise_id || null, title, cover_url || null, release_date || null);
  const gameId = info.lastInsertRowid;
  if (platform_name) {
    db.prepare('INSERT INTO game_platforms (game_id, platform_name) VALUES (?,?)').run(gameId, platform_name);
  }
  res.redirect(`/games/${gameId}`);
});

router.get('/:id', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).send('Not found');
  const platforms = platformsForGame(game.id);
  const franchise = game.franchise_id ? db.prepare('SELECT * FROM franchises WHERE id=?').get(game.franchise_id) : null;
  const platformDetails = platforms.map(p => ({
    ...p,
    categories: categoriesWithObjectives(game.id, p.id),
    progress: progressFor(game.id, p.id),
  }));
  res.render('games/game', { title: game.title, section: 'games', game, franchise, platforms: platformDetails,
    franchises: db.prepare('SELECT * FROM franchises ORDER BY name').all() });
});

router.patch('/:id', (req, res) => {
  const { title, cover_url, release_date, franchise_id } = req.body;
  db.prepare('UPDATE games SET title = ?, cover_url = ?, release_date = ?, franchise_id = ? WHERE id = ?')
    .run(title, cover_url || null, release_date || null, franchise_id || null, req.params.id);
  res.redirect(`/games/${req.params.id}`);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.redirect('/games');
});

router.post('/:id/platforms', (req, res) => {
  const { platform_name } = req.body;
  const info = db.prepare('INSERT INTO game_platforms (game_id, platform_name) VALUES (?,?)')
    .run(req.params.id, platform_name);
  // reflect existing objectives to the new platform (as incomplete)
  const objs = db.prepare(`
    SELECT o.id FROM objectives o JOIN objective_categories c ON c.id = o.category_id WHERE c.game_id = ?
  `).all(req.params.id);
  const insert = db.prepare('INSERT INTO objective_completion (objective_id, platform_id, completed) VALUES (?,?,0)');
  for (const o of objs) insert.run(o.id, info.lastInsertRowid);
  res.redirect(`/games/${req.params.id}`);
});

router.patch('/platforms/:id', (req, res) => {
  const { platform_name } = req.body;
  const p = db.prepare('SELECT * FROM game_platforms WHERE id=?').get(req.params.id);
  db.prepare('UPDATE game_platforms SET platform_name = ? WHERE id = ?').run(platform_name, req.params.id);
  res.redirect(`/games/${p.game_id}`);
});

router.delete('/platforms/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM game_platforms WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM game_platforms WHERE id = ?').run(req.params.id);
  res.redirect(`/games/${p.game_id}`);
});

router.post('/platforms/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE game_platforms SET status = ? WHERE id = ?').run(status, req.params.id);
  res.redirect(req.get('Referer') || '/');
});

router.post('/:id/categories', (req, res) => {
  const { name } = req.body;
  db.prepare('INSERT INTO objective_categories (game_id, name) VALUES (?,?)').run(req.params.id, name);
  res.redirect(`/games/${req.params.id}`);
});

router.patch('/categories/:id', (req, res) => {
  const { name } = req.body;
  const cat = db.prepare('SELECT * FROM objective_categories WHERE id=?').get(req.params.id);
  db.prepare('UPDATE objective_categories SET name = ? WHERE id = ?').run(name, req.params.id);
  res.redirect(`/games/${cat.game_id}`);
});

router.delete('/categories/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM objective_categories WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM objective_categories WHERE id = ?').run(req.params.id);
  res.redirect(`/games/${cat.game_id}`);
});

// adding an objective reflects it to every platform of the game automatically
router.post('/categories/:id/objectives', (req, res) => {
  const { description } = req.body;
  const cat = db.prepare('SELECT * FROM objective_categories WHERE id=?').get(req.params.id);
  const info = db.prepare('INSERT INTO objectives (category_id, description) VALUES (?,?)').run(req.params.id, description);
  const platforms = platformsForGame(cat.game_id);
  const insert = db.prepare('INSERT INTO objective_completion (objective_id, platform_id, completed) VALUES (?,?,0)');
  for (const p of platforms) insert.run(info.lastInsertRowid, p.id);
  res.redirect(`/games/${cat.game_id}`);
});

function gameIdForObjective(objectiveId) {
  const row = db.prepare(`
    SELECT c.game_id FROM objectives o JOIN objective_categories c ON c.id = o.category_id WHERE o.id = ?
  `).get(objectiveId);
  return row ? row.game_id : null;
}

router.patch('/objectives/:id', (req, res) => {
  const { description } = req.body;
  const gameId = gameIdForObjective(req.params.id);
  db.prepare('UPDATE objectives SET description = ? WHERE id = ?').run(description, req.params.id);
  res.redirect(`/games/${gameId}`);
});

router.delete('/objectives/:id', (req, res) => {
  const gameId = gameIdForObjective(req.params.id);
  db.prepare('DELETE FROM objectives WHERE id = ?').run(req.params.id);
  res.redirect(`/games/${gameId}`);
});

router.post('/objectives/:id/toggle', (req, res) => {
  const { platform_id } = req.body;
  const row = db.prepare('SELECT * FROM objective_completion WHERE objective_id=? AND platform_id=?')
    .get(req.params.id, platform_id);
  if (row) {
    db.prepare('UPDATE objective_completion SET completed = ? WHERE objective_id=? AND platform_id=?')
      .run(row.completed ? 0 : 1, req.params.id, platform_id);
  } else {
    db.prepare('INSERT INTO objective_completion (objective_id, platform_id, completed) VALUES (?,?,1)')
      .run(req.params.id, platform_id);
  }
  res.redirect(req.get('Referer') || '/');
});

module.exports = router;
