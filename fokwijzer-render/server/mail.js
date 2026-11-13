"use strict";
// Mails versturen via een mail-API over HTTPS (werkt op Render zonder extra pakketten).
// Instellen met omgevingsvariabelen:
//   MAIL_PROVIDER = brevo | resend   (test: niets versturen, enkel bijhouden, voor de tests)
//   MAIL_API_KEY  = API-sleutel van die dienst
//   MAIL_FROM     = afzenderadres (bij Brevo een geverifieerd adres, bij Resend een adres op een geverifieerd domein)
//   MAIL_FROM_NAME = naam van de afzender (standaard "De Fokwijzer")
const PROVIDER = (process.env.MAIL_PROVIDER || "").toLowerCase();
const KEY = process.env.MAIL_API_KEY || "";
const FROM = process.env.MAIL_FROM || "";
const FROM_NAME = process.env.MAIL_FROM_NAME || "De Fokwijzer";
const verzonden = []; // enkel bij MAIL_PROVIDER=test

const ingesteld = () => PROVIDER === "test" || (!!KEY && !!FROM && (PROVIDER === "brevo" || PROVIDER === "resend"));

async function verstuur({ to, subject, html, text }) {
  if (PROVIDER === "test") { verzonden.push({ to, subject, html, text }); return { ok: true }; }
  if (!ingesteld()) throw Object.assign(new Error("Mail is niet ingesteld op deze server."), { code: "niet_ingesteld" });
  let r;
  if (PROVIDER === "brevo") {
    r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: FROM, name: FROM_NAME }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    });
  } else {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(20000),
      headers: { authorization: "Bearer " + KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM}>`, to: [to], subject, html, text }),
    });
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("[mail]", r.status, t.slice(0, 300));
    throw Object.assign(new Error(`Versturen mislukt (${r.status}).`), { code: "upstream" });
  }
  return { ok: true };
}

module.exports = { ingesteld, verstuur, verzonden };
