"""Draw a plan JSON (walls red, openings green, rooms blue) on top of a rendered drawing, to check the model against the scan.

usage: python3 overlay.py PLAN.json FLOOR_INDEX DRAWING.png OX OY PX_PER_M OUT.png [x0,y0,x1,y1 crop] [scale]
  OX, OY    pixel of plan point (0,0) on the drawing (wall centerline of the top-left corner)
  PX_PER_M  pixels per meter (1:50 drawing rendered at 150 dpi = 118.1)
"""
import json, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None

plan, fi, png, ox, oy, s, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6]), sys.argv[7]
crop = tuple(map(int, sys.argv[8].split(','))) if len(sys.argv) > 8 else None
sc = float(sys.argv[9]) if len(sys.argv) > 9 else .5
F = json.load(open(plan))['floors'][fi]
im = Image.open(png).convert('RGB'); d = ImageDraw.Draw(im)
P = lambda x, z: (ox + x * s, oy + z * s)
for r in F['rooms']:
    d.rectangle([P(r['x0'], r['z0']), P(r['x1'], r['z1'])], outline=(0, 120, 255), width=2)
for w in F['walls']:
    d.line([P(*w['a']), P(*w['b'])], fill=(255, 0, 0), width=5)
for o in F.get('openings', []):
    d.ellipse([P(o['x'], o['z'])[0] - 6, P(o['x'], o['z'])[1] - 6, P(o['x'], o['z'])[0] + 6, P(o['x'], o['z'])[1] + 6], fill=(0, 200, 0))
if crop: im = im.crop(crop)
im.resize((int(im.width * sc), int(im.height * sc))).save(out)
print('saved', out)
