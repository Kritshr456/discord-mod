import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { UserError } from './moderation.js';
export function openStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings(guild TEXT PRIMARY KEY, log_channel TEXT);
    CREATE TABLE IF NOT EXISTS cases(id INTEGER PRIMARY KEY, guild TEXT NOT NULL,
      target TEXT NOT NULL, moderator TEXT NOT NULL, action TEXT NOT NULL,
      reason TEXT NOT NULL, duration INTEGER, status TEXT NOT NULL DEFAULT 'pending',
      created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS case_history ON cases(guild,target,id);
    CREATE TABLE IF NOT EXISTS case_notes(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id INTEGER NOT NULL REFERENCES cases(id),
      moderator TEXT NOT NULL,note TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS notes_by_case ON case_notes(case_id,id);`);
  return {
    close: () => db.close(),
    create: c => Number(db.prepare('INSERT INTO cases(guild,target,moderator,action,reason,duration) VALUES(?,?,?,?,?,?)')
      .run(c.guild,c.target,c.moderator,c.action,c.reason,c.duration ?? null).lastInsertRowid),
    finish: (id,status) => db.prepare('UPDATE cases SET status=? WHERE id=?').run(status,id),
    history(guild,target,page=1) {
      if (!Number.isInteger(page) || page < 1 || page > 100000) throw new RangeError('Invalid history page.');
      return db.prepare('SELECT * FROM cases WHERE guild=? AND target=? ORDER BY id DESC LIMIT 3 OFFSET ?').all(guild,target,(page-1)*3);
    },
    historyCount: (guild,target) => db.prepare('SELECT COUNT(*) AS total FROM cases WHERE guild=? AND target=?').get(guild,target).total,
    getCase: (guild,id) => db.prepare('SELECT * FROM cases WHERE guild=? AND id=?').get(guild,id),
    stats(guild,days=30) {
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new UserError('Choose 1–365 days.');
      const rows = db.prepare("SELECT action,status,COUNT(*) AS total FROM cases WHERE guild=? AND created>=datetime('now',?) GROUP BY action,status ORDER BY action,status").all(guild,`-${days} days`);
      return {days,total:rows.reduce((sum,row)=>sum+row.total,0),rows};
    },
    addNote(guild,id,moderator,note) {
      if (!this.getCase(guild,id)) throw new UserError('Case not found.');
      if (typeof note !== 'string' || !note.trim() || note.length > 400) throw new UserError('Notes must contain 1–400 characters.');
      return Number(db.prepare('INSERT INTO case_notes(case_id,moderator,note) VALUES(?,?,?)').run(id,moderator,note.trim()).lastInsertRowid);
    },
    notes(guild,id,page=1) {
      if (!this.getCase(guild,id)) throw new UserError('Case not found.');
      if (!Number.isInteger(page) || page < 1 || page > 100000) throw new UserError('Invalid notes page.');
      const total = db.prepare('SELECT COUNT(*) AS total FROM case_notes WHERE case_id=?').get(id).total;
      const rows = db.prepare('SELECT * FROM case_notes WHERE case_id=? ORDER BY id DESC LIMIT 3 OFFSET ?').all(id,(page-1)*3);
      return {page,total,rows};
    },
    setLog: (guild,channel) => db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(guild) DO UPDATE SET log_channel=excluded.log_channel').run(guild,channel),
    logChannel: guild => db.prepare('SELECT log_channel FROM settings WHERE guild=?').get(guild)?.log_channel,
  };
}
