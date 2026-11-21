// Carrousel 21 november 2026: "Maak vandaag je eigen Fokwijzer aan" (schermbeelden uit 2026-11-21-schermen.js)
const { chromium } = require('playwright');const fs=require('fs');const u=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const D=process.argv[2]+'/';
const S=[
 {bg:'g',k:'START MET JE EIGEN FOKWIJZER',t:'Maak vandaag je eigen Fokwijzer aan.',s:'Gratis account, en je fokkerij staat op één plek. Zo begin je, in 4 stappen. Swipe →',img:'a_start.png'},
 {bg:'c',k:'STAP 1 · MIJN STAL',t:'Zet je merries en hengsten in je stal.',s:'Typ de naam, tik erop en klaar. Afstamming, stokmaat en WFFS komen mee uit de wikigids.',img:'b_stal.png'},
 {bg:'g',k:'STAP 2 · MERRIEDOSSIER',t:'Hou per merrie een dossier bij.',s:'Dekkingen en zorgmomenten met een volgende datum. Je krijgt een herinnering per mail.',img:'c_dossier.png'},
 {bg:'c',k:'STAP 3 · COMBINATIES',t:'Kies een merrie, zie welke hengst past.',s:'De hengsten uit je stal gerangschikt, met score, inteelt en een virtueel veulen.',img:'d_comb.png'},
 {bg:'g',k:'STAP 4 · FOKKERSPROFIEL',t:'Laat andere fokkers je vinden.',s:'Een eigen pagina met je paarden. Niet verplicht: je kiest zelf wat je deelt.',img:'e_profiel.png'},
 {bg:'c',k:'JOUW BEURT',t:'Begin vandaag, het is gratis.',s:'Tag een fokker die mee moet doen, en bewaar deze post 📌',img:null},
];
const css=`
body{margin:0;width:1080px;height:1350px;font-family:'Source Sans 3',sans-serif;overflow:hidden}
.w{width:1080px;height:1350px;box-sizing:border-box;padding:84px 84px 70px;position:relative;display:flex;flex-direction:column}
.g{background:#13302A;color:#F6F1E8}.c{background:#F6F1E8;color:#13302A}
.k{font-size:26px;letter-spacing:5px;font-weight:700;color:#B08A5A}
h1{font-family:'Bitter',serif;font-weight:700;font-size:66px;line-height:1.08;margin:22px 0 18px}
p{font-size:32px;line-height:1.38;margin:0;opacity:.92;max-width:900px}
.ph{margin-top:40px;flex:1;overflow:hidden;border-radius:36px 36px 0 0;border:6px solid #B08A5A;border-bottom:none;background:#fff;align-self:center;width:640px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.ph img{width:100%;display:block}
.ft{position:absolute;left:84px;right:84px;bottom:34px;display:flex;justify-content:space-between;font-size:22px;letter-spacing:3px;color:#B08A5A;font-weight:600}
.big{margin-top:70px;border:3px solid #B08A5A;border-radius:24px;padding:40px 44px;font-size:42px;line-height:1.7}
.big b{font-family:'Bitter',serif;color:#B08A5A}`;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
for(let i=0;i<S.length;i++){const s=S[i];
 const inner=s.img?`<div class="ph"><img src="${u(D+s.img)}"></div>`:`<div class="big"><b>fokwijzer.onrender.com</b><br>1. Tik op Mijn Fokwijzer<br>2. Account maken met een Fokwijzer-profiel<br>3. Zet je eerste merrie in Mijn stal<br><b>Link in bio</b></div>`;
 await p.setContent(`<style>${css}</style><div class="w ${s.bg}"><div class="k">${s.k}</div><h1>${s.t}</h1><p>${s.s}</p>${inner}<div class="ft"><span>DE FOKWIJZER</span><span>${i+1} / ${S.length}</span></div></div>`,{waitUntil:'load'});
 await p.waitForTimeout(300);await p.screenshot({path:`${D}out/slide${i+1}.png`});}
await b.close();})();
