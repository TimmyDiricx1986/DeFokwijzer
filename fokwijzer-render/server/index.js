"use strict";
// De Fokwijzer: webserver met API, rechten en beveiliging.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const { rateLimit } = require("express-rate-limit");
const store = require("./store");
const auth = require("./auth");
const ai = require("./ai");

const PORT = parseInt(process.env.PORT || "8080", 10);
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const PROD = process.env.NODE_ENV === "production";
const { LEVEL } = auth;

if (PROD && !PUBLIC_URL) {
  console.error("Zet PUBLIC_URL (bv. https://fokwijzer.be) in productie.");
  process.exit(1);
}

const { isColl, rule, ID_RE, validDoc, readerRequest } = require("./validate");

// ---------------------------------------------------------------- live updates (SSE)
const clients = new Set();
function broadcast(coll, id) {
  const msg = `event: change\ndata: ${JSON.stringify({ coll, id })}\n\n`;
  for (const c of clients) if (c.level >= (rule(coll, id, "read") ?? 99)) c.res.write(msg);
}

// ---------------------------------------------------------------- app
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) || process.env.TRUST_PROXY : false);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "style-src-attr": ["'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'none'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
      ...(PROD ? { "upgrade-insecure-requests": [] } : {}),
    },
  },
  strictTransportSecurity: PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  next();
});
app.use(compression({ filter: (req, res) => req.path !== "/api/stream" && compression.filter(req, res) }));

// Algemene limiet op API-gebruik per IP.
const authLimiter = (limit) => rateLimit({ windowMs: 15 * 60e3, limit, standardHeaders: "draft-7", legacyHeaders: false, message: { fout: "Te veel pogingen. Probeer het later opnieuw." } });
const loginLimit = authLimiter(20), registerLimit = authLimiter(10), passwordLimit = authLimiter(10);
const writeLimit = rateLimit({ windowMs: 60e3, limit: 120, skip: (req) => !!(req.actor && (req.actor.service || req.actor.level >= 3)), standardHeaders: "draft-7", legacyHeaders: false, message: { fout: "Te veel wijzigingen per minuut." } });

app.use("/api/", express.json({ limit: "4mb" }));
app.use("/api/", auth.identify);
// Algemene limiet op API-gebruik per IP (beheerders en automatisering uitgezonderd, bv. voor een import).
app.use("/api/", rateLimit({ windowMs: 60e3, limit: 300, skip: (req) => !!(req.actor.service || req.actor.level >= 3), standardHeaders: "draft-7", legacyHeaders: false, message: { fout: "Te veel verzoeken. Wacht even." } }));

