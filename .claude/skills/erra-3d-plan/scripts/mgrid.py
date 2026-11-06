"""Render part of a sheet resampled into a metric frame with a labelled grid, so coordinates can be read in meters.
usage: python3 -I mgrid.py SHEET OUT.png --box=U0,V0,U1,V1 [--frame ox,oz,deg] [--res 90] [--step 0.5]
  U/V are coordinates in the frame (default frame = global: ox=0,oz=0,deg=0). Red lines every metre (labelled), pink every --step.
  For a wing drawn at an angle, use a rotated frame so its walls are axis-aligned (frame = ox,oz,deg)."""
import sys, math, os, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import *
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('out'); ap.add_argument('--box', required=True)
ap.add_argument('--frame', default='0,0,0'); ap.add_argument('--res', type=float, default=90); ap.add_argument('--step', type=float, default=0.5)
a = ap.parse_args()
u0, v0, u1, v1 = map(float, a.box.split(',')); fr = tuple(map(float, a.frame.split(','))); res = a.res
W, H = int((u1-u0)*res), int((v1-v0)*res)
# affine output(i,j) -> sheet pixel: local(u0+i/res, v0+j/res) -> global -> pixel (all affine)
def P(i, j):
    x, z = frame2global(fr, u0 + i/res, v0 + j/res); return m2px(a.sheet, x, z)
p00, p10, p01 = P(0, 0), P(1, 0), P(0, 1)
coef = (p10[0]-p00[0], p01[0]-p00[0], p00[0], p10[1]-p00[1], p01[1]-p00[1], p00[1])
src = Image.open(sheet_path(a.sheet)).convert('RGB')
img = src.transform((W, H), Image.AFFINE, coef, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
d = ImageDraw.Draw(img); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
k = math.floor(u0/a.step)*a.step
while k <= u1 + 1e-9:
    x = (k-u0)*res; major = abs(k-round(k)) < 1e-6
    d.line([(x, 0), (x, H)], fill=(230, 0, 0) if major else (255, 175, 175), width=1)
    if major: d.text((x+2, 2), '%g' % k, fill=(230, 0, 0), font=f)
    k += a.step
k = math.floor(v0/a.step)*a.step
while k <= v1 + 1e-9:
    y = (k-v0)*res; major = abs(k-round(k)) < 1e-6
    d.line([(0, y), (W, y)], fill=(0, 0, 230) if major else (175, 175, 255), width=1)
    if major: d.text((2, y+2), '%g' % k, fill=(0, 0, 230), font=f)
    k += a.step
img.save(a.out); print('saved', a.out, img.size, 'frame', fr)
