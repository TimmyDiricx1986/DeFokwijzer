// Carrousel 26 november 2026: "Combinaties" (schermbeelden uit 2026-11-26-schermen.js). node dagen/2026-11-26-carrousel.js <map>
const { chromium } = require('playwright');const fs=require('fs');const u=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const D=process.argv[2]+'/';fs.mkdirSync(D+'out',{recursive:true});
const S=[
 {bg:'g',k:'MIJN FOKWIJZER · COMBINATIES',t:'Welke hengst past bij jouw merrie?',s:'Kies je merrie en de hengsten uit je stal staan gerangschikt, met een score op 100. Swipe →',img:'a_rang.png'},
 {bg:'c',k:'1 · DE SCORE',t:'Waar komt die 87 vandaan?',s:'Genetische indexen, prestaties en nakomelingen, inteelt, gezondheid en hoe volledig de gegevens zijn. Met de betrouwbaarheid erbij.',img:'b_score.png'},
 {bg:'g',k:'2 · STERK EN LET OP',t:'De inteelt zie je vóór je dekt.',s:'Sterke punten, aandachtspunten en de inteelt van het veulen. Hier 1,61%, onder het KWPN-advies van 5%.',img:'c_inteelt.png'},
 {bg:'c',k:'3 · DE HELE WIKIGIDS',t:'Ook hengsten die je nog niet kende.',s:'De best scorende hengsten uit de hele database voor jouw merrie. Eén tik en hij staat in je stal.',img:'d_db.png'},
 {bg:'g',k:'4 · NAAST ELKAAR',t:'Twijfel je tussen twee? Vergelijk.',s:'De beste 2 uit je stal naast elkaar: score, betrouwbaarheid, inteelt en sterke punten. Groen is de beste waarde.',img:'e_verg.png'},
 {bg:'c',k:'5 · BEWAREN',t:'Bewaar je favoriete combinaties.',s:'Met een naam en notitie, en een fokadvies als PDF. De score is een hulpmiddel: de keuze blijft de jouwe.',img:'f_bewaard.png'},
 {bg:'g',k:'JOUW BEURT',t:'Zoek de beste hengst voor je merrie.',s:'Gratis, in je eigen Fokwijzer. Bewaar deze post 📌',img:null},
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
 const inner=s.img?`<div class="ph"><img src="${u(D+s.img)}"></div>${i>0&&i<6?'<div class="vb"></div>':''}`:`<div class="big"><b>fokwijzer.onrender.com</b><br>1. Tik op Mijn Fokwijzer<br>2. Zet je merrie en hengsten in Mijn stal<br>3. Open Combinaties en kies je merrie<br><b>Link in bio</b></div><div class="nx">Morgen: het virtuele veulen, tot in detail.</div>`;
 await p.setContent(`<style>${css}</style><div class="w ${s.bg}"><div class="k">${s.k}</div><h1>${s.t}</h1><p>${s.s}</p>${inner}<div class="ft"><span>DE FOKWIJZER${s.img?' · echte paarden uit de wikigids':''}</span><span>${i+1} / ${S.length}</span></div></div>`,{waitUntil:'load'});
 await p.waitForTimeout(300);await p.screenshot({path:`${D}out/slide${i+1}.png`});}
await b.close();})();
