/* ============================== STATE / MODES (v2) ============================== */
const state = { mode:'doll', bld:null, view:-1, cur:0, apt:null, furn:true, eve:false, tour:false, plot:true };
let yaw=0, pitch=0, houseRoot=null, APTS=[];
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.08; controls.maxDistance=340; controls.minDistance=2.5;
const BLD = id => BLDS.find(b=>b.id===id);
const R = id => ALLROOMS.find(r=>r.id===id) || ALLOUT.find(r=>r.id===id);
const levelOf = (bld, idx) => { const B_=BLD(bld); return B_ ? B_.levels[idx] : null; };
function disposeTree(o){ o.traverse(n=>{ if(n.geometry) n.geometry.dispose(); }); }
function bboxOf(polys){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(const P of polys) for(const [x,z] of P){ x0=Math.min(x0,x); x1=Math.max(x1,x); z0=Math.min(z0,z); z1=Math.max(z1,z); } return {x0,x1,z0,z1}; }
function NORTH(){ const n=PROJECT.north||[0,-1], l=Math.hypot(n[0],n[1])||1; return [n[0]/l,n[1]/l]; }
function focus(){
  let polys, y=0;
  if (state.apt){ const L=LEVELS[state.apt.L]; polys=[...L.rooms,...L.outdoor].filter(r=>r.apt===state.apt.apt).map(r=>r.poly); y=L.y; }
  else if (state.bld){ const B_=BLD(state.bld); const L=state.view>=0?B_.levels[state.view]:null; polys=(L?[L]:B_.levels).flatMap(q=>[...q.rooms,...q.outdoor.filter(o=>o.kind!=='garden')].map(r=>r.poly)); y=L?L.y:B_.base; }
  else { polys = PLOT ? [PLOT] : LEVELS.flatMap(L=>L.rooms.map(r=>r.poly)); y=0; }
  if (!polys.length) polys=[[[BB.x0,BB.z0],[BB.x1,BB.z1]]];
  const bb=bboxOf(polys); return {c:[(bb.x0+bb.x1)/2,(bb.z0+bb.z1)/2], s:Math.max(8,bb.x1-bb.x0,bb.z1-bb.z0), y};
}
// camera directions are taken relative to north so the default views look at the street-facing south-east corner
function viewDir(){ const [nx,nz]=NORTH(); const sx=-nx, sz=-nz, ex=-nz, ez=nx; const d=[sx*.8+ex*.6, sz*.8+ez*.6], l=Math.hypot(d[0],d[1]); return [d[0]/l,d[1]/l]; }
const PRESETS = {
  doll: () => { const f=focus(), s=f.s, d=viewDir(), k=state.apt?1.0:state.bld?(state.view>=0?1.1:1.35):1.0; return { pos:[f.c[0]+d[0]*s*k, f.y+s*.78*k+4, f.c[1]+d[1]*s*k], tgt:[f.c[0], f.y, f.c[1]] }; },
  plan: () => { const f=focus(), s=f.s; return { pos:[f.c[0], f.y+s*1.35+8, f.c[1]+.01], tgt:[f.c[0], f.y, f.c[1]] }; },
  ext:  () => { const V=PROJECT.views&&PROJECT.views.ext; if (V && (!state.bld || !V.bld || V.bld===state.bld)) return { pos:[V.pos[0], terrainH(V.pos[0],V.pos[1])+(+V.h||14), V.pos[1]], tgt:[V.tgt[0], (state.bld?BLD(state.bld).base:0)+(+V.th||5), V.tgt[1]] };
    const sv=state.apt, sl=state.view; state.apt=null; state.view=-1; const f=focus(); state.apt=sv; state.view=sl; const s=Math.max(f.s,16), d0=viewDir(), by=state.bld?BLD(state.bld).base:0, dist=s*1.25;
    // look from the default corner, or turn until no other building stands in the way
    const others=FOOTS.filter(q=>!state.bld||q.bld!==state.bld);
    let d=d0;
    for (const k of [0,1,-1,2,-2,3,-3,4]){ const a=k*Math.PI/4, c=Math.cos(a), sn=Math.sin(a), dd=[d0[0]*c-d0[1]*sn, d0[0]*sn+d0[1]*c];
      let clear=true; for (let t=.25;t<=1;t+=.05){ const x=f.c[0]+dd[0]*dist*t, z=f.c[1]+dd[1]*dist*t; if (others.some(q=>inPoly(q.poly,x,z))) { clear=false; break; } }
      if (clear){ d=dd; break; } }
    const x=f.c[0]+d[0]*dist, z=f.c[1]+d[1]*dist; return { pos:[x, Math.max(terrainH(x,z)+1.8, by+2)+s*.06, z], tgt:[f.c[0], by+5.5, f.c[1]] }; },
};
const POOL=[]; for (let i=0;i<10;i++){ const l=new THREE.PointLight(0xffd6a6,0,6,2); l.visible=false; scene.add(l); POOL.push(l); }
let poolKey='';
function placePool(Li, near){
  const L=LEVELS[Li]; if(!L) return; const key=Li+'|'+(near?near.id:'')+'|'+TIER; if(key===poolKey) return; poolKey=key;
  const k = TIER==='lux'?1.25 : TIER==='pre'?1.05 : .9;
  let rs=L.rooms.filter(r=>r.kind!=='shaft'&&r.kind!=='stair'&&area(r)>=2.5);
  if (near) rs.sort((a,b)=>Math.hypot(a.cent[0]-near.cent[0],a.cent[1]-near.cent[1])-Math.hypot(b.cent[0]-near.cent[0],b.cent[1]-near.cent[1]));
  else if (state.apt) rs.sort((a,b)=>((b.apt===state.apt.apt)-(a.apt===state.apt.apt)) || area(b)-area(a));
  else rs.sort((a,b)=>area(b)-area(a));
  POOL.forEach((l,i)=>{ const r=rs[i]; if(!r){ l.intensity=0; return; } const a=area(r); l.intensity=k*(a<8?.6:.85); l.distance=Math.max(5,Math.sqrt(a)*2.3); l.position.set(r.cent[0], L.y+L.H-.35, r.cent[1]); });
}
function cutLevel(){ if (!(state.mode==='doll'||state.mode==='plan') || !state.bld || state.view<0) return null; return levelOf(state.bld, state.view); }
function applyState(){
  if (!houseRoot) return;
  const CL=cutLevel();
  LV.forEach((rt,i)=>{ const L=LEVELS[i]; let above=false, atV=false;
    if (CL && L.bld===CL.bld){ above=L.idx>CL.idx; atV=L.idx===CL.idx; }
    rt.root.visible=!above; rt.slab.visible=!atV; rt.fix.visible=!atV; rt.furn.visible=state.furn; rt.glow.visible=state.eve; });
  const litLi = state.mode==='walk' ? state.cur : CL ? LEVELS.indexOf(CL) : -1, e=state.eve;
  POOL.forEach(l=>l.visible = e && litLi>=0);
  if (e && litLi>=0) placePool(litLi, state.mode==='walk' ? R(currentRoomId) : null);
  plotHi.visible = state.plot;
  const under = !!(CL && CL.below); if (TERRAIN) TERRAIN.visible=!under; ground.visible=!under;
  const [nx,nz]=NORTH(), sx=-nx, sz=-nz, wx=nz, wz=-nx, sd=[sx*.82+wx*.57, sz*.82+wz*.57], D=110;
  sun.intensity = e ? .07 : 1.75; sun.color.set(e ? 0x9fb4ff : 0xfff2e0);
  const el = e ? .9 : .95;
  sun.position.set(PCEN[0]+sd[0]*D*Math.cos(el), D*Math.sin(el), PCEN[1]+sd[1]*D*Math.cos(el)); sun.target.position.set(PCEN[0],0,PCEN[1]);
  hemi.intensity = e ? .03 : .34;
  skyU.top.value.set(e?'#0b1426':'#5f8fc8').convertLinearToSRGB(); skyU.mid.value.set(e?'#33405e':'#d9e6ef').convertLinearToSRGB(); skyU.bot.value.set(e?'#151a20':'#b9c2b4').convertLinearToSRGB();
  scene.fog = new THREE.Fog(e?'#262f42':'#d4dfe6', 140, 420);
  renderer.toneMappingExposure = e ? 1.0 : 1.0;
  [...MATS,...GMATS].forEach(m=>{ m.envMapIntensity = (m.userData.env||1) * (e ? .07 : .5); });
  EMIT.forEach(o=>{ o.m.emissiveIntensity = e ? o.night : o.day; }); GEMIT.forEach(o=>{ o.m.emissiveIntensity = e ? o.night : o.day; });
  updateUI();
}
function setMode(m){
  if (m!=='walk') stopTour();
  state.mode=m; controls.enabled = m!=='walk'; controls.enableRotate = m!=='plan'; controls.screenSpacePanning=true;
  controls.mouseButtons = { LEFT: m==='plan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN };
  controls.touches = { ONE: m==='plan'?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN };
  controls.maxPolarAngle = m==='ext' ? 1.5 : 1.38;
  if (m==='walk'){ const r=R(currentRoomId) || firstRoom(); if (r) goRoom(r.id); }
  else { camera.up.set(0,1,0); const p=PRESETS[m](); flyTo(p.pos,p.tgt); }
  camera.fov = m==='walk'? 68 : m==='plan'? 38 : 50; camera.updateProjectionMatrix();
  applyState();
}
function refly(){ if (state.mode==='walk'){ const r=firstRoom(); if(r) goRoom(r.id); return; } if (state.mode==='ext') setMode('doll'); else { const p=PRESETS[state.mode](); flyTo(p.pos,p.tgt); applyState(); } }
function firstRoom(){
  const pool = state.apt ? LEVELS[state.apt.L].rooms.filter(r=>r.apt===state.apt.apt) : state.bld ? (levelOf(state.bld, Math.max(0,state.view))||{rooms:[]}).rooms : ALLROOMS;
  return pool.find(r=>r.nav && r.kind==='living') || pool.find(r=>r.nav && r.type!=='balcony') || pool.find(r=>r.nav);
}
function selectBld(id){ state.bld=id; state.view=-1; state.apt=null; renderNav(); refly(); }
function selectFloor(idx){ state.view=idx; state.apt=null; renderNav(); if(state.mode==='walk'){ const r=firstRoom(); if(r) goRoom(r.id); } else refly(); }
function selectApt(a){ state.bld=a.bld; state.view=LEVELS[a.L].idx; state.apt={L:a.L, apt:a.apt}; renderNav(); if(state.mode==='walk'){ const r=firstRoom(); if(r) goRoom(r.id); } else { if(state.mode==='ext') state.mode='doll'; setMode(state.mode); } }
let currentRoomId=null;
function goRoom(id, dur){
  const r=R(id); if(!r) return; currentRoomId=id; state.cur=r.L; const L=LEVELS[r.L];
  state.mode='walk'; controls.enabled=false; camera.up.set(0,1,0);
  const y=L.y+(r.dy||0), pos=[r.cam[0],y+EYE,r.cam[1]], dd=Math.hypot(r.cam[2]-r.cam[0],r.cam[3]-r.cam[1]), tgt=[r.cam[2],y+(dd>2?1.2:1.45),r.cam[3]];
  flyTo(pos,tgt,reduceMotion?1:(dur||1300),()=>{ setYawPitchFrom(new THREE.Vector3(...pos),new THREE.Vector3(...tgt)); });
  camera.fov=68; camera.updateProjectionMatrix(); applyState();
}

/* ============================== WALK ============================== */
const keys={};
addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT') return; keys[e.code]=true; if(state.mode==='walk' && e.code.startsWith('Arrow')) e.preventDefault(); if(state.tour) stopTour(); });
addEventListener('keyup',e=>{ keys[e.code]=false; });
let drag=null, autoTarget=null;
const cvs=renderer.domElement;
cvs.addEventListener('pointerdown',e=>{ if(state.mode!=='walk') return; if(state.tour) stopTour(); drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:0}; cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener('pointermove',e=>{ if(!drag||state.mode!=='walk'||tween) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.moved+=Math.abs(dx)+Math.abs(dy); drag.x=e.clientX; drag.y=e.clientY;
  const k = e.pointerType==='touch' ? .006 : .0042; yaw += dx*k; pitch = THREE.MathUtils.clamp(pitch + dy*k, -1.2, 1.2); });
cvs.addEventListener('pointerup',e=>{ if(!drag) return; const click = drag.moved<6 && performance.now()-drag.t<400; drag=null;
  if (click && state.mode==='walk'){ const hit=pick(e); if(hit) autoTarget=new THREE.Vector2(hit.x,hit.z); } });
const ray=new THREE.Raycaster();
function pick(e){
  const rc=cvs.getBoundingClientRect(); const v=new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1, -((e.clientY-rc.top)/rc.height)*2+1);
  ray.setFromCamera(v,camera); const fl=[...LV[state.cur].floors]; if (LEVELS[state.cur].ground && TERRAIN) fl.push(TERRAIN);
  const hits=ray.intersectObjects([houseRoot, siteRoot],true);
  const h=hits.find(h=>fl.includes(h.object)); if(!h) return null;
  const blocker=hits[0]; if(blocker && blocker.distance < h.distance-.05 && !fl.includes(blocker.object)) return null;
  return h.point;
}
const joy=document.getElementById('joy'), knob=document.getElementById('joyKnob'); let jv={x:0,y:0}, jid=null;
joy.addEventListener('pointerdown',e=>{ jid=e.pointerId; joy.setPointerCapture(jid); moveJoy(e); if(state.tour) stopTour(); });
joy.addEventListener('pointermove',e=>{ if(e.pointerId===jid) moveJoy(e); });
const endJoy=()=>{ jid=null; jv={x:0,y:0}; knob.style.transform=''; };
joy.addEventListener('pointerup',endJoy); joy.addEventListener('pointercancel',endJoy);
function moveJoy(e){ const r=joy.getBoundingClientRect(); let x=(e.clientX-r.left-r.width/2)/(r.width/2), y=(e.clientY-r.top-r.height/2)/(r.height/2); const l=Math.hypot(x,y); if(l>1){x/=l;y/=l;} jv={x,y}; knob.style.transform=`translate(${x*36}px,${y*36}px)`; }
function collide(p, Li){
  const rad=.24, cols=LV[Li].colliders;
  for (let it=0; it<3; it++) for (const c of cols){
    const q=segPoint(p.x,p.z,c.a[0],c.a[1],c.b[0],c.b[1]), m=rad+(c.r||0);
    if (q.d<m && q.d>1e-6){ const k=(m-q.d)/q.d; p.x+=(p.x-q.cx)*k; p.z+=(p.z-q.cz)*k; }
  }
}
// where can one stand: a room or balcony of this level, or (on a ground floor) another building's ground floor or the open site
function spotAt(Li, x, z){
  const L=LEVELS[Li]; const r=roomAtL(L,x,z,true);
  if (r && !r.detail && r.type!=='balcony') return null;
  if (r) return {Li, y:L.y+(r.dy||0), room:r};
  if (L.ground){
    for (let j=0;j<LEVELS.length;j++){ const M_=LEVELS[j]; if (!M_.ground||j===Li) continue; const r2=roomAtL(M_,x,z,true); if (r2 && !r2.detail && r2.type!=='balcony') return null; if (r2) return {Li:j, y:M_.y+(r2.dy||0), room:r2}; }
    if (FOOTS.some(f=>inPoly(f.poly,x,z))) return L.detail ? {Li, y:L.y, room:null} : null;
    if (TERR_BB && x>TERR_BB.x0+8 && x<TERR_BB.x1-8 && z>TERR_BB.z0+8 && z<TERR_BB.z1-8) return {Li, y:terrainH(x,z), room:null, out:true};
    return null;
  }
  if (L.rooms.some(q=>polyDist(q.poly,x,z)<.35) || L.outdoor.some(q=>polyDist(q.poly,x,z)<.3)) return {Li, y:L.y, room:null};
  return null;
}
function walkStep(dt){
  const sp = (keys.ShiftLeft||keys.ShiftRight) ? 3.4 : 1.7;
  let f=0,s=0;
  if(keys.KeyW||keys.ArrowUp) f+=1; if(keys.KeyS||keys.ArrowDown) f-=1;
  if(keys.KeyD) s+=1; if(keys.KeyA) s-=1;
  if(keys.ArrowLeft) yaw+=1.8*dt; if(keys.ArrowRight) yaw-=1.8*dt;
  f += -jv.y; s += jv.x;
  const p=camera.position, ox=p.x, oz=p.z;
  const fw=new THREE.Vector2(-Math.sin(yaw),-Math.cos(yaw)), rt=new THREE.Vector2(Math.cos(yaw),-Math.sin(yaw));
  if (f||s){ autoTarget=null; p.x += (fw.x*f+rt.x*s)*sp*dt; p.z += (fw.y*f+rt.y*s)*sp*dt; }
  else if (autoTarget){ const dx=autoTarget.x-p.x, dz=autoTarget.y-p.z, d=Math.hypot(dx,dz);
    if (d<.12) autoTarget=null; else { const st=Math.min(d,sp*dt); p.x+=dx/d*st; p.z+=dz/d*st; } }
  collide(p,state.cur);
  let spot=spotAt(state.cur,p.x,p.z);
  if (!spot){ p.x=ox; p.z=oz; autoTarget=null; spot=spotAt(state.cur,p.x,p.z); }
  else if (autoTarget && Math.hypot(p.x-ox,p.z-oz)<1e-4) autoTarget=null;
  if (spot && spot.Li!==state.cur){ state.cur=spot.Li; applyState(); }
  const ty=(spot?spot.y:LEVELS[state.cur].y)+EYE; p.y += (ty-p.y)*Math.min(1,dt*9);
  camera.rotation.set(pitch,yaw,0,'YXZ');
}

/* ============================== AUTO TOUR ============================== */
let tourI=0, tourTimer=null;
const tourBtn=document.getElementById('tourBtn');
function tourList(){ const pool = state.apt ? LEVELS[state.apt.L].rooms.filter(r=>r.apt===state.apt.apt) : state.bld ? BLD(state.bld).levels.flatMap(L=>L.rooms) : ALLROOMS; return pool.filter(r=>r.nav && r.kind!=='lobby'); }
function startTour(){ state.tour=true; tourI=0; tourBtn.setAttribute('aria-pressed','true'); tourBtn.textContent='■ עצירת הסיור'; tourNext(); }
function stopTour(){ if(!state.tour) return; state.tour=false; clearTimeout(tourTimer); tourBtn.setAttribute('aria-pressed','false'); tourBtn.textContent=TOUR_LABEL(); }
function tourNext(){ if(!state.tour) return; const list=tourList(); if(!list.length) return; const r=list[tourI%list.length]; tourI++; goRoom(r.id, 2200); tourTimer=setTimeout(tourNext, 5200); }
const TOUR_LABEL = () => state.apt ? 'סיור אוטומטי בדירה' : state.bld ? 'סיור אוטומטי בבניין' : 'סיור אוטומטי בפרויקט';
tourBtn.addEventListener('click',()=> state.tour? stopTour() : startTour());

/* ============================== PANEL ============================== */
const tiersEl=document.getElementById('tiers');
TIER_ORDER.forEach(id=>{
  const t=TIERS[id]; const b=document.createElement('button'); b.className='tier'; b.id='tier-'+id; b.dataset.tier=id;
  b.innerHTML=`<span class="sw" style="background:${t.swatch}"></span><span class="nm"><span class="num">0${TIER_ORDER.indexOf(id)+1}</span>${t.name}</span><span class="tg">${t.tag}</span>`;
  b.addEventListener('click',()=>{ if(TIER===id) return; TIER=id; poolKey=''; showLoading(()=>build(id)); });
  tiersEl.appendChild(b);
});
const bldSeg=document.getElementById('bldSeg'), levelSeg=document.getElementById('levelSeg'), aptEl=document.getElementById('apts'), roomsEl=document.getElementById('rooms'), roomsSec=document.getElementById('roomsSec');
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function segBtn(parent, label, pressed, fn){ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.setAttribute('aria-pressed',String(pressed)); b.addEventListener('click',()=>{ stopTour(); fn(); }); parent.appendChild(b); return b; }
function computeApts(){
  APTS=[];
  LEVELS.forEach((L,Li)=>{ const ids=[...new Set(L.rooms.filter(r=>r.detail).map(r=>r.apt).filter(a=>a && a!=='common'))];
    for (const apt of ids){ const rs=L.rooms.filter(r=>r.apt===apt), ins=rs.filter(r=>r.type!=='balcony'&&r.kind!=='shaft');
      const nR=(rs.some(r=>r.kind==='living')?1:0)+rs.filter(r=>['bed','master','kids','office','mamad'].includes(r.kind)).length;
      const meta=(PROJECT.apartments||[]).find(a=>String(a.apt)===String(apt) && (!a.building||a.building===L.bld));
      APTS.push({bld:L.bld, L:Li, apt, rooms:rs, nRooms:meta&&meta.rooms||nR, area:meta&&meta.main_area||Math.round(ins.reduce((s,r)=>s+area(r),0)), official:!!(meta&&meta.main_area),
        outdoor:L.outdoor.filter(o=>o.apt===apt), cent:polyCentroid(mpUnion(ins.map(r=>r.poly))[0]?.[0]||rs[0].poly)}); }
  });
  APTS.sort((a,b)=>(a.bld<b.bld?-1:a.bld>b.bld?1:0) || (+a.apt||0)-(+b.apt||0));
}
function renderNav(){
  bldSeg.textContent=''; levelSeg.textContent=''; aptEl.textContent=''; roomsEl.textContent='';
  bldSeg.style.gridTemplateColumns=`repeat(${BLDS.length+1},1fr)`;
  segBtn(bldSeg,'כל הפרויקט',!state.bld,()=>selectBld(null));
  for (const B_ of BLDS) segBtn(bldSeg,B_.name,state.bld===B_.id,()=>selectBld(B_.id));
  levelSeg.hidden=!state.bld;
  if (state.bld){ const B_=BLD(state.bld); const n=B_.levels.length+1; levelSeg.style.gridTemplateColumns=`repeat(${Math.min(n,4)},1fr)`;
    segBtn(levelSeg,'כל הבניין',state.view<0,()=>selectFloor(-1)); B_.levels.forEach((L,i)=>{ if (L.detail) segBtn(levelSeg,L.name,state.view===i,()=>selectFloor(i)); });
    if (levelSeg.children.length<2) levelSeg.hidden=true; else levelSeg.style.gridTemplateColumns=`repeat(${Math.min(levelSeg.children.length,4)},1fr)`; }
  const list=APTS.filter(a=>(!state.bld||a.bld===state.bld) && (state.view<0||!state.bld||LEVELS[a.L].idx===state.view));
  let lastH='';
  for (const a of list){
    const L=LEVELS[a.L], h=`${L.bldName} · ${L.name}`;
    if (h!==lastH){ const d=document.createElement('div'); d.className='rooms-h'; d.textContent=h; aptEl.appendChild(d); lastH=h; }
    const b=document.createElement('button'); b.type='button'; b.className='apt'; b.setAttribute('aria-pressed',String(!!(state.apt&&state.apt.L===a.L&&state.apt.apt===a.apt)));
    b.innerHTML=`<span class="an">דירה ${esc(a.apt)}</span><span class="am">${a.nRooms} חד׳ · ${a.area} מ״ר${a.official?'':'*'}</span>`;
    b.addEventListener('click',()=>{ stopTour(); selectApt(a); }); aptEl.appendChild(b);
  }
  if (!list.length){ const p=document.createElement('p'); p.className='lbl-note'; p.textContent='אין דירות בקומה הזו (לובי, חניה או גג).'; aptEl.appendChild(p); }
  roomsSec.hidden=!state.apt;
  if (state.apt){ const L=LEVELS[state.apt.L];
    const rs=[...L.rooms.filter(r=>r.apt===state.apt.apt && r.nav), ...L.outdoor.filter(o=>o.apt===state.apt.apt)];
    for (const r of rs){ const b=document.createElement('button'); b.type='button'; b.textContent=r.name; b.id='room-'+r.id;
      if (!R(r.id)) b.disabled=true; b.addEventListener('click',()=>{ stopTour(); goRoom(r.id); }); roomsEl.appendChild(b); } }
  tourBtn.textContent = state.tour ? '■ עצירת הסיור' : TOUR_LABEL();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{ state.eve = b.dataset.time==='eve'; applyState(); }));
