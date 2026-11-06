"""Assemble a multi-building walkthrough page from a PROJECT JSON.

usage: python3 studio/tools/build_project.py studio/plans/<project>.json OUT.html [--title "..."]
The page = ERRA panel (studio/src2/body.html + style.css) + the shared engine chunks of house-malkiya-erra.html
(tiers, renderer, materials, furniture builders, openings, kitchens, world, lights, camera tween) + studio/src2/*.js.
"""
import json, os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S2=ROOT+'/studio/src2/'
args=sys.argv[1:]
title='הדמיה'
if '--title' in args:
    k=args.index('--title'); title=args[k+1]; del args[k:k+2]
proj_path, out_path = args[0], args[1]
src=open(ROOT+'/house-malkiya-erra.html').read()
def between(a, b):
    i=src.index(a); j=src.index(b,i); return src[i:j]
P=json.load(open(proj_path))
head=f'''<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;700&family=Inter:wght@400;500&display=swap">
{open(S2+'style.css').read()}
'''
body=open(S2+'body.html').read().replace('%%PROJECT%%', json.dumps(P, ensure_ascii=False, separators=(',',':')))
js=[]
js.append(between('/* ============================== TIERS','/* ============================== RENDERER'))
js.append(between('/* ============================== RENDERER','/* ============================== EXTRA MATERIALS'))
js.append(between('/* ============================== EXTRA MATERIALS','/* ============================== LEVEL BUILD'))
js.append(between('function buildOpening(g, F, o, t, sill, top, inLocal, horiz){','function sidePanels('))
js.append(between('function kitchenRun(p,F,id,o){','function buildKitchens('))
js.append(between('function desk(p,F,x,z,ry,w=1.4)','function buildFurniture('))
js.append(open(S2+'engine2.js').read())
js.append(between('/* ============================== WORLD','(function outdoor(){'))
js.append(between('const hemi = new THREE.HemisphereLight(','/* ============================== STATE / MODES'))
js.append(between('let tween=null;','function applyState(){'))
for f in ['furnish2.js','site2.js','pets2.js','app2.js']: js.append(open(S2+f).read())
out=head+body+'\n'.join(js)
open(out_path,'w').write(out)
print(out_path, len(out))
