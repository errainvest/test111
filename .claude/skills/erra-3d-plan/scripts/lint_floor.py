"""Check a floor JSON (or every floor of a recipe) for the things the engine would otherwise fix silently or drop.

usage: python3 -I lint_floor.py FLOOR.json [FLOOR2.json ...]      # one or more floor files
       python3 -I lint_floor.py --recipe RECIPE.json              # every floor and roof listed in the recipe
Exit code 1 when any ERROR is printed; WARNs are judgement calls.

It is the overlay check's stand-in when there is no drawing to overlay on (a plan written from a brief), and a quick
sanity pass before assembling either way:
  ERROR  opening not on any wall (the engine attaches an opening within t/2 + 0.35 m of a wall centreline, else drops it)
  ERROR  unknown room kind (the engine falls back to 'hall': no furniture of the intended type)
  ERROR  degenerate wall (< 8 cm) or polygon (< 3 points / zero area)
  WARN   two rooms overlap by more than 0.3 m² (rooms should tile the floor on the centrelines)
  WARN   a room edge has no wall along it and no room on the other side (an open side to the outdoors)
  WARN   a door/entry that has rooms on neither side, a window with rooms on both sides
  WARN   an outdoor area without a level; INFO a stair without from_level/to_level (fine between floors, wrong for entrance steps)
  INFO   gross area per apartment (compare with the plan's table)
"""
import json, math, os, sys
KINDS = set('living kitchen dining hall lobby bed master kids office mamad closet storage shaft bath wc laundry service stair balcony terrace garden pergola roof'.split())
OPEN = set('door entry window slider pass'.split())
def area(P): return sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P)))/2
def inpoly(P, x, z):
    c = False
    for i in range(len(P)):
        a, b = P[i], P[(i-1) % len(P)]
        if (a[1] > z) != (b[1] > z) and x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1]) + a[0]: c = not c
    return c
def seg_d(x, z, a, b):
    dx, dz = b[0]-a[0], b[1]-a[1]; L2 = dx*dx+dz*dz
    t = 0 if L2 == 0 else max(0, min(1, ((x-a[0])*dx+(z-a[1])*dz)/L2))
    return math.hypot(x-(a[0]+dx*t), z-(a[1]+dz*t)), t
def overlap_area(P, Q, step=.2):   # sampled; enough to flag real overlaps
    xs = [p[0] for p in P]; zs = [p[1] for p in P]; n = 0; tot = 0
    x = min(xs)+step/2
    while x < max(xs):
        z = min(zs)+step/2
        while z < max(zs):
            if inpoly(P, x, z):
                tot += 1
                if inpoly(Q, x, z): n += 1
            z += step
        x += step
    return n*step*step
