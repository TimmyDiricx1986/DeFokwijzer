// Schermbeelden 26 november 2026 (carrousel "Combinaties"). node dagen/2026-11-26-schermen.js <map>
// Testaccount "Demo Fokker" met echte paarden uit de database (Nixon van 't Meulenhof, Caesar Z, Odina van Klapscheut).
const { begin } = require('../opname');
(async () => {
  const D = process.argv[2]; const o = await begin(D); const p = o.p;
  const voegToe = async (k, q, id) => { await p.click('#stalZoek-' + k); await p.fill('#stalZoek-' + k, q); await p.waitForTimeout(400); await p.locator(`[data-stalsug="${k}"] [data-staladd="${id}"]`).click(); await p.waitForTimeout(450); };
  const shot = async n => { await p.waitForTimeout(350); await p.screenshot({ path: `${D}/${n}.png` }); };
  const yVan = async (bron, marge, kids = false) => { const y = await p.evaluate(([s, kids]) => { const r = new RegExp(s, 'i'); const e = [...document.querySelectorAll('h1,h2,h3,h4,h5,button,label,p,div,span,summary,td,th')].find(e => (kids || e.children.length === 0) && r.test(e.textContent.trim()) && e.offsetParent); return e ? e.getBoundingClientRect().top + scrollY : null; }, [bron, kids]); if (y == null) console.log('niet gevonden', bron); return Math.max(0, Math.round((y ?? 0) - marge)); };
  const combineer = async () => { await o.springNaar(0); await o.tab('tab-beheer'); await o.knop('Combinaties'); await p.selectOption('#stalM', '056002w00308068'); await p.waitForTimeout(800); };
  await o.tab('tab-beheer'); await o.knop('Mijn stal');
  await voegToe('hengst', 'Nixon', 'nixon-van-t-meulenhof-2013');
  await voegToe('hengst', 'Caesar', 'caesar-z-2013');
  await voegToe('merrie', 'Odina', '056002w00308068');
  await combineer();
  await o.springNaar(await yVan('^Combineren$', 16)); await shot('a_rang');
  await o.springNaar(await yVan('^Beste hengsten uit de hele database$', 16)); await shot('d_db');
  // virtueel veulen van de nummer 1
  await p.locator('button:visible', { hasText: /^Virtueel veulen$/ }).first().click(); await p.waitForTimeout(1200);
  await o.springNaar(await yVan('^Combinatie$', 16)); await shot('b_score');
  await o.springNaar(await yVan('^Sterke punten$', 16)); await shot('c_inteelt');
  // vergelijken
  await combineer();
  await p.locator('button:visible', { hasText: /^Vergelijk de beste 2/ }).first().click(); await p.waitForTimeout(1200);
  await o.springNaar(await yVan('^Combinatie met Odina', 16, true)); await shot('e_verg');
  // bewaren
  await combineer();
  await p.locator('button:visible', { hasText: /^Bewaar veulen$/ }).first().click(); await p.waitForTimeout(900);
  await p.locator('button:visible', { hasText: /^Bewaar veulen$/ }).first().click(); await p.waitForTimeout(900);
  await o.springNaar(await yVan('^Bewaarde virtuele veulens', 16, true)); await shot('f_bewaard');
  await o.einde();
})();
