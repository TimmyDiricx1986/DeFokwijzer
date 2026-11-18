// Hulpjes om De Fokwijzer (lokale nabouw via mock.py) als gsm-video op te nemen.
// Elke scène wordt een map met JPEG-beelden (1080x1920, 30 beelden per seconde).
// Gebruik in een dagscript:
//   const { begin } = require('./opname');
//   (async () => { const o = await begin(uitMap);  o.scene('s1'); await o.snap(30); ... await o.einde(); })();
const { chromium } = require('playwright');
const fs = require('fs');
async function begin(OUT, url = 'http://127.0.0.1:8080/?lang=nl') {
  await fetch(new URL('/__reset', url), { method: 'POST' }).catch(() => {}); // lege stal voor het testaccount
  const b = await chromium.launch({ args: ['--lang=nl-BE'], env: { ...process.env, LANG: 'nl_BE.UTF-8', LANGUAGE: 'nl_BE:nl' } }); // Belgische datumnotatie in datumvelden
  const p = await b.newPage({ locale: 'nl-BE', viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('Fout op pagina:', e.message));
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} *{caret-color:transparent}' });
  let scene = '', n = 0;
  const o = {
    p,
    get n() { return n; },
    scene(s) { scene = s; n = 0; fs.rmSync(`${OUT}/${s}`, { recursive: true, force: true }); fs.mkdirSync(`${OUT}/${s}`, { recursive: true }); },
    async snap(k = 1) { const buf = await p.screenshot({ type: 'jpeg', quality: 92 }); for (let i = 0; i < k; i++) fs.writeFileSync(`${OUT}/${scene}/${String(n++).padStart(4, '0')}.jpg`, buf); },
    async vulTot(frames) { if (frames > n) await o.snap(frames - n); },   // scène aanvullen tot een vaste lengte
    Y: () => p.evaluate(() => window.scrollY),
    async scrollNaar(y, frames = 30) { const y0 = await o.Y(); for (let i = 1; i <= frames; i++) { const t = i / frames, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.evaluate(v => window.scrollTo(0, v), Math.round(y0 + (y - y0) * e)); await o.snap(1); } },
    async springNaar(y) { await p.evaluate(v => window.scrollTo(0, v), y); },
    async top(sel, marge = 80) { const y = await p.locator(sel).first().evaluate(e => e.getBoundingClientRect().top + window.scrollY); return Math.max(0, Math.round(y - marge)); },
    async topTekst(tekst, marge = 80) { const y = await p.evaluate(t => { const e = [...document.querySelectorAll('h1,h2,h3,h4,button,label,p,div,span')].find(e => e.children.length === 0 && e.textContent.trim() === t && e.offsetParent); return e ? e.getBoundingClientRect().top + scrollY : null; }, tekst); return y == null ? null : Math.max(0, Math.round(y - marge)); },
    async typ(sel, tekst) { for (const ch of tekst) { await p.type(sel, ch); await p.waitForTimeout(60); await o.snap(2); } },
    async tab(id) { // hoofdtabblad openen (tab-info, tab-beheer, tab-matches of een tab onder het pijltje)
      await p.evaluate(() => window.scrollTo(0, 0));
      if (!(await p.locator('#' + id).isVisible())) await p.click('#tabMore');
      await p.click('#' + id); await p.waitForTimeout(500);
    },
    async knop(tekst, wacht = 500) { // zichtbare knop met exact deze tekst aanklikken (bv. subtabblad 'Merriedossier')
      const re = tekst instanceof RegExp ? tekst : new RegExp('^' + tekst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
      await p.locator('button:visible', { hasText: re }).first().click(); await p.waitForTimeout(wacht);
    },
    async veegOpzij(sel, deel = .5, frames = 40) { const mx = await p.evaluate(s => { const e = document.querySelector(s); return e ? e.scrollWidth - e.clientWidth : 0; }, sel); for (let i = 1; i <= frames; i++) { const t = i / frames, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await p.evaluate(([s, v]) => { const el = document.querySelector(s); if (el) el.scrollLeft = v; }, [sel, Math.round(mx * deel * e)]); await o.snap(1); } },
    async verwijderTekst(re) { await p.evaluate(src => { const r = new RegExp(src); for (const e of document.querySelectorAll('p,div,span,small')) if (e.children.length === 0 && r.test(e.textContent)) e.remove(); }, re); }, // enkel voor meldingen die alleen in de nabouw verschijnen
    async einde() { await b.close(); },
  };
  return o;
}
module.exports = { begin };
