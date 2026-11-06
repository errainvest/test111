"""Build the ERRA walkthrough page from a PROJECT JSON, using the engine bundled with this skill.

usage: python3 -I build_page.py PROJECT.json OUT.html [--title "..."] [--local-libs]
  --local-libs  inline the Three.js / polygon-clipping libraries instead of loading them from the CDN (bigger file,
                works offline and in headless tests without network; the published artifact should use the CDN)

The page = ERRA panel (engine/src2/body.html + style.css) + shared engine chunks cut from engine/base-engine.html
(tiers, renderer, materials, furniture, openings, kitchens, world, lights, camera tween) + engine/src2/*.js.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ENG = os.path.join(os.path.dirname(HERE), 'engine')
S2 = os.path.join(ENG, 'src2') + os.sep
args = sys.argv[1:]
title = 'הדמיה'; local = False
if '--title' in args:
    k = args.index('--title'); title = args[k+1]; del args[k:k+2]
if '--local-libs' in args:
    args.remove('--local-libs'); local = True
proj_path, out_path = args[0], args[1]
src = open(os.path.join(ENG, 'base-engine.html')).read()
def between(a, b):
    i = src.index(a); j = src.index(b, i); return src[i:j]
P = json.load(open(proj_path))
head = f'''<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;700&family=Inter:wght@400;500&display=swap">
{open(S2 + 'style.css').read()}
'''
body = open(S2 + 'body.html').read().replace('%%PROJECT%%', json.dumps(P, ensure_ascii=False, separators=(',', ':')))
if local:
    LIBS = os.path.join(ENG, 'libs')
    import re
    def inline(m):
        f = m.group(1).split('/')[-1]
        return '<script>\n' + open(os.path.join(LIBS, f)).read() + '\n</script>'
    body = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/[^"]*/([^"/]+)"></script>', inline, body)
js = []
js.append(between('/* ============================== TIERS', '/* ============================== RENDERER'))
js.append(between('/* ============================== RENDERER', '/* ============================== EXTRA MATERIALS'))
js.append(between('/* ============================== EXTRA MATERIALS', '/* ============================== LEVEL BUILD'))
js.append(between('function buildOpening(g, F, o, t, sill, top, inLocal, horiz){', 'function sidePanels('))
js.append(between('function kitchenRun(p,F,id,o){', 'function buildKitchens('))
js.append(between('function desk(p,F,x,z,ry,w=1.4)', 'function buildFurniture('))
js.append(open(S2 + 'engine2.js').read())
js.append(between('/* ============================== WORLD', '(function outdoor(){'))
js.append(between('const hemi = new THREE.HemisphereLight(', '/* ============================== STATE / MODES'))
js.append(between('let tween=null;', 'function applyState(){'))
for f in ['furnish2.js', 'site2.js', 'pets2.js', 'app2.js']: js.append(open(S2 + f).read())
out = head + body + '\n'.join(js)
open(out_path, 'w').write(out)
print(out_path, len(out), 'bytes', '(local libs)' if local else '(CDN libs)')
