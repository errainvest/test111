"""Rigidly align floor A to reference floor B using walls that must stack (core / shelter / chosen kinds).
usage: python3 -I align.py A.json B.json --kinds=core,mamad [--init=dx,dz] [--box=x0,z0,x1,z1] [--apply=OUT.json]
Prints the transform (rotation theta about the origin, then translation) and the residuals; with --apply writes A transformed.
"""
import json, math, sys
import numpy as np
args = dict(a.split('=', 1) for a in sys.argv[3:] if '=' in a)
A = json.load(open(sys.argv[1])); Bf = json.load(open(sys.argv[2]))
kinds = set(args.get('--kinds', 'core,mamad').split(','))
kindsB = set(args.get('--kindsB', ','.join(kinds)).split(','))
init = [float(v) for v in args.get('--init', '0,0').split(',')]
box = [float(v) for v in args['--box'].split(',')] if '--box' in args else None
def walls(F, ks):
    out = []
    for w in F.get('walls', []):
        if w.get('kind') not in ks: continue
        a = np.array(w['a'], float); b = np.array(w['b'], float); L = np.linalg.norm(b - a)
        if L < 0.6: continue
        if box and not (box[0] <= (a[0]+b[0])/2 <= box[2] and box[1] <= (a[1]+b[1])/2 <= box[3]): continue
        out.append((a, b, L))
    return out
WA, WB = walls(A, kinds), walls(Bf, kindsB)
pts = []
for a, b, L in WA:
    u = (b - a) / L
    for t in np.arange(0.2, L - 0.19, 0.25): pts.append((a + u * t, u))
th, t = 0.0, np.array(init)
if '--fixed' in args:
    th = math.radians(float(args['--fixed'].split(',')[0])); t = np.array([float(v) for v in args['--fixed'].split(',')[1:]]); pts = []
for it in range(25 if pts else 0):
    R = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
    rows, rhs, res = [], [], []
    for p, u in pts:
        q = R @ p + t; uq = R @ u
        best = None
        for a, b, L in WB:
            ub = (b - a) / L
            if abs(ub[0] * uq[1] - ub[1] * uq[0]) > 0.09: continue
            s = np.dot(q - a, ub)
            if s < -0.2 or s > L + 0.2: continue
            n = np.array([-ub[1], ub[0]]); d = np.dot(q - a, n)
            if abs(d) < 0.7 and (best is None or abs(d) < abs(best[0])): best = (d, n)
        if best is None: continue
        d, n = best
        dq = np.array([-q[1] + t[1], q[0] - t[0]])  # derivative of R p w.r.t. theta (about origin)
        rows.append([np.dot(n, dq), n[0], n[1]]); rhs.append(-d); res.append(d)
    if len(rows) < 6: print('too few matches', len(rows)); break
    M = np.array(rows); r = np.array(rhs)
    w = 1 / np.maximum(0.03, np.abs(r))  # robust weights
    sol = np.linalg.lstsq(M * w[:, None], r * w, rcond=None)[0]
    th += sol[0]; t = t + sol[1:]
    if np.abs(sol).max() < 1e-5: break
res = np.array(res if 'res' in dir() and pts else [0.0])
print(f'theta={math.degrees(th):.4f} deg  t=({t[0]:.4f},{t[1]:.4f})  matches={len(res)}  |res| median={np.median(np.abs(res)):.3f} p90={np.percentile(np.abs(res),90):.3f}')
if '--apply' in args:
    R = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
    T = lambda p: [round(float(v), 3) for v in (R @ np.array(p[:2], float) + t)]
    def tr_poly(P): return [T(q) for q in P]
    for w in A.get('walls', []): w['a'] = T(w['a']); w['b'] = T(w['b'])
    for key in ('railings', 'lower_walls'):
        for w in A.get(key, []) or []: w['a'] = T(w['a']); w['b'] = T(w['b'])
    for o in A.get('openings', []): o['x'], o['z'] = T([o['x'], o['z']])
    for key in ('rooms', 'outdoor', 'stairs', 'lifts'):
        for r in A.get(key, []) or []:
            if r.get('poly'): r['poly'] = tr_poly(r['poly'])
            if key == 'stairs' and r.get('up_dir'): r['up_dir'] = [round(float(v), 4) for v in (R @ np.array(r['up_dir'], float))]
    for it_ in A.get('items', []) or []:
        if it_.get('poly'): it_['poly'] = tr_poly(it_['poly'])
        if it_.get('x') is not None: it_['x'], it_['z'] = T([it_['x'], it_['z']])
    for m in A.get('level_marks', []) or []:
        if isinstance(m, dict) and m.get('x') is not None: m['x'], m['z'] = T([m['x'], m['z']])
    A.setdefault('notes', []).append(f'aligned to {sys.argv[2].split("/")[-1]} on {sorted(kinds)} walls: rotate {math.degrees(th):.4f} deg about (0,0), then translate ({t[0]:.3f},{t[1]:.3f})')
    json.dump(A, open(args['--apply'], 'w'), ensure_ascii=False, indent=1)
    print('wrote', args['--apply'])
