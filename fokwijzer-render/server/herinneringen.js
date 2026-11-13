"use strict";
// Herinneringen uit het merriedossier per mail.
// - De app zet bij elke wijziging van Mijn stal een "planning" (komende herinneringen) in het document.
// - Een gebruiker stelt een e-mailadres in en moet dat eerst bevestigen via een link in een mail.
// - Elke ochtend (vanaf 7 uur, Belgische tijd) krijgt hij één mail met de herinneringen die eraan komen.
// - In elke mail staat een knop "Ik heb deze mail goed ontvangen"; De Fokwijzer toont welke mails bevestigd zijn.
// Links bevatten een geheime code; de server bewaart enkel de hash ervan. Een link opent eerst een pagina
// met een knop (POST), zodat virusscanners die links openen niets bevestigen.
const crypto = require("crypto");
const store = require("./store");
const mail = require("./mail");

const SITE = () => (process.env.PUBLIC_URL || "https://fokwijzer.onrender.com").replace(/\/$/, "");
const ACTOR = { label: "mail", userId: null, ip: null };
const VOORAF = [0, 1, 3, 7];
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/;
const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const code = () => crypto.randomBytes(24).toString("hex");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function belgisch(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { dag: `${p.year}-${p.month}-${p.day}`, uur: parseInt(p.hour, 10) };
}
const dPlus = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtDag = (iso) => { const d = new Date(iso + "T12:00:00Z"); return isNaN(d) ? iso : d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); };

const inst = (uid) => { const d = store.getDoc("mailinst", String(uid)); return d ? d.data : null; };
const logVan = (uid) => store.listDocs("maillog").map((d) => Object.assign({ id: d.id }, d.data)).filter((m) => String(m.user_id) === String(uid)).sort((a, b) => (a.verzonden_op < b.verzonden_op ? 1 : -1));

function status(uid) {
  const i = inst(uid);
  const mails = logVan(uid).slice(0, 12).map((m) => ({ id: m.id, soort: m.soort, email: m.email, verzonden_op: m.verzonden_op, aantal: (m.items || []).length, ontvangen_op: m.ontvangen_op || null }));
  return {
    ingesteld: mail.ingesteld(),
    instelling: i ? { email: i.email, vooraf: i.vooraf, dagzelf: !!i.dagzelf, actief: !!i.actief, bevestigd: !!i.bevestigd, bevestigd_op: i.bevestigd_op || null } : null,
    mails,
  };
}

function knop(url, tekst) {
  return `<p style="margin:22px 0"><a href="${esc(url)}" style="background:#13302A;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(tekst)}</a></p>`;
}
function omhulsel(titel, inhoud) {
  return `<!doctype html><html><body style="margin:0;background:#F6F1E8;font-family:Arial,Helvetica,sans-serif;color:#1F2420">
<div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#ffffff;border:1px solid #E4DCCB;border-radius:12px;padding:24px">
<div style="font-family:Georgia,serif;letter-spacing:2px;color:#13302A;font-weight:700">DE FOKWIJZER</div>
<div style="font-size:11px;letter-spacing:1px;color:#B08A5A;margin-bottom:16px">EEN WIKIGIDS VOOR EN DOOR PAARDENFOKKERS</div>
<h1 style="font-family:Georgia,serif;font-size:22px;color:#13302A;margin:0 0 12px">${esc(titel)}</h1>${inhoud}</div>
<p style="font-size:12px;color:#6B6F66;margin:14px 4px">Je krijgt deze mail omdat je herinneringen per mail aanzette in je merriedossier op <a href="${esc(SITE())}" style="color:#13302A">De Fokwijzer</a>. Uitzetten kan in Mijn Fokwijzer, bij Merriedossier.</p></div></body></html>`;
}

