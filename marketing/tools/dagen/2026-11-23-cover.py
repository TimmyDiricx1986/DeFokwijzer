# Eindbeeld en cover 23 november 2026 (1080x1920): Mijn stal in 15 seconden
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
G=(19,48,42);GO=(176,138,90);C=(246,241,232)
im=Image.new("RGB",(W,H),G);d=ImageDraw.Draw(im)
serif=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",s)
sans=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",s)
sansb=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",s)
d.text((90,215),"D E   F O K W I J Z E R",font=sansb(36),fill=GO)
d.text((90,300),"Mijn stal",font=serif(104),fill=C)
d.text((90,425),"in ",font=serif(104),fill=C)
d.text((90+d.textlength("in ",font=serif(104)),425),"15 seconden",font=serif(104),fill=GO)
y=600
stappen=[("1","Typ de naam","Van je hengst of je merrie"),("2","Tik erop, klaar","Je paard staat in Mijn stal"),("3","Alles komt mee","Afstamming en stokmaat uit de wikigids")]
for n,t,s in stappen:
    d.rounded_rectangle((90,y,990,y+176),radius=22,fill=C)
    d.text((140,y+88),n,font=serif(66),fill=GO,anchor="lm")
    d.text((230,y+40),t,font=serif(52),fill=G)
    d.text((230,y+112),s,font=sans(34),fill=(80,90,85))
    y+=208
y+=40
d.line((90,y,990,y),fill=GO,width=3)
d.text((90,y+50),"Gratis",font=serif(56),fill=C)
d.text((990,y+56),"link in bio →",font=sansb(46),fill=GO,anchor="ra")
d.text((90,y+150),"Ook een voorkeurhengst mag:",font=sans(36),fill=C)
d.text((90,y+200),"hij hoeft niet van jou te zijn.",font=sans(36),fill=C)
im.save("marketing/2026-11-23/tiktok-cover.png")
