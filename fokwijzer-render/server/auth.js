"use strict";
// Accounts, wachtwoorden (scrypt), sessies en rollen.
const crypto = require("crypto");
const { db, now, audit } = require("./store");

const ROLES = ["lezer", "bijdrager", "beheerder"];
const LEVEL = { anoniem: 0, lezer: 1, bijdrager: 2, beheerder: 3 };
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || "14", 10);
const COOKIE = process.env.COOKIE_SECURE === "false" ? "fw_sess" : "__Host-fw_sess";
const SECURE = process.env.COOKIE_SECURE !== "false";
// Geen harde blokkering (die kan misbruikt worden om iemand buiten te sluiten),
// wel een oplopende vertraging per account na mislukte pogingen.
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// --- wachtwoorden
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}
// Vaste hash om timing-verschillen tussen bestaande en onbekende accounts te vermijden.
const DUMMY = hashPassword(crypto.randomBytes(16).toString("hex"));
// Asynchroon, zodat de server niet stilvalt tijdens het controleren.
function verifyPassword(pw, stored) {
  const [alg, n, salt, hash] = String(stored || DUMMY).split("$");
  if (alg !== "scrypt") return Promise.resolve(false);
  const want = Buffer.from(hash, "base64");
  return new Promise((resolve) => {
    crypto.scrypt(pw, Buffer.from(salt, "base64"), want.length, Object.assign({}, SCRYPT, { N: parseInt(n, 10) }), (err, got) => {
      resolve(!err && crypto.timingSafeEqual(want, got));
    });
  });
}
function hashPasswordAsync(pw) {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(pw, salt, 64, SCRYPT, (err, hash) => err ? reject(err) : resolve(`scrypt$${SCRYPT.N}$${salt.toString("base64")}$${hash.toString("base64")}`));
  });
}
function passwordProblem(pw, email) {
  if (typeof pw !== "string" || pw.length < 12) return "Kies een wachtwoord van minstens 12 tekens.";
  if (pw.length > 200) return "Dit wachtwoord is te lang.";
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return "Gebruik je e-mailadres niet in je wachtwoord.";
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|password|wachtwoord)/i.test(pw)) return "Dit wachtwoord is te makkelijk te raden.";
  return null;
}

