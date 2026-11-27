# Eindbeeld en cover 27 november 2026 (1080x1920): virtueel veulen en inteelt
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
G=(19,48,42);GO=(176,138,90);C=(246,241,232);RO=(176,70,60);GR=(60,120,80)
im=Image.new("RGB",(W,H),G);d=ImageDraw.Draw(im)
serif=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",s)
sans=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",s)
sansb=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",s)
d.text((90,215),"D E   F O K W I J Z E R",font=sansb(36),fill=GO)
d.text((90,300),"Check de",font=serif(100),fill=C)
d.text((90,420),"inteelt ",font=serif(100),fill=C)
d.text((90+d.textlength("inteelt ",font=serif(100)),420),"eerst",font=serif(100),fill=GO)
d.text((90,560),"Merrie Hachel (Diamant de Semilly x Cash)",font=sans(34),fill=C)
y=650
rijen=[("Emerald van 't Ruytershof","ook van Diamant de Semilly","12,5%","uitgesloten",RO),
       ("Caesar Z","Chacco-Blue x Ramiro Z","0,24%","66 / 100",GR)]
for n,s,pct,lab,kl in rijen:
    d.rounded_rectangle((90,y,990,y+250),radius=22,fill=C)
    d.text((130,y+40),"x "+n,font=serif(44),fill=G)
    d.text((130,y+105),s,font=sans(32),fill=(80,90,85))
    d.text((130,y+190),"inteelt veulen",font=sans(32),fill=(80,90,85),anchor="lm")
    d.text((560,y+190),pct,font=serif(60),fill=kl,anchor="rm")
    d.rounded_rectangle((620,y+160,950,y+220),radius=30,fill=kl)
    d.text((785,y+190),lab,font=sansb(32),fill=C,anchor="mm")
    y+=290
y+=30
d.line((90,y,990,y),fill=GO,width=3)
d.text((90,y+50),"Gratis",font=serif(56),fill=C)
d.text((990,y+56),"link in bio →",font=sansb(46),fill=GO,anchor="ra")
d.text((90,y+150),"Virtueel veulen op fokwijzer.onrender.com.",font=sans(36),fill=C)
d.text((90,y+200),"KWPN-advies: onder 5% inteelt.",font=sans(36),fill=C)
im.save("marketing/2026-11-27/tiktok-cover.png")
