require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database('media_tracker.db')
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
    const schema = fs.readFileSync(path.join(__dirname, 'database/init.sql'), 'utf8');
    db.exec(schema);

    const types = db.prepare('SELECT COUNT(*) as count FROM media_types').get();
    if (types.count == 0) {
        const insertType = db.prepare('INSERT INTO media_types (name, category) VALUES (?, ?)');
        insertType.run('movie', 'movies_tv');
        insertType.run('tv_show', 'movies_tv');
        insertType.run('anime', 'movies_tv');
        insertType.run('book', 'books_manga');
        insertType.run('manga', 'books_manga');
        insertType.run('light_novel', 'books_manga');
        insertType.run('game', 'games');
    }

    const types_platforms = db.prepare('SELECT COUNT(*) as count FROM platforms').get();
    if (types_platforms.count == 0) {
        const insertType_platforms = db.prepare('INSERT INTO platforms (platform_name) VALUES (?)');
        insertType_platforms.run('NES');
        insertType_platforms.run('SNES');
        insertType_platforms.run('N64');
        insertType_platforms.run('gamecube');
        insertType_platforms.run('WII');
        insertType_platforms.run('WII U');
        insertType_platforms.run('switch');
        insertType_platforms.run('switch 2');
        insertType_platforms.run('gameboy');
        insertType_platforms.run('gameboy color');
        insertType_platforms.run('gameboy advance');
        insertType_platforms.run('DS');
        insertType_platforms.run('3DS');
        insertType_platforms.run('PS1');
        insertType_platforms.run('PS2');
        insertType_platforms.run('PS3');
        insertType_platforms.run('PS4');
        insertType_platforms.run('PS5');
        insertType_platforms.run('PC');
    }

}

initializeDatabase();

app.use((req, res, next) => {
    req.db = db;
    next();
});