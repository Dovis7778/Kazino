'use strict';
// Mažas duomenų bazės sluoksnis: SQLite failas (numatytasis, ./data/kazino.db)
// arba PostgreSQL, jei nustatytas DATABASE_URL. SQL rašomas su „?“ vietos rezervavimu.
// Visi rašymai (tx) vykdomi griežta eile – tai garantuoja, kad pinigų pakeitimai
// į bazę patenka ta pačia tvarka, kaip įvyko žaidime.
const fs = require('fs');
const path = require('path');

const SCHEMA = {
  sqlite: `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nick TEXT NOT NULL,
  nick_lc TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🙂',
  balance INTEGER NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  biggest_win INTEGER NOT NULL DEFAULT 0,
  total_wagered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_balance ON users(balance DESC);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS open_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_key TEXT NOT NULL,
  bet_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS open_bets_round ON open_bets(round_key, user_id);
`,
  pg: `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  nick TEXT NOT NULL,
  nick_lc TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🙂',
  balance BIGINT NOT NULL,
  games_played BIGINT NOT NULL DEFAULT 0,
  biggest_win BIGINT NOT NULL DEFAULT 0,
  total_wagered BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_balance ON users(balance DESC);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS open_bets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_key TEXT NOT NULL,
  bet_key TEXT NOT NULL,
  amount BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS open_bets_round ON open_bets(round_key, user_id);
`,
};

const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + ++i);
};

class Db {
  constructor() {
    this.queue = Promise.resolve();
    this.failures = 0;
  }

  static async open(opts = {}) {
    const db = new Db();
    const url = opts.url !== undefined ? opts.url : process.env.DATABASE_URL;
    if (url) {
      const pg = require('pg');
      pg.types.setTypeParser(20, (v) => Number(v)); // BIGINT
      pg.types.setTypeParser(1700, (v) => Number(v)); // NUMERIC (SUM)
      const local = /localhost|127\.0\.0\.1|\/var\/run|host=\//.test(url);
      db.kind = 'pg';
      db.pool = new pg.Pool({
        connectionString: url,
        max: 5,
        ssl: local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
      });
      db.pool.on('error', (e) => console.error('PostgreSQL klaida:', e.message));
      await db.pool.query(SCHEMA.pg);
    } else {
      const { DatabaseSync } = require('node:sqlite');
      const file = opts.file || process.env.KAZINO_DB || path.join(__dirname, '..', 'data', 'kazino.db');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      db.kind = 'sqlite';
      db.file = file;
      db.sql = new DatabaseSync(file);
      db.sql.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      db.sql.exec(SCHEMA.sqlite);
      db.stmts = new Map();
    }
    return db;
  }

  prep(sql) {
    let s = this.stmts.get(sql);
    if (!s) {
      s = this.sql.prepare(sql);
      this.stmts.set(sql, s);
    }
    return s;
  }

  // Skaitymai (nelaukia eilės, bet laukia anksčiau pradėtų rašymų).
  async all(sql, params = []) {
    await this.flush();
    if (this.kind === 'pg') return (await this.pool.query(toPg(sql), params)).rows;
    return this.prep(sql).all(...params);
  }

  async get(sql, params = []) {
    const rows = await this.all(sql, params);
    return rows[0] || null;
  }

  // Transakcija: [[sql, params], ...]. Grąžina pažadą; eilė išlaiko tvarką.
  tx(statements) {
    const run = async () => {
      if (this.kind === 'pg') {
        const c = await this.pool.connect();
        try {
          await c.query('BEGIN');
          const out = [];
          for (const [s, p] of statements) out.push((await c.query(toPg(s), p || [])).rowCount);
          await c.query('COMMIT');
          return out;
        } catch (e) {
          await c.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          c.release();
        }
      }
      this.sql.exec('BEGIN IMMEDIATE');
      try {
        const out = statements.map(([s, p]) => this.prep(s).run(...(p || [])).changes);
        this.sql.exec('COMMIT');
        return out;
      } catch (e) {
        this.sql.exec('ROLLBACK');
        throw e;
      }
    };
    const p = this.queue.then(run);
    this.queue = p.catch((e) => {
      this.failures++;
      console.error('DB transakcijos klaida:', e.message);
    });
    return p;
  }

  // Pažadas, kuris išsipildo, kai visi iki šiol eilėje esantys rašymai baigti.
  flush() {
    return this.queue;
  }

  async close() {
    await this.flush();
    if (this.kind === 'pg') await this.pool.end();
    else this.sql.close();
  }
}

module.exports = { Db };
