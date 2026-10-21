"use strict";
// Gebruik: node scripts/create-admin.js <email> "<naam>"
// Het wachtwoord wordt gevraagd (niet zichtbaar) of gelezen uit ADMIN_PASSWORD.
const readline = require("readline");
const auth = require("../server/auth");

async function ask(q, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
  const a = await new Promise((r) => rl.question(q, r));
  rl.close();
  if (hidden) process.stdout.write("\n");
  return a;
}
(async () => {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) { console.error('Gebruik: node scripts/create-admin.js <email> "<naam>"'); process.exit(1); }
  const pw = process.env.ADMIN_PASSWORD || (await ask("Wachtwoord (min. 12 tekens): ", true));
  const r = await auth.createUser(email, name, pw, "beheerder");
  if (r.fout) { console.error("Mislukt: " + r.fout); process.exit(1); }
  console.log(`Beheerder ${email} aangemaakt.`);
  process.exit(0);
})();
