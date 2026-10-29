"use strict";
// Opslag: SQLite met documenten per collectie, gebruikers, sessies, audit-log en AI-cache.
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const DB_PATH = path.join(DATA_DIR, "fokwijzer.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS docs (
  coll TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (coll, id)
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  pw TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lezer',
  created_at TEXT NOT NULL,
  last_login TEXT,
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  user_id INTEGER,
  ip TEXT,
  coll TEXT,
  doc_id TEXT,
  action TEXT NOT NULL,
  before TEXT,
  after TEXT
);
CREATE INDEX IF NOT EXISTS audit_doc ON audit(coll, doc_id);
CREATE TABLE IF NOT EXISTS ai_cache (
  hash TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_usage_ts ON ai_usage(ts);
`);

const now = () => new Date().toISOString();

const q = {
  list: db.prepare("SELECT id, data FROM docs WHERE coll = ?"),
  stamp: db.prepare("SELECT COUNT(*) AS n, MAX(updated_at) AS m, TOTAL(rev) AS r FROM docs WHERE coll = ?"),
  get: db.prepare("SELECT id, data, rev FROM docs WHERE coll = ? AND id = ?"),
  upsert: db.prepare(`INSERT INTO docs (coll, id, data, rev, updated_at, updated_by) VALUES (@coll, @id, @data, 1, @ts, @by)
    ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, rev = docs.rev + 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by`),
  del: db.prepare("DELETE FROM docs WHERE coll = ? AND id = ?"),
  audit: db.prepare(`INSERT INTO audit (ts, actor, user_id, ip, coll, doc_id, action, before, after)
    VALUES (@ts, @actor, @user_id, @ip, @coll, @doc_id, @action, @before, @after)`),
  history: db.prepare("SELECT id, ts, actor, action, before, after FROM audit WHERE coll = ? AND doc_id = ? ORDER BY id DESC LIMIT 50"),
};

function listDocs(coll) {
  return q.list.all(coll).map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
}
// Volledige lijst als JSON-tekst, met een ETag die verandert zodra er iets wijzigt. Wordt in het geheugen bewaard.
const listCache = new Map();
function listJson(coll) {
  const st = q.stamp.get(coll);
  const etag = '"' + require("crypto").createHash("sha1").update(`${coll}|${st.n}|${st.m}|${st.r}`).digest("base64url") + '"';
  const hit = listCache.get(coll);
  if (hit && hit.etag === etag) return hit;
  const rows = q.list.all(coll);
  const body = "[" + rows.map((r) => `{"id":${JSON.stringify(r.id)},"data":${r.data}}`).join(",") + "]";
  const out = { etag, body };
  listCache.set(coll, out);
  return out;
}
function getDoc(coll, id) {
  const r = q.get.get(coll, id);
  return r ? { id: r.id, data: JSON.parse(r.data), rev: r.rev } : null;
}
function audit(entry) {
  q.audit.run(Object.assign({ ts: now(), user_id: null, ip: null, coll: null, doc_id: null, before: null, after: null }, entry));
}
// Schrijft een document en logt de vorige en nieuwe versie (wiki-geschiedenis).
const writeDoc = db.transaction((coll, id, data, actor) => {
  const prev = q.get.get(coll, id);
  const json = JSON.stringify(data);
  q.upsert.run({ coll, id, data: json, ts: now(), by: actor.label });
  audit({ actor: actor.label, user_id: actor.userId, ip: actor.ip, coll, doc_id: id, action: prev ? "bijgewerkt" : "aangemaakt", before: prev ? prev.data : null, after: json });
  return !prev;
});
const deleteDoc = db.transaction((coll, id, actor) => {
  const prev = q.get.get(coll, id);
  if (!prev) return false;
  q.del.run(coll, id);
  audit({ actor: actor.label, user_id: actor.userId, ip: actor.ip, coll, doc_id: id, action: "verwijderd", before: prev.data });
  return true;
});
function history(coll, id) {
  return q.history.all(coll, id).map((r) => ({
    id: r.id, ts: r.ts, actor: r.actor, action: r.action,
    before: r.before ? JSON.parse(r.before) : null, after: r.after ? JSON.parse(r.after) : null,
  }));
}

// Dagelijkse back-up van de database, met een vast aantal bewaarde kopieën.
function startBackups() {
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const keep = Math.max(1, parseInt(process.env.BACKUP_KEEP || "14", 10));
  const run = async () => {
    const day = now().slice(0, 10);
    const file = path.join(dir, `fokwijzer-${day}.db`);
    if (fs.existsSync(file)) return;
    try {
      await db.backup(file);
      fs.chmodSync(file, 0o600);
      const files = fs.readdirSync(dir).filter((f) => /^fokwijzer-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
      files.slice(0, Math.max(0, files.length - keep)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
      console.log(`[back-up] ${file}`);
    } catch (e) {
      console.error("[back-up] mislukt:", e.message);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
  // Verlopen sessies en oude AI-gegevens opruimen.
  setInterval(() => {
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
    db.prepare("DELETE FROM ai_usage WHERE ts < ?").run(Date.now() - 2 * 864e5);
    db.prepare("DELETE FROM ai_cache WHERE created_at < ?").run(new Date(Date.now() - 30 * 864e5).toISOString());
  }, 60 * 60 * 1000).unref();
}

// Staat de database op een aparte, vaste schijf (bv. de Disk van Render op /data)?
// Zonder vaste schijf is alles weg bij elke nieuwe versie: paarden, accounts en geschiedenis.
function opslagInfo() {
  let vast = null;
  try { vast = fs.statSync(DATA_DIR).dev !== fs.statSync(path.dirname(path.resolve(DATA_DIR))).dev; } catch (_) { vast = null; }
  if (process.env.DATA_DISK === "ja") vast = true;
  let paarden = 0, gebruikers = 0;
  try { paarden = db.prepare("SELECT COUNT(*) n FROM docs WHERE coll='paarden'").get().n; gebruikers = db.prepare("SELECT COUNT(*) n FROM users").get().n; } catch (_) {}
  return { pad: DATA_DIR, vast, paarden, gebruikers };
}
module.exports = { db, now, listDocs, listJson, getDoc, writeDoc, deleteDoc, history, audit, startBackups, opslagInfo, DATA_DIR };
