"use strict";
// E-mails versturen via de HTTP-API van een maildienst (geen SMTP: dat blokkeert Render op het gratis plan).
// Instellen in .env (of bij Render, Environment):
//   MAIL_PROVIDER = brevo | resend
//   MAIL_API_KEY  = de API-sleutel van die dienst
//   MAIL_FROM     = afzender, bv. "De Fokwijzer <info@jouwdomein.be>" (het adres moet bij de dienst geverifieerd zijn)
//   MAIL_REPLY_TO = (optioneel) adres waarop mensen kunnen antwoorden
// Zonder die instellingen doet de site alles zoals vroeger, alleen zonder mails.
const store = require("./store");

const PROVIDER = String(process.env.MAIL_PROVIDER || "").toLowerCase().trim();
const KEY = process.env.MAIL_API_KEY || "";
const FROM = process.env.MAIL_FROM || "";
const REPLY_TO = process.env.MAIL_REPLY_TO || "";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

store.db.exec(`CREATE TABLE IF NOT EXISTS mails (
  sleutel TEXT PRIMARY KEY,
  naar TEXT NOT NULL,
  onderwerp TEXT NOT NULL,
  status TEXT NOT NULL,
  fout TEXT,
  ts TEXT NOT NULL
)`);
const q = {
  claim: store.db.prepare("INSERT OR IGNORE INTO mails (sleutel, naar, onderwerp, status, ts) VALUES (?, ?, ?, 'bezig', ?)"),
  done: store.db.prepare("UPDATE mails SET status = ?, fout = ?, ts = ? WHERE sleutel = ?"),
  recent: store.db.prepare("SELECT sleutel, naar, onderwerp, status, fout, ts FROM mails ORDER BY ts DESC LIMIT ?"),
};

// "Naam <adres>" of enkel "adres" ontleden.
function parseFrom(s) {
  const m = /^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(s);
  return m ? { name: m[1].replace(/^"|"$/g, "") || undefined, email: m[2] } : { email: s.trim() };
}
const validEmail = (e) => typeof e === "string" && /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i.test(e.trim());

function enabled() {
  return (PROVIDER === "brevo" || PROVIDER === "resend") && !!KEY && validEmail(parseFrom(FROM).email);
}
function status() {
  return { actief: enabled(), dienst: PROVIDER || null, afzender: FROM ? parseFrom(FROM).email : null, ontbreekt: [!PROVIDER && "MAIL_PROVIDER", !KEY && "MAIL_API_KEY", !FROM && "MAIL_FROM"].filter(Boolean) };
}

async function post(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { method: "POST", headers: Object.assign({ "content-type": "application/json", accept: "application/json" }, headers), body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) {
      let msg = "";
      try { const j = await r.json(); msg = j.message || j.error || j.name || JSON.stringify(j); } catch (_) { msg = r.statusText; }
      throw new Error(`${PROVIDER} antwoordde ${r.status}: ${String(msg).slice(0, 300)}`);
    }
  } finally { clearTimeout(t); }
}

// Verstuurt één mail. Gooit een fout als het niet lukt.
async function send({ to, subject, text, html }) {
  if (!enabled()) throw new Error("E-mail is niet ingesteld op deze server.");
  if (!validEmail(to)) throw new Error("Ongeldig e-mailadres.");
  const from = parseFrom(FROM);
  if (PROVIDER === "brevo") {
    return post("https://api.brevo.com/v3/smtp/email", { "api-key": KEY }, {
      sender: from, to: [{ email: to }], subject, htmlContent: html, textContent: text,
      ...(REPLY_TO && validEmail(parseFrom(REPLY_TO).email) ? { replyTo: parseFrom(REPLY_TO) } : {}),
    });
  }
  return post("https://api.resend.com/emails", { authorization: `Bearer ${KEY}` }, {
    from: FROM, to: [to], subject, html, text,
    ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
  });
}