async function stuurBevestiging(uid, i) {
  const t = code();
  const nu = new Date().toISOString();
  const id = `${uid}-${crypto.randomBytes(6).toString("hex")}`;
  const url = `${SITE()}/mail/ontvangen/${t}`;
  const html = omhulsel("Bevestig je e-mailadres", `<p>Je vroeg om herinneringen uit je merriedossier per mail te krijgen op <b>${esc(i.email)}</b>.</p>
<p>Klik op de knop om te bevestigen dat je deze mail goed ontvangen hebt. Pas daarna sturen we je herinneringen.</p>${knop(url, "Ik heb deze mail goed ontvangen")}
<p style="font-size:13px;color:#6B6F66">Vroeg je dit niet aan? Dan mag je deze mail negeren.</p>`);
  const text = `Je vroeg om herinneringen uit je merriedossier per mail te krijgen op ${i.email}.\nBevestig dat je deze mail goed ontvangen hebt: ${url}\nVroeg je dit niet aan? Dan mag je deze mail negeren.`;
  await mail.verstuur({ to: i.email, subject: "De Fokwijzer: bevestig je e-mailadres", html, text });
  store.writeDoc("maillog", id, { user_id: uid, email: i.email, soort: "bevestiging", verzonden_op: nu, items: [], token_hash: hash(t) }, ACTOR);
}

// Instellen of aanpassen. Een nieuw adres moet altijd opnieuw bevestigd worden.
async function instellen(uid, b) {
  const email = String((b && b.email) || "").trim().toLowerCase().slice(0, 160);
  if (!EMAIL_RE.test(email)) return { fout: "Geef een geldig e-mailadres." };
  const vooraf = VOORAF.includes(Number(b.vooraf)) ? Number(b.vooraf) : 1;
  const oud = inst(uid);
  const nieuw = { email, vooraf, dagzelf: !!b.dagzelf, actief: b.actief !== false, bevestigd: !!(oud && oud.bevestigd && oud.email === email), bevestigd_op: oud && oud.email === email ? oud.bevestigd_op || null : null, bijgewerkt: new Date().toISOString() };
  store.writeDoc("mailinst", String(uid), nieuw, ACTOR);
  if (!nieuw.bevestigd) {
    const r = await opnieuw(uid);
    if (r.fout) return r;
  }
  return { ok: true };
}
async function opnieuw(uid) {
  const i = inst(uid);
  if (!i) return { fout: "Stel eerst een e-mailadres in." };
  if (i.bevestigd) return { fout: "Dit adres is al bevestigd." };
  const sinds = Date.now() - 864e5;
  if (logVan(uid).filter((m) => m.soort === "bevestiging" && Date.parse(m.verzonden_op) > sinds).length >= 5) return { fout: "Je vroeg vandaag al vijf bevestigingsmails aan. Probeer morgen opnieuw.", code: "daglimiet" };
  try { await stuurBevestiging(uid, i); } catch (e) { return { fout: e.message, code: e.code || "upstream" }; }
  return { ok: true };
}
function stop(uid) {
  const i = inst(uid);
  if (i) store.writeDoc("mailinst", String(uid), Object.assign({}, i, { actief: false }), ACTOR);
  return { ok: true };
}

// Herinneringen die vandaag in een mail horen voor deze gebruiker (zonder wat al verstuurd is).
function teSturen(uid, i, vandaag) {
  const doc = store.getDoc("mijnstal", String(uid));
  const plan = (doc && doc.data && Array.isArray(doc.data.planning) ? doc.data.planning : []).filter((p) => p && typeof p.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.datum) && p.k);
  const al = new Set(logVan(uid).flatMap((m) => (m.items || []).map((x) => x.sleutel)));
  const out = [];
  for (const p of plan) {
    const v = i.vooraf || 0;
    if (v > 0 && vandaag >= dPlus(p.datum, -v) && vandaag < p.datum) out.push(Object.assign({}, p, { sleutel: `${p.k}|${p.datum}|vooraf`, wanneer: "vooraf" }));
    if ((v === 0 || i.dagzelf) && vandaag === p.datum) out.push(Object.assign({}, p, { sleutel: `${p.k}|${p.datum}|dag`, wanneer: "dag" }));
  }
  return out.filter((x) => !al.has(x.sleutel)).sort((a, b) => (a.datum < b.datum ? -1 : 1)).slice(0, 40);
}

