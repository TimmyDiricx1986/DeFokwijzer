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
CREATE TABLE IF NOT EXISTS stat_hvisitor (hour TEXT NOT NULL, vid TEXT NOT NULL, PRIMARY KEY (hour, vid));
CREATE TABLE IF NOT EXISTS stat_hcount (hour TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (hour, kind));
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
  hvisitor: db.prepare("INSERT OR IGNORE INTO stat_hvisitor (hour, vid) VALUES (?, ?)"),
  hcount: db.prepare("INSERT INTO stat_hcount (hour, kind, n) VALUES (?, ?, 1) ON CONFLICT(hour, kind) DO UPDATE SET n = n + 1"),
  oldHours: db.prepare("DELETE FROM stat_hvisitor WHERE hour < ?"),
  oldHourCounts: db.prepare("DELETE FROM stat_hcount WHERE hour < ?"),
  perHourVisitors: db.prepare("SELECT hour, COUNT(*) AS n FROM stat_hvisitor WHERE hour >= ? GROUP BY hour"),
  perHourKind: db.prepare("SELECT hour, kind, n FROM stat_hcount WHERE hour >= ?"),
  firstHour: db.prepare("SELECT MIN(hour) AS h FROM stat_hcount"),
  topKind: db.prepare("SELECT key, SUM(n) AS n FROM stat_count WHERE day >= ? AND kind = ? GROUP BY key ORDER BY n DESC LIMIT ?"),
};
const today = () => new Date().toISOString().slice(0, 10);
// Uren in Belgische tijd, als "JJJJ-MM-DDTHH" (per uur wordt 100 dagen bewaard).
const UUR_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function uurSleutel(d) { const p = Object.fromEntries(UUR_FMT.formatToParts(d).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}`; }
const dayMinus = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
function saltFor(day) {
  let r = q.salt.get(day);
  if (!r) { q.setSalt.run(day, crypto.randomBytes(24).toString("hex")); q.dropSalts.run(day); q.oldVisitors.run(dayMinus(400)); const oud = uurSleutel(new Date(Date.now() - 100 * 864e5)); q.oldHours.run(oud); q.oldHourCounts.run(oud); r = q.salt.get(day); }
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
  const hour = uurSleutel(new Date());
  if (t === "load") {
    const vid = crypto.createHash("sha256").update(saltFor(day) + "|" + req.ip + "|" + ua).digest("hex").slice(0, 32);
    q.visitor.run(day, vid);
    q.hvisitor.run(hour, vid);
  }
  q.count.run(day, t, key);
  if (t !== "paard") q.hcount.run(hour, t);
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
// Per uur: de laatste 24, 72 of 168 uur, plus het patroon per uur van de dag over die periode.
function reportUren(uren) {
  const n = [24, 72, 168].includes(parseInt(uren, 10)) ? parseInt(uren, 10) : 24;
  const nu = Date.now(), sleutels = [];
  for (let i = n - 1; i >= 0; i--) { const k = uurSleutel(new Date(nu - i * 36e5)); if (sleutels[sleutels.length - 1] !== k) sleutels.push(k); }
  const from = sleutels[0];
  const vis = Object.fromEntries(q.perHourVisitors.all(from).map((r) => [r.hour, r.n]));
  const pag = {};
  for (const r of q.perHourKind.all(from)) pag[r.hour] = (pag[r.hour] || 0) + r.n;
  const perUur = sleutels.map((k) => ({ uur: k, bezoekers: vis[k] || 0, paginas: pag[k] || 0 }));
  const patroon = Array.from({ length: 24 }, (_, h) => ({ uur: h, bezoekers: 0, paginas: 0 }));
  for (const r of perUur) { const h = parseInt(r.uur.slice(11, 13), 10); patroon[h].bezoekers += r.bezoekers; patroon[h].paginas += r.paginas; }
  const drukst = perUur.reduce((a, r) => (r.bezoekers > (a ? a.bezoekers : 0) ? r : a), null);
  const f = q.firstHour.get();
  return {
    uren: n, perUur, patroon, drukst,
    ditUur: perUur[perUur.length - 1],
    periode: { bezoekers: perUur.reduce((a, r) => a + r.bezoekers, 0), paginas: perUur.reduce((a, r) => a + r.paginas, 0) },
    sinds: f && f.h ? f.h : null,
  };
}
module.exports = { record, report, reportUren };
