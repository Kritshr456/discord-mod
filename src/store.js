import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings(guild TEXT PRIMARY KEY, log_channel TEXT);
    CREATE TABLE IF NOT EXISTS cases(id INTEGER PRIMARY KEY, guild TEXT NOT NULL,
      target TEXT NOT NULL, moderator TEXT NOT NULL, action TEXT NOT NULL,
      reason TEXT NOT NULL, duration INTEGER, status TEXT NOT NULL DEFAULT 'pending',
      created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS case_history ON cases(guild,target,id);`);
  return {
    close: () => db.close(),
    create: c => Number(db.prepare('INSERT INTO cases(guild,target,moderator,action,reason,duration) VALUES(?,?,?,?,?,?)')
      .run(c.guild,c.target,c.moderator,c.action,c.reason,c.duration ?? null).lastInsertRowid),
    finish: (id,status) => db.prepare('UPDATE cases SET status=? WHERE id=?').run(status,id),
    history: (guild,target) => db.prepare('SELECT * FROM cases WHERE guild=? AND target=? ORDER BY id DESC LIMIT 10').all(guild,target),
    getCase: (guild,id) => db.prepare('SELECT * FROM cases WHERE guild=? AND id=?').get(guild,id),
    setLog: (guild,channel) => db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(guild) DO UPDATE SET log_channel=excluded.log_channel').run(guild,channel),
    logChannel: guild => db.prepare('SELECT log_channel FROM settings WHERE guild=?').get(guild)?.log_channel,
  };
}
