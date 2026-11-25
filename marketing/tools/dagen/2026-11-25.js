// Video 25 november 2026: "Herinneringen per mail: zo vergeet je geen echo of vaccin"
// node dagen/2026-11-25.js <framesmap>   (mock.py moet draaien)
// De mailinstellingen worden in dit script nagebootst (testadres demo@fokwijzer.test), enkel om te tonen hoe de functie werkt.
const { begin } = require('../opname');
(async () => {
  const o = await begin(process.argv[2]); const p = o.p;
  // Nabootsing van de mail-API: eerst niets ingesteld, na Bewaren "bevestig je adres", na de knip bevestigd.
  let fase = 'leeg'; const nu = new Date();
  const status = () => {
    const iso = new Date(nu.getTime() - 5 * 60e3).toISOString();
    if (fase === 'leeg') return { ingesteld: true, instelling: {}, mails: [] };
    if (fase === 'wacht') return { ingesteld: true, instelling: { email: 'demo@fokwijzer.test', vooraf: 1, dagzelf: true, bevestigd: false, actief: true }, mails: [{ soort: 'bevestiging', verzonden_op: iso, ontvangen_op: null }] };
    return { ingesteld: true, instelling: { email: 'demo@fokwijzer.test', vooraf: 1, dagzelf: true, bevestigd: true, actief: true }, mails: [{ soort: 'bevestiging', verzonden_op: iso, ontvangen_op: nu.toISOString() }] };
  };
  await p.route('**/api/mail/**', async r => {
    if (r.request().url().includes('/instellen')) fase = 'wacht';
    const s = status(); await r.fulfill({ contentType: 'application/json', body: JSON.stringify(r.request().method() === 'GET' ? s : { ok: true, status: s }) });
  });
  // Voorbereiding buiten beeld: merrie Hachel in de stal
  await o.tab('tab-beheer'); await o.knop('Mijn stal');
  await p.click('#stalZoek-merrie'); await p.fill('#stalZoek-merrie', 'Hachel'); await p.waitForTimeout(400);
  await p.locator('[data-stalsug="merrie"] [data-staladd="hachel-2012"]').click(); await p.waitForTimeout(500);
  await o.tab('tab-info'); await o.springNaar(0); await p.waitForTimeout(300);

  // s1 (3 s): startpagina, Mijn Fokwijzer, Merriedossier: nog geen herinneringen
  o.scene('s1'); await o.snap(35);
  await o.tab('tab-beheer'); await o.knop('Merriedossier');
  const yK = await o.topTekst('Komende herinneringen', 60); await o.springNaar(yK ?? 330); await o.vulTot(90);

  // s2 (4,5 s): een dekking registreren
  o.scene('s2');
  const yN = await o.topTekst('Nieuwe ingave', 40); await o.scrollNaar(yN, 25);
  await o.knop('+ Dekking', 450); await o.snap(6);
  const yD = await o.top('#df-datum', 120); await o.scrollNaar(yD, 15);
  await p.fill('#df-datum', '2026-05-20'); await o.snap(10);
  await p.click('#df-hengst'); await o.typ('#df-hengst', 'Caesar Z'); await o.snap(14);
  await p.locator('#dosItemForm button[type=submit]').scrollIntoViewIfNeeded();
  const yB = await o.top('#dosItemForm button[type=submit]', 330); await o.scrollNaar(yB, 18); await o.snap(14);
  await p.locator('#dosItemForm button[type=submit]').click(); await p.waitForTimeout(700); await o.vulTot(135);

  // s3 (6 s): de komende herinneringen staan klaar
  o.scene('s3');
  const yK2 = await o.topTekst('Komende herinneringen', 60); await o.springNaar(yK2 ?? 330); await o.snap(70);
  await o.scrollNaar((yK2 ?? 330) + 200, 40); await o.vulTot(180);

  // s4 (5 s): herinneringen per mail instellen
  o.scene('s4');
  const yM = await o.top('#mailAdres', 260); await o.scrollNaar(yM, 20);
  await p.click('#mailAdres'); await o.typ('#mailAdres', 'demo@fokwijzer.test'); await o.snap(10);
  await p.locator('#mailForm button[type=submit]').click(); await p.waitForTimeout(700);
  const yW = await o.topTekst('Herinneringen per mail', 40); await o.springNaar(yW ?? yM); await o.vulTot(150);

  // s5 (4 s): na één klik in de mail: bevestigd
  fase = 'ok';
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} *{caret-color:transparent}' });
  await o.tab('tab-beheer'); await o.knop('Merriedossier');
  o.scene('s5');
  const yW2 = await o.topTekst('Herinneringen per mail', 40); await o.springNaar(yW2 ?? 900); await o.vulTot(120);
  await o.einde();
})();
