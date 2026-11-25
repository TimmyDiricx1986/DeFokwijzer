# Eindbeeld en cover 25 november 2026 (1080x1920): herinneringen per mail
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
G=(19,48,42);GO=(176,138,90);C=(246,241,232)
im=Image.new("RGB",(W,H),G);d=ImageDraw.Draw(im)
serif=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",s)
sans=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",s)
sansb=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",s)
d.text((90,215),"D E   F O K W I J Z E R",font=sansb(36),fill=GO)
d.text((90,300),"Geen echo of",font=serif(100),fill=C)
d.text((90,420),"vaccin ",font=serif(100),fill=C)
d.text((90+d.textlength("vaccin ",font=serif(100)),420),"vergeten",font=serif(100),fill=GO)
y=600
stappen=[("1","Registreer een dekking","In het merriedossier van je merrie"),("2","Alles staat klaar","Echo's, vaccins en veulendatum"),("3","Herinnering per mail","Op de dag zelf of tot 1 week vooraf")]
for n,t,s in stappen:
    d.rounded_rectangle((90,y,990,y+176),radius=22,fill=C)
    d.text((140,y+88),n,font=serif(66),fill=GO,anchor="lm")
    d.text((230,y+40),t,font=serif(48),fill=G)
    d.text((230,y+112),s,font=sans(34),fill=(80,90,85))
    y+=208
y+=40
d.line((90,y,990,y),fill=GO,width=3)
d.text((90,y+50),"Gratis",font=serif(56),fill=C)
d.text((990,y+56),"link in bio →",font=sansb(46),fill=GO,anchor="ra")
d.text((90,y+150),"Richtdagen zijn een hulpmiddel:",font=sans(36),fill=C)
d.text((90,y+200),"je dierenarts beslist.",font=sans(36),fill=C)
im.save("marketing/2026-11-25/tiktok-cover.png")