async function stuurHerinneringen(uid, i, items, soort) {
  const t = code();
  const nu = new Date().toISOString();
  const id = `${uid}-${crypto.randomBytes(6).toString("hex")}`;
  const url = `${SITE()}/mail/ontvangen/${t}`;
  const perDag = new Map();
  for (const x of items) { if (!perDag.has(x.datum)) perDag.set(x.datum, []); perDag.get(x.datum).push(x); }
  const lijst = [...perDag.entries()].map(([d, xs]) => `<p style="margin:14px 0 4px;font-weight:700;color:#13302A">${esc(fmtDag(d))}</p><ul style="margin:0;padding-left:20px">${xs.map((x) => `<li style="margin:3px 0"><b>${esc(x.merrie)}</b>: ${esc(x.t)}${x.extra ? `<br><span style="color:#6B6F66;font-size:13px">${esc(x.extra)}</span>` : ""}</li>`).join("")}</ul>`).join("");
  const titel = soort === "test" ? "Testmail: zo zien je herinneringen eruit" : items.length === 1 ? "1 herinnering voor je merries" : `${items.length} herinneringen voor je merries`;
  const html = omhulsel(titel, `${items.length ? lijst : "<p>Er staan op dit moment geen herinneringen gepland. Zodra je een dekking of zorgmoment registreert, komen ze in deze mails.</p>"}
<p style="margin-top:18px">Laat even weten dat deze mail goed aankwam:</p>${knop(url, "Ik heb deze mail goed ontvangen")}
<p style="font-size:13px;color:#6B6F66">Richtdagen zijn een hulpmiddel: je dierenarts beslist.</p>`);
  const text = `${titel}\n\n${items.map((x) => `${x.datum}  ${x.merrie}: ${x.t}${x.extra ? " (" + x.extra + ")" : ""}`).join("\n")}\n\nBevestig dat je deze mail goed ontvangen hebt: ${url}`;
  await mail.verstuur({ to: i.email, subject: `De Fokwijzer: ${titel.charAt(0).toLowerCase() + titel.slice(1)}`, html, text });
  store.writeDoc("maillog", id, { user_id: uid, email: i.email, soort, verzonden_op: nu, items: items.map((x) => ({ sleutel: x.sleutel || "", datum: x.datum, t: x.t, merrie: x.merrie })), token_hash: hash(t) }, ACTOR);
}

async function testmail(uid) {
  const i = inst(uid);
  if (!i) return { fout: "Stel eerst een e-mailadres in." };
  if (!i.bevestigd) return { fout: "Bevestig eerst je e-mailadres via de mail die we stuurden." };
  const sinds = Date.now() - 864e5;
  if (logVan(uid).filter((m) => m.soort === "test" && Date.parse(m.verzonden_op) > sinds).length >= 5) return { fout: "Je vroeg vandaag al vijf testmails aan.", code: "daglimiet" };
  const doc = store.getDoc("mijnstal", String(uid));
  const { dag } = belgisch();
  const plan = (doc && doc.data && Array.isArray(doc.data.planning) ? doc.data.planning : []).filter((p) => p && p.datum >= dag).sort((a, b) => (a.datum < b.datum ? -1 : 1)).slice(0, 8);
  try { await stuurHerinneringen(uid, i, plan.map((p) => Object.assign({}, p, { sleutel: "" })), "test"); } catch (e) { return { fout: e.message, code: e.code || "upstream" }; }
  return { ok: true };
}

