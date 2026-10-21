"use strict";
// Importeert een Fokwijzer-export (knop "Exporteer alle data" in de app) in de database.
// Gebruik: node scripts/import.js pad/naar/fokwijzer-export.json
const fs = require("fs");
const store = require("../server/store");
const { validDoc, ID_RE, COLLS } = require("../server/validate");

const file = process.argv[2];
if (!file) { console.error("Gebruik: node scripts/import.js <export.json>"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const cols = data && data.formaat === "fokwijzer-export" && data.collecties;
if (!cols) { console.error("Dit is geen Fokwijzer-export."); process.exit(1); }

const ALLOWED = Object.keys(COLLS);
const actor = { label: "import", userId: null, ip: null };
let n = 0, skipped = 0;
function neutralize(v) {
  if (typeof v === "string") return v.replace(/</g, "‹").replace(/>/g, "›").replace(/javascript:/gi, "javascript‐:");
  if (Array.isArray(v)) return v.map(neutralize);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = neutralize(v[k]); return o; }
  return v;
}
for (const [coll, docs] of Object.entries(cols)) {
  if (!ALLOWED.includes(coll)) { console.warn(`Collectie ${coll} overgeslagen.`); continue; }
  for (let [id, doc] of Object.entries(docs || {})) {
    if (!ID_RE.test(id) || !doc || typeof doc !== "object") { skipped++; continue; }
    // Trigger-id's van Claude zijn op de website niet bruikbaar.
    if (coll === "systeem" && id === "instellingen") { skipped++; continue; }
    let err = validDoc(coll, doc);
    if (err && /HTML of scripts/.test(err)) {
      // Tekst met punthaken (bv. '<vader> x <moeder>') onschadelijk maken in plaats van weigeren.
      doc = neutralize(doc);
      console.warn(`${coll}/${id}: punthaken vervangen door ‹ ›`);
      err = validDoc(coll, doc);
    }
    if (err) { console.warn(`${coll}/${id} overgeslagen: ${err}`); skipped++; continue; }
    store.writeDoc(coll, id, doc, actor);
    n++;
  }
}
console.log(`${n} documenten geïmporteerd, ${skipped} overgeslagen.`);
