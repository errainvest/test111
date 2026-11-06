/* ============================== ENGINE v2: polygons, walls at any angle, many buildings & floors ============================== */
const PCL = window.polygonClipping;
const MERGE = (THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries) || null;
const SLAB = 0.25;
let LV=[], F=null, TIER='pre';

/* ---------------- polygon helpers ---------------- */
function polyArea(p){ let a=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length]; a+=q[0]*r[1]-r[0]*q[1]; } return a/2; }
function polyCentroid(p){ let a=0,cx=0,cz=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length], f=q[0]*r[1]-r[0]*q[1]; a+=f; cx+=(q[0]+r[0])*f; cz+=(q[1]+r[1])*f; }
  if (Math.abs(a)<1e-9) return [p.reduce((s,q)=>s+q[0],0)/p.length, p.reduce((s,q)=>s+q[1],0)/p.length]; return [cx/(3*a), cz/(3*a)]; }
function inPoly(p,x,z){ let c=false; for(let i=0,j=p.length-1;i<p.length;j=i++){ const xi=p[i][0], zi=p[i][1], xj=p[j][0], zj=p[j][1]; if(((zi>z)!==(zj>z)) && (x<(xj-xi)*(z-zi)/(zj-zi)+xi)) c=!c; } return c; }
function polyBBox(p){ const xs=p.map(q=>q[0]), zs=p.map(q=>q[1]); return {x0:Math.min(...xs), x1:Math.max(...xs), z0:Math.min(...zs), z1:Math.max(...zs)}; }
function segPoint(px,pz,ax,az,bx,bz){ const dx=bx-ax, dz=bz-az, L2=dx*dx+dz*dz||1e-9; let t=((px-ax)*dx+(pz-az)*dz)/L2; t=Math.max(0,Math.min(1,t)); const cx=ax+dx*t, cz=az+dz*t; return {d:Math.hypot(px-cx,pz-cz), t, cx, cz}; }
const ring = p => p.map(q=>[+q[0],+q[1]]);
function mpUnion(polys){ const g=polys.filter(p=>p&&p.length>=3).map(p=>[ring(p)]); if(!g.length) return []; if(!PCL) return g; try{ return PCL.union(...g); }catch(e){ return g; } }
function mpDiff(mp, polys){ const g=polys.filter(p=>p&&p.length>=3).map(p=>[ring(p)]); if(!mp.length||!g.length||!PCL) return mp; try{ return PCL.difference(mp, ...g); }catch(e){ return mp; } }
function mpDiffMP(a, b){ if(!a.length||!b.length||!PCL) return a; try{ return PCL.difference(a, b); }catch(e){ return a; } }
function shapesOf(mp){
  return mp.map(poly=>{ const s=new THREE.Shape(poly[0].map(([x,z])=>new THREE.Vector2(x,-z)));
    for (let k=1;k<poly.length;k++) s.holes.push(new THREE.Path(poly[k].map(([x,z])=>new THREE.Vector2(x,-z)))); return s; });
}
function flatGeom(mp, y){ const shapes=shapesOf(mp); if(!shapes.length) return null; const g=new THREE.ShapeGeometry(shapes); g.rotateX(-Math.PI/2); g.translate(0,y,0); return g; }
function slabGeom(mp, y0, h){ const shapes=shapesOf(mp); if(!shapes.length) return null; const g=new THREE.ExtrudeGeometry(shapes,{depth:h, bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0,y0,0); return g; }

/* ---------------- extra materials ---------------- */
function stoneTex(key, base, seed){
  return ctex(key,1024,(x,N)=>{
    const r=rng(seed), S=2.4, px=N/S; x.fillStyle=col(base,.06); x.fillRect(0,0,N,N);
    let y=0; const courses=[]; while(y<N-2){ let h=Math.round(px*(.25+r()*.15)); if(N-y-h<px*.2) h=N-y; courses.push([y,h]); y+=h; }
    for (const [y0,h] of courses){
      let xx=-r()*px*.6;
      while(xx<N){ let w=px*(.45+r()*.55); const c=col(base,(r()-.5)*.07,(r()-.5)*.05);
        for (const off of [0,-N,N]){ const X=xx+off; if(X>N||X+w<0) continue;
          x.fillStyle=c; x.fillRect(X+1.5,y0+1.5,w-3,h-3);
          x.save(); x.beginPath(); x.rect(X+1.5,y0+1.5,w-3,h-3); x.clip();
          const sr=rng(Math.floor((X+999)*7+y0*13)); x.strokeStyle='rgba(90,70,40,.10)'; x.lineWidth=1;
          for (let k=-h; k<w; k+=3+sr()*2){ x.beginPath(); x.moveTo(X+k,y0+h); x.lineTo(X+k+h*.55,y0); x.stroke(); }
          const g=x.createLinearGradient(0,y0,0,y0+h); g.addColorStop(0,'rgba(255,255,255,.10)'); g.addColorStop(1,'rgba(0,0,0,.07)'); x.fillStyle=g; x.fillRect(X,y0,w,h);
          x.restore(); }
        xx+=w; }
    }
    blotch(x,N,7,.12,seed+3,'#6b5a40','#ffffff'); fine(x,N,10,seed+4);
  },[1/2.4,1/2.4]);
}
const stoneM = M({map:stoneTex('jstone','#e2d4b6',301), roughness:.88}, true);
const plasterWhiteM = M({map:plasterTex('pwhite','#f3f1ec',.07,2.5,303), roughness:.93}, true);
const roofGravelM = M({map:tileTex('gravel',{base:'#c9c6bf',grout:'#c9c6bf',cols:1,rows:1,sizeU:1.2,sizeV:1.2,style:'speckle',seed:305,groutPx:0,N:512}), roughness:.95}, true);
const darkGlassM = M({color:'#1d2730', roughness:.12, metalness:.5}, true);
const metalGreyM = M({color:'#9aa0a4', roughness:.45, metalness:.6}, true);
const sillStoneM = M({map:stoneTex('jstone','#e2d4b6',301), color:'#efe6d2', roughness:.8}, true);
const nightGlass = []; // window glass materials that glow at night

/* ---------------- normalisation ---------------- */
const KINDS2 = {
  living:{n:'סלון',t:'living'}, kitchen:{n:'מטבח',t:'living'}, dining:{n:'פינת אוכל',t:'living'}, hall:{n:'מבואה',t:'living'}, lobby:{n:'לובי',t:'living'},
  bed:{n:'חדר שינה',t:'bed'}, master:{n:'חדר הורים',t:'bed'}, kids:{n:'חדר ילדים',t:'bed'}, office:{n:'חדר עבודה',t:'bed'}, mamad:{n:'ממ״ד',t:'bed'},
  closet:{n:'ארונות',t:'closet'}, storage:{n:'מחסן',t:'closet'}, shaft:{n:'פיר',t:'closet'},
  bath:{n:'רחצה',t:'wet'}, wc:{n:'שירותים',t:'wet'}, laundry:{n:'כביסה',t:'wet'}, service:{n:'מעבה',t:'balcony'},
  stair:{n:'מדרגות',t:'living'}, balcony:{n:'מרפסת',t:'balcony'}, terrace:{n:'מרפסת',t:'balcony'}, garden:{n:'חצר',t:'balcony'}, pergola:{n:'פרגולה',t:'balcony'}, roof:{n:'גג',t:'balcony'},
};
const PRIVATE = new Set(['bed','master','kids','office','mamad','closet','storage','bath','wc','laundry']);
let ALLOUT=[];
let LEVELS=[], ALLROOMS=[], BLDS=[], BB={x0:0,x1:10,z0:0,z1:10}, C0=[5,5], PCEN=[5,5], PLOT=null, DATUM=0;
const area = r => Math.abs(polyArea(r.poly));
function wallInfo(w){ const dx=w.b[0]-w.a[0], dz=w.b[1]-w.a[1], len=Math.hypot(dx,dz)||1e-6, u=[dx/len,dz/len]; return {len,u,n:[-u[1],u[0]]}; }
function roomAtL(L,x,z,withOutdoor){ for(const r of L.rooms) if(inPoly(r.poly,x,z)) return r; if(withOutdoor) for(const r of L.outdoor) if(inPoly(r.poly,x,z)) return r; return null; }
function insideL(L,x,z){ return L.rooms.some(r=>inPoly(r.poly,x,z)); }

function normalizeProject(P){
  DATUM = +P.datum || 0;
  if (P.railing) RAIL={...RAIL, ...P.railing};
  LEVELS=[]; BLDS=[];
  for (const b of P.buildings){
    const base = (+b.zero||DATUM) - DATUM;
    const floors = b.floors.filter(f=>!f.roof).sort((a,c)=>a.level-c.level);
    const B_ = {id:b.id, name:b.name||('בניין '+b.id), base, levels:[], roof:b.floors.find(f=>f.roof)||null, stone:b.stone||[], plaster:b.plaster||'white'};
    const roofF=b.floors.find(f=>f.roof), roofLv = roofF && roofF.level!=null ? +roofF.level : null;
    floors.forEach((f,idx)=>{
      const next=floors[idx+1], floorH = next ? next.level-f.level : (roofLv!=null && roofLv-f.level>2.3 && roofLv-f.level<4.5 ? roofLv-f.level : (+f.height||3.0));
      const L = {id:b.id+'-'+idx, bld:b.id, bldName:B_.name, idx, name:f.name, y:base+(+f.level||0), level:+f.level||0, ground:Math.abs(+f.level||0)<.5, below:(+f.level||0)<-.5, shell:!!f.shell, showApts:Array.isArray(f.show_apts)?new Set(f.show_apts.map(String)):null, floorH, H:Math.max(2.3,floorH-SLAB),
        walls:[], rooms:[], outdoor:[], railings:[], stairs:f.stairs||[], lifts:f.lifts||[], items:f.items||[], pergolas:[], src:f};
      for (const w0 of (f.walls||[])){
        const a=[+w0.a[0],+w0.a[1]], c=[+w0.b[0],+w0.b[1]]; if(Math.hypot(c[0]-a[0],c[1]-a[1])<.08) continue;
        const t = Math.min(.6, Math.max(.06, +w0.t || (w0.kind==='int'?.1:.25)));
        L.walls.push({a, b:c, t, kind:w0.kind||'ext', h:w0.h!=null?+w0.h:null, open:[], ...wallInfo({a,b:c})});
      }
      (f.rooms||[]).forEach((r0,j)=>{ if(!r0.poly||r0.poly.length<3) return; const kind=KINDS2[r0.kind]?r0.kind:'hall';
        L.rooms.push({id:`${L.id}-r${j}`, name:r0.name||KINDS2[kind].n, kind, type:KINDS2[kind].t, apt:r0.apt!=null?String(r0.apt):'', poly:ring(r0.poly), L:LEVELS.length, bld:b.id}); });
      (f.outdoor||[]).forEach((r0,j)=>{ if(!r0.poly||r0.poly.length<3) return; const kind=KINDS2[r0.kind]?r0.kind:'balcony';
        if (['parking','path','driveway','road'].includes(r0.kind)) return;
        const lv = r0.level!=null ? +r0.level : L.level; const o={id:`${L.id}-o${j}`, name:r0.name||KINDS2[kind].n, kind, type:'balcony', apt:r0.apt!=null?String(r0.apt):'', poly:ring(r0.poly), L:LEVELS.length, bld:b.id, level:lv, dy:lv-L.level};
        if (kind==='pergola') L.pergolas.push(o);
        if (Math.abs(o.dy)<.45 || kind==='garden') L.outdoor.push(o); });
      for (const r0 of (f.railings||[])) if (r0.a&&r0.b) L.railings.push({a:[+r0.a[0],+r0.a[1]], b:[+r0.b[0],+r0.b[1]], h:+r0.h||1.1, y:r0.level!=null? (+r0.level>100? +r0.level-(+b.zero||DATUM) : +r0.level)-L.level : 0});
      // a wall is on the facade if, somewhere along it, one side has no room (outside or a balcony)
      for (const w of L.walls){ w.exterior = w.kind==='low';
        for (const t of [.12,.35,.5,.65,.88]){ const px=w.a[0]+w.u[0]*w.len*t, pz=w.a[1]+w.u[1]*w.len*t, d=w.t/2+.18;
          if (!roomAtL(L,px+w.n[0]*d,pz+w.n[1]*d,false) || !roomAtL(L,px-w.n[0]*d,pz-w.n[1]*d,false)){ w.exterior=true; break; } } }
      // attach openings to the nearest wall
      for (const o of (f.openings||[])){
        if (o.x==null||o.z==null) continue;
        let best=null, bd=1e9, bs=0;
        for (const w of L.walls){ if (w.kind==='low') continue; const s=(o.x-w.a[0])*w.u[0]+(o.z-w.a[1])*w.u[1], d=Math.abs((o.x-w.a[0])*w.n[0]+(o.z-w.a[1])*w.n[1]);
          if (s<-.1||s>w.len+.1) continue; if (d<bd && d<w.t/2+.35){ bd=d; best=w; bs=s; } }
        if (!best) continue;
        const type=['door','window','slider','pass','entry'].includes(o.type)?o.type:'window';
        let wd=Math.min(Math.max(+o.w||(type==='window'?1.2:.9),.35), best.len-.08); if (wd<.3) continue;
        const c=Math.min(Math.max(bs, wd/2+.04), best.len-wd/2-.04);
        if (best.open.some(p=>Math.abs(p.c-c)<(p.w+wd)/2+.02)) continue;
        const op={c, w:wd, type};
        if (type==='window'){ op.h=Math.min(Math.max(+o.h||1.2,.35),L.H-.25); op.sill=o.sill!=null? +o.sill : Math.max(.3, 2.15-op.h); if(op.sill+op.h>L.H-.15) op.sill=Math.max(0,L.H-.15-op.h); op.type='window'; }
        else if (type==='slider'){ op.h=Math.min(+o.h||2.2,L.H-.2); op.sill=0; op.type='slider'; }
        else if (type==='pass'){ op.h=Math.min(+o.h||2.1,L.H-.2); op.sill=0; op.type='pass'; }
        else { op.h=Math.min(+o.h||(type==='entry'?2.2:2.1),L.H-.2); op.sill=0; op.type='door'; if(type==='entry') op.front=1; }
        best.open.push(op);
      }
      L.fixtures = Array.isArray(f.fixtures) ? f.fixtures : [];
      L.swings = Array.isArray(f.door_swings) ? f.door_swings : [];
      // door swing side: towards the more private room
      for (const w of L.walls) for (const op of w.open){ if (op.type!=='door') continue;
        const cx=w.a[0]+w.u[0]*op.c, cz=w.a[1]+w.u[1]*op.c, d=w.t/2+.3;
        const rp=roomAtL(L,cx+w.n[0]*d,cz+w.n[1]*d,true), rn=roomAtL(L,cx-w.n[0]*d,cz-w.n[1]*d,true);
        const sc=r=>!r||r.type==='balcony'?-1:(PRIVATE.has(r.kind)?1:0)+1/(1+area(r));
        op.into = sc(rp)>=sc(rn)?1:-1;
        // a door swing drawn on the plan overrides the guess
        const sw=L.swings.find(q=>q && q.x!=null && Math.hypot(q.x-cx,q.z-cz)<Math.max(.45,op.w*.7));
        if (sw){ const nm=String(sw.opens_into||''); if (rp && rp.name===nm) op.into=1; else if (rn && rn.name===nm) op.into=-1;
          if (Array.isArray(sw.hinge)){ const hs=(sw.hinge[0]-cx)*w.u[0]+(sw.hinge[1]-cz)*w.u[1]; op.hinge = hs<0?'s':'e'; } } }
      B_.levels.push(L); LEVELS.push(L);
    });
    BLDS.push(B_);
  }
  // stairs connect a floor to the next floor of the same building: hole in the slab above
  for (const B_ of BLDS) B_.levels.forEach((L,i)=>{ const up=B_.levels[i+1]; L.stairUp = up ? L.stairs.map(s=>ring(s.poly)) : []; if(up) up.stairHoles=(up.stairHoles||[]).concat(L.stairUp); });
  ALLROOMS = LEVELS.flatMap(L=>L.rooms);
  ALLROOMS.forEach(r=>{ r.cent=polyCentroid(r.poly); r.detail=isDetail(LEVELS[r.L], r); r.nav = r.detail && r.kind!=='shaft' && r.kind!=='stair' && area(r)>=1.5; });
  LEVELS.forEach(L=>{ L.detail = L.rooms.some(r=>r.detail && r.apt && r.apt!=='common'); L.outdoor.forEach(o=>{ o.detail=isDetail(L,o); });
    for (const fx of L.fixtures){ const r=fixtureRoom(L,fx); if (r){ (r.fixtures=r.fixtures||[]).push(fx); } } });
  // balconies and terraces of shown apartments can be walked to
  ALLOUT = LEVELS.flatMap(L=>L.outdoor.filter(o=>o.detail && o.kind!=='garden' && o.kind!=='roof' && Math.abs(polyArea(o.poly))>=2));
  ALLOUT.forEach(o=>{ o.cent=polyCentroid(o.poly); o.nav=true; o.cam=autoCam2(LEVELS[o.L], o); });
  ALLROOMS.forEach(r=>{ r.cam=autoCam2(LEVELS[r.L], r); });
  const xs=[], zs=[]; LEVELS.forEach(L=>{ L.walls.forEach(w=>{ xs.push(w.a[0],w.b[0]); zs.push(w.a[1],w.b[1]); }); });
  BB = xs.length ? {x0:Math.min(...xs), x1:Math.max(...xs), z0:Math.min(...zs), z1:Math.max(...zs)} : {x0:0,x1:10,z0:0,z1:10};
  C0=[(BB.x0+BB.x1)/2,(BB.z0+BB.z1)/2];
  PLOT = P.site && P.site.plot && P.site.plot.length>=3 ? ring(P.site.plot) : null;
  PCEN = PLOT ? polyCentroid(PLOT) : C0;
}
function fixtureRoom(L, fx){
  const pts=[];
  if (fx.a && fx.b){ const mx=(fx.a[0]+fx.b[0])/2, mz=(fx.a[1]+fx.b[1])/2, l=Math.hypot(fx.b[0]-fx.a[0],fx.b[1]-fx.a[1])||1, n=[-(fx.b[1]-fx.a[1])/l,(fx.b[0]-fx.a[0])/l]; pts.push([mx+n[0]*.3,mz+n[1]*.3],[mx-n[0]*.3,mz-n[1]*.3]); }
  if (fx.poly && fx.poly.length>=3) pts.push(polyCentroid(fx.poly));
  if (fx.x!=null) pts.push([+fx.x,+fx.z]);
  const all=[...L.rooms,...L.outdoor], cands=[];
  for (const [x,z] of pts) for (const r of all) if (inPoly(r.poly,x,z) && !cands.includes(r)) cands.push(r);
  return cands.find(r=>fx.room && r.name===fx.room) || cands[0] || null;
}
function isDetail(L, r){ if (L.shell) return false; if (!L.showApts) return true; return !r.apt || r.apt==='common' || L.showApts.has(String(r.apt)); }
function autoCam2(L, r){
  // stand in a doorway of the room (a little outside it for small rooms) and look at what is drawn in it, or at the farthest corner
  const [mx,mz]=r.cent, small=Math.abs(polyArea(r.poly))<6.5;
  const fxPts=(r.fixtures||[]).map(f=> f.a&&f.b ? [(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2] : f.poly ? polyCentroid(f.poly) : f.x!=null ? [+f.x,+f.z] : null).filter(Boolean);
  const target=(px,pz)=>{
    if (fxPts.length){ const tx=fxPts.reduce((a,p)=>a+p[0],0)/fxPts.length, tz=fxPts.reduce((a,p)=>a+p[1],0)/fxPts.length; if (Math.hypot(tx-px,tz-pz)>1.2) return [tx,tz]; }
    let b=null, bd=-1; for (const v of r.poly){ const d=Math.hypot(v[0]-px,v[1]-pz); if(d>bd){ bd=d; b=v; } } return [b[0]+(mx-b[0])*.25, b[1]+(mz-b[1])*.25]; };
  let best=null;
  for (const w of L.walls) for (const o of w.open){ if (o.type==='window') continue;
    const cx=w.a[0]+w.u[0]*o.c, cz=w.a[1]+w.u[1]*o.c;
    for (const s of [1,-1]){ const ix=cx+w.n[0]*s*(w.t/2+.5), iz=cz+w.n[1]*s*(w.t/2+.5); if (!inPoly(r.poly,ix,iz)) continue;
      // outside point (other side of the door) for small rooms
      const ox=cx-w.n[0]*s*(w.t/2+.55), oz=cz-w.n[1]*s*(w.t/2+.55), outOK=L.rooms.some(q=>q!==r && inPoly(q.poly,ox,oz)) || L.outdoor.some(q=>q!==r && inPoly(q.poly,ox,oz));
      const [px,pz] = small && outOK ? [ox,oz] : [ix,iz]; const t=target(px,pz), score=Math.hypot(t[0]-px,t[1]-pz) + (o.type==='door'?.3:0) + (o.type==='slider'?-.6:0);
      if (!best || score>best[0]) best=[score,[px,pz,t[0],t[1]]]; } }
  if (best) return best[1];
  const u=(()=>{ let bl=0, uu=[1,0]; const P=r.poly; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if(l>bl){ bl=l; uu=[(b[0]-a[0])/l,(b[1]-a[1])/l]; } } return uu; })();
  for (const k of [1.6,1.2,.8,.4]) for (const sg of [1,-1]){ const px=mx-u[0]*k*sg, pz=mz-u[1]*k*sg; if (inPoly(r.poly,px,pz) && polyDist2(r.poly,px,pz)>.35){ const t=target(px,pz); return [px,pz,t[0],t[1]]; } }
  return [mx-.01,mz-.01,mx+u[0]*2,mz+u[1]*2];
}
/* ---------------- facade material ---------------- */
function facadeMat(L, w){
  const B_=BLDS.find(b=>b.id===L.bld);
  for (const rule of (B_&&B_.stone)||[]){
    if (rule.floors && !rule.floors.includes(L.idx)) continue;
    if (rule.kinds && !rule.kinds.includes(w.kind)) continue;
    if (rule.zone){ const mx=(w.a[0]+w.b[0])/2, mz=(w.a[1]+w.b[1])/2; if(!inPoly(rule.zone,mx,mz)) continue; }
    return stoneM;
  }
  return plasterWhiteM;
}

/* ---------------- walls, openings, skirting, tiles ---------------- */
const WET = new Set(['bath','wc','laundry']);
function wallBox(L, rt, g, w, s0, s1, y0, y1, F){
  if (s1-s0<.01 || y1-y0<.01) return;
  const len=s1-s0, h=y1-y0, mid=(s0+s1)/2, cx=w.a[0]+w.u[0]*mid, cz=w.a[1]+w.u[1]*mid;
  const geo=new THREE.BoxGeometry(len,h,w.t);
  const pos=geo.attributes.position, nor=geo.attributes.normal, uv=geo.attributes.uv;
  for (let i=0;i<pos.count;i++){ const lx=pos.getX(i), ly=pos.getY(i), lz=pos.getZ(i), nx=Math.abs(nor.getX(i)), ny=Math.abs(nor.getY(i));
    if (ny>.5) uv.setXY(i, lx+mid, lz); else if (nx>.5) uv.setXY(i, lz, ly+(y0+y1)/2+L.y); else uv.setXY(i, lx+mid, ly+(y0+y1)/2+L.y); }
  const ry=Math.atan2(-w.u[1], w.u[0]);
  // which side faces a room (paint) and which faces outside (facade)
  const d=w.t/2+.14, rp=roomAtL(L,cx+w.n[0]*d,cz+w.n[1]*d,false), rn=roomAtL(L,cx-w.n[0]*d,cz-w.n[1]*d,false);
  const outM = w.kind==='low' ? facadeMat(L,w) : facadeMat(L,w);
  const sideP = rp ? F.paint : outM, sideN = rn ? F.paint : outM;
  const cap = (rp||rn) && !(rp&&rn) ? outM : (rp&&rn ? F.paint : outM);
  const mats=[cap,cap,cap,cap,sideP,sideN];
  const m=new THREE.Mesh(geo,mats); m.position.set(cx,(y0+y1)/2,cz); m.rotation.y=ry; m.castShadow=m.receiveShadow=true; g.add(m);
  if (y0<.3) rt.colliders.push({a:[w.a[0]+w.u[0]*s0, w.a[1]+w.u[1]*s0], b:[w.a[0]+w.u[0]*s1, w.a[1]+w.u[1]*s1], r:w.t/2});
  // skirting and wet-room tiles on the room sides
  for (const [room,sg] of [[rp,1],[rn,-1]]){ if(!room) continue;
    const off=w.t/2+.006;
    if (y0<.01 && h>.08){ const sk=new THREE.Mesh(new THREE.BoxGeometry(len,.07,.012),F.skirt); sk.position.set(cx+w.n[0]*sg*off,.035,cz+w.n[1]*sg*off); sk.rotation.y=ry; g.add(sk); }
    if (WET.has(room.kind)){ const top=Math.min(y1,L.H), bot=y0; if (top-bot>.02){ const pg=new THREE.PlaneGeometry(len,top-bot); const pu=pg.attributes.uv, pp=pg.attributes.position;
        for (let i=0;i<pp.count;i++) pu.setXY(i,(pp.getX(i)+mid)*sg,pp.getY(i)+(top+bot)/2);
        const pm=new THREE.Mesh(pg,F.wetWall); pm.position.set(cx+w.n[0]*sg*(w.t/2+.004),(top+bot)/2,cz+w.n[1]*sg*(w.t/2+.004)); pm.rotation.y=ry+(sg>0?0:Math.PI); pm.receiveShadow=true; g.add(pm); } }
  }
}
function buildWall2(L, rt, g, w, F){
  const H = w.kind==='low' ? (w.h!=null?w.h:1.0) : L.H;
  const ext=w.kind==='int'?w.t/2:w.t/2;
  const ops=[...w.open].sort((p,q)=>p.c-q.c); let cur=-ext;
  for (const o of ops){
    const s=o.c-o.w/2, e=o.c+o.w/2, sill=o.sill||0, top=Math.min(H-.02, sill+o.h);
    wallBox(L,rt,g,w,cur,s,0,H,F); if (sill>0) wallBox(L,rt,g,w,s,e,0,sill,F); wallBox(L,rt,g,w,s,e,top,H,F); cur=e;
    const cx=w.a[0]+w.u[0]*o.c, cz=w.a[1]+w.u[1]*o.c;
    rt.open.push({ax:w.a[0]+w.u[0]*s, az:w.a[1]+w.u[1]*s, bx:w.a[0]+w.u[0]*e, bz:w.a[1]+w.u[1]*e, win:o.type==='window', sill, top, type:o.type, t:w.t, ext:w.kind!=='int'});
    const fx=G(g,cx,cz,Math.atan2(-w.u[1],w.u[0]));
    const d=w.t/2+.15, inLocal = insideL(L,cx+w.n[0]*d,cz+w.n[1]*d) ? 1 : -1;
    buildOpening(fx, F, {...o, into:o.into||1}, w.t, sill, top, inLocal, true);
    if (w.kind!=='int' && w.kind!=='low'){ // exterior stone sill and head on facade openings
      const outS = -inLocal, fm=facadeMat(L,w);
      if (o.type==='window' && sill>.05) B(fx, sillStoneM, o.w+.12, .045, .09, 0, sill-.045, outS*(w.t/2+.03));
      B(fx, fm===stoneM?sillStoneM:fm, o.w+.06, .06, .03, 0, top, outS*(w.t/2+.012));
    }
  }
  wallBox(L,rt,g,w,cur,w.len+ext,0,H,F);
}
let RAIL={style:'glass', color:'#2d5f8a'}, railMetalM=null;
function metalRail(g, a, b, ya, yb, h, mat){
  // painted metal railing: posts, top and bottom rails, a band of small X's under the top rail, vertical bars below
  const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz); if (len<.1) return;
  const ux=dx/len, uz=dz/len, ry=Math.atan2(-uz,ux), np=Math.max(1,Math.round(len/1.6));
  const at=(t,y)=>[a[0]+dx*t, ya+(yb-ya)*t+y, a[1]+dz*t];
  const bar=(t0,y0,t1,y1,th)=>{ const p0=at(t0,y0), p1=at(t1,y1), L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]); if(L<.01) return;
    const m=new THREE.Mesh(new THREE.BoxGeometry(th,L,th),mat); m.position.set((p0[0]+p1[0])/2,(p0[1]+p1[1])/2,(p0[2]+p1[2])/2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]).normalize()); m.castShadow=true; g.add(m); };
  for (let i=0;i<=np;i++){ const t=i/np; bar(t,0,t,h,.05); }
  bar(0,h,1,h,.055); bar(0,h-.2,1,h-.2,.03); bar(0,.1,1,.1,.03);
  const nx=Math.max(1,Math.round(len/.2)); for (let i=0;i<nx;i++){ const t0=i/nx, t1=(i+1)/nx; bar(t0,h-.2,t1,h,.016); bar(t0,h,t1,h-.2,.016); }
  const nb=Math.max(1,Math.round(len/.12)); for (let i=1;i<nb;i++){ const t=i/nb; bar(t,.1,t,h-.2,.018); }
}
function buildRailing2(L, rt, g, r){
  const dx=r.b[0]-r.a[0], dz=r.b[1]-r.a[1], len=Math.hypot(dx,dz); if(len<.1) return;
  const h=r.h||1.1, y0=r.y||0;
  if (RAIL.style==='metal-x'){ if(!railMetalM) railMetalM=M({color:RAIL.color, roughness:.45, metalness:.45}, true); metalRail(g, r.a, r.b, y0, y0, h, railMetalM); rt.colliders.push({a:r.a,b:r.b,r:.05}); return; }
  const ry=Math.atan2(-dz/len, dx/len), cx=(r.a[0]+r.b[0])/2, cz=(r.a[1]+r.b[1])/2;
  const top=new THREE.Mesh(new THREE.BoxGeometry(len,.05,.06),railM); top.position.set(cx,y0+h,cz); top.rotation.y=ry; top.castShadow=true; g.add(top);
  const n=Math.max(1,Math.round(len/1.2)); for(let i=0;i<=n;i++){ const t=i/n; const p=new THREE.Mesh(new THREE.BoxGeometry(.04,h,.04),railM); p.position.set(r.a[0]+dx*t,y0+h/2,r.a[1]+dz*t); g.add(p); }
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(len,h-.12),F.glass); gl.position.set(cx,y0+(h-.12)/2+.06,cz); gl.rotation.y=ry; g.add(gl);
  rt.colliders.push({a:r.a,b:r.b,r:.05});
}
function buildPergola2(L, g, o){
  const bb=polyBBox(o.poly), y=2.55+(o.dy||0);
  const alongX=(bb.x1-bb.x0)>=(bb.z1-bb.z0);
  for (const [x,z] of o.poly) if (Math.min(...L.walls.map(w=>segPoint(x,z,w.a[0],w.a[1],w.b[0],w.b[1]).d))>.4) B(g,pergolaM,.14,y,.14,x,0,z);
  const [cx,cz]=polyCentroid(o.poly);
  for (let t=(alongX?bb.x0:bb.z0)+.2; t<(alongX?bb.x1:bb.z1); t+=.55){
    const pts=[]; // clip the batten to the polygon by sampling
    let s0=null; const a0=alongX?bb.z0:bb.x0, a1=alongX?bb.z1:bb.x1;
    for (let q=a0;q<=a1+1e-6;q+=.05){ const x=alongX?t:q, z=alongX?q:t, inn=inPoly(o.poly,x,z); if(inn&&s0===null) s0=q; if((!inn||q>a1-1e-6)&&s0!==null){ pts.push([s0,inn?q:q-.05]); s0=null; } }
    for (const [q0,q1] of pts){ if(q1-q0<.2) continue; const m=(q0+q1)/2; if(alongX) B(g,pergolaM,.06,.16,q1-q0,t,y,m); else B(g,pergolaM,q1-q0,.16,.06,m,y,t); }
  }
}

