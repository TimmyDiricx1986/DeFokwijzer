"use strict";
// Beveiligingstests voor de API. Draaien met:  npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fw-test-"));
process.env.COOKIE_SECURE = "false";
process.env.SERVICE_TOKEN = "t".repeat(40);
const app = require("../server/index");
const auth = require("../server/auth");

let base, server;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  await auth.createUser("beheer@test.be", "Beheer", "Sterk-wachtwoord-123", "beheerder");
  await auth.createUser("bij@test.be", "Bijdrager", "Sterk-wachtwoord-456", "bijdrager");
  await auth.createUser("lees@test.be", "Lezer", "Sterk-wachtwoord-789", "lezer");
});
test.after(() => server.close());

const H = { "content-type": "application/json", "x-fokwijzer": "1" };
async function login(email, pw) {
  const r = await fetch(base + "/api/auth/login", { method: "POST", headers: H, body: JSON.stringify({ email, password: pw }) });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const put = (url, data, cookie, extra) => fetch(base + url, { method: "PUT", headers: Object.assign({}, H, cookie ? { cookie } : {}, extra || {}), body: JSON.stringify({ data }) });

test("anoniem mag paarden lezen maar niet schrijven", async () => {
  assert.equal((await fetch(base + "/api/c/paarden")).status, 200);
  assert.equal((await put("/api/c/paarden/p1", { naam: "A" })).status, 401);
});

test("anoniem mag aanvragen en back-log niet lezen", async () => {
  assert.equal((await fetch(base + "/api/c/aanvragen")).status, 401);
  assert.equal((await fetch(base + "/api/c/veiling_backlog")).status, 401);
});

test("lezer mag aanvragen indienen maar geen paarden schrijven", async () => {
  const c = await login("lees@test.be", "Sterk-wachtwoord-789");
  assert.equal((await put("/api/c/aanvragen/a1", { naam: "Ratina Z", status: "wachtrij" }, c)).status, 200);
  assert.equal((await put("/api/c/aanvragen/a1", { naam: "x", status: "goedgekeurd" }, c)).status, 403, "bestaande aanvraag wijzigen vraagt bijdrager");
  assert.equal((await put("/api/c/paarden/p1", { naam: "A" }, c)).status, 403);
});

test("bijdrager mag paarden schrijven, niet verwijderen of partners beheren", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  assert.equal((await put("/api/c/paarden/p1", { naam: "A" }, c)).status, 200);
  assert.equal((await fetch(base + "/api/c/paarden/p1", { method: "DELETE", headers: Object.assign({ cookie: c }, H) })).status, 403);
  assert.equal((await put("/api/c/partners/x", { naam: "B" }, c)).status, 403);
  assert.equal((await put("/api/c/systeem/instellingen", { a: 1 }, c)).status, 403);
  assert.equal((await fetch(base + "/api/users", { headers: { cookie: c } })).status, 403);
});

test("CSRF: zonder eigen header of met vreemde herkomst geweigerd", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  const r1 = await fetch(base + "/api/c/paarden/p2", { method: "PUT", headers: { "content-type": "application/json", cookie: c }, body: JSON.stringify({ data: { naam: "x" } }) });
  assert.equal(r1.status, 403);
  const r2 = await put("/api/c/paarden/p2", { naam: "x" }, c, { origin: "https://kwaadaardig.example" });
  assert.equal(r2.status, 403);
});

test("validatie: HTML, prototype-sleutels, foute id's en te grote documenten", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  assert.equal((await put("/api/c/paarden/p3", { naam: "<script>alert(1)</script>" }, c)).status, 400);
  assert.equal((await put("/api/c/paarden/p3", { bron: "javascript:alert(1)" }, c)).status, 400);
  const r = await fetch(base + "/api/c/paarden/p3", { method: "PUT", headers: Object.assign({ cookie: c }, H), body: '{"data":{"__proto__":{"x":1}}}' });
  assert.equal(r.status, 400);
  assert.equal((await put("/api/c/paarden/..%2Fetc", { naam: "a" }, c)).status, 400);
  assert.equal((await put("/api/c/paarden/groot", { t: "x".repeat(450000) }, c)).status, 400);
  assert.equal((await put("/api/c/onbekend/x", { a: 1 }, c)).status, 404);
});

test("geschiedenis wordt bijgehouden en is alleen voor bijdragers", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  await put("/api/c/paarden/p4", { naam: "Eerst" }, c);
  await put("/api/c/paarden/p4", { naam: "Daarna" }, c);
  const h = await (await fetch(base + "/api/history/paarden/p4", { headers: { cookie: c } })).json();
  assert.equal(h.length, 2);
  assert.equal(h[0].after.naam, "Daarna");
  assert.equal((await fetch(base + "/api/history/paarden/p4")).status, 401);
});

test("verkeerd wachtwoord geeft geen hint over het bestaan van een account", async () => {
  const a = await fetch(base + "/api/auth/login", { method: "POST", headers: H, body: JSON.stringify({ email: "lees@test.be", password: "fout-fout-fout" }) });
  const b = await fetch(base + "/api/auth/login", { method: "POST", headers: H, body: JSON.stringify({ email: "bestaatniet@test.be", password: "fout-fout-fout" }) });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(await a.json(), await b.json());
});

