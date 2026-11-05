/* ============================== STATE / MODES ============================== */
const state = { mode:'doll', furn:true, eve:false, tour:false, view:0, cur:0, plot:true, pane:'3d' };
let yaw=0, pitch=0;
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.08; controls.maxDistance=120; controls.minDistance=3;
function span(){ const o=(state.plot&&PLOT)?PLOT:BB; return Math.max(o.x1-o.x0, o.z1-o.z0); }
const PRESETS = {
  doll: v => { const c=(state.plot&&PLOT)?PC:C0, s=span(); return { pos:[c[0]+s*.55, s*.95+LEVELS[v].y, c[1]+s*.75], tgt:[c[0], LEVELS[v].y, c[1]] }; },
  plan: v => { const c=(state.plot&&PLOT)?PC:C0, s=span(); return { pos:[c[0], s*1.55+8, c[1]+.01], tgt:[c[0], LEVELS[v].y, c[1]] }; },
  ext:  () => { const s=Math.max(BB.x1-BB.x0,BB.z1-BB.z0); return { pos:[C0[0]+s*.75, 4.2, C0[1]+s*1.0], tgt:[C0[0], 2.4, C0[1]] }; },
};
function applyState(){
  if (!houseRoot) return;
  const cut = state.mode==='doll' || state.mode==='plan', V = state.view;
  LV.forEach((rt,i)=>{
    const above = cut && i>V, atV = cut && i===V;
    rt.root.visible = !above; rt.slab.visible = !atV; rt.fix.visible = !atV;
    rt.furn.visible = state.furn; rt.lights.visible = state.eve && !above;
  });
  plotHi.visible = state.plot;
  const e = state.eve;
  sun.intensity = e ? .12 : 2.4; sun.color.set(e ? 0x9fb4ff : 0xfff0dc);
  sun.position.set(C0[0]+(e?-6:-7), e?10:18, C0[1]+(e?9:14));
  hemi.intensity = e ? .05 : .35;
  skyU.top.value.set(e?'#0b1426':'#5f8fc8'); skyU.mid.value.set(e?'#33405e':'#d9e6ef'); skyU.bot.value.set(e?'#151a20':'#b9c2b4');
  scene.fog = new THREE.Fog(e?'#262f42':'#d4dfe6', 90, 300);
  renderer.toneMappingExposure = e ? 1.15 : .95;
  [...MATS,...GMATS].forEach(m=>{ m.envMapIntensity = (m.userData.env||1) * (e ? .12 : .6); });
  EMIT.forEach(o=>{ o.m.emissiveIntensity = e ? o.night : o.day; });
  updateUI();
}
function setMode(m){
  if (m!=='walk') stopTour();
  state.mode = m; controls.enabled = m!=='walk'; controls.enableRotate = m!=='plan'; controls.screenSpacePanning = true;
  controls.mouseButtons = { LEFT: m==='plan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN };
  controls.touches = { ONE: m==='plan'?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN };
  controls.maxPolarAngle = m==='ext' ? 1.52 : 1.38;
  if (m==='walk'){ const r = R(currentRoomId) || ALLROOMS.find(r=>r.nav); if (r) goRoom(r.id); }
  else { const p=PRESETS[m](Math.min(state.view,LEVELS.length-1)); flyTo(p.pos,p.tgt); }
  camera.fov = m==='walk'? 68 : m==='plan'? 38 : 50; camera.updateProjectionMatrix();
  applyState();
}
function setView(v){
  state.view=v;
  if (state.mode==='walk'){ const r=LEVELS[v].rooms.find(r=>r.nav && r.type!=='balcony') || LEVELS[v].rooms.find(r=>r.nav); if(r) goRoom(r.id); return; }
  if (state.mode==='ext') setMode('doll'); else { const p=PRESETS[state.mode](v); flyTo(p.pos,p.tgt); applyState(); }
}
let currentRoomId=null;
function goRoom(id, dur){
  const r=R(id); if(!r) return; currentRoomId=id; state.cur=r.L; state.view=r.L;
  state.mode='walk'; controls.enabled=false;
  const y=LEVELS[r.L].y, pos=[r.cam[0],y+EYE,r.cam[1]], tgt=[r.cam[2],y+1.25,r.cam[3]];
  flyTo(pos,tgt,reduceMotion?1:(dur||1300),()=>{ setYawPitchFrom(new THREE.Vector3(...pos),new THREE.Vector3(...tgt)); });
  camera.fov=68; camera.updateProjectionMatrix(); applyState();
}
function roomAt(L,x,z){ return LEVELS[L] && LEVELS[L].rooms.find(r=>x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1); }

/* ============================== AUTO TOUR ============================== */
let tourI=0, tourTimer=null;
const tourBtn=document.getElementById('tourBtn');
function startTour(){ state.tour=true; tourI=0; tourBtn.setAttribute('aria-pressed','true'); tourBtn.textContent='■ עצירת הסיור'; tourNext(); }
function stopTour(){ if(!state.tour) return; state.tour=false; clearTimeout(tourTimer); tourBtn.setAttribute('aria-pressed','false'); tourBtn.textContent='סיור אוטומטי בכל הבית'; }
function tourNext(){ if(!state.tour) return; const list=ALLROOMS.filter(r=>r.nav); if(!list.length) return; const r=list[tourI%list.length]; tourI++; goRoom(r.id, 2200); tourTimer=setTimeout(tourNext, 5200); }
tourBtn.addEventListener('click',()=> state.tour? stopTour() : startTour());

/* ============================== VIEWER UI ============================== */
const tiersEl=document.getElementById('tiers');
TIER_ORDER.forEach(id=>{
  const t=TIERS[id]; const b=document.createElement('button'); b.className='tier'; b.id='tier-'+id; b.dataset.tier=id;
  b.innerHTML=`<span class="sw" style="background:${t.swatch}"></span><span class="nm"><span class="num">0${TIER_ORDER.indexOf(id)+1}</span>${t.name}</span><span class="tg">${t.tag}</span>`;
  b.addEventListener('click',()=>{ if(TIER===id) return; TIER=id; showLoading(()=>build(id)); });
  tiersEl.appendChild(b);
});
const roomsEl=document.getElementById('rooms'), levelSeg=document.getElementById('levelSeg');
function renderNav(){
  roomsEl.textContent=''; levelSeg.textContent='';
  LEVELS.forEach((L,i)=>{
    const lb=document.createElement('button'); lb.type='button'; lb.dataset.level=i; lb.textContent=L.name; lb.addEventListener('click',()=>{ stopTour(); setView(i); }); levelSeg.appendChild(lb);
    const h=document.createElement('div'); h.className='rooms-h'; h.textContent=L.name; roomsEl.appendChild(h);
    const wrap=document.createElement('div'); wrap.className='rooms-row'; roomsEl.appendChild(wrap);
    L.rooms.filter(r=>r.nav).forEach(r=>{ const b=document.createElement('button'); b.type='button'; b.textContent=r.name; b.id='room-'+r.id; b.addEventListener('click',()=>{ stopTour(); goRoom(r.id); }); wrap.appendChild(b); });
  });
  levelSeg.hidden = LEVELS.length<2;
  levelSeg.style.gridTemplateColumns=`repeat(${Math.max(1,LEVELS.length)},1fr)`;
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{ setPane('3d'); setMode(b.dataset.mode); }));
document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{ state.eve = b.dataset.time==='eve'; applyState(); }));
document.getElementById('furn').addEventListener('change',e=>{ state.furn=e.target.checked; applyState(); });
document.getElementById('plotT').addEventListener('change',e=>{ state.plot=e.target.checked; if(state.mode==='doll'||state.mode==='plan'){ const p=PRESETS[state.mode](state.view); flyTo(p.pos,p.tgt); } applyState(); });
const floorBtn=document.getElementById('floorBtn');
floorBtn.addEventListener('click',()=>{ stopTour(); const n=(state.cur+1)%LEVELS.length; setView(n); });
const HINTS = {
  doll:'גררו כדי לסובב · גלגלת או צביטה לזום · בחרו קומה כדי לראות אותה בחתך',
  plan:'תוכנית מלמעלה של הקומה הנבחרת · גררו להזזה · גלגלת לזום',
  ext:'מבט חוץ · גררו כדי להקיף את הבית',
  walk: isTouch ? 'גררו על המסך כדי להסתכל · ג׳ויסטיק להליכה · נגיעה ברצפה = הליכה לנקודה' : 'גררו כדי להסתכל · W A S D או חיצים להליכה · Shift מהר יותר · לחיצה על הרצפה = הליכה לנקודה',
};
function updateUI(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.mode===state.mode)));
  levelSeg.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed', String(+b.dataset.level===(state.mode==='walk'?state.cur:state.view))));
  document.querySelectorAll('[data-time]').forEach(b=>b.setAttribute('aria-pressed', String((b.dataset.time==='eve')===state.eve)));
  TIER_ORDER.forEach(id=>document.getElementById('tier-'+id).setAttribute('aria-pressed',String(id===TIER)));
  const t=TIERS[TIER];
  document.getElementById('furnNote').textContent = state.furn ? t.furnDesc : 'בית ריק: רק גמר, מטבחים וכלים סניטריים';
  document.getElementById('spec').innerHTML = t.spec.filter(([k])=>k!=='מדרגות').map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.getElementById('hint').textContent = HINTS[state.mode];
  document.getElementById('joy').hidden = !(isTouch && state.mode==='walk');
  floorBtn.hidden = state.mode!=='walk' || LEVELS.length<2;
  floorBtn.textContent = LEVELS.length>1 ? (state.cur+1<LEVELS.length ? `▲ ${LEVELS[state.cur+1].name}` : `▼ ${LEVELS[0].name}`) : '';
  roomsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('on', state.mode==='walk' && b.id==='room-'+currentRoomId));
}
const loadingEl=document.getElementById('loading');
function showLoading(fn){ loadingEl.hidden=false; requestAnimationFrame(()=>requestAnimationFrame(()=>{ try{ fn(); } finally { loadingEl.hidden=true; } })); }