// --- sessies
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const q = {
  userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  userById: db.prepare("SELECT id, email, name, role, created_at, last_login FROM users WHERE id = ?"),
  session: db.prepare("SELECT s.user_id, s.expires_at, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"),
  newSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
  touch: db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?"),
  delSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  delUserSessions: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
  insertUser: db.prepare("INSERT INTO users (email, name, pw, role, created_at) VALUES (?, ?, ?, ?, ?)"),
  fail: db.prepare("UPDATE users SET failed = failed + 1 WHERE id = ?"),
  ok: db.prepare("UPDATE users SET failed = 0, locked_until = NULL, last_login = ? WHERE id = ?"),
  setPw: db.prepare("UPDATE users SET pw = ? WHERE id = ?"),
  setRole: db.prepare("UPDATE users SET role = ? WHERE id = ?"),
  delUser: db.prepare("DELETE FROM users WHERE id = ?"),
  users: db.prepare("SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at"),
  admins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'beheerder'"),
};
const expiry = () => new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i <= 0) return;
    try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) { /* ongeldige cookie negeren */ }
  });
  return out;
}
function setSessionCookie(res, token) {
  const parts = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${SESSION_DAYS * 86400}`];
  if (SECURE) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(res) {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (SECURE) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  q.newSession.run(sha(token), userId, now(), expiry());
  setSessionCookie(res, token);
}

// --- service-token voor automatisering (bv. geplande agents die veilingen bijwerken)
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "";
if (SERVICE_TOKEN && SERVICE_TOKEN.length < 32) {
  console.error("SERVICE_TOKEN moet minstens 32 tekens lang zijn. Het token wordt genegeerd.");
}
const serviceHash = SERVICE_TOKEN.length >= 32 ? crypto.createHash("sha256").update(SERVICE_TOKEN).digest() : null;

// Middleware: bepaalt wie de aanvraag doet. Zet req.actor.
function identify(req, res, next) {
  const ip = req.ip;
  const authz = req.get("authorization") || "";
  if (serviceHash && authz.startsWith("Bearer ")) {
    const got = crypto.createHash("sha256").update(authz.slice(7)).digest();
    if (crypto.timingSafeEqual(got, serviceHash)) {
      req.actor = { level: LEVEL.beheerder, role: "beheerder", label: "automatisering", userId: null, ip, service: true };
      return next();
    }
    return res.status(401).json({ fout: "Ongeldig token." });
  }
  const token = parseCookies(req.get("cookie"))[COOKIE];
  if (token && token.length < 200) {
    const h = sha(token);
    const s = q.session.get(h);
    if (s && s.expires_at > now()) {
      // Sessie verlengen als ze over de helft is.
      if (Date.parse(s.expires_at) - Date.now() < (SESSION_DAYS * 864e5) / 2) {
        q.touch.run(expiry(), h);
        setSessionCookie(res, token);
      }
      req.actor = { level: LEVEL[s.role] || LEVEL.lezer, role: s.role, label: `${s.name} <${s.email}>`, userId: s.user_id, name: s.name, email: s.email, ip, tokenHash: h };
      return next();
    }
    if (s) q.delSession.run(h);
    clearSessionCookie(res);
  }
  req.actor = { level: LEVEL.anoniem, role: "anoniem", label: "anoniem", userId: null, ip };
  next();
}

const need = (role) => (req, res, next) => {
  if (req.actor.level >= LEVEL[role]) return next();
  res.status(req.actor.level ? 403 : 401).json({ fout: req.actor.level ? "Je hebt hiervoor niet de juiste rol." : "Log eerst in." });
};

function cleanEmail(e) {
  e = String(e || "").trim().toLowerCase();
  return /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/.test(e) ? e : null;
}
function cleanName(n) {
  n = String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim();
  return n.length >= 2 && n.length <= 60 ? n : null;
}

async function register({ email, name, password }) {
  const e = cleanEmail(email), n = cleanName(name);
  if (!e) return { fout: "Vul een geldig e-mailadres in." };
  if (!n) return { fout: "Vul een naam in van 2 tot 60 tekens." };
  const p = passwordProblem(password, e);
  if (p) return { fout: p };
  if (q.userByEmail.get(e)) return { fout: "Met deze gegevens kan geen account gemaakt worden. Heb je al een account? Log dan in." };
  const info = q.insertUser.run(e, n, await hashPasswordAsync(password), process.env.DEFAULT_ROLE === "bijdrager" ? "bijdrager" : "lezer", now());
  audit({ actor: `${n} <${e}>`, user_id: info.lastInsertRowid, action: "account aangemaakt" });
  return { id: info.lastInsertRowid };
}

// Per e-mailadres (bestaand of niet): pogingen één voor één, met een budget van 10 mislukte pogingen per kwartier.
// Zo helpen parallelle aanvragen of veel IP-adressen niet om wachtwoorden te raden, en verraadt de timing niet of een account bestaat.
const FAIL_BUDGET = 10, FAIL_WINDOW = 15 * 60e3;
const failures = new Map(); // email -> tijdstippen van mislukte pogingen
const chains = new Map();
function serial(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}
function recentFailures(key) {
  const list = (failures.get(key) || []).filter((t) => t > Date.now() - FAIL_WINDOW);
  if (list.length) failures.set(key, list); else failures.delete(key);
  return list.length;
}
setInterval(() => { for (const k of failures.keys()) recentFailures(k); }, FAIL_WINDOW).unref();

function login(email, password, ip) {
  const e = cleanEmail(email);
  const key = e || "ongeldig";
  return serial(key, async () => {
    const n = recentFailures(key);
    if (n > 3) await delay(Math.min(5000, (n - 3) * 1000));
    if (n >= FAIL_BUDGET) {
      await verifyPassword("x", DUMMY); // zelfde rekentijd, maar geen echte controle
      audit({ actor: e || "onbekend", ip, action: "inloggen geweigerd (te veel pogingen)" });
      return { fout: "E-mailadres of wachtwoord klopt niet." };
    }
    const u = e ? q.userByEmail.get(e) : null;
    const ok = await verifyPassword(String(password || "").slice(0, 200), u ? u.pw : DUMMY);
    if (!u || !ok) {
      failures.set(key, (failures.get(key) || []).concat(Date.now()));
      if (u) q.fail.run(u.id);
      audit({ actor: e || "onbekend", ip, action: "inloggen mislukt" });
      return { fout: "E-mailadres of wachtwoord klopt niet." };
    }
    failures.delete(key);
    q.ok.run(now(), u.id);
    audit({ actor: `${u.name} <${u.email}>`, user_id: u.id, ip, action: "ingelogd" });
    return { id: u.id };
  });
}

function logout(req, res) {
  if (req.actor.tokenHash) q.delSession.run(req.actor.tokenHash);
  clearSessionCookie(res);
}

async function changePassword(userId, oldPw, newPw) {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!u || !(await verifyPassword(String(oldPw || "").slice(0, 200), u.pw))) return { fout: "Je huidige wachtwoord klopt niet." };
  const p = passwordProblem(newPw, u.email);
  if (p) return { fout: p };
  q.setPw.run(await hashPasswordAsync(newPw), userId);
  q.delUserSessions.run(userId);
  return { ok: true };
}

async function createUser(email, name, password, role) {
  const r = await register({ email, name, password });
  if (r.fout) return r;
  if (role && ROLES.includes(role)) q.setRole.run(role, r.id);
  return r;
}

function listUsers() { return q.users.all(); }
// Eerste beheerder aanmaken vanuit instellingen (handig op Render, zonder shell).
// Werkt alleen zolang er nog geen enkele gebruiker bestaat.
async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD;
  if (!email || !pw) return;
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) {
    console.log("[beheerder] Er bestaan al gebruikers; ADMIN_PASSWORD wordt genegeerd. Verwijder het uit de instellingen.");
    return;
  }
  const r = await createUser(email, process.env.ADMIN_NAME || "Beheerder", pw, "beheerder");
  console.log(r.fout ? `[beheerder] Niet aangemaakt: ${r.fout}` : `[beheerder] ${email} aangemaakt. Verwijder ADMIN_PASSWORD nu uit de instellingen.`);
}
function setRole(actor, id, role) {
  if (!ROLES.includes(role)) return { fout: "Onbekende rol." };
  const u = q.userById.get(id);
  if (!u) return { fout: "Gebruiker niet gevonden." };
  if (u.role === "beheerder" && role !== "beheerder" && q.admins.get().n <= 1) return { fout: "Er moet minstens één beheerder overblijven." };
  q.setRole.run(role, id);
  q.delUserSessions.run(id); // nieuwe rol geldt vanaf de volgende login
  audit({ actor: actor.label, user_id: actor.userId, ip: actor.ip, action: `rol van ${u.email} gewijzigd naar ${role}` });
  return { ok: true };
}
function deleteUser(actor, id) {
  const u = q.userById.get(id);
  if (!u) return { fout: "Gebruiker niet gevonden." };
  if (u.role === "beheerder" && q.admins.get().n <= 1) return { fout: "Er moet minstens één beheerder overblijven." };
  q.delUser.run(id);
  audit({ actor: actor.label, user_id: actor.userId, ip: actor.ip, action: `account ${u.email} verwijderd` });
  return { ok: true };
}

module.exports = { bootstrapAdmin, LEVEL, ROLES, identify, need, register, login, logout, startSession, changePassword, createUser, listUsers, setRole, deleteUser, userById: (id) => q.userById.get(id) };
