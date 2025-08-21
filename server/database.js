// Simple SQLite wrapper (Node.js) – uses sqlite3
// Install: npm i express sqlite3 cors
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck INTEGER,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    answer TEXT,
    keywords TEXT,
    keywordThreshold TEXT,
    synonyms TEXT,
    explain TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { db, all, get, run };