/* ---------------- floors, slabs, roofs ---------------- */
function buildFloors2(L, rt, g, F){
  const holes = L.stairHoles||[];
  const lifts = L.lifts.map(l=>ring(l.poly));
  for (const r of [...L.rooms, ...L.outdoor]){
    if (r.kind==='shaft') continue;
    if (!r.detail && r.type!=='balcony') continue;
    const mat = r.type==='wet'?F.floorWet : r.type==='bed'||r.type==='closet'?F.floorBed : r.kind==='garden'?null : r.type==='balcony'?F.deck : F.floorLiving;
    if (!mat) continue;
    const mp = mpDiff([[r.poly]], [...holes, ...lifts]);
    const gg = flatGeom(mp, .002 + (r.dy||0)); if(!gg) continue;
    const m=new THREE.Mesh(gg,mat); m.receiveShadow=true; m.userData.room=r.id; g.add(m); rt.floors.push(m);
  }
  for (const h of holes) for (let i=0;i<h.length;i++){ const a=h[i], b=h[(i+1)%h.length]; rt.colliders.push({a,b,r:.05}); }
}
function walkable(L){ return mpUnion([...L.rooms.map(r=>r.poly), ...L.outdoor.filter(o=>o.kind!=='garden').map(o=>o.poly)]); }
function buildSlabs2(B_, F){
  const lv=B_.levels;
  lv.forEach((L,i)=>{
    const rt=LV[LEVELS.indexOf(L)], up=lv[i+1];
    const W = walkable(L);
    if (i===0){ // plinth below the ground floor
      const bot=(typeof plinthBottom==='function') ? plinthBottom(B_) : -.6;
      const g=slabGeom(mpUnion(L.rooms.map(r=>r.poly)), bot, -bot); if(g){ const m=new THREE.Mesh(g,[plinthM, facadeMat(L,{kind:'ext',a:[0,0],b:[0,0]})]); m.receiveShadow=true; m.castShadow=true; rt.struct.add(m); }
    } else {
      if (L.ground){ const bot=(typeof plinthBottom==='function') ? plinthBottom({...B_, levels:[L]}) : -.6; const pg=slabGeom(mpUnion(L.rooms.map(r=>r.poly)), bot, Math.max(.05,-SLAB-bot)); if(pg){ const m=new THREE.Mesh(pg,[plinthM, facadeMat(L,{kind:'ext',a:[0,0],b:[0,0]})]); m.receiveShadow=true; rt.struct.add(m); } }
      const mp=mpDiff(W, L.stairHoles||[]); const g=slabGeom(mp, -SLAB, SLAB);
      if(g){ const m=new THREE.Mesh(g,[F.ceilPaint, facadeMat(L,{kind:'ext',a:[0,0],b:[0,0]})]); m.castShadow=m.receiveShadow=true; rt.slab0.add(m); }
    }
    // roof over the parts of this floor that the floor above does not cover
    const top = L.floorH;
    const rooms = mpUnion(L.rooms.filter(r=>r.kind!=='shaft').map(r=>r.poly));
    const exposed = up ? mpDiffMP(rooms, walkable(up)) : rooms;
    if (exposed.length){
      const g=slabGeom(exposed, top-SLAB, SLAB); if(g){ const m=new THREE.Mesh(g,[F.ceilPaint, facadeMat(L,{kind:'ext',a:[0,0],b:[0,0]})]); m.castShadow=m.receiveShadow=true; rt.slab.add(m); }
      const tg=flatGeom(exposed, top+.004); if(tg){ const m=new THREE.Mesh(tg,roofGravelM); m.receiveShadow=true; rt.slab.add(m); }
    }
  });
}
function roofBaseAt(B_, x, z, pad){
  // relative height (to the top level's root) of the roof slab top under (x,z): the highest level of this building whose rooms reach the point
  const topL=B_.levels[B_.levels.length-1];
  for (let i=B_.levels.length-1;i>=0;i--){ const L=B_.levels[i];
    if (L.rooms.some(r=>inPoly(r.poly,x,z) || polyDist2(r.poly,x,z)<pad)) return (L.level+L.floorH)-topL.level; }
  return topL.floorH;
}
function polyDist2(P,x,z){ let d=1e9; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length]; d=Math.min(d,segPoint(x,z,a[0],a[1],b[0],b[1]).d); } return d; }
function buildRoofExtras(B_, F){
  if (!B_.roof || !B_.levels.length) return;
  const topL=B_.levels[B_.levels.length-1], rt=LV[LEVELS.indexOf(topL)], g=rt.slab;
  const R=B_.roof, rel=v=>{ v=+v; return v>100 ? v-(B_.base+DATUM) : v; };
  const Lr={...topL, walls:[], rooms:[], outdoor:[]};
  for (const w0 of (R.walls||[])){
    const a=[+w0.a[0],+w0.a[1]], b=[+w0.b[0],+w0.b[1]]; if(Math.hypot(b[0]-a[0],b[1]-a[1])<.1) continue;
    const w={a,b,t:Math.max(.12,+w0.t||.2),kind:'low',h:+w0.h||1.1,open:[],...wallInfo({a,b})};
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
    // a parapet of a lower terrace belongs to the floor at that level (so it stays visible when that floor is cut open)
    const home = w0.base!=null ? B_.levels.find(L=>Math.abs(L.level-rel(w0.base))<.5) : null;
    const ref = home || topL, gg = home ? LV[LEVELS.indexOf(home)].struct : g;
    const y0 = w0.base!=null ? rel(w0.base)-ref.level : roofBaseAt(B_, mx+w.n[0]*.25, mz+w.n[1]*.25, w.t/2+.2);
    const y1 = w0.top!=null ? rel(w0.top)-ref.level : y0+w.h;
    if (y1-y0<.05) continue; w.h=y1-y0;
    const grp=G(gg,0,0,0,y0); const rtt={colliders:[],open:[]}; buildWall2({...Lr,H:w.h}, rtt, grp, w, F);
  }
  for (const it of (R.items||[])){
    let cx, cz, wd=1, dp=2;
    if (it.poly && it.poly.length>=3){ [cx,cz]=polyCentroid(it.poly); const bb=polyBBox(it.poly); wd=Math.max(.4,bb.x1-bb.x0); dp=Math.max(.4,bb.z1-bb.z0); }
    else if (it.x!=null){ cx=+it.x; cz=+it.z; wd=+it.w||1; dp=+it.d||2; } else continue;
    const yb = it.level!=null ? rel(it.level)-topL.level : roofBaseAt(B_, cx, cz, .3);
    if (it.type==='machine_room' && it.poly){ const top = it.top!=null ? rel(it.top)-topL.level : yb+2.8; const gg=slabGeom(mpUnion([it.poly]), yb, Math.max(1.2,top-yb)); if(gg){ const m=new THREE.Mesh(gg,[plasterWhiteM, facadeMat(topL,{kind:'core',a:[cx,cz],b:[cx,cz]})]); m.castShadow=m.receiveShadow=true; g.add(m); } continue; }
    addRoofItem(g, it.type, cx, yb, cz, wd, dp, it);
  }
}
function addRoofItem(g, type, x, y, z, w, d, it){
  const n=PROJ_NORTH(), yaw=Math.atan2(-n[0],-n[1]);   // local +z points south
  if (type==='solar'){ const tilt=((it&&it.tilt_deg)||40)*Math.PI/180, grp=G(g,x,z,yaw,y), L=Math.max(w,d), Wd=Math.min(w,d)||1;
    const pl=new THREE.Mesh(new THREE.BoxGeometry(Wd*.96,.05,L*.96),darkGlassM); pl.rotation.x=tilt; pl.position.y=.25+Math.sin(tilt)*L*.48; pl.castShadow=true; grp.add(pl);
    const fr=new THREE.Mesh(new THREE.BoxGeometry(Wd,.035,L),metalGreyM); fr.rotation.x=tilt; fr.position.y=pl.position.y-.04; grp.add(fr);
    const hi=.25+Math.sin(tilt)*L*.96; for (const sx of [-Wd*.42,Wd*.42]){ B(grp,metalGreyM,.04,hi,.04,sx,0,-Math.cos(tilt)*L*.46); B(grp,metalGreyM,.04,.28,.04,sx,0,Math.cos(tilt)*L*.46); } }
  else if (type==='tank'||type==='boiler'){ const r=Math.max(.25,Math.min(w,d)/2); C(g,boilerM,r,r,(it&&it.h)||1.35,x,y,z,24); C(g,metalGreyM,r*.95,r*.95,.06,x,y+((it&&it.h)||1.35),z,24); }
  else if (type==='hatch'){ B(g,metalGreyM,Math.min(w,1.2),.45,Math.min(d,1.2),x,y,z,.02); }
  else if (type==='ac'){ B(g,F.white,.85,.6,.32,x,y,z,.03); }
  else if (type==='box'||type==='machine'){ B(g,plasterWhiteM,w,.6,d,x,y,z); }
}
const boilerM = M({color:'#e8e9e6', roughness:.35, metalness:.3}, true);
function PROJ_NORTH(){ const nn=(typeof PROJECT!=='undefined'&&PROJECT.north)||[0,-1], l=Math.hypot(nn[0],nn[1])||1; return [nn[0]/l,nn[1]/l]; }

