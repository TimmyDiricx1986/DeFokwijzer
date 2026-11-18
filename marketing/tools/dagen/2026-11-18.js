// Video 18 november 2026: "Wat is je eigen Fokwijzer?" (Mijn stal, merriedossier, combinaties)
// node dagen/2026-11-18.js <framesmap>   (mock.py moet draaien)
const { begin } = require('../opname');
(async () => {
  const o = await begin(process.argv[2]); const p = o.p;
  const sub = (naam) => o.knop(naam);
  const voegToe = async (k, q, id, opname) => {
    await p.click('#stalZoek-' + k);
    if (opname) await o.typ('#stalZoek-' + k, q); else await p.fill('#stalZoek-' + k, q);
    await p.waitForTimeout(350); if (opname) await o.snap(4);
    await p.locator(`[data-stalsug="${k}"] [data-staladd="${id}"]`).click(); await p.waitForTimeout(450);
  };
  // Voorbereiding buiten beeld: testaccount met een hengst en een merrie in de stal
  await o.tab('tab-beheer'); await sub('Mijn stal');
  await voegToe('hengst', 'Nixon', 'nixon-van-t-meulenhof-2013');
  await voegToe('merrie', 'Odina', '056002w00308068');
  await o.tab('tab-info'); await o.springNaar(0); await p.waitForTimeout(300);

  // s1 (2,5 s): startpagina, tik op Mijn Fokwijzer
  o.scene('s1'); await o.snap(40);
  await o.tab('tab-beheer'); await sub('Mijn stal'); await o.springNaar(330); await o.vulTot(75);

  // s2 (6 s): Mijn stal, een merrie toevoegen, rustig scrollen
  o.scene('s2'); await o.snap(8);
  const yM = await o.top('#stalZoek-merrie', 300); await o.scrollNaar(yM, 20);
  await voegToe('merrie', 'Oasis', 'oasis-van-de-bucxtale-2014', true);
  await o.snap(12); const yM2 = await o.top('#stalZoek-merrie', 420); await o.scrollNaar(yM2, 25); await o.vulTot(180);

  // s3 (7 s): merriedossier, vaccinatie met volgende datum, herinnering verschijnt
  o.scene('s3');
  await o.springNaar(0); await sub('Merriedossier'); await o.springNaar(330); await o.snap(6);
  await p.locator('button:visible', { hasText: 'Oasis van de Bucxtale' }).first().click().catch(() => {}); await p.waitForTimeout(500);
  const yV = await o.top('text=+ Vaccinatie', 260); await o.scrollNaar(yV, 20);
  await p.locator('button:visible', { hasText: '+ Vaccinatie' }).first().click(); await p.waitForTimeout(400); await o.snap(6);
  const yF = await o.top('#df-datum', 260); await o.scrollNaar(yF, 15);
  await p.fill('#df-datum', '2026-11-18'); await o.snap(6);
  await p.selectOption('#df-type', { index: 2 }); await o.snap(8);
  await p.fill('#df-volgende', '2027-05-18'); await o.snap(10);
  await p.locator('form.dos-form button[type=submit]').first().click(); await p.waitForTimeout(700);
  const yH = await o.topTekst('Komende herinneringen', 40); await o.springNaar(yH ?? 330); await o.vulTot(210);

  // s4 (6 s): Combinaties, Nixon x Oasis met virtueel veulen en inteelt
  o.scene('s4');
  await o.springNaar(0); await sub('Combinaties'); await o.springNaar(330); await o.snap(15);
  await p.selectOption('#stalM', 'oasis-van-de-bucxtale-2014').catch(() => {}); await p.waitForTimeout(500);
  const yC = await o.topTekst('Combineren', 60); await o.scrollNaar(yC ?? 400, 25); await o.snap(30);
  await o.scrollNaar((yC ?? 400) + 430, 40); await o.vulTot(180);
  await o.einde();
})();
