"""Overlay the walls of several floor JSONs (global metres) in one image, one colour per floor, to check that floors stack.
usage: python3 -I stack_check.py OUT.png X0,Z0,X1,Z1 PX_PER_M floor1.json floor2.json ...
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
out, box, s = sys.argv[1], list(map(float, sys.argv[2].split(','))), float(sys.argv[3])
files = sys.argv[4:]
X0, Z0, X1, Z1 = box
W, H = int((X1 - X0) * s), int((Z1 - Z0) * s)
im = Image.new('RGB', (W, H + 30), 'white'); d = ImageDraw.Draw(im)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
except Exception: font = None
P = lambda x, z: ((x - X0) * s, (z - Z0) * s)
for gx in range(int(X0), int(X1) + 1):
    d.line([P(gx, Z0), P(gx, Z1)], fill=(235, 235, 235) if gx % 5 else (200, 200, 200))
for gz in range(int(Z0), int(Z1) + 1):
    d.line([P(X0, gz), P(X1, gz)], fill=(235, 235, 235) if gz % 5 else (200, 200, 200))
cols = [(220, 30, 30), (30, 120, 220), (20, 160, 60), (230, 140, 0), (150, 40, 180), (0, 0, 0)]
for i, f in enumerate(files):
    F = json.load(open(f)); c = cols[i % len(cols)]
    for w in F.get('walls', []):
        t = max(1, int(float(w.get('t', .2)) * s * .6))
        d.line([P(*w['a']), P(*w['b'])], fill=c, width=t)
    for r in F.get('rooms', []):
        p = [P(*q) for q in r['poly']]
        if len(p) >= 3: d.polygon(p, outline=c)
    d.text((10 + i * 170, H + 8), f.split('/')[-1], fill=c, font=font)
im.save(out); print('saved', out, im.size)
