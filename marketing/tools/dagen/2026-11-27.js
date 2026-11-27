// Video 27 november 2026: "Virtueel veulen en inteelt: zelfde vader? Check dit vóór je dekt."
// Echte combinaties uit de database: Emerald van 't Ruytershof x Hachel (allebei van Diamant de Semilly) en Caesar Z x Hachel.
// node dagen/2026-11-27.js <framesmap>   (mock.py moet draaien)
const { begin } = require('../opname');
(async () => {
  const o = await begin(process.argv[2]); const p = o.p;
  const kies = async (sel, v, k = 12) => { await p.selectOption(sel, v); await p.waitForTimeout(600); await o.snap(k); };

  // s1 (3 s): startpagina, dan naar Virtueel veulen
  o.scene('s1'); await o.snap(42);
  await o.tab('tab-vergelijken'); const yS = await o.top('#cS', 120); await o.springNaar(yS); await o.vulTot(90);

  // s2 (6 s): Emerald van 't Ruytershof x Hachel: allebei van Diamant de Semilly
  o.scene('s2');
  await kies('#cS', 'emerald-van-t-ruytershof-2004'); await kies('#cM', 'hachel-2012', 14);
  await o.scrollNaar(yS + 170, 35); await o.vulTot(180);

  // s3 (6,5 s): score uitgesloten, inteelt 12,5%, Diamant de Semilly 2 x 2
  o.scene('s3');
  const yC = await o.topTekst('Combinatie', 30); await o.scrollNaar(yC, 35); await o.snap(55);
  const yI = await o.topTekst('Inteelt van het veulen', 40); await o.scrollNaar(yI, 35); await o.vulTot(195);

  // s4 (6,5 s): andere hengst, Caesar Z x Hachel: 66/100 en 0,24%
  o.scene('s4');
  await o.scrollNaar(yS, 25); await kies('#cS', 'caesar-z-2013', 14);
  const yC2 = await o.topTekst('Combinatie', 30); await o.scrollNaar(yC2, 30); await o.snap(40);
  const yI2 = await o.topTekst('Inteelt van het veulen', 40); await o.scrollNaar(yI2, 30); await o.vulTot(195);
  await o.einde();
})();
