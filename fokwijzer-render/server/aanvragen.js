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
function maakPakket(actor, paarden) {
  const pakket = crypto.randomBytes(8).toString("hex");
  const nu = new Date().toISOString();
  return paarden.map((p) => {
    const id = crypto.randomBytes(10).toString("hex");
    const data = Object.assign({ naam: p.naam }, p.link ? { link: p.link } : {}, {
      status: "wachtrij", aangevraagd_op: nu, pakket, pakket_grootte: paarden.length,
      ...(actor.userId ? { aanvrager_id: actor.userId } : {}),
    });
    return { id, data };
  });
}

module.exports = { PER_DAG, MAX_PAARDEN, limiet, schoonPaarden, daglimietFout, maakPakket, vrijgesteld };
