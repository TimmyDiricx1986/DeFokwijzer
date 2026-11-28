// Schermbeelden 28 november 2026 (carrousel "Fokkersprofiel"). node dagen/2026-11-28-schermen.js <map>
// Testaccount "Demo Fokker" met echte paarden uit de database; de profielgegevens zijn testgegevens.
const { begin } = require('../opname');
(async () => {
  const D = process.argv[2]; const o = await begin(D); const p = o.p;
  const voegToe = async (k, q, id) => { await p.click('#stalZoek-' + k); await p.fill('#stalZoek-' + k, q); await p.waitForTimeout(400); await p.locator(`[data-stalsug="${k}"] [data-staladd="${id}"]`).click(); await p.waitForTimeout(450); };
  const shot = async n => { await p.waitForTimeout(350); await p.screenshot({ path: `${D}/${n}.png` }); };
  const yVan = async (bron, marge) => { const y = await p.evaluate(s => { const r = new RegExp(s, 'i'); const e = [...document.querySelectorAll('h1,h2,h3,h4,button,label,p,div,span')].find(e => e.children.length === 0 && r.test(e.textContent.trim()) && e.offsetParent); return e ? e.getBoundingClientRect().top + scrollY : null; }, bron); if (y == null) console.log('niet gevonden', bron); return Math.max(0, Math.round((y ?? 0) - marge)); };
  await o.tab('tab-beheer'); await o.knop('Mijn stal');
  await voegToe('hengst', 'Nixon', 'nixon-van-t-meulenhof-2013');
  await voegToe('hengst', 'Caesar', 'caesar-z-2013');
  await voegToe('merrie', 'Odina', '056002w00308068');
  await voegToe('merrie', 'Hachel', 'hachel-2012');
  await o.springNaar(0); await o.tab('tab-beheer'); await o.knop('Fokkersprofiel');
  await o.springNaar(await yVan('^Fokkersprofiel$', 16)); await shot('a_leeg');
  await p.fill('#pf-stalnaam', 'Stal Demo'); await p.fill('#pf-naam', 'Demo Fokker'); await p.fill('#pf-land', 'België');
  await p.fill('#pf-email', 'demo@fokwijzer.test'); await p.fill('#pf-website', 'www.fokwijzer.test');
  await p.fill('#pf-over', 'Voorbeeldprofiel met testgegevens. Hier vertel je waar je op fokt, je bekendste paarden en of je veulens verkoopt.');
  await o.springNaar(await yVan('^Naam van je stal', 16)); await shot('b_form');
  await o.springNaar(await yVan('^Over je fokkerij$', 16)); await shot('c_over');
  await p.locator('button:visible', { hasText: /^Profiel publiceren$/ }).click(); await p.waitForTimeout(900);
  await o.springNaar(await yVan('^Je profiel staat online$', 40)); await shot('d_online');
  await o.springNaar(await o.top('#profOut section:nth-of-type(2)', 16)); await shot('e_paarden');
  await o.springNaar(0); await p.locator('[data-profbekijk]').click(); await p.waitForTimeout(800); await shot('f_bekijk');
  await o.einde();
})();