def lint(path, roof=False):
    F = json.load(open(path)); name = os.path.basename(path); errs = 0
    walls = [w for w in F.get('walls', []) if w.get('a') and w.get('b')]
    for w in F.get('walls', []):
        if not (w.get('a') and w.get('b')): print(f'ERROR {name}: wall without a/b: {w}'); errs += 1; continue
        if math.hypot(w['b'][0]-w['a'][0], w['b'][1]-w['a'][1]) < .08: print(f'ERROR {name}: degenerate wall {w["a"]}->{w["b"]}'); errs += 1
    if roof: print(f'OK    {name}: roof, {len(walls)} parapet walls, {len(F.get("items", []))} items'); return errs
    rooms = []
    for r in F.get('rooms', []):
        P = r.get('poly') or []
        if len(P) < 3 or abs(area(P)) < .05: print(f'ERROR {name}: room {r.get("name")!r} has a degenerate polygon'); errs += 1; continue
        if r.get('kind') not in KINDS: print(f'ERROR {name}: room {r.get("name")!r} has unknown kind {r.get("kind")!r} (engine falls back to hall)'); errs += 1
        rooms.append(r)
    outs = [o for o in F.get('outdoor', []) if o.get('poly') and len(o['poly']) >= 3]
    for o in outs:
        if o.get('level') is None: print(f'WARN  {name}: outdoor {o.get("name")!r} has no level (taken as the floor level)')
    def room_at(x, z, with_out=True):
        for r in rooms:
            if inpoly(r['poly'], x, z): return r
        if with_out:
            for o in outs:
                if inpoly(o['poly'], x, z): return o
        return None
    for o in F.get('openings', []):
        if o.get('type') not in OPEN: print(f'WARN  {name}: opening type {o.get("type")!r} unknown (window assumed) at {o.get("x")},{o.get("z")}')
        best = None
        for w in walls:
            d, t = seg_d(o['x'], o['z'], w['a'], w['b'])
            if d <= (w.get('t', .2))/2 + .35 and -.1 <= t <= 1.1:
                if best is None or d < best[0]: best = (d, w)
        if best is None: print(f'ERROR {name}: opening {o.get("type")} at ({o["x"]},{o["z"]}) is not on any wall: the engine drops it'); errs += 1; continue
        if best[0] > .12: print(f'WARN  {name}: opening {o.get("type")} at ({o["x"]},{o["z"]}) is {best[0]*100:.0f} cm off its wall centreline')
        w = best[1]; dx, dz = w['b'][0]-w['a'][0], w['b'][1]-w['a'][1]; L = math.hypot(dx, dz) or 1; nx, nz = -dz/L, dx/L; dd = w.get('t', .2)/2+.3
        s1, s2 = room_at(o['x']+nx*dd, o['z']+nz*dd), room_at(o['x']-nx*dd, o['z']-nz*dd)
        if o.get('type') in ('door', 'entry', 'pass') and not s1 and not s2: print(f'WARN  {name}: {o["type"]} at ({o["x"]},{o["z"]}) has no room on either side')
        if o.get('type') == 'window' and s1 and s2 and s1 in rooms and s2 in rooms: print(f'WARN  {name}: window at ({o["x"]},{o["z"]}) has rooms on both sides ({s1.get("name")!r} / {s2.get("name")!r})')
    for i in range(len(rooms)):
        for j in range(i+1, len(rooms)):
            A, B = rooms[i]['poly'], rooms[j]['poly']
            if max(p[0] for p in A) < min(p[0] for p in B) or max(p[0] for p in B) < min(p[0] for p in A): continue
            if max(p[1] for p in A) < min(p[1] for p in B) or max(p[1] for p in B) < min(p[1] for p in A): continue
            ov = overlap_area(A, B)
            if ov > .3: print(f'WARN  {name}: rooms {rooms[i].get("name")!r} and {rooms[j].get("name")!r} overlap by {ov:.1f} m²')
    for r in rooms:   # an edge with nothing on the other side and no wall on it = an open side
        P = r['poly']
        for i in range(len(P)):
            a, b = P[i], P[(i+1) % len(P)]; L = math.hypot(b[0]-a[0], b[1]-a[1])
            if L < .5: continue
            mx, mz = (a[0]+b[0])/2, (a[1]+b[1])/2; nx, nz = -(b[1]-a[1])/L, (b[0]-a[0])/L
            side = (mx+nx*.3, mz+nz*.3) if not inpoly(P, mx+nx*.3, mz+nz*.3) else (mx-nx*.3, mz-nz*.3)
            on_wall = any(seg_d(mx, mz, w['a'], w['b'])[0] < .15 and seg_d(a[0], a[1], w['a'], w['b'])[0] < .3 and seg_d(b[0], b[1], w['a'], w['b'])[0] < .3 for w in walls)
            if not on_wall and room_at(*side) is None and L > 1.0: print(f'WARN  {name}: room {r.get("name")!r} edge {a}->{b} has no wall and nothing beyond it')
    for s in F.get('stairs', []):
        if s.get('from_level') is None or s.get('to_level') is None: print(f'INFO  {name}: stair without from_level/to_level: built one full storey up from this floor (right between floors; wrong for entrance steps, half-flights or the top floor)')
    apts = {}
    for r in rooms:
        if r.get('apt') in (None, '', 'common') or r.get('kind') == 'shaft': continue
        apts[str(r['apt'])] = apts.get(str(r['apt']), 0) + abs(area(r['poly']))
    for k in sorted(apts): print(f'INFO  {name}: apartment {k} gross {apts[k]:.1f} m² ({sum(1 for r in rooms if str(r.get("apt"))==k)} rooms)')
    print(f'{"OK   " if not errs else "FAIL "} {name}: {len(walls)} walls, {len(F.get("openings", []))} openings, {len(rooms)} rooms, {len(outs)} outdoor')
    return errs
args = sys.argv[1:]; total = 0
if args and args[0] == '--recipe':
    R = json.load(open(args[1])); D = os.path.join(os.path.dirname(os.path.abspath(args[1])), R.get('dir', '.'))
    for b in R['buildings']:
        for fn in b['floors']: total += lint(os.path.join(D, fn))
        if b.get('roof'): total += lint(os.path.join(D, b['roof']), roof=True)
else:
    for p in args: total += lint(p)
sys.exit(1 if total else 0)
