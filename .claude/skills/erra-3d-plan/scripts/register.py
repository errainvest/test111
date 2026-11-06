"""Register a drawing sheet: pixel <-> global metres, from two points whose metric positions you know.

usage: python3 -I register.py REG.json SHEET PNG --p1 PX,PY,X,Z --p2 PX,PY,X,Z [--label "קומה א'"] [--aniso]
  REG.json   the project's registration file (created if missing); PNG is stored relative to it
  --p1/--p2  two points on the sheet (pixels) and where they are in the global frame (metres); far apart, ideally on a
             dimension chain (e.g. the two ends of an "18.00" chain), so scale and tilt come out right
  --aniso    keep separate x/y scales (scanners often differ by ~1%); needs a third point: --p3 PX,PY,X,Z

Scale check: a 1:100 drawing scanned at 200 dpi gives ~78.7 px/m; 1:50 at 150 dpi gives 118.1 px/m. If the printed scale
and the fitted scale disagree by more than ~3%, the sheet was reduced when printed (common) — trust the fit, not the title block.
"""
import json, math, os, sys, argparse
ap = argparse.ArgumentParser(); ap.add_argument('reg'); ap.add_argument('sheet'); ap.add_argument('png')
ap.add_argument('--p1', required=True); ap.add_argument('--p2', required=True); ap.add_argument('--p3'); ap.add_argument('--label', default='')
ap.add_argument('--aniso', action='store_true')
a = ap.parse_args()
P = lambda s: list(map(float, s.split(',')))
p1, p2 = P(a.p1), P(a.p2)
du, dv = p2[0]-p1[0], p2[1]-p1[1]; dx, dz = p2[2]-p1[2], p2[3]-p1[3]
tilt = math.degrees(math.atan2(dv, du) - math.atan2(dz, dx))      # rotation of the scan relative to the metric frame
s = math.hypot(du, dv) / math.hypot(dx, dz)
sx = sy = s
if a.aniso and a.p3:
    p3 = P(a.p3); t = math.radians(tilt); c, sn = math.cos(t), math.sin(t)
    def loc(p):   # de-rotated pixel offsets from p1
        u, v = p[0]-p1[0], p[1]-p1[1]; return (u*c + v*sn, -u*sn + v*c)
    L2, L3 = loc(p2), loc(p3)
    cand = []
    for L, p in ((L2, p2), (L3, p3)):
        if abs(p[2]-p1[2]) > 1: cand.append(('sx', L[0]/(p[2]-p1[2])))
        if abs(p[3]-p1[3]) > 1: cand.append(('sy', L[1]/(p[3]-p1[3])))
    xs = [v for k, v in cand if k == 'sx']; ys = [v for k, v in cand if k == 'sy']
    if xs: sx = sum(xs)/len(xs)
    if ys: sy = sum(ys)/len(ys)
reg = json.load(open(a.reg)) if os.path.exists(a.reg) else {
    '_doc': 'pixel->global metres per sheet. u=px-ref_px, v=py-ref_py; rotate by -tilt; x=ref_x+u/sx, z=ref_z+v/sy. x right, z DOWN the drawing.'}
png = os.path.relpath(os.path.abspath(a.png), os.path.dirname(os.path.abspath(a.reg)))
reg[a.sheet] = {'label': a.label, 'png': png, 'ref_px': [p1[0], p1[1]], 'ref_m': [p1[2], p1[3]], 'tilt_deg': round(tilt, 3), 'sx': round(sx, 2), 'sy': round(sy, 2)}
json.dump(reg, open(a.reg, 'w'), ensure_ascii=False, indent=1)
# verify: map p2 back through the stored transform
r = reg[a.sheet]; t = math.radians(r['tilt_deg']); c, sn = math.cos(t), math.sin(t)
u, v = p2[0]-r['ref_px'][0], p2[1]-r['ref_px'][1]
x, z = r['ref_m'][0] + (u*c + v*sn)/r['sx'], r['ref_m'][1] + (-u*sn + v*c)/r['sy']
print('registered %s: %.2f px/m (x) %.2f px/m (y), tilt %.3f deg; p2 maps to (%.3f, %.3f), target (%.3f, %.3f), error %.1f cm'
      % (a.sheet, sx, sy, tilt, x, z, p2[2], p2[3], 100*math.hypot(x-p2[2], z-p2[3])))