// CSRF-bescherming: elke wijziging moet de eigen header dragen en van de eigen site komen.
app.use("/api/", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.actor.service) return next();
  if (req.get("x-fokwijzer") !== "1") return res.status(403).json({ fout: "Ongeldig verzoek." });
  const origin = req.get("origin");
  if (origin) {
    const own = PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    if (origin !== own) return res.status(403).json({ fout: "Ongeldige herkomst." });
  }
  next();
});
app.use("/api/", (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

const actorJson = (a) => (a.userId ? { id: a.userId, naam: a.name, email: a.email, rol: a.role } : a.service ? { naam: "automatisering", rol: "beheerder" } : null);

// ---------------------------------------------------------------- accounts
app.get("/api/me", (req, res) => {
  res.json({
    gebruiker: actorJson(req.actor),
    registratie: process.env.REGISTRATION !== "closed",
    ai: ai.enabled(),
    taken: { verwerking: HOOKS.has("verwerking"), veilingmeester: HOOKS.has("veilingmeester") },
  });
});
app.post("/api/auth/register", registerLimit, async (req, res) => {
  if (process.env.REGISTRATION === "closed") return res.status(403).json({ fout: "Registreren is gesloten. Vraag een beheerder om een account." });
  const r = await auth.register(req.body || {});
  if (r.fout) return res.status(400).json(r);
  auth.startSession(res, r.id);
  res.json({ ok: true });
});
app.post("/api/auth/login", loginLimit, async (req, res) => {
  const b = req.body || {};
  const r = await auth.login(b.email, b.password, req.ip);
  if (r.fout) return res.status(401).json(r);
  auth.startSession(res, r.id);
  res.json({ ok: true });
});
app.post("/api/auth/logout", (req, res) => { auth.logout(req, res); res.json({ ok: true }); });
app.post("/api/auth/password", passwordLimit, auth.need("lezer"), async (req, res) => {
  const b = req.body || {};
  const r = await auth.changePassword(req.actor.userId, b.oud, b.nieuw);
  if (r.fout) return res.status(400).json(r);
  auth.startSession(res, req.actor.userId);
  res.json({ ok: true });
});
app.get("/api/users", auth.need("beheerder"), (req, res) => res.json(auth.listUsers()));
app.patch("/api/users/:id", auth.need("beheerder"), (req, res) => {
  if (req.actor.service) return res.status(403).json({ fout: "Niet via automatisering." });
  const r = auth.setRole(req.actor, parseInt(req.params.id, 10), (req.body || {}).rol);
  res.status(r.fout ? 400 : 200).json(r);
});
app.delete("/api/users/:id", auth.need("beheerder"), (req, res) => {
  if (req.actor.service) return res.status(403).json({ fout: "Niet via automatisering." });
  const r = auth.deleteUser(req.actor, parseInt(req.params.id, 10));
  res.status(r.fout ? 400 : 200).json(r);
});

// ---------------------------------------------------------------- documenten
function guard(req, res, op) {
  const { coll } = req.params;
  const id = req.params.id;
  if (!isColl(coll)) { res.status(404).json({ fout: "Onbekende collectie." }); return false; }
  if (id != null && !ID_RE.test(id)) { res.status(400).json({ fout: "Ongeldig id." }); return false; }
  const need = rule(coll, id, op);
  if (typeof need !== "number" || req.actor.level < need) {
    res.status(req.actor.level ? 403 : 401).json({ fout: req.actor.level ? "Je hebt hiervoor niet de juiste rol." : "Log eerst in." });
    return false;
  }
  return true;
}
// Bezoekers en lezers mogen grote lijsten minder vaak opvragen.
const anonListLimit = rateLimit({ windowMs: 60e3, limit: 40, skip: (req) => req.actor.level >= 2, standardHeaders: "draft-7", legacyHeaders: false, message: { fout: "Te veel verzoeken. Wacht even." } });
app.get("/api/c/:coll", anonListLimit, (req, res) => {
  if (!guard(req, res, "read")) return;
  const { coll } = req.params;
  if (coll === "systeem") {
    return res.json(store.listDocs(coll).filter((d) => req.actor.level >= rule(coll, d.id, "read")));
  }
  // Lijst als kant-en-klare JSON met ETag: de browser krijgt 304 als er niets veranderde.
  const { etag, body } = store.listJson(coll);
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("ETag", etag);
  if (req.get("if-none-match") === etag) return res.status(304).end();
  res.type("application/json").send(body);
});
app.get("/api/c/:coll/:id", (req, res) => {
  if (!guard(req, res, "read")) return;
  const d = store.getDoc(req.params.coll, req.params.id);
  res.json({ id: req.params.id, data: d ? d.data : null });
});
function save(req, res, id, data) {
  const { coll } = req.params;
  const err = validDoc(coll, data);
  if (err) return res.status(400).json({ fout: err });
  store.writeDoc(coll, id, data, req.actor);
  broadcast(coll, id);
  res.json({ ok: true, id });
}
// Nieuw document met een door de server gekozen id.
// Lezers mogen alleen een eenvoudige aanvraag indienen (naam en eventueel link).
const incoming = (req, creating) => {
  const d = (req.body || {}).data;
  return creating && req.params.coll === "aanvragen" && req.actor.level < 2 ? readerRequest(d) : d;
};
app.post("/api/c/:coll", writeLimit, (req, res) => {
  if (!guard(req, res, "create")) return;
  save(req, res, crypto.randomBytes(10).toString("hex"), incoming(req, true));
});
// Volledig vervangen (set). Bestaat het nog niet, dan geldt het recht om aan te maken.
app.put("/api/c/:coll/:id", writeLimit, (req, res) => {
  const exists = !!store.getDoc(req.params.coll, req.params.id);
  if (!guard(req, res, exists ? "update" : "create")) return;
  save(req, res, req.params.id, incoming(req, !exists));
});
// Velden samenvoegen (update).
app.patch("/api/c/:coll/:id", writeLimit, (req, res) => {
  if (!guard(req, res, "update")) return;
  const cur = store.getDoc(req.params.coll, req.params.id);
  if (!cur) return res.status(404).json({ fout: "Niet gevonden." });
  const patch = (req.body || {}).data;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return res.status(400).json({ fout: "Ongeldige wijziging." });
  save(req, res, req.params.id, Object.assign({}, cur.data, patch));
});
app.delete("/api/c/:coll/:id", writeLimit, (req, res) => {
  if (!guard(req, res, "delete")) return;
  const ok = store.deleteDoc(req.params.coll, req.params.id, req.actor);
  if (ok) broadcast(req.params.coll, req.params.id);
  res.json({ ok });
});
// Importeren in blokken, alleen met het service-token (bv. om een export over te zetten).
app.post("/api/bulk", (req, res) => {
  if (!req.actor.service) return res.status(403).json({ fout: "Alleen met het service-token." });
  const docs = Array.isArray((req.body || {}).docs) ? req.body.docs : null;
  if (!docs || docs.length > 200) return res.status(400).json({ fout: "Stuur 1 tot 200 documenten per keer." });
  const resultaat = docs.map((d) => {
    if (!d || !isColl(d.coll) || typeof d.id !== "string" || !ID_RE.test(d.id)) return { id: d && d.id, fout: "Ongeldige collectie of id." };
    const err = validDoc(d.coll, d.data);
    if (err) return { id: d.id, fout: err };
    store.writeDoc(d.coll, d.id, d.data, req.actor);
    broadcast(d.coll, d.id);
    return { id: d.id, ok: true };
  });
  res.json({ resultaat });
});
// Wiki-geschiedenis van een document.
app.get("/api/history/:coll/:id", auth.need("bijdrager"), (req, res) => {
  if (!guard(req, res, "read")) return;
  // E-mailadressen van andere bijdragers niet doorgeven.
  res.json(store.history(req.params.coll, req.params.id).map((h) => Object.assign(h, { actor: String(h.actor).replace(/\s*<[^>]*>$/, "") })));
});

// ---------------------------------------------------------------- live updates
app.get("/api/stream", (req, res) => {
  if (clients.size > 2000) return res.status(503).end();
  let mine = 0;
  for (const c of clients) if (c.ip === req.ip) mine++;
  if (mine >= 8) return res.status(429).end();
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 5000\n\n");
  const c = { res, level: req.actor.level, ip: req.ip };
  clients.add(c);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => { clearInterval(ping); clients.delete(c); });
});

// ---------------------------------------------------------------- AI-advies (council)
app.post("/api/ai/json", auth.need("bijdrager"), async (req, res) => {
  const ctl = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ctl.abort(); });
  try {
    const b = req.body || {};
    const out = await ai.askJson(req.actor, b.prompt, { tier: b.tier, cache: b.cache }, ctl.signal);
    res.json({ ok: true, resultaat: out });
  } catch (e) {
    if (e instanceof ai.AiError) return res.status(e.status).json({ fout: e.message, code: e.code });
    console.error("[ai]", e);
    res.status(500).json({ fout: "Onverwachte fout.", code: "upstream" });
  }
});

