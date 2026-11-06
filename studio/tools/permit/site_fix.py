"""Blend-transform SITE.json (fpE) into the frame of the aligned buildings and add derived features.
usage: python3 -I site_fix.py SITE_IN.json SITE_OUT.json TM TE
  TM / TE = 'theta,dx,dz' transforms (rotate theta deg about the origin, then translate) for the M2 side (x<-6) and the E side (x>4);
  points in between get a linear blend of the two results."""
import json, math, sys
S = json.load(open(sys.argv[1])); TM = list(map(float, sys.argv[3].split(','))); TE = list(map(float, sys.argv[4].split(',')))
def tf(T, x, z):
    c, s = math.cos(math.radians(T[0])), math.sin(math.radians(T[0])); return c*x - s*z + T[1], s*x + c*z + T[2]
def T(p):
    x, z = float(p[0]), float(p[1]); w = min(1, max(0, (x + 6) / 10))
    a = tf(TM, x, z); b = tf(TE, x, z); return [round(a[0]*(1-w) + b[0]*w, 3), round(a[1]*(1-w) + b[1]*w, 3)]
def walk(o, key=None):
    if isinstance(o, dict):
        if isinstance(o.get('x'), (int, float)) and isinstance(o.get('z'), (int, float)): o['x'], o['z'] = T([o['x'], o['z']])
        for k, v in list(o.items()):
            if k in ('a', 'b') and isinstance(v, list) and len(v) >= 2 and isinstance(v[0], (int, float)): o[k] = T(v)
            elif k in ('poly', 'pts', 'plot', 'polygon_densified') and isinstance(v, list): o[k] = [T(q) if isinstance(q, list) and len(q) >= 2 and isinstance(q[0], (int, float)) else q for q in v]
            elif k in ('north',): pass
            else: walk(v, k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if key == 'building_lines' and isinstance(v, list) and v and isinstance(v[0], list): o[i] = [T(q) for q in v]
            else: walk(v, key)
walk(S)
# --- derived features -------------------------------------------------------------
def mean(v):
    if isinstance(v, list): v = [float(q) for q in v if isinstance(q, (int, float))]; return sum(v)/len(v) if v else None
    return v
for g in S.get('gardens', []): g['level'] = mean(g.get('level'))
for d in S.get('driveways', []) + S.get('paths', []) + S.get('parking', []):
    if isinstance(d.get('level'), list): d['level'] = None
S['poles'] = [{'x': l['x'], 'z': l['z'], 'h': l.get('h', 3.5)} for l in S.get('lights', [])]
# neighbouring buildings: height from their storeys (6 units each), base at their ±0.00
H = {'M1': 11.0, 'E1': 9.6, 'M2m': 11.0, 'P': 9.6, 'P1': 9.6}
nb = []
for n in S.get('neighbours', []):
    if n.get('kind') != 'building': continue
    lab = n.get('label', ''); key = lab.split(' ')[0]
    import re
    m = re.search(r'([0-9]{3}\.[0-9]{2})', lab); base = float(m.group(1)) if m else None
    h = H.get(key, 3.0 if 'אשפה' in lab or 'refuse' in lab else 9.0)
    nb.append({'poly': n['poly'], 'label': lab, 'h': h, 'base_abs': base})
S['neighbours'] = nb
# roads: carriageways asphalt, sidewalks red pavers
roads, walks = [], []
for r in S.get('roads', []):
    (roads if r.get('kind') == 'carriageway' or 'carriageway' in (r.get('name') or '') else walks).append({'poly': r['poly'], 'name': r.get('name')})
S['roads'] = roads; S['sidewalks'] = walks
# kerbs along every carriageway edge; red-white within 22 m of the B10/B21 junction
J = T([-21.0, -7.0])
S['kerbs'] = []
for r in roads:
    P = r['poly']
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        S['kerbs'].append({'pts': [a, b], 'paint': 'redwhite' if math.hypot(mx - J[0], mz - J[1]) < 22 else 'grey'})
# crosswalks next to the junction: across B10 east of it and across B21 south of it (as in the photos)
def road_edges_at(poly, axis, val):
    # intersections of a vertical (axis='x') or horizontal (axis='z') line with the polygon edges
    hits = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        k = 0 if axis == 'x' else 1
        if (a[k] - val) * (b[k] - val) <= 0 and a[k] != b[k]:
            t = (val - a[k]) / (b[k] - a[k]); hits.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    return hits
cw = []
for r in roads:
    nm = r.get('name') or ''
    if 'B10' in nm:
        h = road_edges_at(r['poly'], 'x', J[0] + 7.5)
        if len(h) >= 2: h.sort(key=lambda p: p[1]); cw.append({'a': h[0], 'b': h[-1], 'w': 3.2})
    if 'B21' in nm:
        h = road_edges_at(r['poly'], 'z', J[1] + 9.0)
        if len(h) >= 2: h.sort(key=lambda p: p[0]); cw.append({'a': h[0], 'b': h[-1], 'w': 3.2})
S['crosswalks'] = cw
# curved stone wall along the plot's rounded NW corner, with an arched gate where M2's entrance path meets it (seen in photos of the building)
P = S.get('plot') or []
arc = [q for q in P if q[0] < -13.6 and q[1] < 5.6]
if len(arc) >= 3:
    i0 = P.index(arc[0])
    # keep the order along the polygon
    idx = [i for i, q in enumerate(P) if q in arc]
    for i in range(len(idx) - 1):
        if idx[i + 1] == idx[i] + 1:
            a, b = P[idx[i]], P[idx[i + 1]]
            S['retaining_walls'].append({'a': a, 'b': b, 't': 0.35, 'top': 247.85, 'name': 'stone wall at the street corner (photos)'})
    ent = [p for p in S.get('paths', []) if 'M2' in (p.get('name') or '') and 'entrance path' in (p.get('name') or '')]
    if ent:
        E_ = ent[0]['poly']; mx = (E_[0][0] + E_[-1][0]) / 2; mz = (E_[0][1] + E_[-1][1]) / 2
        best = None
        for i in range(len(idx) - 1):
            a, b = P[idx[i]], P[idx[i + 1]]; dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1e-9
            t = max(0, min(1, ((mx - a[0]) * dx + (mz - a[1]) * dz) / L2)); q = [a[0] + dx * t, a[1] + dz * t]; d = math.hypot(q[0] - mx, q[1] - mz)
            if best is None or d < best[0]: best = (d, q)
        if best: S['gates'] = [{'x': round(best[1][0], 3), 'z': round(best[1][1], 3), 'w': 1.9, 'h': 2.7, 'arch': True}]
json.dump(S, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print('site fixed:', len(roads), 'roads', len(walks), 'sidewalks', len(nb), 'neighbours', len(S['kerbs']), 'kerb pieces', len(cw), 'crosswalks')
