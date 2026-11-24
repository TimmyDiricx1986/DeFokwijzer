// Carrousel 24 november 2026: "Het merriedossier" (schermbeelden uit 2026-11-24-schermen.js). node dagen/2026-11-24-carrousel.js <map>
const { chromium } = require('playwright');const fs=require('fs');const u=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const D=process.argv[2]+'/';fs.mkdirSync(D+'out',{recursive:true});
const S=[
 {bg:'g',k:'MIJN FOKWIJZER · MERRIEDOSSIER',t:'Alles over je merrie in één dossier.',s:'Cyclus, dekkingen, dracht, veulen, zorg en kosten. Per merrie, op je gsm. Swipe →',img:'a_overzicht.png'},
 {bg:'c',k:'1 · DE MERRIEKAART',t:'Haar vaste gegevens bij de hand.',s:'Status, stal, dierenarts, hoefsmid, chip- en paspoortnummer en verzekering. Nooit meer zoeken.',img:'b_kaart.png'},
 {bg:'g',k:'2 · ALLES REGISTREREN',t:'Van hengstigheid tot geboorte.',s:'Cycluscontrole, dekking of inseminatie, drachtcontrole, veulenbewaking, geboorte, en ook vaccinaties, ontworming en hoefsmid.',img:'c_nieuw.png'},
 {bg:'c',k:'3 · DRACHT',t:'De dag van de dracht, vanzelf.',s:'Na een dekking en een positieve echo zie je op welke dag ze zit en wanneer het veulen verwacht wordt.',img:'a_kop.png'},
 {bg:'g',k:'4 · TIJDLIJN',t:'Haar hele verhaal op een rij.',s:'Alles in een tijdlijn, met verslagen van de dierenarts erbij, kosten per jaar en een PDF van het dossier.',img:'e_lijn.png'},
 {bg:'c',k:'5 · VOLGENDE STAPPEN',t:'Het dossier denkt mee.',s:'Echo\'s, vaccins en veulenbewaking komen als herinnering. Richtdagen zijn een hulpmiddel: je dierenarts beslist.',img:'f_her.png'},
 {bg:'g',k:'JOUW BEURT',t:'Start vandaag je merriedossier.',s:'Gratis, in je eigen Fokwijzer. Bewaar deze post 📌',img:null},
];
const css=`
body{margin:0;width:1080px;height:1350px;font-family:'Source Sans 3',sans-serif;overflow:hidden}
.w{width:1080px;height:1350px;box-sizing:border-box;padding:84px 84px 70px;position:relative;display:flex;flex-direction:column}
.g{background:#13302A;color:#F6F1E8}.c{background:#F6F1E8;color:#13302A}
.k{font-size:26px;letter-spacing:5px;font-weight:700;color:#B08A5A}
h1{font-family:'Bitter',serif;font-weight:700;font-size:64px;line-height:1.08;margin:22px 0 18px}
p{font-size:31px;line-height:1.38;margin:0;opacity:.92;max-width:910px}
.ph{margin-top:38px;flex:1;overflow:hidden;border-radius:36px 36px 0 0;border:6px solid #B08A5A;border-bottom:none;background:#fff;align-self:center;width:620px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.ph img{width:100%;display:block}
.vb{position:absolute;right:84px;bottom:76px;font-size:19px;color:#B08A5A;letter-spacing:1px}
.ft{position:absolute;left:84px;right:84px;bottom:34px;display:flex;justify-content:space-between;font-size:22px;letter-spacing:3px;color:#B08A5A;font-weight:600}
.big{margin-top:60px;border:3px solid #B08A5A;border-radius:24px;padding:40px 44px;font-size:40px;line-height:1.7}
.big b{font-family:'Bitter',serif;color:#B08A5A}
.nx{margin-top:44px;font-size:30px;opacity:.85}`;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
for(let i=0;i<S.length;i++){const s=S[i];
 const inner=s.img?`<div class="ph"><img src="${u(D+s.img)}"></div>${i>0&&i<6?'<div class="vb"></div>':''}`:`<div class="big"><b>fokwijzer.onrender.com</b><br>1. Tik op Mijn Fokwijzer<br>2. Zet je merrie in Mijn stal<br>3. Open Merriedossier en registreer<br><b>Link in bio</b></div><div class="nx">Morgen: herinneringen per mail, zo vergeet je niets.</div>`;
 await p.setContent(`<style>${css}</style><div class="w ${s.bg}"><div class="k">${s.k}</div><h1>${s.t}</h1><p>${s.s}</p>${inner}<div class="ft"><span>DE FOKWIJZER${s.img?' · voorbeeld met testgegevens':''}</span><span>${i+1} / ${S.length}</span></div></div>`,{waitUntil:'load'});
 await p.waitForTimeout(300);await p.screenshot({path:`${D}out/slide${i+1}.png`});}
await b.close();})();