// ---------------------------------------------------------------- geplande taken starten (webhooks)
// Webhooks werken alleen met een geheim, zodat de ontvanger kan controleren dat de oproep echt is.
const HOOKS = new Map();
if (process.env.WEBHOOK_SECRET && process.env.WEBHOOK_SECRET.length >= 24) {
  if (process.env.WEBHOOK_VERWERKING_URL) HOOKS.set("verwerking", process.env.WEBHOOK_VERWERKING_URL);
  if (process.env.WEBHOOK_VEILINGMEESTER_URL) HOOKS.set("veilingmeester", process.env.WEBHOOK_VEILINGMEESTER_URL);
} else if (process.env.WEBHOOK_VERWERKING_URL || process.env.WEBHOOK_VEILINGMEESTER_URL) {
  console.error("Webhooks uitgeschakeld: zet WEBHOOK_SECRET (minstens 24 tekens).");
}
const hookLimit = rateLimit({ windowMs: 10 * 60e3, limit: 3, message: { fout: "Deze taak werd net gestart. Probeer het later opnieuw." } });
app.post("/api/taak/:naam", hookLimit, auth.need("bijdrager"), async (req, res) => {
  const url = HOOKS.get(req.params.naam);
  if (!url) return res.status(501).json({ fout: "Deze taak is niet ingesteld op de server.", code: "niet_ingesteld" });
  const body = JSON.stringify({ taak: req.params.naam, gestart_door: req.actor.label, tijd: store.now() });
  const sig = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(body).digest("hex");
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-fokwijzer-signature": sig }, body, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("status " + r.status);
    store.audit({ actor: req.actor.label, user_id: req.actor.userId, ip: req.ip, action: `taak ${req.params.naam} gestart` });
    res.json({ ok: true });
  } catch (e) {
    console.error("[taak]", e.message);
    res.status(502).json({ fout: "De taak kon niet gestart worden.", code: "upstream" });
  }
});

app.use("/api/", (req, res) => res.status(404).json({ fout: "Niet gevonden." }));
// Foutafhandeling zonder interne details te tonen.
app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ fout: "Te groot." });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ fout: "Ongeldige JSON." });
  console.error(err);
  res.status(500).json({ fout: "Onverwachte fout." });
});

// ---------------------------------------------------------------- website
const PUB = path.join(__dirname, "..", "public");
app.use("/.well-known", express.static(path.join(PUB, ".well-known"), { dotfiles: "allow" }));
app.use(express.static(PUB, {
  index: "index.html",
  dotfiles: "deny",
  setHeaders(res, file) {
    if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    else if (/[\\/]fonts[\\/]/.test(file)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    else res.setHeader("Cache-Control", "public, max-age=300");
  },
}));
app.use((req, res) => res.status(404).sendFile(path.join(PUB, "404.html")));

if (require.main === module) {
  store.startBackups();
  auth.bootstrapAdmin().catch((e) => console.error("[beheerder]", e.message));
  app.listen(PORT, () => console.log(`De Fokwijzer draait op poort ${PORT}`));
}
module.exports = app;