/* ---------------- stairs (straight or U) ---------------- */
function buildStairs2(L, rt, g, s, rise){
  const P=ring(s.poly); if(P.length<3) return;
  let d=s.up_dir&&Math.hypot(s.up_dir[0],s.up_dir[1])>.1 ? [s.up_dir[0],s.up_dir[1]] : null;
  if (!d){ let best=0; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if(l>best){ best=l; d=[(b[0]-a[0])/l,(b[1]-a[1])/l]; } } }
  const dl=Math.hypot(d[0],d[1]); d=[d[0]/dl,d[1]/dl]; const p=[-d[1],d[0]];
  let d0=1e9,d1=-1e9,p0=1e9,p1=-1e9; for(const v of P){ const a=v[0]*d[0]+v[1]*d[1], b=v[0]*p[0]+v[1]*p[1]; d0=Math.min(d0,a); d1=Math.max(d1,a); p0=Math.min(p0,b); p1=Math.max(p1,b); }
  const run=d1-d0, wid=p1-p0, ry=Math.atan2(d[0],d[1]);
  const pt=(a,b)=>[d[0]*a+p[0]*b, d[1]*a+p[1]*b];
  const step=(a0,a1,b0,b1,top)=>{ const [x,z]=pt((a0+a1)/2,(b0+b1)/2); const sd=Math.abs(a1-a0), sw=Math.abs(b1-b0);
    const m=B(g,stairBodyM,sw,Math.max(.05,top-.04),sd,x,0,z,0,ry); m.castShadow=false; B(g,treadM,sw+.02,.04,sd+.02,x,top-.04,z,0,ry); };
  const n=Math.max(6,Math.round(rise/.172)), h=rise/n;
  if (wid>=2.0){ // U stair: flight up along +d on one half, landing at the far end, flight back on the other half
    const half=Math.ceil(n/2), land=Math.min(1.3,run*.3), t=Math.min(.3,(run-land-.9)/half), fw=wid/2-.05;
    const start=d1-land-half*t;
    for (let i=0;i<half;i++) step(start+i*t, start+(i+1)*t, p0+.05, p0+.05+fw, (i+1)*h);
    step(d1-land, d1-.05, p0+.05, p1-.05, half*h);
    for (let i=0;i<n-half;i++) step(d1-land-(i+1)*t, d1-land-i*t, p1-.05-fw, p1-.05, (half+i+1)*h);
  } else {
    const t=Math.min(.3,(run-.2)/n);
    for (let i=0;i<n;i++) step(d0+.1+i*t, d0+.1+(i+1)*t, p0+.05, p1-.05, (i+1)*h);
  }
  rt.colliders.push(...P.map((a,i)=>({a,b:P[(i+1)%P.length],r:.05})));
}

