"""Find wall faces along a line, in metres. Samples darkness of the drawing along the line from (u0,v0) to (u1,v1) in a frame,
averaging across a band of +-W metres perpendicular to the line. Prints positions (distance along the line, and the global x,z)
where the drawing is dark/coloured: wall faces come as pairs of edges.
usage: python3 -I scan.py SHEET --p0=U0,V0 --p1=U1,V1 [--frame ox,oz,deg] [--band 0.15] [--thr 150]"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import *
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('--p0', required=True); ap.add_argument('--p1', required=True)
ap.add_argument('--frame', default='0,0,0'); ap.add_argument('--band', type=float, default=0.15); ap.add_argument('--thr', type=float, default=150)
a = ap.parse_args(); fr = tuple(map(float, a.frame.split(',')))
u0, v0 = map(float, a.p0.split(',')); u1, v1 = map(float, a.p1.split(','))
im = np.array(Image.open(sheet_path(a.sheet)).convert('RGB')).astype(float)
L = math.hypot(u1-u0, v1-v0); n = int(L/0.01); du, dv = (u1-u0)/L, (v1-v0)/L; pu, pv = -dv, du
vals = []
for i in range(n+1):
    t = i*0.01; acc = []
    for w in np.linspace(-a.band, a.band, 7):
        x, z = frame2global(fr, u0+du*t+pu*w, v0+dv*t+pv*w); px, py = m2px(a.sheet, x, z)
        if 0 <= int(py) < im.shape[0] and 0 <= int(px) < im.shape[1]:
            r, g, b = im[int(py), int(px)]; acc.append(min(r, g, b) if abs(r-g) < 25 and abs(g-b) < 25 else min(150, min(r, g, b)))
    vals.append(np.mean(acc) if acc else 255)
vals = np.array(vals); dark = vals < a.thr
runs = []; s = None
for i, d in enumerate(dark):
    if d and s is None: s = i
    if (not d or i == len(dark)-1) and s is not None: runs.append((s, i)); s = None
for s0, s1 in runs:
    t0, t1 = s0*0.01, s1*0.01; xa, za = frame2global(fr, u0+du*t0, v0+dv*t0); xb, zb = frame2global(fr, u0+du*t1, v0+dv*t1)
    print('dark %.2f..%.2f m along (thick %.2f)  global (%.2f,%.2f)->(%.2f,%.2f)' % (t0, t1, t1-t0, xa, za, xb, zb))
