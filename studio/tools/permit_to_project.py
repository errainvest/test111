"""Assemble measured floor JSONs (one per building floor, global metric frame) into a PROJECT JSON for the multi-building viewer.

usage: python3 -I studio/tools/permit_to_project.py RECIPE.json OUT.json

RECIPE = {
  "name": "...", "place": "...", "subtitle": "...", "fine": "...", "facade": "...", "datum": 246.40,
  "dir": "/path/to/floor/jsons",
  "buildings": [ {"id": "E", "name": "בניין E", "zero": 246.40, "floors": ["E1.json", ...], "roof": "ER.json",
                  "stone": [{"floors": [0]}, {"kinds": ["core"]}], "levels": {"E1.json": 0.0}} ],
  "site": "SITE.json", "apartments": [{"building": "E", "apt": "1", "main_area": 74.7, "rooms": 3}]
}
Levels in the floor files may be relative to the building's ±0.00 or absolute (> 100 m); everything is written relative.
"""
import json, math, os, sys

def num(v, default=None):
    try:
        f = float(v)
        return f if math.isfinite(f) else default
    except (TypeError, ValueError):
        return default

def pt(p):
    if isinstance(p, dict): p = [p.get('x'), p.get('z')]
    if not isinstance(p, (list, tuple)) or len(p) < 2: return None
    x, z = num(p[0]), num(p[1])
    return None if x is None or z is None else [round(x, 3), round(z, 3)]

def poly(P):
    if not isinstance(P, list): return None
    out = [q for q in (pt(p) for p in P) if q]
    if len(out) >= 2 and out[0] == out[-1]: out = out[:-1]
    if len(out) < 3: return None
    a = sum(out[i][0] * out[(i + 1) % len(out)][1] - out[(i + 1) % len(out)][0] * out[i][1] for i in range(len(out))) / 2
    return out if abs(a) > 0.05 else None

def rel(v, zero):
    v = num(v)
    if v is None: return None
    return round(v - zero, 3) if v > 100 else round(v, 3)

def floor_from(F, zero, level_default, name_default):
    lv = rel(F.get('level'), zero)
    if lv is None: lv = level_default
    out = {'name': F.get('floor') or name_default, 'level': lv, 'walls': [], 'openings': [], 'rooms': [], 'outdoor': [], 'railings': [], 'stairs': [], 'lifts': []}
    for w in F.get('walls', []):
        a, b = pt(w.get('a')), pt(w.get('b'))
        if not a or not b or math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05: continue
        o = {'a': a, 'b': b, 't': num(w.get('t'), 0.2), 'kind': w.get('kind') or 'ext'}
        if num(w.get('h')) is not None: o['h'] = num(w.get('h'))
        for k in ('base', 'top'):
            if num(w.get(k)) is not None: o[k] = rel(w.get(k), zero)
        out['walls'].append(o)
    for o in F.get('openings', []):
        x, z = num(o.get('x')), num(o.get('z'))
        if x is None or z is None: continue
        q = {'type': o.get('type') or 'window', 'x': x, 'z': z, 'w': num(o.get('w'), 0.9)}
        for k in ('h', 'sill'):
            if num(o.get(k)) is not None: q[k] = num(o.get(k))
        out['openings'].append(q)
    for r in F.get('rooms', []):
        P = poly(r.get('poly'))
        if not P: continue
        out['rooms'].append({'name': r.get('name') or '', 'kind': r.get('kind') or 'hall', 'apt': str(r.get('apt')) if r.get('apt') is not None else '', 'poly': P})
    for r in F.get('outdoor', []):
        P = poly(r.get('poly'))
        if not P: continue
        if (r.get('kind') == 'pergola') and ('בעתיד' in (r.get('name') or '') or 'FUTURE' in (r.get('note') or '').upper()): continue
        q = {'name': r.get('name') or '', 'kind': r.get('kind') or 'balcony', 'apt': str(r.get('apt')) if r.get('apt') is not None else '', 'poly': P}
        lv2 = rel(r.get('level'), zero)
        if lv2 is not None: q['level'] = lv2
        out['outdoor'].append(q)
    for r in F.get('railings', []):
        a, b = pt(r.get('a')), pt(r.get('b'))
        if a and b: out['railings'].append({'a': a, 'b': b, 'h': num(r.get('h'), 1.1)})
    for s in F.get('stairs', []):
        P = poly(s.get('poly'))
        if not P: continue
        q = {'poly': P}
        d = s.get('up_dir')
        if isinstance(d, list) and len(d) >= 2 and num(d[0]) is not None and num(d[1]) is not None: q['up_dir'] = [num(d[0]), num(d[1])]
        out['stairs'].append(q)
    for l in F.get('lifts', []):
        P = poly(l.get('poly'))
        if P: out['lifts'].append({'poly': P})
    return out