document.getElementById('furn').addEventListener('change',e=>{ state.furn=e.target.checked; applyState(); });
document.getElementById('plotT').addEventListener('change',e=>{ state.plot=e.target.checked; applyState(); });
const floorBtn=document.getElementById('floorBtn');
floorBtn.addEventListener('click',()=>{ stopTour(); const L=LEVELS[state.cur], B_=BLD(L.bld), dl=B_.levels.filter(q=>q.detail); if (dl.length<2) return; const n=dl[(dl.indexOf(L)+1)%dl.length];
  state.bld=L.bld; state.view=n.idx; state.apt=null;
  const r=n.rooms.find(r=>r.nav && r.kind==='lobby') || n.rooms.find(r=>r.nav && r.type!=='balcony') || n.rooms.find(r=>r.nav); renderNav(); if(r) goRoom(r.id); });
const HINTS = {
  doll:'גררו כדי לסובב · גלגלת או צביטה לזום · בחרו בניין וקומה כדי לראות אותה בחתך',
  plan:'תוכנית מלמעלה · גררו להזזה · גלגלת לזום · בחרו קומה כדי לראות אותה',
  ext:'מבט חוץ · גררו כדי להקיף את הבניינים',
  walk: isTouch ? 'גררו על המסך כדי להסתכל · ג׳ויסטיק להליכה · נגיעה ברצפה = הליכה לנקודה' : 'גררו כדי להסתכל · W A S D או חיצים להליכה · Shift מהר יותר · לחיצה על הרצפה = הליכה לנקודה',
};
function updateUI(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.mode===state.mode)));
  document.querySelectorAll('[data-time]').forEach(b=>b.setAttribute('aria-pressed', String((b.dataset.time==='eve')===state.eve)));
  TIER_ORDER.forEach(id=>document.getElementById('tier-'+id).setAttribute('aria-pressed',String(id===TIER)));
  const t=TIERS[TIER];
  document.getElementById('furnNote').textContent = state.furn ? t.furnDesc : 'דירות ריקות: גמר, מטבחים וכלים סניטריים';
  document.getElementById('spec').innerHTML = t.spec.filter(([k])=>k!=='מדרגות').map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('') + (PROJECT.facade?`<dt>חזיתות</dt><dd>${esc(PROJECT.facade)}</dd>`:'');
  document.getElementById('hint').textContent = HINTS[state.mode];
  document.getElementById('joy').hidden = !(isTouch && state.mode==='walk');
  const L=LEVELS[state.cur], B_=L&&BLD(L.bld);
  const dl = B_ ? B_.levels.filter(q=>q.detail) : [];
  floorBtn.hidden = state.mode!=='walk' || dl.length<2;
  if (dl.length>1 && dl.includes(L)){ const n=dl[(dl.indexOf(L)+1)%dl.length]; floorBtn.textContent = (n.idx>L.idx?'▲ ':'▼ ')+n.name; }
  roomsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('on', state.mode==='walk' && b.id==='room-'+currentRoomId));
}
const loadingEl=document.getElementById('loading');
function showLoading(fn){ loadingEl.hidden=false; requestAnimationFrame(()=>requestAnimationFrame(()=>{ try{ fn(); } finally { loadingEl.hidden=true; } })); }