/* ---------------- lighting fixtures (polygon rooms) ---------------- */
let PENDANTS=[];
function buildFixtures2(L, g, F, id){
  const H=L.H;
  for (const r of L.rooms){
    if (r.kind==='shaft'||r.kind==='stair'||area(r)<1.2||!r.detail) continue;
    const [cx,cz]=r.cent, A=area(r), bb=polyBBox(r.poly);
    const ok=(x,z,m=.4)=>inPoly(r.poly,x,z)&&inPoly(r.poly,x+m,z)&&inPoly(r.poly,x-m,z)&&inPoly(r.poly,x,z+m)&&inPoly(r.poly,x,z-m);
    if (id==='basic'){ const pts=A>26?[[cx-(bb.x1-bb.x0)/4,cz],[cx+(bb.x1-bb.x0)/4,cz]]:[[cx,cz]]; for(const [x,z] of pts) if(ok(x,z,.2)||(x===cx&&z===cz)) C(g,F.lampEmit,.2,.22,.06,x,H-.06,z,32).castShadow=false; }
    else {
      const stp=id==='lux'?1.3:1.6; let n=0;
      for (let x=bb.x0+stp/2; x<bb.x1; x+=stp) for (let z=bb.z0+stp/2; z<bb.z1; z+=stp) if (ok(x,z,.45)){ C(g,F.lampEmit,.045,.045,.008,x,H-.008,z,16).castShadow=false; n++; }
      if (!n) C(g,F.lampEmit,.045,.045,.008,cx,H-.008,cz,16).castShadow=false;
      if (id==='lux' && A>8 && r.type!=='wet'){
        const P=r.poly; for (let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(len<1.2) continue;
          const u=[(b[0]-a[0])/len,(b[1]-a[1])/len]; let nn=[-u[1],u[0]]; const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2; if(!inPoly(P,mx+nn[0]*.3,mz+nn[1]*.3)) nn=[-nn[0],-nn[1]];
          const m=new THREE.Mesh(new THREE.BoxGeometry(len-.8,.012,.02),F.led); m.position.set(mx+nn[0]*.32,H-.03,mz+nn[1]*.32); m.rotation.y=Math.atan2(-u[1],u[0]); g.add(m); }
      }
    }
  }
  for (const [lid,x,z,kind] of PENDANTS){ if (lid!==L.id || id==='basic') continue;
    const drop=.95; C(g,F.black,.003,.003,drop,x,H-drop,z,6).castShadow=false;
    if (kind==='ring' && id==='lux'){ const ring_=new THREE.Mesh(new THREE.TorusGeometry(.5,.016,10,80),F.handle); ring_.rotation.x=Math.PI/2; ring_.position.set(x,H-drop-.02,z); g.add(ring_); const r2=new THREE.Mesh(new THREE.TorusGeometry(.5,.007,8,80),F.led); r2.rotation.x=Math.PI/2; r2.position.set(x,H-drop-.04,z); g.add(r2); }
    else { const sh=new THREE.Mesh(new THREE.CylinderGeometry(.05,.2,.24,32,1,true),F.pendant||F.black); sh.position.set(x,H-drop-.12,z); g.add(sh); const b=new THREE.Mesh(new THREE.SphereGeometry(.045,12,8),F.bulb); b.position.set(x,H-drop-.2,z); g.add(b); }
  }
}
function buildLights2(L, g, id){
  const k = id==='lux'?1.25 : id==='pre'?1.05 : .9;
  const rs=L.rooms.filter(r=>r.kind!=='shaft'&&area(r)>=3).sort((a,b)=>area(b)-area(a)).slice(0,10);
  for (const r of rs){ const a=area(r); const Lt=new THREE.PointLight(0xffd6a6, k*(a<8?.6:.85), Math.max(5,Math.sqrt(a)*2.3), 2); Lt.position.set(r.cent[0], L.H-.35, r.cent[1]); g.add(Lt); }
}

