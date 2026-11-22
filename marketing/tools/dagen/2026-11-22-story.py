from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
G=(19,48,42);GO=(176,138,90);C=(246,241,232)
im=Image.new("RGB",(W,H),G);d=ImageDraw.Draw(im)
def lora(s,w=700):
    f=ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf",s)
    try:f.set_variation_by_axes([w])
    except Exception:pass
    return f
sans=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",s)
sansb=lambda s:ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",s)
d.text((90,150),"DE FOKWIJZER · WEEK 2",font=sansb(34),fill=GO)
d.line((90,210,330,210),fill=GO,width=4)
y=260
for t in ["Elke dag één","functie van je","eigen Fokwijzer."]:
    d.text((90,y),t,font=lora(92),fill=C);y+=112
y+=40
dagen=[("MA","Mijn stal"),("DI","Merriedossier"),("WO","Herinneringen per mail"),("DO","Combinaties"),("VR","Virtueel veulen + inteelt"),("ZA","Fokkersprofiel")]
for k,v in dagen:
    d.rounded_rectangle((90,y,990,y+92),radius=18,fill=(28,66,58))
    d.text((122,y+24),k,font=sansb(38),fill=GO)
    d.text((240,y+24),v,font=sans(38),fill=C);y+=110
y+=30
# lege zone voor vraagsticker
d.rounded_rectangle((90,y,990,y+330),radius=28,outline=GO,width=3)
d.text((W//2,y+165),"plaats hier je vraagsticker",font=sans(32),fill=(120,140,130),anchor="mm")
d.text((W//2,H-150),"fokwijzer.onrender.com",font=lora(46,600),fill=GO,anchor="mm")
im.save("story.png")