/* ---------------- labels ---------------- */
const labelsEl=document.getElementById('labels');
let LBL=[], PL=[], BL=[];
function renderLabels(){
  labelsEl.textContent=''; LBL=[]; PL=[]; BL=[];
  const add=(arr,html,v,cls,extra)=>{ const d=document.createElement('div'); d.className='rl '+(cls||''); d.innerHTML=html; labelsEl.appendChild(d); arr.push({d,v,...extra}); };
  for (const r of ALLROOMS){ if (r.kind==='shaft' || area(r)<2.2 || !r.detail) continue; const L=LEVELS[r.L]; add(LBL,`${esc(r.name)}<small>${area(r).toFixed(1)} מ״ר</small>`,new THREE.Vector3(r.cent[0],L.y+.2,r.cent[1]),'',{r}); }
  for (const a of APTS){ const L=LEVELS[a.L]; add(LBL,`דירה ${esc(a.apt)}`,new THREE.Vector3(a.cent[0],L.y+1.2,a.cent[1]),'apt-l',{apt:a}); }
  for (const B_ of BLDS){ const top=B_.levels[B_.levels.length-1]; if(!top) continue; const mp=mpUnion((B_.levels.find(L=>L.ground)||B_.levels[0]).rooms.map(r=>r.poly)); const c=mp.length?polyCentroid(mp[0][0]):[0,0];
    const nApt=new Set(B_.levels.flatMap(L=>L.rooms.filter(r=>r.apt&&r.apt!=='common').map(r=>L.idx+'|'+r.apt))).size;
    add(BL,`${esc(B_.name)}<small>${B_.levels.filter(L=>!L.below).length} קומות · ${nApt} דירות</small>`,new THREE.Vector3(c[0],top.y+top.floorH+3.2,c[1]),'bld-l',{b:B_}); }
  if (PLOT){ for (let i=0;i<PLOT.length;i++){ const a=PLOT[i], b=PLOT[(i+1)%PLOT.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if (l<6) continue; const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
      add(PL,`${l.toFixed(1)} מ׳`,new THREE.Vector3(mx,terrainH(mx,mz)+.35,mz),'pl-b'); } }
  const A=PLOT?Math.round(Math.abs(polyArea(PLOT))):0;
  document.getElementById('plotRow').hidden=!PLOT;
  document.getElementById('plotNote').textContent = PLOT ? `מגרש בשטח ${(PROJECT.site&&PROJECT.site.plot_area)||A} מ״ר`+((PROJECT.site&&PROJECT.site.building_lines&&PROJECT.site.building_lines.length)?' · קווי בניין מקווקווים':'') : '';
}
const _v=new THREE.Vector3();
function placeLbl(L, w0, h0, lim=1.05){ _v.copy(L.v).project(camera); const vis=_v.z<1 && Math.abs(_v.x)<lim && Math.abs(_v.y)<lim; L.d.style.display=vis?'':'none'; if(vis){ L.d.style.left=((_v.x+1)/2*w0)+'px'; L.d.style.top=((1-_v.y)/2*h0)+'px'; } }
function updateLabels(){
  const w0=view.clientWidth, h0=view.clientHeight, CL=cutLevel(), over=state.mode==='doll'||state.mode==='plan';
  const showP = state.plot && state.mode!=='walk' && !CL;
  for (const L of PL){ if(!showP){ L.d.style.display='none'; continue; } placeLbl(L,w0,h0); }
  for (const L of BL){ if(!over || CL || state.mode==='walk'){ L.d.style.display='none'; continue; } placeLbl(L,w0,h0); }
  for (const L of LBL){
    const r=L.r, a=L.apt, Li=r?r.L:a.L;
    const ok = over && CL && LEVELS[Li]===CL && (r ? (state.apt && r.apt===state.apt.apt) : !state.apt);
    if(!ok){ L.d.style.display='none'; continue; } placeLbl(L,w0,h0,1.1);
  }
  labelsEl.hidden=false;
}

/* ---------------- minimap ---------------- */
const mini=document.getElementById('mini'), mx=mini.getContext('2d'), MP=16;
let MB={x0:0,x1:10,z0:0,z1:10};
function miniBounds(){ const polys = PLOT ? [PLOT] : LEVELS.flatMap(L=>L.rooms.map(r=>r.poly)); const b=bboxOf(polys); MB={x0:b.x0-3,x1:b.x1+3,z0:b.z0-3,z1:b.z1+3}; }
function mm(){ const Wd=mini.width, Hh=mini.height; const s=Math.min((Wd-2*MP)/(MB.x1-MB.x0),(Hh-2*MP)/(MB.z1-MB.z0)); const ox=(Wd-s*(MB.x1-MB.x0))/2, oy=(Hh-s*(MB.z1-MB.z0))/2; return {s,ox,oy}; }
function toMini(x,z){ const {s,ox,oy}=mm(); return [ox+(x-MB.x0)*s, oy+(z-MB.z0)*s]; }
function fromMini(px,py){ const {s,ox,oy}=mm(); return [MB.x0+(px-ox)/s, MB.z0+(py-oy)/s]; }
function miniLevel(){ if (state.mode==='walk') return state.cur; const CL=cutLevel(); if (CL) return LEVELS.indexOf(CL); return -1; }
function pathPoly(P){ mx.beginPath(); P.forEach((q,i)=>{ const [a,b]=toMini(q[0],q[1]); i?mx.lineTo(a,b):mx.moveTo(a,b); }); mx.closePath(); }
function drawMini(){
  const Wd=mini.width, Hh=mini.height; mx.clearRect(0,0,Wd,Hh);
  if (PLOT && state.plot){ pathPoly(PLOT); mx.fillStyle='#eef1e8'; mx.fill(); mx.strokeStyle='#ff4d1a'; mx.lineWidth=2.5; mx.stroke(); }
  for (const p of (SITE.parking||[])) if (p.poly){ pathPoly(p.poly); mx.fillStyle='#d6d4cf'; mx.fill(); }
  for (const B_ of BLDS){ const L0=B_.levels.find(L=>L.ground)||B_.levels[0]; if(!L0) continue; for (const r of L0.rooms){ pathPoly(r.poly); mx.fillStyle='#d9d5cc'; mx.fill(); } }
  const Li=miniLevel(), L=LEVELS[Li], rt=LV[Li];
  if (L && rt){
    for (const r of [...L.rooms, ...L.outdoor]){ pathPoly(r.poly); mx.fillStyle = r.id===currentRoomId && state.mode==='walk' ? '#dce8fb' : (state.apt && r.apt===state.apt.apt && Li===state.apt.L) ? '#e6eefb' : r.type==='wet'?'#dbe6ea': r.type==='balcony'?'#dfe8d6':'#f6f4ef'; mx.fill(); }
    mx.strokeStyle='#2a2f31'; mx.lineCap='square';
    for (const w of L.walls){ if (!w.exterior && !wallNearDetail(L,w)) continue; const [a,b]=toMini(...w.a), [c,d]=toMini(...w.b); mx.lineWidth=w.t>.2?2.6:1.4; mx.beginPath(); mx.moveTo(a,b); mx.lineTo(c,d); mx.stroke(); }
    for (const o of rt.open){ mx.strokeStyle=o.win?'#7aa0b8':'#f6f4ef'; mx.lineWidth=o.win?2:3.2; const [a,b]=toMini(o.ax,o.az), [c,d]=toMini(o.bx,o.bz); mx.beginPath(); mx.moveTo(a,b); mx.lineTo(c,d); mx.stroke(); }
  }
  const p=camera.position, [px,py]=toMini(p.x,p.z);
  if (state.mode==='walk'){ const fx=-Math.sin(yaw), fz=-Math.cos(yaw), ang=Math.atan2(fz,fx);
    mx.fillStyle='rgba(0,80,201,.28)'; mx.beginPath(); mx.moveTo(px,py); mx.arc(px,py,30,ang-.55,ang+.55); mx.closePath(); mx.fill();
    mx.fillStyle='#0050c9'; mx.beginPath(); mx.arc(px,py,5.5,0,7); mx.fill(); mx.strokeStyle='#fff'; mx.lineWidth=2; mx.stroke(); }
  // north arrow
  const [nx,nz]=NORTH(), ax=Wd-22, ay=40; mx.save(); mx.translate(ax,ay); mx.rotate(Math.atan2(nx,-nz)); mx.fillStyle='#1f1f1f'; mx.beginPath(); mx.moveTo(0,-13); mx.lineTo(6,7); mx.lineTo(0,3); mx.lineTo(-6,7); mx.closePath(); mx.fill(); mx.restore();
  mx.fillStyle='#1f1f1f'; mx.font='700 13px Arimo, Arial'; mx.textAlign='center'; mx.fillText('צ',ax,ay+24);
  mx.font='700 17px Arimo, Arial'; mx.textAlign='right'; mx.fillText(L ? `${L.bldName} · ${L.name}` : 'תוכנית מגרש', Wd-44, 24);
}
mini.addEventListener('click',e=>{
  const rc=mini.getBoundingClientRect(); const [x,z]=fromMini((e.clientX-rc.left)*mini.width/rc.width,(e.clientY-rc.top)*mini.height/rc.height);
  let Li=miniLevel(); if (Li<0){ Li=LEVELS.findIndex(L=>L.ground && roomAtL(L,x,z,true)); if (Li<0) Li=LEVELS.findIndex(L=>L.ground); }
  const sp=spotAt(Li,x,z); if(!sp) return;
  stopTour(); state.mode='walk'; controls.enabled=false; camera.up.set(0,1,0); state.cur=sp.Li; if (sp.room) currentRoomId=sp.room.id;
  const p=new THREE.Vector3(x,sp.y+EYE,z); collide(p,sp.Li);
  const look = sp.room ? new THREE.Vector3(sp.room.cent[0]+(sp.room.cent[0]-x)*.5+.01, sp.y+1.3, sp.room.cent[1]+(sp.room.cent[1]-z)*.5+.01) : new THREE.Vector3(PCEN[0], sp.y+3, PCEN[1]);
  flyTo([p.x,p.y,p.z],[look.x,look.y,look.z],900,()=>setYawPitchFrom(p,look));
  camera.fov=68; camera.updateProjectionMatrix(); applyState();
});

/* ============================== BUILD ============================== */
const GLOW=[0,1,2].map(i=>new THREE.MeshBasicMaterial({color:new THREE.Color(['#ffd29a','#ffe2b8','#f5c27e'][i]).multiplyScalar([2.4,1.9,1.5][i])}));
function buildGlow(L, rt){
  for (const w of L.walls){ for (const op of w.open){ if (op.type!=='window' && op.type!=='slider') continue;
    const cx=w.a[0]+w.u[0]*op.c, cz=w.a[1]+w.u[1]*op.c, d=w.t/2+.18;
    const rp=roomAtL(L,cx+w.n[0]*d,cz+w.n[1]*d,false), rn=roomAtL(L,cx-w.n[0]*d,cz-w.n[1]*d,false);
    if (!!rp===!!rn) continue; const sg=rp?1:-1, h=(Math.floor(cx*13.7+cz*7.3+L.idx*5)%997+997)%997, room=rp||rn;
    if (!room.detail){ const cu=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.2,op.w-.08),Math.max(.2,op.h-.06)),CURTAIN[h%3]);
      cu.position.set(cx+w.n[0]*sg*(w.t/2+.09),(op.sill||0)+op.h/2,cz+w.n[1]*sg*(w.t/2+.09)); cu.rotation.y=Math.atan2(-w.n[0]*sg,-w.n[1]*sg); cu.receiveShadow=true; rt.struct.add(cu); }
    if (h%10<3) continue;
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.2,op.w-.12),Math.max(.2,op.h-.12)),GLOW[h%3]);
    pl.position.set(cx+w.n[0]*sg*(w.t/2+.05),(op.sill||0)+op.h/2,cz+w.n[1]*sg*(w.t/2+.05)); pl.rotation.y=Math.atan2(-w.n[0]*sg,-w.n[1]*sg); rt.glow.add(pl); } }
}
function wallNearDetail(L, w){
  // interior walls are built only where they bound a room that is shown in detail
  const mx=(w.a[0]+w.b[0])/2, mz=(w.a[1]+w.b[1])/2, d=w.t/2+.18;
  for (const t of [.2,.5,.8]){ const px=w.a[0]+w.u[0]*w.len*t, pz=w.a[1]+w.u[1]*w.len*t;
    for (const sg of [1,-1]){ const r=roomAtL(L,px+w.n[0]*d*sg,pz+w.n[1]*d*sg,false); if (r && r.detail) return true; } }
  return false;
}
const curtainTex = (key, base, kind) => ctex(key,256,(x,N)=>{ x.fillStyle=base; x.fillRect(0,0,N,N);
  if (kind==='blind'){ for(let y=0;y<N;y+=8){ x.fillStyle='rgba(0,0,0,.10)'; x.fillRect(0,y+6,N,2); x.fillStyle='rgba(255,255,255,.10)'; x.fillRect(0,y,N,2); } }
  else { for(let i=0;i<N;i++){ const v=Math.sin(i/N*Math.PI*2*9)*.5+.5; x.fillStyle=`rgba(0,0,0,${.03+v*.11})`; x.fillRect(i,0,1,N); } }
  fine(x,N,6,77); },[1,1]);