def roof_from(F, zero, lower=True):
    out = {'name': 'גג', 'roof': True, 'level': rel(F.get('level'), zero), 'walls': [], 'items': []}
    groups = [('walls', False)] + ([('lower_walls', True)] if lower else [])
    for key, is_lower in groups:
        for w in F.get(key, []) or []:
            a, b = pt(w.get('a')), pt(w.get('b'))
            if not a or not b or math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05: continue
            o = {'a': a, 'b': b, 't': num(w.get('t'), 0.2), 'kind': 'low'}
            if num(w.get('h')) is not None: o['h'] = num(w.get('h'))
            for k in ('base', 'top'):
                if num(w.get(k)) is not None: o[k] = rel(w.get(k), zero)
            if is_lower:
                o['lower'] = True
                if 'h' not in o and 'top' not in o: o['h'] = 1.05
            out['walls'].append(o)
    for it in F.get('items', []):
        q = {'type': it.get('type') or 'ac'}
        P = poly(it.get('poly'))
        if P: q['poly'] = P
        for k in ('x', 'z', 'w', 'd', 'tilt_deg', 'h'):
            if num(it.get(k)) is not None: q[k] = num(it.get(k))
        for k in ('level', 'top'):
            if num(it.get(k)) is not None: q[k] = rel(it.get(k), zero)
        if 'poly' in q or 'x' in q: out['items'].append(q)
    return out

def site_from(S, datum):
    out = {}
    P = poly(S.get('plot'))
    if P: out['plot'] = P
    if num(S.get('plot_area')) is not None: out['plot_area'] = num(S.get('plot_area'))
    bl = []
    for line in S.get('building_lines', []) or []:
        pts = line.get('pts') if isinstance(line, dict) else line
        q = [p for p in (pt(x) for x in (pts or [])) if p]
        if len(q) >= 2: bl.append(q)
    out['building_lines'] = bl
    for key in ('parking', 'driveways', 'paths', 'gardens', 'roads', 'neighbours', 'sidewalks'):
        arr = []
        for it in S.get(key, []) or []:
            Pp = poly(it.get('poly'))
            if not Pp: continue
            q = {'poly': Pp}
            for k in ('label', 'kind', 'name', 'owner'):
                if it.get(k) is not None: q[k] = it.get(k)
            for k in ('level', 'h', 'base_abs', 'floors'):
                if num(it.get(k)) is not None: q[k] = num(it.get(k))
            arr.append(q)
        out[key] = arr
    out['kerbs'] = [{'pts': [p for p in (pt(x) for x in k.get('pts', [])) if p], 'paint': k.get('paint', 'grey')} for k in S.get('kerbs', []) or []]
    out['crosswalks'] = [{'a': pt(c.get('a')), 'b': pt(c.get('b')), 'w': num(c.get('w'), 3)} for c in S.get('crosswalks', []) or [] if pt(c.get('a')) and pt(c.get('b'))]
    out['poles'] = [{'x': num(p.get('x')), 'z': num(p.get('z')), 'h': num(p.get('h'), 3.5)} for p in S.get('poles', []) or [] if num(p.get('x')) is not None]
    out['gates'] = [{'x': num(g.get('x')), 'z': num(g.get('z')), 'w': num(g.get('w'), 1.6), 'h': num(g.get('h'), 2.4), 'arch': g.get('arch', True)} for g in S.get('gates', []) or [] if num(g.get('x')) is not None]
    out['retaining_walls'] = []
    for w in S.get('retaining_walls', []) or []:
        a, b = pt(w.get('a')), pt(w.get('b'))
        if a and b: out['retaining_walls'].append({'a': a, 'b': b, 't': num(w.get('t'), 0.3), 'top': num(w.get('top'))})
    out['fences'] = []
    for w in S.get('fences', []) or []:
        a, b = pt(w.get('a')), pt(w.get('b'))
        if a and b:
            q = {'a': a, 'b': b, 'h': num(w.get('h'), 1.1)}
            if num(w.get('base')) is not None: q['base'] = num(w.get('base'))
            out['fences'].append(q)
    out['trees'] = [{'x': num(t.get('x')), 'z': num(t.get('z')), 'r': num(t.get('r'), 2)} for t in S.get('trees', []) or [] if num(t.get('x')) is not None and num(t.get('z')) is not None]
    out['spot_levels'] = [{'x': num(p.get('x')), 'z': num(p.get('z')), 'v': num(p.get('v'))} for p in S.get('spot_levels', []) or []
                          if None not in (num(p.get('x')), num(p.get('z')), num(p.get('v')))]
    return out

