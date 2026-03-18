const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './db/hornsby.db';
const dbDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.resolve(dbPath));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL CHECK(role IN ('player','coach','manager')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS teams (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS team_info (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id       INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    playstyle     TEXT    NOT NULL DEFAULT '',
    strategy      TEXT    NOT NULL DEFAULT '',
    win_condition TEXT    NOT NULL DEFAULT '',
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scout_players (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    position      INTEGER NOT NULL CHECK(position IN (1,2,3)),
    player_number TEXT    NOT NULL DEFAULT '',
    strengths     TEXT    NOT NULL DEFAULT '',
    weaknesses    TEXT    NOT NULL DEFAULT '',
    matchup       TEXT    NOT NULL DEFAULT '',
    UNIQUE(team_id, position)
  );

  CREATE TABLE IF NOT EXISTS games (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    opponent_name TEXT    NOT NULL,
    our_score     INTEGER,
    opp_score     INTEGER,
    game_date     TEXT    NOT NULL,
    published     INTEGER NOT NULL DEFAULT 0,
    created_by    INTEGER NOT NULL REFERENCES users(id),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id             INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    execution           INTEGER NOT NULL CHECK(execution BETWEEN 1 AND 10),
    containment         INTEGER NOT NULL CHECK(containment BETWEEN 1 AND 10),
    shot_selection      INTEGER NOT NULL CHECK(shot_selection BETWEEN 1 AND 10),
    offensive_flow      INTEGER NOT NULL CHECK(offensive_flow BETWEEN 1 AND 10),
    defensive_intensity INTEGER NOT NULL CHECK(defensive_intensity BETWEEN 1 AND 10),
    overall             INTEGER NOT NULL CHECK(overall BETWEEN 1 AND 10),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_id, user_id)
  );
`);

module.exports = db;
