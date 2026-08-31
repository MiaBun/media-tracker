-- ============= MANGA & BOOKS =============
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('manga','book')),
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Volumes only exist for manga. Books skip straight to chapters.
CREATE TABLE IF NOT EXISTS volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number REAL NOT NULL,
  title TEXT,
  cover_url TEXT,
  owned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','reading','read')),
  release_date TEXT
);

-- Chapters belong to a volume (manga) OR directly to a work (books, volume_id NULL)
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  volume_id INTEGER REFERENCES volumes(id) ON DELETE CASCADE,
  number REAL NOT NULL,
  title TEXT,
  owned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','reading','read')),
  release_date TEXT
);

-- ============= ANIME / MOVIES / TV =============
CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('movie','tv')),
  title TEXT NOT NULL,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','in_progress','watched')),
  release_date TEXT, -- for movies, or premiere date for tv
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season INTEGER NOT NULL DEFAULT 1,
  number INTEGER NOT NULL,
  title TEXT,
  air_date TEXT,
  watched INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- ordered items in a timeline; each item is a whole movie or tv show slot.
-- for a tv show item, "complete" means every episode watched; then the timeline
-- auto-advances to the next item.
CREATE TABLE IF NOT EXISTS timeline_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeline_id INTEGER NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL
);

-- ============= GAMES =============
CREATE TABLE IF NOT EXISTS franchises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  franchise_id INTEGER REFERENCES franchises(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  release_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- each platform-copy of a game is tracked independently for progress
CREATE TABLE IF NOT EXISTS game_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  platform_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','in_progress','played'))
);

-- objective categories are shared at the game level (e.g. "Main Quests", "Side Quests")
CREATE TABLE IF NOT EXISTS objective_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES objective_categories(id) ON DELETE CASCADE,
  description TEXT NOT NULL
);

-- completion is per-platform, since each platform copy tracks progress independently
CREATE TABLE IF NOT EXISTS objective_completion (
  objective_id INTEGER NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES game_platforms(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (objective_id, platform_id)
);