/* ---------------- labels ---------------- */
const labelsEl=document.getElementById('labels');
let LBL=[], PL=[];
function renderLabels(){
  labelsEl.textContent='';
  LBL = ALLROOMS.filter(r=>r.lbl).map(r=>{ const d=document.createElement('div'); d.className='rl'; d.innerHTML=`${esc(r.name)}<small>${area(r).toFixed(1)} מ״ר</small>`; labelsEl.appendChild(d); return {r,d,v:new THREE.Vector3((r.x0+r.x1)/2, LEVELS[r.L].y+.2, (r.z0+r.z1)/2)}; });
  PL=[];
  if (PLOT){ const P=PLOT, W_=P.x1-P.x0, D_=P.z1-P.z0;
    const add=(html,x,z,cls)=>{ const d=document.createElement('div'); d.className='rl '+cls; d.innerHTML=html; labelsEl.appendChild(d); PL.push({d,v:new THREE.Vector3(x,.3,z)}); };
    add(`גבול מגרש<small>${W_.toFixed(1)} מ׳</small>`,(P.x0+P.x1)/2,P.z0,'pl-b'); add(`גבול מגרש<small>${W_.toFixed(1)} מ׳</small>`,(P.x0+P.x1)/2,P.z1,'pl-b');
    add(`גבול מגרש<small>${D_.toFixed(1)} מ׳</small>`,P.x0,(P.z0+P.z1)/2,'pl-b'); add(`גבול מגרש<small>${D_.toFixed(1)} מ׳</small>`,P.x1,(P.z0+P.z1)/2,'pl-b');
    if (SETBACK){ const Bl=BLD; add(`קו בניין<small>${SETBACK.n} מ׳</small>`,(Bl.x0+Bl.x1)/2,(P.z0+Bl.z0)/2,'pl-l'); add(`קו בניין<small>${SETBACK.s} מ׳</small>`,(Bl.x0+Bl.x1)/2,(P.z1+Bl.z1)/2,'pl-l'); add(`קו בניין<small>${SETBACK.w} מ׳</small>`,(P.x0+Bl.x0)/2,(Bl.z0+Bl.z1)/2,'pl-l'); add(`קו בניין<small>${SETBACK.e} מ׳</small>`,(P.x1+Bl.x1)/2,(Bl.z0+Bl.z1)/2,'pl-l'); }
    document.getElementById('plotNote').textContent = `מגרש כ־${W_.toFixed(1)}×${D_.toFixed(1)} מ׳ (≈${Math.round(W_*D_)} מ״ר)` + (SETBACK?` · קווי בניין: צפון ${SETBACK.n}, דרום ${SETBACK.s}, מערב ${SETBACK.w}, מזרח ${SETBACK.e} מ׳`:'');
  }
}
function updateLabels(){
  const showP = state.plot && state.mode!=='walk' && state.pane==='3d', w0=view.clientWidth, h0=view.clientHeight;
  for (const L of PL){ if(!showP){ L.d.style.display='none'; continue; } const p=L.v.clone().project(camera); const vis=p.z<1 && Math.abs(p.x)<1.05 && Math.abs(p.y)<1.05; L.d.style.display=vis?'':'none'; if(vis){ L.d.style.left=((p.x+1)/2*w0)+'px'; L.d.style.top=((1-p.y)/2*h0)+'px'; } }
  const show = (state.mode==='plan' || state.mode==='doll') && state.pane==='3d';
  labelsEl.hidden = !(show || showP); if(!show){ LBL.forEach(L=>L.d.style.display='none'); return; }
  for (const L of LBL){ if(L.r.L!==state.view){ L.d.style.display='none'; continue; } const p=L.v.clone().project(camera); const vis=p.z<1 && Math.abs(p.x)<1.1 && Math.abs(p.y)<1.1; L.d.style.display = vis?'':'none'; if(vis){ L.d.style.left=((p.x+1)/2*w0)+'px'; L.d.style.top=((1-p.y)/2*h0)+'px'; } }
}
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- minimap ---------------- */
const mini=document.getElementById('mini'), mx=mini.getContext('2d'), MP=22;
function mm(){ const Wd=mini.width, Hh=mini.height; const s=Math.min((Wd-2*MP)/(BOUNDS.x1-BOUNDS.x0),(Hh-2*MP)/(BOUNDS.z1-BOUNDS.z0)); const ox=(Wd-s*(BOUNDS.x1-BOUNDS.x0))/2, oy=(Hh-s*(BOUNDS.z1-BOUNDS.z0))/2; return {s,ox,oy}; }
function toMini(x,z){ const {s,ox,oy}=mm(); return [ox+(x-BOUNDS.x0)*s, oy+(z-BOUNDS.z0)*s]; }
function fromMini(px,py){ const {s,ox,oy}=mm(); return [BOUNDS.x0+(px-ox)/s, BOUNDS.z0+(py-oy)/s]; }
function drawMini(){
  const Wd=mini.width, Hh=mini.height; mx.clearRect(0,0,Wd,Hh);
  const Li = state.mode==='walk' ? state.cur : state.view, L=LEVELS[Li], rt=LV[Li]; if(!L||!rt) return;
  if (state.plot && PLOT){ const [a,b]=toMini(PLOT.x0,PLOT.z0),[c,d]=toMini(PLOT.x1,PLOT.z1); mx.strokeStyle='#ff4d1a'; mx.lineWidth=3; mx.strokeRect(a,b,c-a,d-b);
    if (BLD){ const [e,f]=toMini(BLD.x0,BLD.z0),[g2,h2]=toMini(BLD.x1,BLD.z1); mx.strokeStyle='#0050c9'; mx.lineWidth=1.5; mx.setLineDash([5,4]); mx.strokeRect(e,f,g2-e,h2-f); mx.setLineDash([]); } }
  if (Li>0){ mx.fillStyle='#e4e1da'; for(const r of LEVELS[0].rooms){ const [a,b]=toMini(r.x0,r.z0), [c,d]=toMini(r.x1,r.z1); mx.fillRect(a,b,c-a,d-b); } }
  for(const r of L.rooms){ const [a,b]=toMini(r.x0,r.z0), [c,d]=toMini(r.x1,r.z1);
    mx.fillStyle = r.id===currentRoomId && state.mode==='walk' ? '#dce8fb' : r.type==='wet'?'#dbe6ea': r.type==='balcony'?'#dfe8d6': r.void?'#cfc9bf':'#f6f4ef'; mx.fillRect(a,b,c-a,d-b); }
  mx.strokeStyle='#2a2f31'; mx.lineCap='square';
  for(const w of L.walls){ const [a,b]=toMini(...w.a), [c,d]=toMini(...w.b); mx.lineWidth=w.t>.2?4:2.2; mx.beginPath(); mx.moveTo(a,b); mx.lineTo(c,d); mx.stroke(); }
  for(const o of rt.OPEN){ const win=o.bot>0; mx.strokeStyle= win?'#7aa0b8':'#f6f4ef'; mx.lineWidth= win?3:5; const [a,b]= o.axis==='h'?toMini(o.s,o.coord):toMini(o.coord,o.s); const [c,d]= o.axis==='h'?toMini(o.e,o.coord):toMini(o.coord,o.e); mx.beginPath(); mx.moveTo(a,b); mx.lineTo(c,d); mx.stroke(); }
  const p=camera.position, [px,py]=toMini(p.x,p.z);
  if (state.mode==='walk'){ const fx=-Math.sin(yaw), fz=-Math.cos(yaw), ang=Math.atan2(fz,fx);
    mx.fillStyle='rgba(0,80,201,.28)'; mx.beginPath(); mx.moveTo(px,py); mx.arc(px,py,40,ang-.55,ang+.55); mx.closePath(); mx.fill();
    mx.fillStyle='#0050c9'; mx.beginPath(); mx.arc(px,py,6.5,0,7); mx.fill(); mx.strokeStyle='#fff'; mx.lineWidth=2.5; mx.stroke(); }
  mx.fillStyle='#2a2f31'; mx.font='700 22px Arimo, Arial'; mx.textAlign='right'; mx.fillText(L.name, Wd-10, 26);
}
mini.addEventListener('click',e=>{
  const rc=mini.getBoundingClientRect(); const [x,z]=fromMini((e.clientX-rc.left)*mini.width/rc.width,(e.clientY-rc.top)*mini.height/rc.height);
  const Li = state.mode==='walk' ? state.cur : state.view, room=roomAt(Li,x,z); if(!room || room.stair || room.void) return;
  stopTour(); setPane('3d');
  state.mode='walk'; controls.enabled=false; currentRoomId=room.id; state.cur=Li; state.view=Li;
  const y=LEVELS[Li].y, p=new THREE.Vector3(x,y+EYE,z); collide(p,Li);
  const look=new THREE.Vector3(room.cam[2],y+1.3,room.cam[3]);
  flyTo([p.x,p.y,p.z],[look.x,look.y,look.z],900,()=>setYawPitchFrom(p,look));
  camera.fov=68; camera.updateProjectionMatrix(); applyState();
});

/* ============================== LOAD A PLAN ============================== */
let FLOORS_SRC=[]; // per floor: {name, img (HTMLImageElement|null), crop:{x,y,w,h}, assetId?, cal:{s,dx,dy}}
function loadPlan(P, src){
  PLAN = P; normalizePlan(P);
  if (src) FLOORS_SRC = src;
  document.getElementById('projTitle').textContent = P.name || 'פרויקט ללא שם';
  document.getElementById('projSub').textContent = `${BUILT} מ״ר בנוי · ${LEVELS.length===1?'קומה אחת':LEVELS.length+' קומות'}` + (BALC?` · ${BALC} מ״ר מרפסות`:'') + ` · ${ALLROOMS.filter(r=>r.nav).length} חללים`;
  document.getElementById('pName').value = P.name || '';
  currentRoomId=null; state.view=Math.min(state.view,LEVELS.length-1); state.cur=0;
  buildSite(); renderNav(); renderLabels(); renderRoomsEdit();
  build(TIER);
  setMode(state.mode==='walk'?'doll':state.mode);
}
