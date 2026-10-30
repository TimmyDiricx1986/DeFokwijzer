"use strict";
// Eenvoudige, privacyvriendelijke bezoekersstatistieken.
// Geen cookies en geen IP-adressen: per dag een onomkeerbare code (dagelijks wisselend zout + IP + browser),
// zodat iemand die dezelfde dag terugkomt maar één keer telt. Het zout van gisteren wordt gewist.
const crypto = require("crypto");
const { db } = require("./store");

db.exec(`
CREATE TABLE IF NOT EXISTS stat_salt (day TEXT PRIMARY KEY, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stat_visitor (day TEXT NOT NULL, vid TEXT NOT NULL, PRIMARY KEY (day, vid));
CREATE TABLE IF NOT EXISTS stat_count (day TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind, key));
`);
const q = {
  salt: db.prepare("SELECT salt FROM stat_salt WHERE day = ?"),
  setSalt: db.prepare("INSERT OR IGNORE INTO stat_salt (day, salt) VALUES (?, ?)"),
  dropSalts: db.prepare("DELETE FROM stat_salt WHERE day <> ?"),
  visitor: db.prepare("INSERT OR IGNORE INTO stat_visitor (day, vid) VALUES (?, ?)"),
  count: db.prepare("INSERT INTO stat_count (day, kind, key, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, kind, key) DO UPDATE SET n = n + 1"),
  oldVisitors: db.prepare("DELETE FROM stat_visitor WHERE day < ?"),
  perDayVisitors: db.prepare("SELECT day, COUNT(*) AS n FROM stat_visitor WHERE day >= ? GROUP BY day"),
  perDayKind: db.prepare("SELECT day, SUM(n) AS n FROM stat_count WHERE day >= ? AND kind = ? GROUP BY day"),
  topKind: db.prepare("SELECT key, SUM(n) AS n FROM stat_count WHERE day >= ? AND kind = ? GROUP BY key ORDER BY n DESC LIMIT ?"),
};
const today = () => new Date().toISOString().slice(0, 10);
const dayMinus = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
function saltFor(day) {
  let r = q.salt.get(day);
  if (!r) { q.setSalt.run(day, crypto.randomBytes(24).toString("hex")); q.dropSalts.run(day); q.oldVisitors.run(dayMinus(400)); r = q.salt.get(day); }
  return r.salt;
}
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|curl|wget|python-requests/i;
const KINDS = { load: 40, tab: 40, paard: 160 };

function record(req, t, v) {
  if (!Object.hasOwn(KINDS, t)) return false;
  const ua = String(req.get("user-agent") || "");
  if (!ua || BOT.test(ua)) return false;
  if (req.actor && (req.actor.level >= 3 || req.actor.service)) return false; // beheerders tellen niet mee
  const key = t === "load" ? "-" : String(v || "").slice(0, KINDS[t]);
  if (t !== "load" && !/^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$/.test(key)) return false;
  const day = today();
  if (t === "load") {
    const vid = crypto.createHash("sha256").update(saltFor(day) + "|" + req.ip + "|" + ua).digest("hex").slice(0, 32);
    q.visitor.run(day, vid);
  }
  q.count.run(day, t, key);
  return true;
}

function report(days, horseName) {
  const n = Math.max(7, Math.min(365, parseInt(days, 10) || 30));
  const from = dayMinus(n - 1);
  const vis = Object.fromEntries(q.perDayVisitors.all(from).map((r) => [r.day, r.n]));
  const views = Object.fromEntries(q.perDayKind.all(from, "load").map((r) => [r.day, r.n]));
  const tabs = Object.fromEntries(q.perDayKind.all(from, "tab").map((r) => [r.day, r.n]));
  const perDag = [];
  for (let i = n - 1; i >= 0; i--) { const d = dayMinus(i); perDag.push({ dag: d, bezoekers: vis[d] || 0, bezoeken: (views[d] || 0), paginas: (views[d] || 0) + (tabs[d] || 0) }); }
  const som = (k, last) => perDag.slice(-last).reduce((a, r) => a + r[k], 0);
  return {
    dagen: n,
    perDag,
    vandaag: { bezoekers: som("bezoekers", 1), paginas: som("paginas", 1) },
    week: { bezoekers: som("bezoekers", 7), paginas: som("paginas", 7) },
    periode: { bezoekers: som("bezoekers", n), paginas: som("paginas", n) },
    onderdelen: q.topKind.all(from, "tab", 12).map((r) => ({ naam: r.key, n: r.n })),
    paarden: q.topKind.all(from, "paard", 10).map((r) => ({ id: r.key, naam: horseName(r.key) || r.key, n: r.n })),
  };
}
module.exports = { record, report };