const CURTAIN=[M({map:curtainTex('cur1','#efe9df','fold'), roughness:.95},true), M({map:curtainTex('cur2','#ddd2bf','fold'), roughness:.95},true), M({map:curtainTex('cur3','#cfcfcb','blind'), roughness:.8},true)];
const capM = M({color:'#e4e1db', roughness:.95}, true);
// aluminium chevron louvres that screen the AC / laundry niches (detail "אלמנט המסתור": profiles 11.5 cm with 3 cm gaps, 195 cm high)
const louvreM = M({map:ctex('louvre',256,(x,N)=>{ x.fillStyle='#cfd2d4'; x.fillRect(0,0,N,N); const p=N/7; for(let i=0;i<7;i++){ const g=x.createLinearGradient(i*p,0,i*p+p,0); g.addColorStop(0,'#e6e8ea'); g.addColorStop(.45,'#c3c7ca'); g.addColorStop(.78,'#9aa0a5'); g.addColorStop(.8,'#3c4246'); g.addColorStop(1,'#3c4246'); x.fillStyle=g; x.fillRect(i*p,0,p,N); } fine(x,N,5,91); },[1/1.03,1]), roughness:.45, metalness:.5}, true);
function buildScreens(L, rt){
  for (const r of L.rooms){ if (r.kind!=='service') continue;
    const P=r.poly;
    for (let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]); if (len<.5) continue;
      const u=[(b[0]-a[0])/len,(b[1]-a[1])/len], n=[-u[1],u[0]], mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
      const walled=L.walls.some(w=>Math.abs(w.u[0]*u[1]-w.u[1]*u[0])<.05 && Math.abs((mx-w.a[0])*w.n[0]+(mz-w.a[1])*w.n[1])<.15 && segPoint(mx,mz,w.a[0],w.a[1],w.b[0],w.b[1]).d<.2);
      if (walled) continue;
      let out=n; if (inPoly(P,mx+n[0]*.2,mz+n[1]*.2)) out=[-n[0],-n[1]];
      if (roomAtL(L,mx+out[0]*.3,mz+out[1]*.3,true)) continue;
      const h=Math.min(1.95,L.H-.05), geo=new THREE.BoxGeometry(len,h,.05); const uv=geo.attributes.uv, pos=geo.attributes.position; for(let k=0;k<pos.count;k++) uv.setXY(k,pos.getX(k)+len/2,pos.getY(k)+h/2);
      const m=new THREE.Mesh(geo,louvreM); m.position.set(mx+out[0]*.03,h/2+.02,mz+out[1]*.03); m.rotation.y=Math.atan2(-u[1],u[0]); m.castShadow=m.receiveShadow=true; rt.struct.add(m); } }
}
function build(id){
  if (houseRoot){ scene.remove(houseRoot); disposeTree(houseRoot); }
  MATS.forEach(m=>m.dispose()); MATS=[]; EMIT=[]; PENDANTS=[];
  F=tierMats(id); F.id=id;
  houseRoot=new THREE.Group();
  LV=LEVELS.map(L=>{
    const root=new THREE.Group(); root.position.y=L.y; houseRoot.add(root);
    const rt={root, colliders:[], floors:[], open:[]};
    for (const k of ['struct','slab0','slab','furn','fit','fix','lights','glow']){ rt[k]=new THREE.Group(); root.add(rt[k]); }
    for (const w of L.walls){ if (!w.exterior && !wallNearDetail(L,w)) continue; buildWall2(L, rt, rt.struct, w, F); }
    buildFloors2(L, rt, rt.struct, F);
    for (const r of L.railings) buildRailing2(L, rt, rt.struct, r);
    for (const o of L.pergolas) buildPergola2(L, rt.struct, o);
    return rt;
  });
  for (const B_ of BLDS){
    buildSlabs2(B_, F); buildRoofExtras(B_, F);
    B_.levels.forEach((L,i)=>{ const rt=LV[LEVELS.indexOf(L)], up=B_.levels[i+1]; if (up) for (const s of L.stairs) buildStairs2(L, rt, rt.struct, s, up.y-L.y); });
  }
  LEVELS.forEach((L,i)=>{ const rt=LV[i]; buildFurniture2(L, rt, rt.furn, F, id); });
  LEVELS.forEach((L,i)=>{ const rt=LV[i]; buildFixtures2(L, rt.fix, F, id); buildGlow(L, rt); buildScreens(L, rt); });
  LEVELS.forEach((L,i)=>{ if (!L.detail) return; const hidden=L.rooms.filter(r=>!r.detail); if (!hidden.length) return;
    const mp=mpUnion(hidden.map(r=>r.poly)); const gc=slabGeom(mp, L.H, SLAB*.6); if (gc){ const m=new THREE.Mesh(gc,[capM,capM]); m.castShadow=m.receiveShadow=true; LV[i].struct.add(m); } });
  LV.forEach(rt=>{ for (const k of ['struct','slab0','slab','furn','fit','fix']) mergeGroup(rt[k]); });
  houseRoot.traverse(n=>{ if(n.isMesh && n.material && !Array.isArray(n.material) && n.material.transparent){ n.castShadow=false; n.renderOrder=2; } });
  scene.add(houseRoot);
  poolKey='';
  applyState();
}

