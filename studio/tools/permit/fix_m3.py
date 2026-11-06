"""Corrections to M3.json confirmed by two independent fixture readers and the reconciler (apartment 4, floor ג׳).
Idempotent: each fix applies only if the original error is still present.
usage: python3 -I fix_m3.py M3.json"""
import json, math, sys
p = sys.argv[1]; F = json.load(open(p)); log = []
close = lambda a, b, tol=.04: abs(a[0]-b[0]) < tol and abs(a[1]-b[1]) < tol
# 1. master-bedroom door: drawn at z 2.88 between the x=-5.35 partition and the jamb stub; no wall at z 2.17 there
def horiz(w, z, x0, x1):  # wall along z (tolerance 5 cm) lying between x0 and x1
    return abs(w['a'][1]-z) < .05 and abs(w['b'][1]-z) < .05 and min(w['a'][0], w['b'][0]) > x0-.06 and max(w['a'][0], w['b'][0]) < x1+.06
west = [w for w in F['walls'] if abs(w['a'][0]-w['b'][0]) < .02 and -4.45 < w['a'][0] < -4.25 and min(w['a'][1], w['b'][1]) > 2.1 and max(w['a'][1], w['b'][1]) < 2.95]
xw = west[0]['a'][0] if west else -4.32
bad = [i for i, w in enumerate(F['walls']) if horiz(w, 2.17, -5.36, xw)]
if bad:
    del F['walls'][bad[0]]
    F['walls'].append({'a': [-5.35, 2.88], 'b': [xw, 2.88], 't': .12, 'kind': 'int', 'h': None, 'note': 'fixed: master door wall at z 2.88 (drawn), replaces a wall at z 2.17 that is not on the plan'})
    if not any(abs(w['a'][0]+5.35) < .03 and abs(w['b'][0]+5.35) < .03 and min(w['a'][1], w['b'][1]) < 2.2 and max(w['a'][1], w['b'][1]) > 2.85 for w in F['walls']):
        F['walls'].append({'a': [-5.35, 2.17], 'b': [-5.35, 2.88], 't': .12, 'kind': 'int', 'h': None, 'note': 'fixed: partition west of the master door'})
    for o in F['openings']:
        if o.get('type') == 'door' and abs(o['x'] + 4.89) < .08 and abs(o['z'] - 2.17) < .08:
            o['x'], o['z'] = -4.88, 2.88; o['note'] = 'fixed: moved to the drawn position (z 2.88)'
    for r in F['rooms']:
        if r.get('apt') == '4' and r.get('kind') == 'master':
            k = [i for i, q in enumerate(r['poly']) if close(q, [xw, 2.17])]
            if k: r['poly'][k[0]:k[0]+1] = [[xw, 2.88], [-5.35, 2.88], [-5.35, 2.17]]
        if r.get('apt') == '4' and r.get('kind') == 'hall' and any(close(q, [xw, 2.17]) for q in r['poly']):
            r['poly'] = [q for q in r['poly'] if not (close(q, [-5.35, 2.17]) or close(q, [xw, 2.17]) or close(q, [xw, 2.88]))]
            r['poly'].insert(0, [-5.35, 2.88])
    log.append(f'master door moved to z 2.88; wall at z 2.17 removed; strip x -5.35..{xw} joined to the master bedroom')
# 2. bathroom door: drawn 0.75 wide with jambs at v_R 0.95..1.70 (centre (-4.917,6.051)); M3 had it 8 cm further south and 0.80 wide
for o in F['openings']:
    if o.get('type') == 'door' and math.hypot(o['x'] + 4.944, o['z'] - 6.093) < .03 and abs(o.get('w', .8) - .8) < .01:
        o['x'], o['z'], o['w'] = -4.917, 6.051, 0.75; o['note'] = 'fixed: drawn opening (0.75), clears the bathtub'; log.append('bathroom door set to the drawn opening')
F.setdefault('notes', []).extend(['POST-FIX: ' + l for l in log])
json.dump(F, open(p, 'w'), ensure_ascii=False, indent=1)
print('fix_m3:', log or 'nothing to fix')
