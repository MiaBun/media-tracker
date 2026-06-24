-- media types

CREATE TABLE IF NOT EXISTS media_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, -- 'movie', 'tv_show', 'anime', 'book', 'manga', 'gamne'
    category TEXT NOT NULL -- 'movies_tv', 'books_manga', 'games'
);

-- movies/tv shows/anime

CREATE TABLE IF NOT EXISTS movies_tv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'movie', 'tv_show', 'anime'
    description TEXT,
    cover_image TEXT,
    release_date TEXT,
    total_episodes INTEGER DEFAULT 0,
    total_seasons INTEGER DEFAULT 1,
    total_runtime_minutes REAL DEFAULT 0, -- movies 
    avg_episode_runtime INTEGER DEFAULT 30, -- for tv shows
    status TEXT DEFAULT 'wishlist', -- 'watching', 'completed', 'backlog', 'wishlist'
    rating REAL,
    timeline_name TEXT, -- 'mcu', 'arrowverse'
    timeline_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- tv show/anime episodes 

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER,
    season_number INTEGER DEFAULT 1,
    episode_number INTEGER NOT NULL,
    title TEXT,
    runtime INTEGER DEFAULT 30,
    watched INTEGER DEFAULT 0, -- boolean
    watched_date TEXT,
    FOREIGN KEY (media_id) REFERENCES movies_tv(id) ON DELETE CASCADE
);

-- books & manga 

CREATE TABLE IF NOT EXISTS books_manga (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'book', 'manga', 'light_novel'
    author TEXT,
    description TEXT,
    cover_image TEXT,
    release_date TEXT,
    total_volumes INTEGER DEFAULT 1,
    total_chapters INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    status TEXT DEFAULT 'wishlist', -- 'reading', 'completed', 'backlog', 'wishlist'
    rating REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- book/manga chapters 

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER,
    volume_number INTEGER DEFAULT 1,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    pages INTEGER DEFAULT 0,
    read INTEGER DEFAULT 0, -- boolean
    read_date TEXT,
    FOREIGN KEY (media_id) REFERENCES books_manga(id) ON DELETE CASCADE
);

-- platforms

CREATE TABLE IF NOT EXISTS platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_name TEXT
);

-- games

CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    platform_id INTEGER,
    description TEXT,
    cover_image TEXT,
    release_date TEXT,
    steam_app_id TEXT,
    howlongtobeat_id TEXT,
    main_story_hours REAL DEFAULT 0,
    main_plus_extras_hours REAL DEFAULT 0,
    completionist_hours REAL DEFAULT 0,
    played_hours REAL DEFAULT 0,
    status TEXT DEFAULT 'wishlist', -- 'playing', 'completed', 'backlog', 'wishlist'
    rating REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
);

-- game objectives

CREATE TABLE IF NOT EXISTS objective_categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    description TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_date TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES objective_categories(id) ON DELETE CASCADE
);

-- Release Calendar
CREATE TABLE IF NOT EXISTS release_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL, -- 'movies_tv', 'books_manga', 'games'
    media_id INTEGER,
    title TEXT NOT NULL,
    episode_or_volume TEXT, -- e.g., "Episode 5", "Volume 3"
    release_date TEXT NOT NULL,
    notified INTEGER DEFAULT 0,
    FOREIGN KEY (media_id) REFERENCES movies_tv(id) ON DELETE CASCADE
);

-- Statistics Cache
CREATE TABLE IF NOT EXISTS stats_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    stat_name TEXT NOT NULL,
    stat_value REAL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);