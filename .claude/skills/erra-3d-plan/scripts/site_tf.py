"""Apply a rigid transform (rotate THETA deg about the origin, then translate DX,DZ) to every coordinate in a SITE.json.
usage: python3 -I site_tf.py SITE.json OUT.json THETA,DX,DZ"""
import json, math, sys
S = json.load(open(sys.argv[1])); th, dx, dz = map(float, sys.argv[3].split(','))
c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
def T(p):
    if isinstance(p, dict) and 'x' in p and 'z' in p:
        x, z = float(p['x']), float(p['z']); p['x'], p['z'] = round(c*x - s*z + dx, 3), round(s*x + c*z + dz, 3); return p
    if isinstance(p, list) and len(p) >= 2 and all(isinstance(v, (int, float)) for v in p[:2]):
        x, z = float(p[0]), float(p[1]); return [round(c*x - s*z + dx, 3), round(s*x + c*z + dz, 3)] + list(p[2:])
    return p
def walk(o, key=None):
    if isinstance(o, dict):
        if 'x' in o and 'z' in o and isinstance(o.get('x'), (int, float)): T(o)
        for k, v in o.items():
            if k in ('a', 'b') and isinstance(v, list): o[k] = T(v)
            elif k in ('poly', 'pts', 'plot', 'polygon_densified') and isinstance(v, list): o[k] = [T(q) for q in v]
            elif k in ('north', 'up_dir', 'unit_xz', 'east_unit_xz'): pass
            else: walk(v, k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if key == 'building_lines' and isinstance(v, list) and v and isinstance(v[0], list): o[i] = [T(q) for q in v]
            else: walk(v, key)
walk(S)
if isinstance(S.get('plot'), list): S['plot'] = [T(q) for q in S['plot']] if S['plot'] and isinstance(S['plot'][0], list) and False else S['plot']
# rotate the north vector too
n = S.get('north')
if isinstance(n, list) and len(n) >= 2: S['north'] = [round(c*n[0] - s*n[1], 4), round(s*n[0] + c*n[1], 4)]
S.setdefault('notes', []).append(f'site transformed: rotate {th} deg about (0,0), translate ({dx},{dz})')
json.dump(S, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1); print('wrote', sys.argv[2])
