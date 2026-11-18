"""Maakt van opgenomen scènes een afgewerkte video: tekst in beeld, eindbeeld, deuntje eronder.

Gebruik: python3 afwerken.py spec.json
spec.json:
{
  "frames": "/pad/naar/frames",                 # map met submappen per scène (uit opname.js)
  "scenes": [{"id": "s1", "tekst": "Alles over je merrie op één plek? Kijk."}, ...],
  "eindbeeld": "/pad/naar/tiktok-cover.png",    # 1080x1920, getoond op het einde
  "eind_s": 3,                                   # duur eindbeeld in seconden
  "uit": "/pad/naar/video.mp4",
  "deuntje": true                                # deuntje De Fokwijzer op maat eronder
}
Tekstvak: donkergroen met gouden rand en crème schreefletter, op ongeveer 62% van de hoogte
(boven de zone van de TikTok-knoppen en caption).
"""
import sys, os, glob, json, subprocess, tempfile, importlib.util
from PIL import Image, ImageDraw, ImageFont
G = (0x13, 0x30, 0x2A); GOLD = (0xB0, 0x8A, 0x5A); C = (0xF6, 0xF1, 0xE8)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 64)
HIER = os.path.dirname(os.path.abspath(__file__))
ENC = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30']
def wrap(d, t, w):
    out, cur = [], ''
    for x in t.split():
        s = (cur + ' ' + x).strip()
        if d.textlength(s, font=F) <= w: cur = s
        else: out.append(cur); cur = x
    out.append(cur); return out
def overlay(text):
    o = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    if not text: return o
    ls = wrap(d, text, 860); lh = 80; h = len(ls) * lh + 70; y0 = 1180
    d.rounded_rectangle([70, y0, 1010, y0 + h], radius=28, fill=G + (240,), outline=GOLD, width=4)
    for i, l in enumerate(ls):
        w = d.textlength(l, font=F); d.text(((1080 - w) / 2, y0 + 35 + i * lh), l, font=F, fill=C)
    return o
def run(*a): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)
def main(spec):
    tmp = tempfile.mkdtemp(prefix='afwerken-'); files = []
    for sc in spec['scenes']:
        ov = overlay(sc.get('tekst', '')); od = os.path.join(tmp, sc['id']); os.makedirs(od)
        for f in sorted(glob.glob(os.path.join(spec['frames'], sc['id'], '*.jpg'))):
            im = Image.open(f).convert('RGBA'); im.alpha_composite(ov); im.convert('RGB').save(os.path.join(od, os.path.basename(f)), quality=92)
        out = os.path.join(tmp, sc['id'] + '.mp4'); run('-framerate', '30', '-i', od + '/%04d.jpg', *ENC, out); files.append(out)
    if spec.get('eindbeeld'):
        cj = os.path.join(tmp, 'eind.jpg'); Image.open(spec['eindbeeld']).convert('RGB').resize((1080, 1920)).save(cj, quality=95)
        out = os.path.join(tmp, 'eind.mp4')
        run('-framerate', '30', '-i', cj, '-vf', f"format=yuv420p,loop=-1:1,trim=duration={spec.get('eind_s', 3)},fade=t=in:st=0:d=0.3", *ENC, out); files.append(out)
    lst = os.path.join(tmp, 'lijst.txt'); open(lst, 'w').write(''.join(f"file '{f}'\n" for f in files))
    v = os.path.join(tmp, 'v.mp4'); run('-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', v)
    L = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v], capture_output=True, text=True).stdout)
    wav = os.path.join(tmp, 'deuntje.wav')
    if spec.get('deuntje', True):
        sp = importlib.util.spec_from_file_location('deuntje', os.path.join(HIER, 'deuntje-synth.py')); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
        m.maak(wav, L)
        run('-i', v, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', spec['uit'])
    else:
        run('-i', v, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', spec['uit'])
    print(f"Klaar: {spec['uit']} ({L:.1f} s)")
if __name__ == '__main__':
    main(json.load(open(sys.argv[1], encoding='utf-8')))