/* ============================== LOOP ============================== */
function resize(){ const w=view.clientWidth, h=view.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(view);
const whereEl=document.getElementById('where');
let last=performance.now(), miniT=0;
function loop(now){
  const dt=Math.min(.05,(now-last)/1000); last=now;
  if (tween){
    const k=Math.min(1,(now-tween.start)/tween.dur), e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    camera.position.lerpVectors(tween.p0,tween.p1,e); controls.target.lerpVectors(tween.t0,tween.t1,e); camera.lookAt(controls.target);
    if (k>=1){ const d=tween.done; tween=null; d&&d(); if(state.mode!=='walk') controls.update(); }
  } else if (state.mode==='walk') walkStep(dt);
  else controls.update();
  if (state.mode==='walk'){
    const p=camera.position, sp=spotAt(state.cur,p.x,p.z), r=sp&&sp.room, L=LEVELS[state.cur];
    if (r && r.id!==currentRoomId){ currentRoomId=r.id; if(state.eve) placePool(state.cur, R(r.id)); updateUI(); }
    whereEl.hidden=false; whereEl.textContent = (r ? r.name+(r.apt&&r.apt!=='common'?' · דירה '+r.apt:'') : sp&&sp.out ? 'בחצר' : 'מעבר') + ' · ' + L.name + ' · ' + L.bldName;
  } else whereEl.hidden=true;
  updateLabels();
  if (now-miniT>80){ drawMini(); miniT=now; }
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}

/* ============================== START ============================== */
function start(){
  normalizeProject(PROJECT);
  PENDANTS=[];
  computeApts();
  document.getElementById('projTitle').textContent = PROJECT.name || 'פרויקט מגורים';
  document.getElementById('projEyebrow').textContent = PROJECT.place || '';
  const nA=APTS.length, nF=Math.max(...BLDS.map(b=>b.levels.length));
  document.getElementById('projSub').textContent = PROJECT.subtitle || `${BLDS.length} בניינים · ${nA} דירות · עד ${nF} קומות`;
  document.getElementById('fine').textContent = PROJECT.fine || '';
  buildSite(); miniBounds(); renderNav(); renderLabels();
  build(TIER);
  const st=PROJECT.start||{}; if (st.bld && BLD(st.bld)){ state.bld=st.bld; const B_=BLD(st.bld); const i=B_.levels.findIndex(L=>Math.abs(L.level-(+st.level||0))<.3); state.view = i>=0 ? i : -1;
    if (st.apt!=null){ const a=APTS.find(a=>a.bld===st.bld && String(a.apt)===String(st.apt)); if (a) state.apt={L:a.L, apt:a.apt}; } renderNav(); }
  setMode('doll');
}
resize();
start();
loadingEl.hidden=true;
requestAnimationFrame(loop);
window.__studio={state,setMode,goRoom,build,selectBld,selectFloor,selectApt,camera,APTS:()=>APTS,LEVELS:()=>LEVELS,
  edges:id=>{ const r=R(id); const L=LEVELS[r.L], rt=LV[r.L]; return roomEdges(L,rt,r).map(e=>({len:+e.len.toFixed(2), free:+freeLen(e).toFixed(2), depth:+e.depth.toFixed(2), t:e.t, ints:e.ints.map(i=>[+i.a.toFixed(2),+i.b.toFixed(2)])})); },
  rooms:()=>ALLROOMS.filter(r=>r.detail).map(r=>[r.id,r.name,r.kind,r.apt,+area(r).toFixed(1)])};
})();
</script>