// Verstuurt een mail hooguit één keer per sleutel (bv. per aanvraagpakket), ook als de server meerdere keren probeert.
// Een mislukte poging mag later opnieuw.
async function sendOnce(sleutel, mail) {
  if (!enabled()) return { overgeslagen: true };
  const nu = new Date().toISOString();
  const claimed = q.claim.run(sleutel, mail.to, mail.subject, nu).changes === 1;
  if (!claimed) {
    const vorige = store.db.prepare("SELECT status FROM mails WHERE sleutel = ?").get(sleutel);
    if (!vorige || vorige.status !== "mislukt") return { al: true };
    q.done.run("bezig", null, nu, sleutel);
  }
  try {
    await send(mail);
    q.done.run("verstuurd", null, new Date().toISOString(), sleutel);
    return { ok: true };
  } catch (err) {
    q.done.run("mislukt", String(err && err.message || err).slice(0, 500), new Date().toISOString(), sleutel);
    console.error("Mail niet verstuurd:", err && err.message);
    return { fout: err && err.message };
  }
}

// Laatste mails voor de beheerder, zonder volledige adressen van anderen.
const verberg = (e) => String(e).replace(/^(.).*?(@.*)$/, "$1…$2");
function recent(n = 20) {
  return q.recent.all(n).map((m) => Object.assign(m, { naar: verberg(m.naar) }));
}

// ---------------------------------------------------------------- opmaak
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function layout(titel, alineas, knop) {
  const html = `<!doctype html><html lang="nl"><body style="margin:0;padding:24px;background:#F4F1EA;font-family:Arial,Helvetica,sans-serif;color:#1F2A22">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 28px 22px">
<div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#2F5A3A;margin-bottom:16px">De Fokwijzer</div>
<h1 style="font-size:19px;margin:0 0 12px">${esc(titel)}</h1>
${alineas.map((a) => (a.lijst ? `<ul style="padding-left:20px;margin:8px 0 14px;line-height:1.6">${a.lijst.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p style="line-height:1.55;margin:0 0 12px">${esc(a)}</p>`)).join("\n")}
${knop ? `<p style="margin:20px 0 6px"><a href="${esc(knop.url)}" style="display:inline-block;background:#2F5A3A;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold">${esc(knop.tekst)}</a></p>` : ""}
<p style="font-size:12px;color:#6B7268;margin:22px 0 0">Je krijgt deze mail omdat je een account hebt bij De Fokwijzer. Powered by DeDilieHoeve.</p>
</div></body></html>`;
  const text = [titel, "", ...alineas.map((a) => (a.lijst ? a.lijst.map((x) => "- " + x).join("\n") : a)), knop ? `\n${knop.tekst}: ${knop.url}` : "", "", "De Fokwijzer"].join("\n");
  return { html, text };
}

// Mail aan de aanvrager zodra alle paarden van een aanvraag afgehandeld zijn.
function aanvraagKlaar({ naam, online, nietOnline }) {
  const alineas = [`Dag ${naam || "fokker"},`];
  if (online.length) {
    alineas.push(online.length > 1 ? "Goed nieuws: deze paarden staan nu online in De Fokwijzer:" : "Goed nieuws: dit paard staat nu online in De Fokwijzer:");
    alineas.push({ lijst: online });
  }
  if (nietOnline.length) {
    alineas.push(nietOnline.length > 1 ? "Voor deze paarden vonden we te weinig betrouwbare informatie om ze toe te voegen:" : "Voor dit paard vonden we te weinig betrouwbare informatie om het toe te voegen:");
    alineas.push({ lijst: nietOnline });
    alineas.push("Heb je een link naar Horsetelex of een stamboek? Vraag het paard dan gerust opnieuw aan met die link erbij.");
  }
  alineas.push("Bedankt om De Fokwijzer mee aan te vullen.");
  const subject = online.length
    ? (online.length > 1 ? `${online.length} paarden staan online in De Fokwijzer` : `${online[0]} staat online in De Fokwijzer`)
    : "Je aanvraag bij De Fokwijzer is afgehandeld";
  return Object.assign({ subject }, layout(online.length ? "Je aanvraag is klaar" : "Je aanvraag is afgehandeld", alineas, PUBLIC_URL ? { tekst: "Open De Fokwijzer", url: PUBLIC_URL + "/" } : null));
}

function testMail(naam) {
  return Object.assign({ subject: "Testmail van De Fokwijzer" }, layout("De mail werkt", [`Dag ${naam || "beheerder"},`, "Deze testmail bewijst dat De Fokwijzer mails kan versturen. Gebruikers krijgen voortaan een mail zodra de paarden uit hun aanvraag afgehandeld zijn."], PUBLIC_URL ? { tekst: "Open De Fokwijzer", url: PUBLIC_URL + "/" } : null));
}

module.exports = { enabled, status, send, sendOnce, recent, aanvraagKlaar, testMail };