def main():
    recipe, out_path = sys.argv[1], sys.argv[2]
    R = json.load(open(recipe))
    D = R.get('dir', '.')
    P = {k: R[k] for k in ('name', 'place', 'subtitle', 'fine', 'facade', 'apartments', 'railing', 'start', 'views') if k in R}
    P['datum'] = num(R.get('datum'), 0)
    P['buildings'] = []
    for b in R['buildings']:
        zero = num(b.get('zero'), P['datum'])
        floors = []
        for i, fn in enumerate(b['floors']):
            path = os.path.join(D, fn)
            if not os.path.exists(path):
                print('missing', path); continue
            F = json.load(open(path))
            lvl_default = (b.get('levels') or {}).get(fn, 3.0 * i)
            floors.append(floor_from(F, zero, lvl_default, F.get('floor') or fn))
            if fn in (b.get('levels') or {}): floors[-1]['level'] = b['levels'][fn]
            if fn in (b.get('names') or {}): floors[-1]['name'] = b['names'][fn]
            if 'detail_floors' in b and fn not in b['detail_floors']: floors[-1]['shell'] = True
            if fn in (b.get('show_apts') or {}): floors[-1]['show_apts'] = [str(a) for a in b['show_apts'][fn]]
            fxf = (b.get('fixtures') or {}).get(fn)
            if fxf and os.path.exists(os.path.join(D, fxf)):
                FX = json.load(open(os.path.join(D, fxf)))
                clean = []
                for fx in FX.get('fixtures', []):
                    q = {'type': fx.get('type'), 'room': fx.get('room')}
                    for k in ('a', 'b', 'sink', 'cook', 'fridge', 'facing'):
                        if isinstance(fx.get(k), list) and len(fx[k]) >= 2 and num(fx[k][0]) is not None: q[k] = [num(fx[k][0]), num(fx[k][1])]
                    if poly(fx.get('poly')): q['poly'] = poly(fx.get('poly'))
                    for k in ('x', 'z', 'w', 'depth'):
                        if num(fx.get(k)) is not None: q[k] = num(fx.get(k))
                    clean.append(q)
                floors[-1]['fixtures'] = clean
                floors[-1]['door_swings'] = [{'x': num(d.get('x')), 'z': num(d.get('z')), 'w': num(d.get('w')), 'hinge': d.get('hinge'), 'opens_into': d.get('opens_into')}
                                             for d in FX.get('door_swings', []) if num(d.get('x')) is not None]
        if b.get('roof') and os.path.exists(os.path.join(D, b['roof'])):
            floors.append(roof_from(json.load(open(os.path.join(D, b['roof']))), zero, b.get('roof_lower_walls', True)))
        P['buildings'].append({'id': b['id'], 'name': b.get('name') or b['id'], 'zero': zero, 'floors': floors, 'stone': b.get('stone', [])})
    # official apartment areas per level (from the area tables) are matched to the measured apartments by size
    def parea(P_):
        return abs(sum(P_[i][0] * P_[(i + 1) % len(P_)][1] - P_[(i + 1) % len(P_)][0] * P_[i][1] for i in range(len(P_))) / 2)
    apts = list(P.get('apartments', []))
    for b in P['buildings']:
        table = (R.get('areas_by_level') or {}).get(b['id'], {})
        for f in b['floors']:
            if f.get('roof'): continue
            key = str(int(round(f['level']))) if f['level'] == int(round(f['level'])) else str(f['level'])
            off = table.get(key)
            if not off: continue
            groups = {}
            for r in f['rooms']:
                if r['apt'] in ('', 'common') or r['kind'] in ('shaft',): continue
                groups.setdefault(r['apt'], 0.0); groups[r['apt']] += parea(r['poly'])
            model = sorted(groups.items(), key=lambda kv: kv[1])
            offs = sorted(off, key=lambda o: o['area'])
            if len(model) != len(offs):
                print('area table mismatch', b['id'], key, model, offs); continue
            for (apt, a_model), o in zip(model, offs):
                apts.append({'building': b['id'], 'apt': apt, 'main_area': o['area'], 'rooms': o.get('rooms'), 'model_area': round(a_model, 1)})
    if apts: P['apartments'] = apts
    if R.get('site') and os.path.exists(os.path.join(D, R['site'])):
        S = json.load(open(os.path.join(D, R['site'])))
        P['site'] = site_from(S, P['datum'])
        n = S.get('north')
        if isinstance(n, list) and len(n) >= 2 and num(n[0]) is not None: P['north'] = [num(n[0]), num(n[1])]
    if R.get('north'): P['north'] = R['north']
    for k in ('crosswalks', 'kerbs', 'gates', 'roads', 'sidewalks', 'driveways', 'poles', 'terrain_plane', 'neighbours'):
        if k in (R.get('site_extra') or {}):
            P.setdefault('site', {})
            if k in ('terrain_plane',): P['site'][k] = R['site_extra'][k]
            else: P['site'][k] = list(P['site'].get(k, [])) + list(R['site_extra'][k])
    json.dump(P, open(out_path, 'w'), ensure_ascii=False, indent=1)
    for b in P['buildings']:
        print(b['id'], [(f['name'], f.get('level'), len(f.get('walls', [])), len(f.get('rooms', []))) for f in b['floors']])
    print('site keys:', list(P.get('site', {}).keys()))

if __name__ == '__main__':
    main()
