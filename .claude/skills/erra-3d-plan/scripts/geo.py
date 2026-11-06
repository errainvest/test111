"""Sheet registration helpers (pixel <-> global metres) shared by mgrid.py, scan.py and overlay2.py.

The registration file is the project's reg.json: $ERRA_REG if set, else ./reg.json in the current directory.
Sheet PNG paths inside it are relative to the reg.json file. Make entries with register.py.
CLI: geo.py px2m SHEET px py | m2px SHEET x z | f2g ox,oz,deg u v | g2f ox,oz,deg x z"""
import json, math, os
REG_PATH = os.path.abspath(os.environ.get('ERRA_REG') or 'reg.json')
ROOT = os.path.dirname(REG_PATH)
class _Reg(dict):
    def __missing__(self, k):
        if not self.get('_loaded'):
            if not os.path.exists(REG_PATH): raise SystemExit('no registration file: %s (cd into the project or set ERRA_REG)' % REG_PATH)
            self.update(json.load(open(REG_PATH))); self['_loaded'] = True
            if k in self: return self[k]
        raise SystemExit('sheet %r is not registered in %s (run register.py)' % (k, REG_PATH))
REG = _Reg()
def T(sheet):
    r = REG[sheet]; t = math.radians(r['tilt_deg']); return r, math.cos(t), math.sin(t)
def px2m(sheet, px, py):
    r, c, s = T(sheet); u, v = px - r['ref_px'][0], py - r['ref_px'][1]
    return (r['ref_m'][0] + (u*c + v*s)/r['sx'], r['ref_m'][1] + (-u*s + v*c)/r['sy'])
def m2px(sheet, x, z):
    r, c, s = T(sheet); up, vp = (x - r['ref_m'][0])*r['sx'], (z - r['ref_m'][1])*r['sy']
    return (r['ref_px'][0] + up*c - vp*s, r['ref_px'][1] + up*s + vp*c)
def frame2global(fr, u, v):
    """fr = (ox, oz, deg): local (u,v) -> global (x,z). deg rotates the local axes clockwise on the drawing (z is down)."""
    ox, oz, d = fr; a = math.radians(d); return (ox + u*math.cos(a) - v*math.sin(a), oz + u*math.sin(a) + v*math.cos(a))
def global2frame(fr, x, z):
    ox, oz, d = fr; a = math.radians(d); dx, dz = x-ox, z-oz; return (dx*math.cos(a) + dz*math.sin(a), -dx*math.sin(a) + dz*math.cos(a))
def sheet_path(sheet): return os.path.join(ROOT, REG[sheet]['png'])
if __name__ == '__main__':
    import sys
    cmd = sys.argv[1]
    if cmd == 'px2m': print('%.3f %.3f' % px2m(sys.argv[2], float(sys.argv[3]), float(sys.argv[4])))
    elif cmd == 'm2px': print('%.1f %.1f' % m2px(sys.argv[2], float(sys.argv[3]), float(sys.argv[4])))
    elif cmd == 'f2g': fr = tuple(map(float, sys.argv[2].split(','))); print('%.3f %.3f' % frame2global(fr, float(sys.argv[3]), float(sys.argv[4])))
    elif cmd == 'g2f': fr = tuple(map(float, sys.argv[2].split(','))); print('%.3f %.3f' % global2frame(fr, float(sys.argv[3]), float(sys.argv[4])))
