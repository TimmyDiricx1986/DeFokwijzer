"use strict";
// Aanvragen als pakket: een gebruiker vraagt in één keer 1 tot MAX_PAARDEN paarden aan,
// en mag dat hoogstens PER_DAG keer per dag (Belgische tijd). De server telt, niet de browser.
// Paarden-beheerders en beheerders zijn vrijgesteld van de daglimiet.
const crypto = require("crypto");
const store = require("./store");
const { LEVEL } = require("./auth");

const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
const PER_DAG = num(process.env.AANVRAAG_PER_DAG, 3);
const MAX_PAARDEN = num(process.env.AANVRAAG_MAX_PAARDEN, 5);
const TZ = "Europe/Brussels";

const dag = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const vrijgesteld = (actor) => !!(actor.service || actor.level >= LEVEL.paardenbeheerder);

// Aantal pakketten dat deze gebruiker vandaag al indiende. Een oude losse aanvraag (zonder pakket) telt als één pakket.
function gebruiktVandaag(userId) {
  const vandaag = dag(new Date());
  const pakketten = new Set();
  for (const d of store.listDocs("aanvragen")) {
    const a = d.data || {};
    if (a.aanvrager_id !== userId || typeof a.aangevraagd_op !== "string") continue;
    const t = new Date(a.aangevraagd_op);
    if (Number.isNaN(t.getTime()) || dag(t) !== vandaag) continue;
    pakketten.add(a.pakket || "los:" + d.id);
  }
  return pakketten.size;
}

function limiet(actor) {
  const vrij = vrijgesteld(actor);
  const gebruikt = actor.userId ? gebruiktVandaag(actor.userId) : 0;
  return { per_dag: PER_DAG, max_paarden: MAX_PAARDEN, gebruikt, resterend: vrij ? null : Math.max(0, PER_DAG - gebruikt), vrijgesteld: vrij };
}

// Een afbeelding of printscreen bij een paard (optioneel): enkel PNG, JPG of WebP als data-URL, en de inhoud
// moet echt zo'n afbeelding zijn (de eerste bytes worden gecontroleerd). De browser verkleint ze vooraf.
const IMG_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_IMG = 900000; // tekens base64, ongeveer 650 kB
function schoonAfbeelding(v, naam) {
  if (v == null || v === "") return {};
  if (typeof v !== "string") return { fout: `De bijlage bij "${naam}" is geen afbeelding.` };
  if (v.length > MAX_IMG) return { fout: `De afbeelding bij "${naam}" is te groot (maximaal ongeveer 650 kB).` };
  const m = IMG_RE.exec(v);
  if (!m) return { fout: `De bijlage bij "${naam}" is geen PNG-, JPG- of WebP-afbeelding.` };
  const b = Buffer.from(m[2].slice(0, 24), "base64");
  const ok = m[1] === "png" ? b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : m[1] === "jpeg" ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    : b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  if (!ok) return { fout: `De bijlage bij "${naam}" is geen geldige afbeelding.` };
  return { afbeelding: v };
}

// Controleert en schoont de lijst paarden op. Geeft { paarden } of { fout }.
function schoonPaarden(lijst) {
  if (!Array.isArray(lijst) || !lijst.length) return { fout: "Vul minstens één paard in." };
  if (lijst.length > MAX_PAARDEN) return { fout: `Je kunt maximaal ${MAX_PAARDEN} paarden per aanvraag indienen.` };
  const paarden = [], gezien = new Set();
  for (const p of lijst) {
    const naam = p && typeof p.naam === "string" ? p.naam.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    if (!naam) return { fout: "Elk paard heeft een naam nodig." };
    const sleutel = naam.toLowerCase();
    if (gezien.has(sleutel)) return { fout: `"${naam}" staat twee keer in je aanvraag.` };
    gezien.add(sleutel);
    const out = { naam };
    if (p.link != null && p.link !== "") {
      let link = typeof p.link === "string" ? p.link.trim().slice(0, 500) : "";
      if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
      let ok = false;
      try { const u = new URL(link); ok = /^https?:$/.test(u.protocol) && u.hostname.includes("."); } catch (_) {}
      if (!ok) return { fout: `De link bij "${naam}" is geen geldige webpagina.` };
      out.link = link;
    }
    const im = schoonAfbeelding(p.afbeelding, naam);
    if (im.fout) return { fout: im.fout };
    if (im.afbeelding) out.afbeelding = im.afbeelding;
    paarden.push(out);
  }
  return { paarden };
}

// Is er nog plaats vandaag? Geeft null of een foutobject (status 429).
function daglimietFout(actor) {
  if (vrijgesteld(actor)) return null;
  if (gebruiktVandaag(actor.userId) < PER_DAG) return null;
  return { fout: `Je hebt vandaag je ${PER_DAG} aanvragen gebruikt. Morgen kan het weer.`, code: "daglimiet", resterend: 0 };
}

// Maakt de documenten voor één pakket. better-sqlite3 werkt synchroon, dus controle en schrijven gebeuren in één stap.
// Een afbeelding gaat in een apart document in "bijlagen" (zelfde id als de aanvraag), dat alleen
// paarden-beheerders, beheerders en de data-agent kunnen lezen. De aanvraag zelf krijgt enkel bijlage: true.
function maakPakket(actor, paarden) {
  const pakket = crypto.randomBytes(8).toString("hex");
  const nu = new Date().toISOString();
  return paarden.map((p) => {
    const id = crypto.randomBytes(10).toString("hex");
    const wie = actor.userId ? { aanvrager_id: actor.userId } : {};
    const data = Object.assign({ naam: p.naam }, p.link ? { link: p.link } : {}, p.afbeelding ? { bijlage: true } : {}, {
      status: "wachtrij", aangevraagd_op: nu, pakket, pakket_grootte: paarden.length, ...wie,
    });
    const bijlage = p.afbeelding ? Object.assign({ aanvraag_id: id, naam: p.naam, afbeelding: p.afbeelding, aangemaakt_op: nu }, wie) : null;
    return { id, data, bijlage };
  });
}

module.exports = { PER_DAG, MAX_PAARDEN, MAX_IMG, limiet, schoonPaarden, schoonAfbeelding, daglimietFout, maakPakket, vrijgesteld };