test("service-token werkt en een fout token wordt geweigerd", async () => {
  const ok = await fetch(base + "/api/c/veilingen/v1", { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer " + "t".repeat(40) }, body: JSON.stringify({ data: { veiling: "Test" } }) });
  assert.equal(ok.status, 200);
  const bad = await fetch(base + "/api/c/veilingen/v1", { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer fout" }, body: JSON.stringify({ data: { veiling: "Test" } }) });
  assert.equal(bad.status, 401);
});

test("beveiligingsheaders staan op de pagina", async () => {
  const r = await fetch(base + "/");
  const csp = r.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("laatste beheerder kan zijn rol niet verliezen", async () => {
  const c = await login("beheer@test.be", "Sterk-wachtwoord-123");
  const users = await (await fetch(base + "/api/users", { headers: { cookie: c } })).json();
  const me = users.find((u) => u.email === "beheer@test.be");
  const r = await fetch(base + "/api/users/" + me.id, { method: "PATCH", headers: Object.assign({ cookie: c }, H), body: JSON.stringify({ rol: "lezer" }) });
  assert.equal(r.status, 400);
});

// ---- regressietests na de security-review
test("namen van prototype-eigenschappen zijn geen collecties", async () => {
  for (const c of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    const r = await fetch(base + "/api/c/" + c + "/x1", { method: "PUT", headers: H, body: JSON.stringify({ data: { a: 1 } }) });
    assert.ok([400, 401, 403, 404].includes(r.status), c + " gaf " + r.status);
    assert.notEqual((await fetch(base + "/api/c/" + c)).status, 200, c);
  }
});

test("verborgen javascript-links worden geweigerd", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  for (const v of ["java\tscript:alert(1)", "javascript\n:alert(1)", " JaVaScRiPt:alert(1)", "javascript&colon;alert(1)", "data:image/svg+xml;base64,PHN2Zz4="]) {
    assert.equal((await put("/api/c/paarden/p5", { url: v }, c)).status, 400, JSON.stringify(v));
  }
  assert.equal((await put("/api/c/paarden/p5", { url: "https://www.horsetelex.com/x", tekst: "kleiner dan <1m40 springen" }, c)).status, 200);
});

test("een lezer kan geen agentresultaten of status meesturen bij een aanvraag", async () => {
  const c = await login("lees@test.be", "Sterk-wachtwoord-789");
  assert.equal((await put("/api/c/aanvragen/a9", { naam: "Nep", status: "klaar", voorstel: { naam: "Nep" } }, c)).status, 200);
  const b = await login("bij@test.be", "Sterk-wachtwoord-456");
  const d = await (await fetch(base + "/api/c/aanvragen/a9", { headers: { cookie: b } })).json();
  assert.equal(d.data.status, "wachtrij");
  assert.equal(d.data.voorstel, undefined);
});

test("lijsten hebben een ETag en geven 304 als er niets veranderde", async () => {
  const r1 = await fetch(base + "/api/c/paarden");
  const et = r1.headers.get("etag");
  assert.ok(et);
  const r2 = await fetch(base + "/api/c/paarden", { headers: { "if-none-match": et } });
  assert.equal(r2.status, 304);
});

test("een ongeldige cookie breekt de API niet", async () => {
  const r = await fetch(base + "/api/me", { headers: { cookie: "fw_sess=%E0%A4%A" } });
  assert.equal(r.status, 200);
});

test("geschiedenis toont geen e-mailadressen", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  const h = await (await fetch(base + "/api/history/paarden/p4", { headers: { cookie: c } })).json();
  assert.ok(h.every((x) => !/@/.test(x.actor)));
});

test("entiteiten en andere URL-trucs worden geweigerd; naam als object geeft 400", async () => {
  const c = await login("bij@test.be", "Sterk-wachtwoord-456");
  for (const v of ["java&Tab;script:alert(1)", "java&#9;script:alert(1)", "javascript&#x3A;alert(1)", "data:application/xhtml+xml;base64,AA", "blob:https://x/1"]) {
    assert.equal((await put("/api/c/paarden/p6", { url: v }, c)).status, 400, v);
  }
  const l = await login("lees@test.be", "Sterk-wachtwoord-789");
  assert.equal((await put("/api/c/aanvragen/a10", { naam: { toString: 1 } }, l)).status, 400);
});

test("parallelle raadpogingen worden één voor één afgehandeld en begrensd", async () => {
  const bad = () => fetch(base + "/api/auth/login", { method: "POST", headers: H, body: JSON.stringify({ email: "doelwit@test.be", password: "fout-fout-fout" }) });
  const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: 6 }, bad));
  assert.ok(rs.every((r) => r.status === 401));
  assert.ok(Date.now() - t0 >= 2000, "pogingen hadden opeenvolgend vertraagd moeten worden");
});

test("bulk-import alleen met service-token, met validatie per document", async () => {
  const anon = await fetch(base + "/api/bulk", { method: "POST", headers: H, body: JSON.stringify({ docs: [] }) });
  assert.equal(anon.status, 403);
  const r = await fetch(base + "/api/bulk", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + "t".repeat(40) },
    body: JSON.stringify({ docs: [{ coll: "paarden", id: "b1", data: { naam: "Bulk" } }, { coll: "constructor", id: "x", data: {} }, { coll: "paarden", id: "b2", data: { naam: "<b>x</b>" } }] }) });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).resultaat.map((x) => !!x.ok), [true, false, false]);
});

test("eerste beheerder via instellingen alleen als er nog geen gebruikers zijn", async () => {
  process.env.ADMIN_EMAIL = "nieuw@test.be"; process.env.ADMIN_PASSWORD = "Nog-een-sterk-ww-1";
  await auth.bootstrapAdmin();
  assert.ok(!auth.listUsers().some((u) => u.email === "nieuw@test.be"));
  delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_PASSWORD;
});