// Dagelijkse ronde: vanaf 7 uur Belgische tijd, één mail per gebruiker met wat er nieuw te melden is.
let bezig = false;
async function ronde(opts = {}) {
  if (bezig || !mail.ingesteld()) return { verstuurd: 0, overgeslagen: true };
  const { dag, uur } = belgisch(opts.nu);
  if (!opts.altijd && uur < 7) return { verstuurd: 0, te_vroeg: true };
  bezig = true;
  let verstuurd = 0, fouten = 0;
  try {
    for (const d of store.listDocs("mailinst")) {
      const i = d.data || {};
      if (!i.actief || !i.bevestigd || !i.email) continue;
      const items = teSturen(d.id, i, opts.dag || dag);
      if (!items.length) continue;
      try { await stuurHerinneringen(d.id, i, items, "herinnering"); verstuurd++; } catch (e) { fouten++; console.error("[herinneringen]", d.id, e.message); }
    }
  } finally { bezig = false; }
  return { verstuurd, fouten };
}
function startPlanner() {
  const t = setInterval(() => { ronde().catch((e) => console.error("[herinneringen]", e.message)); }, 20 * 60e3);
  t.unref();
  setTimeout(() => ronde().catch(() => {}), 60e3).unref();
}

// Links uit de mails.
function zoekToken(t) {
  if (!/^[a-f0-9]{48}$/.test(String(t || ""))) return null;
  const h = hash(t);
  const m = store.listDocs("maillog").find((d) => d.data && d.data.token_hash === h);
  return m || null;
}
function pagina(titel, inhoud) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titel)} · De Fokwijzer</title><meta name="robots" content="noindex"></head>
<body style="margin:0;background:#F6F1E8;font-family:Arial,Helvetica,sans-serif;color:#1F2420"><div style="max-width:520px;margin:40px auto;padding:0 16px"><div style="background:#fff;border:1px solid #E4DCCB;border-radius:12px;padding:24px">
<div style="font-family:Georgia,serif;letter-spacing:2px;color:#13302A;font-weight:700;margin-bottom:14px">DE FOKWIJZER</div><h1 style="font-family:Georgia,serif;font-size:22px;color:#13302A;margin:0 0 12px">${esc(titel)}</h1>${inhoud}
<p style="margin-top:20px"><a href="${esc(SITE())}" style="color:#13302A">Naar De Fokwijzer</a></p></div></div></body></html>`;
}
function linkPagina(t) {
  const m = zoekToken(t);
  if (!m) return { status: 404, html: pagina("Link niet gevonden", "<p>Deze link is niet (meer) geldig.</p>") };
  if (m.data.ontvangen_op) return { status: 200, html: pagina("Al bevestigd", `<p>Je bevestigde al op ${esc(new Date(m.data.ontvangen_op).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" }))} dat deze mail goed aankwam. Bedankt!</p>`) };
  return { status: 200, html: pagina("Mail goed ontvangen?", `<p>Bevestig dat de mail van De Fokwijzer aan <b>${esc(m.data.email)}</b> goed aankwam.</p>
<form method="post" action="/mail/ontvangen/${esc(t)}"><button type="submit" style="background:#13302A;color:#fff;border:0;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;cursor:pointer">Ja, ik heb deze mail goed ontvangen</button></form>`) };
}
function bevestig(t) {
  const m = zoekToken(t);
  if (!m) return { status: 404, html: pagina("Link niet gevonden", "<p>Deze link is niet (meer) geldig.</p>") };
  const nu = new Date().toISOString();
  if (!m.data.ontvangen_op) store.writeDoc("maillog", m.id, Object.assign({}, m.data, { ontvangen_op: nu }), ACTOR);
  let extra = "<p>Bedankt! We weten nu dat de mail goed aankwam.</p>";
  if (m.data.soort === "bevestiging") {
    const i = inst(m.data.user_id);
    if (i && i.email === m.data.email && !i.bevestigd) store.writeDoc("mailinst", String(m.data.user_id), Object.assign({}, i, { bevestigd: true, bevestigd_op: nu }), ACTOR);
    extra = "<p>Bedankt! Je e-mailadres is bevestigd. Vanaf nu krijg je je herinneringen uit het merriedossier per mail.</p>";
  }
  return { status: 200, html: pagina("Goed ontvangen", extra) };
}

module.exports = { status, instellen, opnieuw, stop, testmail, ronde, startPlanner, linkPagina, bevestig, teSturen, belgisch };
