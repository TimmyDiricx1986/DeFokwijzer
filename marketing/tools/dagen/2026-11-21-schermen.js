// Schermbeelden 21 november 2026 (carrousel "Je eigen Fokwijzer in 4 stappen"). node dagen/2026-11-21-schermen.js <map>
const { begin } = require('../opname');
(async () => {
  const D = process.argv[2]; const o = await begin(D); const p = o.p;
  const sub = n => o.knop(n);
  const voegToe = async (k, q, id) => { await p.click('#stalZoek-' + k); await p.fill('#stalZoek-' + k, q); await p.waitForTimeout(400); await p.locator(`[data-stalsug="${k}"] [data-staladd="${id}"]`).click(); await p.waitForTimeout(450); };
  const shot = async n => { await p.waitForTimeout(300); await p.screenshot({ path: `${D}/${n}.png` }); };
  await o.tab('tab-beheer'); await shot('a_start');
  await sub('Mijn stal');
  await voegToe('hengst', 'Nixon', 'nixon-van-t-meulenhof-2013');
  await voegToe('merrie', 'Odina', '056002w00308068');
  await voegToe('merrie', 'Oasis', 'oasis-van-de-bucxtale-2014');
  await o.springNaar(await o.top('#stalZoek-hengst', 120)); await shot('b_stal');
  await o.springNaar(0); await sub('Merriedossier'); await p.locator('button:visible', { hasText: 'Odina van Klapscheut' }).first().click().catch(() => {}); await p.waitForTimeout(500);
  const yH = await o.topTekst('Komende herinneringen', 40); await o.springNaar(yH ?? 550); await shot('c_dossier');
  await o.springNaar(0); await sub('Combinaties'); await p.selectOption('#stalM', '056002w00308068').catch(() => {}); await p.waitForTimeout(600);
  const yC = await o.topTekst('Combineren', 40); await o.springNaar(yC ?? 400); await shot('d_comb');
  await o.springNaar(0); await sub('Fokkersprofiel'); const yP = await o.topTekst('Nog niet gepubliceerd', 70); await o.springNaar(yP ?? 550); await shot('e_profiel');
  await o.einde();
})();