/* ---------------- merge static meshes per material (draw-call budget) ---------------- */
function mergeGroup(group){
  if (!MERGE) return;
  group.updateMatrixWorld(true);
  const buckets=new Map(), kill=[];
  group.traverse(o=>{
    if (!o.isMesh || o.userData.room || o.userData.keep) return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    if (mats.some(m=>m.transparent)) return;
    const geo=o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const inv=new THREE.Matrix4().copy(group.matrixWorld).invert(); const mtx=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
    geo.applyMatrix4(mtx);
    const keepAttrs=['position','normal','uv']; for (const k of Object.keys(geo.attributes)) if(!keepAttrs.includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv){ geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2)); }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const groups = Array.isArray(o.material) && geo.groups.length ? geo.groups : [{start:0,count:geo.attributes.position.count,materialIndex:0}];
    for (const gr of groups){
      const m=mats[gr.materialIndex]||mats[0];
      const part=new THREE.BufferGeometry();
      for (const k of keepAttrs){ const at=geo.attributes[k]; const arr=at.array.slice(gr.start*at.itemSize,(gr.start+gr.count)*at.itemSize); part.setAttribute(k,new THREE.BufferAttribute(arr,at.itemSize)); }
      const key=m.uuid+'|'+(o.castShadow?1:0); if(!buckets.has(key)) buckets.set(key,{m,cast:o.castShadow,geos:[]}); buckets.get(key).geos.push(part);
    }
    geo.dispose(); kill.push(o);
  });
  for (const o of kill){ o.parent.remove(o); o.geometry.dispose(); }
  for (const {m,cast,geos} of buckets.values()){
    for (let i=0;i<geos.length;i+=1500){ const mg=MERGE(geos.slice(i,i+1500),false); if(!mg) continue; const mesh=new THREE.Mesh(mg,m); mesh.castShadow=cast; mesh.receiveShadow=true; group.add(mesh); }
    geos.forEach(g=>g.dispose());
  }
}
