"use strict";
// Beveiligde downloadlinks voor bijlagen (afbeeldingen bij aanvragen en stamboomtests).
// De GitHub-repository is openbaar, dus afbeeldingen mogen daar niet op komen. In de plaats maakt de
// workflow "Wachtrij ophalen" (met het service-token) per afbeelding een link aan, die de geplande
// Claude-taak zonder token kan downloaden. Een link:
//  - is ondertekend met HMAC-SHA256 (sleutel afgeleid van SERVICE_TOKEN, dus niet te vervalsen),
//  - geldt voor precies 1 bijlage en is kort geldig (standaard 30 minuten),
//  - werkt maar 1 keer: na de eerste download is ze ongeldig.
// Zo kan wie de openbare wachtrij leest de afbeelding niet later nog ophalen.
const crypto = require("crypto");
const store = require("./store");

const GELDIG_S = Math.min(Math.max(parseInt(process.env.DOWNLOADLINK_MINUTEN || "30", 10) || 30, 1), 180) * 60;
const IMG_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,159}$/;

function sleutel() {
  const t = process.env.SERVICE_TOKEN || "";
  return t.length >= 32 ? crypto.createHmac("sha256", t).update("fokwijzer-downloadlink-v1").digest() : null;
}
const handtekening = (k, id, exp, nonce) => crypto.createHmac("sha256", k).update(`${id}|${exp}|${nonce}`).digest("base64url");

// Gebruikte links (handtekening -> vervaltijd). In het geheugen volstaat: een link vervalt toch snel.
const gebruikt = new Map();
function opruimen(nu) { for (const [s, exp] of gebruikt) if (exp < nu) gebruikt.delete(s); }

// Maakt links voor de gevraagde bijlagen die bestaan en een afbeelding hebben. Geeft {id: pad}.
function maak(ids) {
  const k = sleutel();
  if (!k) return null;
  const exp = Math.floor(Date.now() / 1000) + GELDIG_S;
  const uit = {};
  for (const id of ids) {
    if (typeof id !== "string" || !ID_RE.test(id)) continue;
    const d = store.getDoc("bijlagen", id);
    if (!d || !d.data || !IMG_RE.test(d.data.afbeelding || "")) continue;
    const nonce = crypto.randomBytes(9).toString("base64url");
    uit[id] = `/api/download/${encodeURIComponent(id)}?exp=${exp}&n=${nonce}&sig=${handtekening(k, id, exp, nonce)}`;
  }
  return { links: uit, geldig_tot: new Date(exp * 1000).toISOString() };
}

// Controleert een link. Geeft {type, buffer} of {status, fout}.
function haal(id, q) {
  const k = sleutel();
  const nu = Math.floor(Date.now() / 1000);
  const exp = parseInt(q.exp, 10);
  const nonce = typeof q.n === "string" ? q.n : "";
  const sig = typeof q.sig === "string" ? q.sig : "";
  if (!k || !ID_RE.test(id) || !/^[A-Za-z0-9_-]{8,40}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(sig) || !Number.isFinite(exp))
    return { status: 404, fout: "Niet gevonden." };
  const verwacht = Buffer.from(handtekening(k, id, exp, nonce));
  const kreeg = Buffer.from(sig);
  if (kreeg.length !== verwacht.length || !crypto.timingSafeEqual(kreeg, verwacht)) return { status: 404, fout: "Niet gevonden." };
  if (exp < nu || exp > nu + GELDIG_S + 60) return { status: 410, fout: "Deze link is verlopen." };
  opruimen(nu);
  if (gebruikt.has(sig)) return { status: 410, fout: "Deze link werd al gebruikt." };
  const d = store.getDoc("bijlagen", id);
  const m = d && d.data && IMG_RE.exec(d.data.afbeelding || "");
  if (!m) return { status: 404, fout: "Niet gevonden." };
  gebruikt.set(sig, exp);
  return { type: "image/" + m[1], buffer: Buffer.from(m[2], "base64") };
}

module.exports = { maak, haal, GELDIG_S };
