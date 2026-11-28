// Carrousel 28 november 2026: "Fokkersprofiel" (schermbeelden uit 2026-11-28-schermen.js). node dagen/2026-11-28-carrousel.js <map>
const { chromium } = require('playwright');const fs=require('fs');const u=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const D=process.argv[2]+'/';fs.mkdirSync(D+'out',{recursive:true});
const S=[
 {bg:'g',k:'MIJN FOKWIJZER · FOKKERSPROFIEL',t:'Laat andere fokkers je vinden.',s:'Een eigen pagina met je paarden en contactgegevens. Gratis, en je kiest zelf wat erop komt. Swipe →',img:'a_leeg.png'},
 {bg:'c',k:'1 · JE GEGEVENS',t:'Jij kiest wat erop komt.',s:'Enkel de naam van je stal is verplicht. Contactpersoon, gemeente, mail, telefoon en website vul je in als je wil.',img:'b_form.png'},
 {bg:'g',k:'2 · JE FOKKERIJ',t:'Vertel waar je op fokt.',s:'Je bekendste paarden, of je veulens verkoopt. En vink aan of de paarden uit Mijn stal erbij mogen.',img:'c_over.png'},
 {bg:'c',k:'3 · PUBLICEREN',t:'Eén klik en je staat online.',s:'Met een eigen link om te delen. Bij paarden die je zelf toevoegt, staat je stal als fokker. Bijwerken of offline halen kan altijd.',img:'d_online.png'},
 {bg:'g',k:'4 · ZO ZIEN ANDEREN HET',t:'Je visitekaartje als fokker.',s:'Andere fokkers zien je stal, je verhaal, hoe ze je bereiken en je paarden, met afstamming.',img:'f_bekijk.png'},
 {bg:'c',k:'5 · PRIVACY',t:'Je stal en je dossier blijven van jou.',s:'',img:null,priv:true},
 {bg:'g',k:'JOUW BEURT',t:'Maak vandaag je fokkersprofiel.',s:'Gratis, in je eigen Fokwijzer. Tag een fokker die dit moet zien 👇',img:null},
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
li{margin:0 0 18px}.big ul{margin:0;padding-left:34px;font-size:34px;line-height:1.45}
.big b{font-family:'Bitter',serif;color:#B08A5A}
.nx{margin-top:44px;font-size:30px;opacity:.85}`;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
for(let i=0;i<S.length;i++){const s=S[i];
 const inner=s.priv?`<div class="big"><ul><li><b>Mijn stal</b> en je <b>merriedossier</b> zien andere fokkers niet.</li><li>Op je profiel komt enkel wat jij invult en aanvinkt.</li><li>Geen profiel? Dan sta je nergens als fokker vermeld.</li></ul></div><div class="nx">Alles op je profiel is openbaar: vul enkel in wat je wil delen.</div>`:s.img?`<div class="ph"><img src="${u(D+s.img)}"></div>`:`<div class="big"><b>fokwijzer.onrender.com</b><br>1. Tik op Mijn Fokwijzer<br>2. Zet je paarden in Mijn stal<br>3. Open Fokkersprofiel en publiceer<br><b>Link in bio</b></div><div class="nx">Volgende week: maak je profiel, deel je stal.</div>`;
 await p.setContent(`<style>${css}</style><div class="w ${s.bg}"><div class="k">${s.k}</div><h1>${s.t}</h1>${s.s?`<p>${s.s}</p>`:''}${inner}<div class="ft"><span>DE FOKWIJZER${s.img?' · echte paarden · profiel met testgegevens':''}</span><span>${i+1} / ${S.length}</span></div></div>`,{waitUntil:'load'});
 await p.waitForTimeout(300);await p.screenshot({path:`${D}out/slide${i+1}.png`});}
await b.close();})();
