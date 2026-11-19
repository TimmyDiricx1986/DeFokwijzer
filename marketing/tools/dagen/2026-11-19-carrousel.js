const { chromium } = require('playwright');const fs=require('fs');const u=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const D='/tmp/claude-0/sp/';
const S=[
 {bg:'g',k:'HOE EEN FICHE IN ELKAAR ZIT',t:'Waar komt elk gegeven vandaan?',s:'Een fiche op De Fokwijzer, stap voor stap. Met een echt voorbeeld: Bamako de Muze (BWP, 2001). Swipe →',img:'c_overzicht.png'},
 {bg:'c',k:'1 · DE KOP',t:'Wie is het paard, en hoe volledig is de fiche?',s:'Geslacht, geboortejaar en een percentage dat toont hoeveel er al ingevuld is. Labels zoals WFFS en OCD zie je meteen.',img:'c_kop.png'},
 {bg:'g',k:'2 · GEGEVENS',t:'De harde feiten op een rij.',s:'Stamboek, UELN, FEI-ID en stokmaat. Wat nog niet gekend is, staat er eerlijk als "onbekend".',img:'c_Gegevens.png'},
 {bg:'c',k:'3 · BRONNEN',t:'Elk gegeven met bron en datum.',s:'Het stamboek, de FEI, een catalogus. Je klikt door en controleert zelf. Ken je een bron? Voeg ze toe.',img:'c_Bronnen.png'},
 {bg:'g',k:'4 · AFSTAMMING',t:'Berekend uit de stamboom.',s:'Bloedpercentage, verwantschap met de populatie en de vaderlijn. Handig voor je volgende combinatie.',img:'c_Afstamming.png'},
 {bg:'c',k:'JOUW BEURT',t:'Zoek je eigen merrie of hengst op.',s:'Mis je iets? Vul het aan, met bron. En maak gratis je eigen Fokwijzer aan via de link in bio. Bewaar deze post 📌',img:null},
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
.big{margin-top:70px;border:3px solid #B08A5A;border-radius:24px;padding:40px 44px;font-size:44px;line-height:1.7}
.big b{font-family:'Bitter',serif;color:#B08A5A}
.ph.kop{flex:0 0 auto;width:860px;border-radius:36px;border-bottom:6px solid #B08A5A;margin-top:70px}`;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
for(let i=0;i<S.length;i++){const s=S[i];
 const inner=s.img?`<div class="ph ${s.img=='c_kop.png'?'kop':''}"><img src="${u(D+s.img)}"></div>`:`<div class="big"><b>fokwijzer.onrender.com</b><br>1. Zoek een paard op<br>2. Bekijk de bronnen<br>3. Vul aan wat ontbreekt<br>4. Maak je eigen Fokwijzer aan</div>`;
 await p.setContent(`<style>${css}</style><div class="w ${s.bg}"><div class="k">${s.k}</div><h1>${s.t}</h1><p>${s.s}</p>${inner}<div class="ft"><span>DE FOKWIJZER</span><span>${i+1} / ${S.length}</span></div></div>`,{waitUntil:'load'});
 await p.waitForTimeout(300);await p.screenshot({path:`${D}out/slide${i+1}.png`});}
await b.close();})();
