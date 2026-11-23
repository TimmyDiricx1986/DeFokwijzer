// Video 23 november 2026: "Mijn stal: een hengst en een merrie toevoegen in 15 seconden"
// node dagen/2026-11-23.js <framesmap>   (mock.py moet draaien)
const { begin } = require('../opname');
(async () => {
  const o = await begin(process.argv[2]); const p = o.p;
  const voegToe = async (k, q, id) => {
    await p.click('#stalZoek-' + k); await o.snap(4);
    await o.typ('#stalZoek-' + k, q); await p.waitForTimeout(350); await o.snap(14);
    await p.locator(`[data-stalsug="${k}"] [data-staladd="${id}"]`).click(); await p.waitForTimeout(450);
  };
  // s1 (3 s): startpagina, tik op Mijn Fokwijzer
  o.scene('s1'); await o.snap(50);
  await o.tab('tab-beheer'); await o.knop('Mijn stal'); await o.vulTot(60);
  const y0 = await o.top('#stalZoek-hengst', 170); await o.scrollNaar(y0, 30); await o.vulTot(90);

  // s2 (6,5 s): hengst toevoegen (Caesar Z)
  o.scene('s2');
  await voegToe('hengst', 'Caesar', 'caesar-z-2013');
  await o.snap(30); await o.vulTot(195);

  // s3 (6,5 s): merrie toevoegen (Hachel)
  o.scene('s3');
  const yM = await o.top('#stalZoek-merrie', 170); await o.scrollNaar(yM, 25);
  await voegToe('merrie', 'Hachel', 'hachel-2012');
  await o.snap(30); await o.vulTot(195);

  // s4 (5 s): de stal met beide paarden, eigen hengst of voorkeurhengst
  o.scene('s4');
  const yS = await o.top('#stalZoek-hengst', 120); await o.scrollNaar(yS, 30);
  await o.snap(25); await o.scrollNaar(yS + 260, 30); await o.vulTot(150);
  await o.einde();
})();
