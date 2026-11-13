"use strict";
// Rechten per collectie en controle van documenten.
// read/create/update/delete = minimaal niveau (0 lezer zonder account, 1 gebruiker, 2 paarden-beheerder, 3 beheerder)
// Objecten zonder prototype, zodat namen als "constructor" of "__proto__" nooit als collectie gelden.
const table = (o) => Object.freeze(Object.assign(Object.create(null), o));
const COLLS = table({
  paarden: { read: 0, create: 2, update: 1, delete: 2, max: 400e3 }, // update 1: alleen wiki-velden, delete 2: alleen eigen paarden (zie index.js)
  veilingen: { read: 0, create: 3, update: 3, delete: 3, max: 3e6 },
  council: { read: 0, create: 2, update: 2, delete: 3, max: 200e3 },
  partners: { read: 0, create: 1, update: 1, delete: 1, max: 400e3 }, // niet-beheerders: alleen als partner, alleen eigen plekken (zie index.js)
  // Contact- en betaalgegevens van partners: alleen beheerders (nooit publiek).
  partner_admin: { read: 3, create: 3, update: 3, delete: 3, max: 50e3 },
  aanvragen: { read: 1, create: 1, update: 2, delete: 3, max: 200e3 },
  bijlagen: { read: 2, create: 3, update: 3, delete: 3, max: 1.2e6 }, // afbeelding bij een aanvraag; aanmaken enkel via /api/aanvraag
  // Testen van het lezen van stambomen op afbeeldingen (Beheer); de afbeelding staat in "bijlagen" als st-<id>.
  stamboomtests: { read: 2, create: 3, update: 3, delete: 3, max: 200e3 },
  veiling_backlog: { read: 3, create: 3, update: 3, delete: 3, max: 3e6 },
  systeem: { read: 0, create: 3, update: 3, delete: 3, max: 100e3 },
  // Werkplek van een Fokwijzer-profiel (bewaarde hengsten, merries en virtuele veulens): enkel het eigen
  // document, met als id het gebruikers-id (zie index.js). Een beheerder kan elke werkplek openen.
  mijnstal: { read: 2, create: 2, update: 2, delete: 2, max: 900e3 },
  // Aanvragen voor de expertenraad: aanmaken enkel via /api/council/aanvraag. Een geplande taak verwerkt
  // ze één keer per uur en zet het advies in "council".
  // Openbaar fokkersprofiel van een Fokwijzer-profiel: iedereen leest, enkel de eigenaar schrijft
  // (id = gebruikers-id, zie index.js).
  fokkers: { read: 0, create: 2, update: 2, delete: 2, max: 60e3 },
  // Verslagen van de dierenarts bij het merriedossier: enkel via /api/verslagen (eigenaar of beheerder).
  verslagen: { read: 3, create: 99, update: 99, delete: 3, max: 5e6 },
  // Herinneringen per mail: instellingen en verzonden mails, enkel via /api/mail (zie herinneringen.js).
  mailinst: { read: 3, create: 99, update: 99, delete: 3, max: 20e3 },
  maillog: { read: 3, create: 99, update: 99, delete: 3, max: 100e3 },
  councilvragen: { read: 1, create: 3, update: 3, delete: 3, max: 120e3 },
});
// Uitzonderingen voor losse systeemdocumenten.
const SYS_DOCS = table({
  instellingen: { read: 3 },
  verwerking: { create: 2, update: 2 },
});
const isColl = (c) => typeof c === "string" && Object.hasOwn(COLLS, c);
// Geeft het vereiste niveau terug, of 99 (niemand) als iets onbekend is: altijd gesloten bij twijfel.
function rule(coll, id, op) {
  if (!isColl(coll)) return 99;
  if (coll === "systeem" && id && Object.hasOwn(SYS_DOCS, id) && typeof SYS_DOCS[id][op] === "number") return SYS_DOCS[id][op];
  const n = COLLS[coll][op];
  return typeof n === "number" ? n : 99;
}

// ---------------------------------------------------------------- validatie
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$/;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
// HTML-achtige inhoud en gevaarlijke URL-schema's weigeren, als extra laag naast escaping en CSP.
const TAG_RE = /<\s*[a-zA-Z!\/?]/;
// Browsers negeren tabs, regeleinden en spaties in URL-schema's; daarom eerst alles samenvoegen.
const SCHEME_RE = /(javascript|vbscript|livescript)(:|&colon;)|data:[a-z-]+\/[a-z0-9.+-]+|blob:|filesystem:/i;
const NAMED = { tab: "\t", newline: "\n", colon: ":", nbsp: " ", sol: "/" };
// HTML-entiteiten eerst omzetten (bv. &#9; of &Tab;), zodat ze de controle niet kunnen omzeilen.
const decode = (v) => v
  .replace(/&#x0*([0-9a-f]{1,6});?/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (_) { return ""; } })
  .replace(/&#0*([0-9]{1,7});?/g, (m, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch (_) { return ""; } })
  .replace(/&([a-z]+);/gi, (m, n) => (Object.hasOwn(NAMED, n.toLowerCase()) ? NAMED[n.toLowerCase()] : m));
function badText(v) {
  if (TAG_RE.test(v)) return true;
  const compact = decode(v).replace(/[\u0000-\u0020\u007f-\u00a0\u2000-\u200f\u2028\u2029\ufeff]/g, "");
  return SCHEME_RE.test(compact);
}
function checkValue(v, depth, where) {
  if (depth > 12) return `${where}: te diep genest`;
  if (v === null || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? null : `${where}: ongeldig getal`;
  if (typeof v === "string") {
    // Afbeeldingen als data-URL mogen langer zijn dan gewone tekst; de maximale grootte per collectie blijft gelden.
    if (v.length <= 1.2e6 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return null;
    if (v.length > 200000) return `${where}: tekst te lang`;
    if (badText(v)) return `${where}: HTML of scripts zijn niet toegestaan`;
    return null;
  }
  if (Array.isArray(v)) {
    if (v.length > 5000) return `${where}: lijst te lang`;
    for (let i = 0; i < v.length; i++) { const e = checkValue(v[i], depth + 1, `${where}[${i}]`); if (e) return e; }
    return null;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length > 500) return `${where}: te veel velden`;
    for (const k of keys) {
      if (BAD_KEYS.has(k) || k.length > 100) return `${where}: ongeldige veldnaam`;
      const e = checkValue(v[k], depth + 1, `${where}.${k}`);
      if (e) return e;
    }
    return null;
  }
  return `${where}: ongeldig type`;
}
function validDoc(coll, data) {
  if (!isColl(coll)) return "Onbekende collectie.";
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Een document moet een object zijn.";
  const size = Buffer.byteLength(JSON.stringify(data));
  if (size > COLLS[coll].max) return "Dit document is te groot.";
  return checkValue(data, 0, "data");
}

// Een lezer mag een paard aanvragen, maar geen statussen of agentresultaten meesturen.
function readerRequest(data) {
  const d = data && typeof data === "object" ? data : {};
  const naam = typeof d.naam === "string" ? d.naam.slice(0, 120).trim() : "";
  if (!naam) return null; // wordt door de validatie geweigerd
  const out = { naam, status: "wachtrij", aangevraagd_op: new Date().toISOString() };
  if (typeof d.link === "string" && d.link.trim()) out.link = d.link.slice(0, 500).trim();
  return out;
}

module.exports = { COLLS, isColl, rule, ID_RE, validDoc, readerRequest };
