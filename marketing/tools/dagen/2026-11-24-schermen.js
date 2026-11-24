// Schermbeelden 24 november 2026 (carrousel "Het merriedossier"). node dagen/2026-11-24-schermen.js <map>
// Testaccount "Demo Fokker" met voorbeeldgegevens in het dossier (enkel om te tonen hoe het werkt).
const { begin } = require('../opname');
(async () => {
  const D = process.argv[2]; const o = await begin(D); const p = o.p;
  const voegToe = async (k, q, id) => { await p.click('#stalZoek-' + k); await p.fill('#stalZoek-' + k, q); await p.waitForTimeout(400); await p.locator(`[data-stalsug="${k}"] [data-staladd="${id}"]`).click(); await p.waitForTimeout(450); };
  const shot = async n => { await p.waitForTimeout(350); await p.screenshot({ path: `${D}/${n}.png` }); };
  const ingave = async (soort, velden) => { await p.locator(`[data-dosnieuw="${soort}"]`).click(); await p.waitForTimeout(350);
    for (const [k, v] of Object.entries(velden)) { const el = p.locator('#df-' + k); const tag = await el.evaluate(e => e.tagName); if (tag === 'SELECT') await el.selectOption(v); else await el.fill(v); }
    await p.locator('#dosItemForm button[type=submit]').click(); await p.waitForTimeout(600); };
  await o.tab('tab-beheer'); await o.knop('Mijn stal');
  await voegToe('hengst', 'Caesar', 'caesar-z-2013');
  await voegToe('merrie', 'Hachel', 'hachel-2012');
  await o.springNaar(0); await o.knop('Merriedossier');
  await p.locator('[data-dossel="hachel-2012"]').first().click().catch(() => {}); await p.waitForTimeout(400);
  // leeg dossier: de knoppen voor een nieuwe ingave
  const yN = await o.topTekst('Nieuwe ingave', 20); await o.springNaar(yN ?? 900); await shot('c_nieuw');
  await ingave('dekking', { datum: '2026-05-12', hengst: 'Caesar Z', methode: 'vers' });
  await ingave('controle', { datum: '2026-05-27', uitslag: 'drachtig' });
  await ingave('controle', { datum: '2026-06-26', uitslag: 'drachtig' });
  await ingave('vaccinatie', { datum: '2026-10-05', type: 'influenza-tetanus', volgende: '2027-03-20' });
  await ingave('hoefsmid', { datum: '2026-11-10', wat: 'bekappen', volgende: '2026-12-29' });
  await p.setViewportSize({ width: 360, height: 640 });
  await o.springNaar(0); await shot('z_top');
  const yH = await o.topTekst('Komende herinneringen', 20); await o.springNaar(yH ?? 0); await shot('f_her');
  const yK = await o.top('.dos-kop', 20); await o.springNaar(yK); await shot('a_kop');
  await p.locator('.dos-kop details summary').click(); await p.waitForTimeout(300); await o.springNaar(await o.top('.dos-kop details', 16)); await shot('b_kaart');
  await p.locator('.dos-kop details summary').click(); await p.waitForTimeout(300);
  const yO = await o.topTekst('Je merries', 20); await o.springNaar(yO ?? 0); await shot('a_overzicht');
  const yT = await o.top('.dos-lijst', 150); await o.springNaar(yT); await shot('e_lijn');
  await o.einde();
})();
