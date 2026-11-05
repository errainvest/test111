import json, re
import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
G=ROOT+'/studio/src/'
src=open(ROOT+'/house-malkiya-erra.html').read()
lines=src.split('\n')
def L(a,b): return '\n'.join(lines[a-1:b])+'\n'
def between(a_marker, b_marker):
    i=src.index(a_marker); j=src.index(b_marker,i); return src[i:j]

logo=open(ROOT+'/studio/assets/erra-logo.svg').read().strip().replace('<svg width="74" height="23"','<svg class="logo" width="74" height="23" role="img" aria-label="ERRA"',1)
css=open(G+'erra.css').read().replace('</style>', open(G+'extra.css').read()+'</style>')
head=f'''<title>מחולל הדמיות</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;700&family=Inter:wght@400;500&display=swap">
{css}
'''
sample=json.load(open(ROOT+'/studio/plans/malkiya-12.json'))
body=open(G+'body.html').read().replace('%%LOGO%%',logo).replace('%%SAMPLE%%',json.dumps(sample,ensure_ascii=False))

js=[]
js.append(between('/* ============================== TIERS','/* ============================== RENDERER'))
js.append(open(G+'plan.js').read())
js.append(between('/* ============================== RENDERER','/* ============================== EXTRA MATERIALS'))
js.append(between('/* ============================== EXTRA MATERIALS','function buildFloors(L, rt, g, F){'))
js.append(between('function buildRails(L, rt, g, F){','/* ---------------- slabs, roof, pergola'))
js.append(between('function rectMinus(r, holes){','function buildGroundSlabs('))
js.append(between('function hipRoof(g, mat,','function buildUpperRoof('))
js.append(between('function kitchenRun(p,F,id,o){','function buildKitchens('))
js.append(between('/* ---------------- lighting fixtures','/* ---------------- loose furniture'))
js.append(between('function desk(p,F,x,z,ry,w=1.4)','function buildFurniture('))
js.append(between('/* ============================== WORLD','(function outdoor(){'))
js.append(between('const hemi = new THREE.HemisphereLight(','/* ============================== STATE / MODES'))
js.append(open(G+'build.js').read())
js.append(between('let tween=null;','function applyState(){'))
js.append(open(G+'app.js').read())
js.append(between('/* ============================== WALK CONTROLS','/* ============================== AUTO TOUR'))
js.append(open(G+'gen.js').read())
js.append(between('/* ============================== LOOP','/* ============================== START'))
js.append('''/* ============================== START ============================== */
resize();
new ResizeObserver(()=>{ if(!chk.hidden){ sizeChk(); drawCheck(); } }).observe(view);
loadPlan(JSON.parse(JSON.stringify(SAMPLE)), SAMPLE.floors.map(()=>null));
loadingEl.hidden=true;
requestAnimationFrame(loop);
window.__studio={state,setMode,goRoom,build,setView,camera,loadPlan};
})();
</script>
''')
out=head+body+''.join(js)
# fixes for generic use
out=out.replace("  sky.position.set(C0[0],0,C0[1]); scene.add(sky);","  scene.add(sky);") if False else out
open(ROOT+'/studio/plan-to-3d.html','w').write(out)
print(len(out))
