"""Draw a floor JSON (global metres) on its sheet: walls red (thickness to scale), openings green/cyan, rooms blue outlines with names.
usage: python3 -I overlay2.py FLOOR.json SHEET OUT.png [--box x0,z0,x1,z1] [--res 60] [--frame ox,oz,deg]
FLOOR.json: {"walls":[{"a":[x,z],"b":[x,z],"t":..}], "openings":[{"type","x","z","w"}], "rooms":[{"name","poly":[[x,z],...]}]}"""
import sys, os, json, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import *
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser(); ap.add_argument('floor'); ap.add_argument('sheet'); ap.add_argument('out')
ap.add_argument('--box'); ap.add_argument('--res', type=float, default=60); ap.add_argument('--frame', default='0,0,0')
a = ap.parse_args(); F = json.load(open(a.floor)); fr = tuple(map(float, a.frame.split(',')))
pts = [p for w in F.get('walls', []) for p in (w['a'], w['b'])] + [p for r in F.get('rooms', []) for p in r['poly']]
if a.box: u0, v0, u1, v1 = map(float, a.box.split(','))
else:
    loc = [global2frame(fr, *p) for p in pts]; u0 = min(p[0] for p in loc)-2; u1 = max(p[0] for p in loc)+2; v0 = min(p[1] for p in loc)-2; v1 = max(p[1] for p in loc)+2
res = a.res; W, H = int((u1-u0)*res), int((v1-v0)*res)
def P(i, j):
    x, z = frame2global(fr, u0+i/res, v0+j/res); return m2px(a.sheet, x, z)
p00, p10, p01 = P(0, 0), P(1, 0), P(0, 1)
img = Image.open(sheet_path(a.sheet)).convert('RGB').transform((W, H), Image.AFFINE, (p10[0]-p00[0], p01[0]-p00[0], p00[0], p10[1]-p00[1], p01[1]-p00[1], p00[1]), resample=Image.BICUBIC, fillcolor=(255, 255, 255))
ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
def Q(x, z):
    u, v = global2frame(fr, x, z); return ((u-u0)*res, (v-v0)*res)
for r in F.get('rooms', []):
    poly = [Q(*p) for p in r['poly']]
    if len(poly) >= 3: d.polygon(poly, outline=(0, 90, 255, 255), fill=(0, 90, 255, 28))
    cx = sum(p[0] for p in poly)/len(poly); cy = sum(p[1] for p in poly)/len(poly)
    d.text((cx-20, cy-6), (r.get('kind', '') + ' ' + str(r.get('apt', ''))).strip(), fill=(0, 60, 200, 255), font=f)
for w in F.get('walls', []):
    d.line([Q(*w['a']), Q(*w['b'])], fill=(235, 0, 0, 170) if w.get('kind') != 'railing' else (255, 140, 0, 200), width=max(2, int(w.get('t', .2)*res)))
for o in F.get('openings', []):
    x, y = Q(o['x'], o['z']); col = (0, 190, 0, 255) if o['type'] in ('door', 'entry', 'pass') else (0, 200, 230, 255)
    d.ellipse([x-5, y-5, x+5, y+5], fill=col); d.text((x+6, y-6), '%s %.2f' % (o['type'][0], o.get('w', 0)), fill=col, font=f)
Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB').save(a.out); print('saved', a.out, (W, H))
