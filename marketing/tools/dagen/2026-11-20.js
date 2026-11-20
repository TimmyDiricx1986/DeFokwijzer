// Video 20 november 2026: "Hengstenkeuze in november?" (Hengsten vergelijken, virtueel veulen, inteelt)
// node dagen/2026-11-20.js <framesmap>   (mock.py moet draaien)
const { begin } = require('../opname');
(async () => {
  const o = await begin(process.argv[2]); const p = o.p;
  const kies = async (sel, v, k = 12) => { await p.selectOption(sel, v); await p.waitForTimeout(500); await o.snap(k); };

  // s1 (3 s): startpagina, dan naar Hengsten vergelijken
  o.scene('s1'); await o.snap(45);
  await o.tab('tab-hengsten'); await o.springNaar(0); await o.vulTot(90);

  // s2 (7 s): Nixon van 't Meulenhof naast Kannan, met merrie Odina van Klapscheut
  o.scene('s2');
  const yS = await o.top('#hc0', 120); await o.scrollNaar(yS, 15);
  await kies('#hc0', 'nixon-van-t-meulenhof-2013');
  await kies('#hc1', 'nld003199204130');
  await kies('#hcM', '056002w00308068', 10);
  await o.scrollNaar(yS + 380, 30); await o.snap(20);
  await o.scrollNaar(yS + 1000, 45); await o.vulTot(210);

  // s3 (7 s): Virtueel veulen Kannan x Odina, score van de combinatie
  o.scene('s3');
  await o.tab('tab-vergelijken'); await o.springNaar(0);
  const yV = await o.top('#cS', 120); await o.springNaar(yV); await o.snap(10);
  await kies('#cS', 'nld003199204130'); await kies('#cM', '056002w00308068');
  const yC = await o.topTekst('Combinatie', 30) ?? await o.top('text=Sterke punten', 400);
  await o.scrollNaar(yC, 40); await o.snap(45);
  const yP = await o.topTekst('Sterke punten', 160); await o.scrollNaar(yP ?? yC + 450, 35); await o.vulTot(210);

  // s4 (6 s): inteelt van het veulen en de stamboom van het veulen
  o.scene('s4');
  const yI = await o.topTekst('Inteelt van het veulen', 60); await o.scrollNaar(yI, 30); await o.snap(60);
  const yB = await o.topTekst('Stamboom van het veulen', 40); await o.scrollNaar(yB, 40); await o.vulTot(180);
  await o.einde();
})();
