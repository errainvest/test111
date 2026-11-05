/* ============================== GENERIC BUILD ============================== */
let houseRoot=null, PENDANTS=[];
function disposeTree(o){ o.traverse(n=>{ if(n.geometry) n.geometry.dispose(); }); }

function buildFloors(L, rt, g, F){
  const holes = L.stairHoles||[];
  for (const r of L.rooms){
    if (r.void){ rt.colliders.push({x0:r.x0+.06,x1:r.x1-.06,z0:r.z0+.06,z1:r.z1-.06}); continue; }
    const mat = r.type==='wet'?F.floorWet : r.type==='bed'||r.type==='closet'?F.floorBed : r.type==='balcony'?F.deck : F.floorLiving;
    const hs = holes.filter(h=>h[0]<r.x1&&h[2]>r.x0&&h[1]<r.z1&&h[3]>r.z0).map(h=>[Math.max(h[0],r.x0),Math.max(h[1],r.z0),Math.min(h[2],r.x1),Math.min(h[3],r.z1)]);
    for (const q of rectMinus(r, hs)) floorRect(rt,g,mat,q.x0,q.z0,q.x1,q.z1,.002,r);
    hs.forEach(h=>rt.colliders.push({x0:h[0]+.05,x1:h[2]-.05,z0:h[1]+.05,z1:h[3]-.05}));
    if (r.type!=='balcony') sidePanels(L, rt, g, r, F.skirt, .07, 0, true);
    if (r.type==='wet') sidePanels(L, rt, g, r, F.wetWall, L.H-.01, .004, false);
  }
}
function buildSlab(L, g, F, top){
  const th=top-L.H;
  for (const r0 of L.rooms){
    if (r0.type==='balcony' || r0.void) continue;
    for (const r of rectMinus(r0, r0.holes||[])){
      const w=r.x1-r.x0, d=r.z1-r.z0, cx=(r.x0+r.x1)/2, cz=(r.z0+r.z1)/2;
      const geo = meterUV(new THREE.BoxGeometry(w,th,d), cx, L.H+th/2, cz);
      const m=new THREE.Mesh(geo,[F.facade,F.facade,F.roofTop,F.ceilPaint,F.facade,F.facade]);
      m.position.set(cx,L.H+th/2,cz); m.castShadow=m.receiveShadow=true; g.add(m);
    }
  }
}
function buildTopRoof(L, g, F, kind){
  const rs=L.rooms.filter(r=>r.type!=='balcony' && !r.void);
  if (!rs.length) return;
  if (kind==='flat'){ buildSlab(L,g,F,L.H+.35);
    for (const r of rs) for (const [w,d,x,z] of [[r.x1-r.x0,.15,(r.x0+r.x1)/2,r.z0],[r.x1-r.x0,.15,(r.x0+r.x1)/2,r.z1],[.15,r.z1-r.z0,r.x0,(r.z0+r.z1)/2],[.15,r.z1-r.z0,r.x1,(r.z0+r.z1)/2]]){
      const cx=x+(w<.2?(x===r.x0?-.08:.08):0), cz=z+(d<.2?(z===r.z0?-.08:.08):0);
      if (inside(L, cx+(w<.2?(x===r.x0?-.3:.3):0), cz+(d<.2?(z===r.z0?-.3:.3):0))) continue;
      B(g,F.facade,w,.4,d,x,L.H+.35,z);
    }
    return; }
  for (const r of rs) B(g,F.ceilPaint,r.x1-r.x0,.12,r.z1-r.z0,(r.x0+r.x1)/2,L.H,(r.z0+r.z1)/2).castShadow=true;
  const x0=Math.min(...rs.map(r=>r.x0))-.4, x1=Math.max(...rs.map(r=>r.x1))+.4, z0=Math.min(...rs.map(r=>r.z0))-.4, z1=Math.max(...rs.map(r=>r.z1))+.4;
  if (x1-x0>=z1-z0) hipRoof(g, tileRoofM, x0,z0,x1,z1, L.H+.14, 27*Math.PI/180);
  else hipRoofZ(g, tileRoofM, x0,z0,x1,z1, L.H+.14, 27*Math.PI/180);
}
function hipRoofZ(g, mat, x0,z0,x1,z1, y, pitch){
  const W=x1-x0, Dp=z1-z0, tp=Math.tan(pitch), cp=Math.cos(pitch), h=W/2*tp, xc=(x0+x1)/2;
  const r1=[xc,y+h,z0+W/2], r2=[xc,y+h,z1-W/2], A=[x0,y,z0],Bq=[x1,y,z0],Cq=[x1,y,z1],Dq=[x0,y,z1], P=[], U=[];
  const tri=(a,b,c,uv)=>{ for(const v of [a,b,c]){ P.push(...v); U.push(...uv(v)); } };
  const wu=v=>[v[2],(v[0]-x0)/cp], eu=v=>[v[2],(x1-v[0])/cp], nu=v=>[v[0],(v[2]-z0)/cp], su=v=>[v[0],(z1-v[2])/cp];
  tri(A,r1,Dq,wu); tri(Dq,r1,r2,wu); tri(Bq,Cq,r2,eu); tri(Bq,r2,r1,eu); tri(A,Bq,r1,nu); tri(Cq,Dq,r2,su);
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat); m.material.side=THREE.DoubleSide; m.castShadow=m.receiveShadow=true; g.add(m);
  const so=new THREE.Mesh(new THREE.PlaneGeometry(W,Dp),soffitM); so.rotation.x=Math.PI/2; so.position.set(xc,y-.005,(z0+z1)/2); g.add(so);
}
function buildStraightStairs(g, r, rise){
  const alongX = (r.x1-r.x0) >= (r.z1-r.z0), len = alongX? r.x1-r.x0 : r.z1-r.z0, wid = alongX? r.z1-r.z0 : r.x1-r.x0;
  const n=Math.max(8,Math.round(rise/.175)), h=rise/n, t=Math.min(.3,(len-.1)/n), w=Math.min(wid-.1,1.1);
  for(let i=0;i<n;i++){
    const top=(i+1)*h, a=r[alongX?'x0':'z0']+.05+t*(i+.5), c=(alongX?(r.z0+r.z1)/2:(r.x0+r.x1)/2);
    const x=alongX?a:c, z=alongX?c:a, sw=alongX?t:w, sd=alongX?w:t;
    B(g,stairBodyM,sw,top-.04,sd,x,0,z).castShadow=false; B(g,treadM,sw+.02,.04,sd+.02,x,top-.04,z);
  }
}

/* ---------------- auto furnishing ---------------- */
const SIDES = {N:{axis:'h',n:[0,1],ry:0}, S:{axis:'h',n:[0,-1],ry:Math.PI}, W:{axis:'v',n:[1,0],ry:Math.PI/2}, E:{axis:'v',n:[-1,0],ry:-Math.PI/2}};
function sideInfo(L, rt, r, s, maxSill=1.0){
  const S=SIDES[s], coord = s==='N'?r.z0: s==='S'?r.z1: s==='W'?r.x0: r.x1, a0=S.axis==='h'?r.x0:r.z0, a1=S.axis==='h'?r.x1:r.z1;
  const ops=rt.OPEN.filter(o=>o.axis===S.axis && Math.abs(o.coord-coord)<1e-6 && o.bot<maxSill);
  const ints=[]; let st=null, tw=.12;
  for (let p=a0; p<=a1+1e-6; p+=.05){
    const w=findWall(L,S.axis,coord,p), blocked=!w || ops.some(o=>p>o.s-.12&&p<o.e+.12);
    if (w) tw=w.t;
    if (!blocked && st===null) st=p;
    if ((blocked||p>a1-1e-6) && st!==null){ const e=blocked?p-.05:p; if(e-st>.3) ints.push({a:st+.1,b:e-.1}); st=null; }
  }
  return {s, ...S, coord, t:tw, ints, depth: S.axis==='h'? r.z1-r.z0 : r.x1-r.x0, used:[]};
}
function freeLen(si){ return si.ints.reduce((m,i)=>Math.max(m,i.b-i.a),0); }
function take(si, w){
  let best=null;
  for (const it of si.ints){
    const segs=[[it.a,it.b]];
    si.used.forEach(([u0,u1])=>{ for(let k=segs.length-1;k>=0;k--){ const [s0,s1]=segs[k]; if(u1<=s0||u0>=s1) continue; segs.splice(k,1,...[[s0,u0],[u1,s1]].filter(([a,b])=>b-a>.05)); } });
    for (const [a,b] of segs) if (b-a>=w && (!best || b-a>best[1]-best[0])) best=[a,b];
  }
  if (!best) return null;
  const c=(best[0]+best[1])/2; si.used.push([c-w/2,c+w/2]); return c;
}
function at(si, along, d){ const off=si.t/2+d; return si.axis==='h' ? [along, si.coord+si.n[1]*off] : [si.coord+si.n[0]*off, along]; }
function furnishRoom(L, rt, g, r, F, id, hasDining){
  const sides=['N','S','W','E'].map(s=>sideInfo(L,rt,r,s)).sort((a,b)=>freeLen(b)-freeLen(a));
  const opp = s=>({N:'S',S:'N',W:'E',E:'W'})[s];
  const cx=(r.x0+r.x1)/2, cz=(r.z0+r.z1)/2, A=area(r);
  const pick=(minLen,minDepth=0,excl=[])=>sides.find(si=>!excl.includes(si.s) && freeLen(si)>=minLen && si.depth>=minDepth);
  const plantAt=(s=1)=>{ const k=[[r.x0+.4,r.z0+.4],[r.x1-.4,r.z0+.4],[r.x0+.4,r.z1-.4],[r.x1-.4,r.z1-.4]]; const p=k[(r.id.length+L.rooms.indexOf(r))%4]; plant(g,F,p[0],p[1],s); };
  const k=r.kind;
  if (k==='bed'||k==='master'||k==='kids'||(k==='mamad'&&A>=10)){
    const bw = k==='master'?1.8 : k==='kids'?1.2 : A>12?1.6:1.4;
    const s1=pick(bw+.2,2.5); if(!s1) return;
    const c=take(s1,bw+.15); if(c===null) return;
    const [x,z]=at(s1,c,1.075+.05); bed(g,F,x,z,s1.ry,bw);
    for (const sg of [-1,1]){ const p=c+sg*(bw/2+.33); if (s1.ints.some(i=>p-.26>i.a&&p+.26<i.b)){ const [nx,nz]=at(s1,p,.22); nightstand(g,F,nx,nz,s1.ry); } }
    const [ax,az]=at(s1,c,.03); art(g,F,F.art[(r.id.length)%2],ax,1.4,az,s1.ry,Math.min(1.3,bw-.2),.7);
    const s2=pick(1.3,1.6,[s1.s]); if (s2){ const ww=Math.min(2.2,freeLen(s2)-.1), c2=take(s2,ww); if(c2!==null){ const [wx,wz]=at(s2,c2,.3); wardrobe(g,F,wx,wz,s2.ry,ww); } }
    if (A>12 || k==='kids'){ const s3=pick(1.2,2,[s1.s,s2&&s2.s]); if(s3){ const c3=take(s3,1.15); if(c3!==null){ const [dx,dz]=at(s3,c3,.33); desk(g,F,dx,dz,s3.ry,1.1); const [ox,oz]=at(s3,c3,.85); officeChair(g,F,ox,oz,s3.ry+Math.PI); } } }
    const [rx,rz]=at(s1,c,1.2); B(g,F.rug,s1.axis==='h'?bw+.6:2.6,.012,s1.axis==='h'?2.6:bw+.6,rx,.003,rz);
  } else if (k==='living'){
    const s1=pick(2.2,3.0);
    if (s1){ const tw=Math.min(2.6,freeLen(s1)-.1), c=take(s1,tw);
      if (c!==null){ const [tx,tz]=at(s1,c,0); tvWall(g,F,tx,tz,s1.ry,tw);
        const ds=Math.min(s1.depth-.65, 3.7); const [sx,sz]=at(s1,c,ds); sofa(g,F,sx,sz,s1.ry+Math.PI,Math.min(2.9,tw+.4),A>22);
        const [kx,kz]=at(s1,c,ds-1.35); B(g,F.tableTop,s1.axis==='h'?1.2:.7,.05,s1.axis==='h'?.7:1.2,kx,.36,kz,.02); for(const lx of [-.5,.5]) for(const lz of [-.27,.27]) C(g,F.metal,.015,.015,.36,kx+(s1.axis==='h'?lx:lz),0,kz+(s1.axis==='h'?lz:lx),8);
        const [rx,rz]=at(s1,c,ds-1.35); B(g,F.rug,s1.axis==='h'?3.0:2.6,.012,s1.axis==='h'?2.6:3.0,rx,.003,rz);
        const sideOff=Math.min(tw/2+.9, (s1.axis==='h'?r.x1-r.x0:r.z1-r.z0)/2-.5);
        const [ax,az]=at(s1,c+sideOff,ds-1.35); if (ax>r.x0+.4&&ax<r.x1-.4&&az>r.z0+.4&&az<r.z1-.4) armchair(g,F,ax,az,s1.ry+(sideOff>0?-1:1)*Math.PI/2);
        if (!hasDining && A>24){
          const along=s1.axis==='h'?r.x1-r.x0:r.z1-r.z0;
          if (along>=6){ const dc = c + (c-(s1.axis==='h'?r.x0:r.z0) < along/2 ? along/2 - .2 : -along/2 + .2) * .9; const [dx,dz]=at(s1,dc,s1.depth/2-.1);
            if (dx>r.x0+1&&dx<r.x1-1&&dz>r.z0+1&&dz<r.z1-1){ const gg=G(g,dx,dz,s1.axis==='h'?0:Math.PI/2); dining(gg,F,id,0,0,2.0,3); PENDANTS.push([L.id,dx,dz,'ring']); } }
        }
      } }
    plantAt(1.1);
  } else if (k==='kitchen'){
    const s1=pick(1.8,1.8); if(!s1) return;
    const len=Math.min(freeLen(s1),4.4), c=take(s1,len); if(c===null) return;
    const start=c-len/2, end=c+len/2;
    const rev = s1.s==='S'||s1.s==='W';
    const [ox,oz]=at(s1, rev?end:start, 0);
    const fr=len>=2.6; const b1=fr?len-.68:len;
    kitchenRun(g,F,id,{x:ox,z:oz,rot:s1.ry,len,b0:0,b1,sink:b1*.65,cook:Math.min(.6,b1*.25)+.05,hood:true,fridge:fr?len-.33:null,up:[.05,b1],splash:[0,b1,.92,id==='lux'?Math.min(2.5,L.H-.3):1.55]});
    if (s1.depth>=3.9 && len>=2.4){ const [ix,iz]=at(s1,c,2.05); const il=Math.min(2.2,len-.4); island(g,F,id,ix,iz,il,s1.ry); PENDANTS.push([L.id,ix,iz,'cone']);
      for(const o of [-.5,.5]){ const [sx,sz]=at(s1,c+o*il*.6,2.85); stool(g,F,sx,sz); } }
    else if (!hasDining && A>12){ const [dx,dz]=at(s1,c,s1.depth*.65); if(s1.depth>=3.2){ const gg=G(g,dx,dz,s1.axis==='h'?0:Math.PI/2); dining(gg,F,id,0,0,1.4,2); } }
  } else if (k==='dining'){
    const lx=r.x1-r.x0, lz=r.z1-r.z0, long=Math.max(lx,lz), len=Math.min(2.2,long-1.6);
    if (len>=1.1){ const gg=G(g,cx,cz,lx>=lz?0:Math.PI/2); dining(gg,F,id,0,0,len,len>1.9?3:2); PENDANTS.push([L.id,cx,cz,'ring']); }
    plantAt(1);
  } else if (k==='bath'||k==='wc'||k==='laundry'){
    if (k==='laundry'){ const s1=pick(1.3); if(s1){ const c=take(s1,1.3); if(c!==null) for(const o of [-.33,.33]){ const [x,z]=at(s1,c+o,.31); const gg=G(g,x,z,s1.ry); B(gg,F.white,.6,.85,.6,0,0,0,.02); } } return; }
    const s1=pick(k==='wc'?.6:.9); if(!s1) return;
    const vw=k==='wc'?.6:Math.min(1.4,freeLen(s1)-.2), c=take(s1,vw); if(c!==null){ const [x,z]=at(s1,c,0); vanity(g,F,x,z,s1.ry,vw,id); }
    const s2=sides.find(si=>si!==s1 && freeLen(si)>=.6) || s1; const c2=take(s2,.55); if(c2!==null){ const [x,z]=at(s2,c2,0); toilet(g,F,x,z,s2.ry); }
    if (k==='bath'){
      const s3=sides.find(si=>freeLen(si)>=1.7 && si.depth>=1.6 && si.used.length===0);
      if (s3){ const c3=take(s3,1.7); const [x,z]=at(s3,c3,.38); const gg=G(g,x,z,s3.ry); B(gg,F.ceramic,1.7,.55,.75,0,0,0,.18); B(gg,M({color:'#e9ebea',roughness:.15}),1.52,.02,.6,0,.535,0,.12); }
      else { const s4=sides.find(si=>freeLen(si)>=.9 && si.used.length===0) || sides[sides.length-1]; const c4=take(s4,.9);
        if (c4!==null){ const [x,z]=at(s4,c4+.45,.45); const gl=new THREE.Mesh(new THREE.PlaneGeometry(.9,2.0),F.showerGlass); gl.position.set(x,1.0,z); gl.rotation.y=s4.ry+Math.PI/2; g.add(gl); const [hx,hz]=at(s4,c4,.15); C(g,id==='lux'?F.handle:F.chrome,.11,.11,.012,hx,L.H-.35,hz,32).castShadow=false; } }
    }
  } else if (k==='office'||k==='mamad'){
    const s1=pick(1.3,1.8); if(s1){ const c=take(s1,1.4); if(c!==null){ const [dx,dz]=at(s1,c,.33); desk(g,F,dx,dz,s1.ry,1.4); const [ox,oz]=at(s1,c,.85); officeChair(g,F,ox,oz,s1.ry+Math.PI); } }
    const s2=pick(1.4,1.5,[s1&&s1.s]); if(s2){ const c=take(s2,1.5); if(c!==null){ const [x,z]=at(s2,c,.2); const bs=G(g,x,z,s2.ry); B(bs,F.joinery,1.5,2.0,.38,0,0,0); for(let i=1;i<5;i++) B(bs,F.wood,1.44,.025,.34,0,i*.4,.02);
      const rb=rng(r.id.length*7+3); for(let sh=0;sh<4;sh++){ let bx=-.68; while(bx<.55){ const bw=.03+rb()*.04, bh=.22+rb()*.12; B(bs,F.book[Math.floor(rb()*7)],bw,bh,.24,bx+bw/2,.03+sh*.4+.025,0); bx+=bw+.004; if(rb()<.08) bx+=.15; } } } }
    if (A>10){ const s3=pick(2.0,2.2,[s1&&s1.s,s2&&s2.s]); if(s3){ const c=take(s3,2.0); if(c!==null){ const [x,z]=at(s3,c,.52); sofa(g,F,x,z,s3.ry,2.0,false); } } }
    plantAt(.85);
  } else if (k==='closet'||k==='storage'){
    for (const si of sides.slice(0,2)){ if (freeLen(si)<1 || si.depth<1.2) continue; const ww=Math.min(2.4,freeLen(si)-.1), c=take(si,ww); if(c===null) continue; const [x,z]=at(si,c,.3); if(k==='closet') wardrobe(g,F,x,z,si.ry,ww); else { const gg=G(g,x,z,si.ry); for(let i=0;i<4;i++) B(gg,F.joinery,ww,.03,.45,0,.4+i*.5,0); } }
  } else if (k==='hall'){
    if (A>4){ const s1=pick(1.3,1.6); if(s1){ const c=take(s1,1.2); if(c!==null){ const [x,z]=at(s1,c,.18); const gg=G(g,x,z,s1.ry); B(gg,F.wood,1.2,.8,.35,0,0,0,.01); B(gg,F.mirror,.8,1.0,.02,0,1.15,-.17); } } }
    if (A>6) plantAt(.8);
  } else if (k==='balcony'){
    const wallSide=sides.find(si=>freeLen(si)>=2.2 && si.depth>=2.2);
    if (A>=8 && wallSide){ const c=take(wallSide,2.4); const [x,z]=at(wallSide,c,.55); sofa(g,F,x,z,wallSide.ry,2.4,false); const [tx,tz]=at(wallSide,c,1.55); C(g,F.wood,.4,.4,.04,tx,.4,tz,40); C(g,F.metal,.06,.06,.4,tx,0,tz,12); }
    else if (A>=3){ chair(g,F,cx-.4,cz,Math.PI/2); chair(g,F,cx+.4,cz,-Math.PI/2); }
    if (A>=3){ plant(g,F,r.x0+.45,r.z0+.45,1); if (A>=8) plant(g,F,r.x1-.45,r.z1-.45,1); }
  }
}
function buildFurnitureAuto(L, rt, g, F, id){
  const hasDining=L.rooms.some(r=>r.kind==='dining');
  for (const r of L.rooms) if (!r.void && !r.stair) furnishRoom(L, rt, g, r, F, id, hasDining);
}
function buildRoomLightsAuto(L, g, id){
  const k = id==='lux'?1.25 : id==='pre'?1.05 : .9;
  for (const r of L.rooms){
    if (r.void || area(r)<2) continue;
    const a=area(r), bal=r.type==='balcony';
    const n = a>30 ? 2 : 1, alongX=(r.x1-r.x0)>=(r.z1-r.z0);
    for (let i=0;i<n;i++){
      const t=(i+.5)/n, x=alongX? r.x0+(r.x1-r.x0)*t : (r.x0+r.x1)/2, z=alongX? (r.z0+r.z1)/2 : r.z0+(r.z1-r.z0)*t;
      const Lt=new THREE.PointLight(bal?0xffd2a0:0xffd6a6, k*(bal?.45 : a<6?.55:.85), Math.max(5,Math.sqrt(a/n)*2.2), 2);
      Lt.position.set(x, bal? L.H-.25 : L.H-.35, z); g.add(Lt);
    }
  }
}
function build(id){
  if (houseRoot){ scene.remove(houseRoot); disposeTree(houseRoot); }
  MATS.forEach(m=>m.dispose()); MATS=[]; EMIT=[]; PENDANTS=[];
  F = tierMats(id);
  houseRoot = new THREE.Group();
  LV = LEVELS.map(L=>{
    const root=new THREE.Group(); root.position.y=L.y; houseRoot.add(root);
    const rt={root, colliders:[], floors:[], OPEN:[]};
    for (const k of ['struct','furn','fix','slab','lights']){ rt[k]=new THREE.Group(); root.add(rt[k]); }
    buildWalls(L, rt, rt.struct, F);
    buildFloors(L, rt, rt.struct, F);
    buildRails(L, rt, rt.struct, F);
    return rt;
  });
  if (LV[0]) LV[0].floors.push(ground);
  LEVELS.forEach((L,i)=>{
    const rt=LV[i], up=LEVELS[i+1];
    if (up) buildSlab(L, rt.slab, F, up.y-L.y); else buildTopRoof(L, rt.slab, F, PLAN.roof==='flat'?'flat':'hip');
    for (const r of L.rooms) if (r.stair && up){ buildStraightStairs(rt.struct, r, up.y-L.y); rt.colliders.push({x0:r.x0+.05,x1:r.x1-.05,z0:r.z0+.05,z1:r.z1-.05}); }
    buildFurnitureAuto(L, rt, rt.furn, F, id);
  });
  LEVELS.forEach((L,i)=>{ buildFixtures(L, LV[i].fix, F, id, PENDANTS.filter(p=>p[0]===L.id).map(p=>[p[1],p[2],.95,p[3]])); buildRoomLightsAuto(L, LV[i].lights, id); });
  // plinth under each ground-floor room
  const pl=new THREE.Group(); houseRoot.add(pl);
  if (LEVELS[0]) for (const r of LEVELS[0].rooms){ if(r.void) continue; B(pl,plinthM,r.x1-r.x0+.3,.16,r.z1-r.z0+.3,(r.x0+r.x1)/2,-.16,(r.z0+r.z1)/2); }
  houseRoot.traverse(n=>{ if(n.isMesh && n.material && n.material.transparent){ n.castShadow=false; n.renderOrder=2; } });
  scene.add(houseRoot);
  applyState();
}

/* ---------------- site: trees and plot boundary ---------------- */
const siteG=new THREE.Group(); scene.add(siteG);
const plotG = new THREE.Group(), plotHi = new THREE.Group(); scene.add(plotG); plotG.add(plotHi);
const wallM = M({map:plasterTex('bwall','#cfc8bb',.18,2,95), roughness:.9}, true);
const fenceM = M({color:'#26282a', roughness:.5, metalness:.6}, true);
const bndM = new THREE.MeshBasicMaterial({color:0xff4d1a, transparent:true, opacity:.95, depthWrite:false});
const bldM = new THREE.MeshBasicMaterial({color:0x1f7ae0, transparent:true, opacity:.9, depthWrite:false});
const stakeM = new THREE.MeshBasicMaterial({color:0xff4d1a});
const trunkM=M({color:'#5b4636',roughness:.9},true), leafAM=M({color:'#3e6430',roughness:.8},true), leafBM=M({color:'#56793a',roughness:.8},true);
function tree(g,x,z,s){ const t=G(g,x,z,0); t.scale.setScalar(s); C(t,trunkM,.12,.18,2.4,0,0,0,10); const r=rng(Math.floor(x*31+z*17+999));
  for(let i=0;i<7;i++){ const geo=new THREE.SphereGeometry(.9+r()*.6,24,16); const p=geo.attributes.position, s1=r()*9, s2=r()*9; for(let k=0;k<p.count;k++){const X=p.getX(k),Y=p.getY(k),Z=p.getZ(k); const f=1+.16*Math.sin(X*3.1+s1)*Math.sin(Y*2.7+s2)*Math.sin(Z*3.4)+.06*Math.sin(X*9+Z*7+s2); p.setXYZ(k,X*f,Y*f*.85,Z*f);} geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,r()<.5?leafAM:leafBM); m.position.set((r()-.5)*1.8,2.4+r()*1.6,(r()-.5)*1.8); m.castShadow=true; m.receiveShadow=true; t.add(m);} }
function clearGroup(g){ for (const c of [...g.children]){ if(c===plotHi) continue; g.remove(c); disposeTree(c); } }
function buildSite(){
  clearGroup(siteG); clearGroup(plotG); for (const c of [...plotHi.children]){ plotHi.remove(c); disposeTree(c); }
  const b=BB, o=PLOT?{x0:PLOT.x0-4,x1:PLOT.x1+4,z0:PLOT.z0-4,z1:PLOT.z1+4}:{x0:b.x0-6,x1:b.x1+6,z0:b.z0-6,z1:b.z1+6};
  for (const [x,z,s] of [[o.x0,o.z0,1.2],[o.x1,(o.z0+o.z1)/2,1.1],[o.x0,o.z1-2,1.3],[o.x1-3,o.z1,1.0],[(o.x0+o.x1)/2-4,o.z0-1,1.15]]) tree(siteG,x,z,s);
  sky.position.set(C0[0],0,C0[1]); ground.position.set(C0[0],-.03,C0[1]); sun.target.position.set(C0[0],0,C0[1]);
  const ext=Math.max(b.x1-b.x0,b.z1-b.z0, PLOT?Math.max(PLOT.x1-PLOT.x0,PLOT.z1-PLOT.z0):0)/2+6; sc.left=-ext; sc.right=ext; sc.top=ext; sc.bottom=-ext; sc.updateProjectionMatrix();
  document.getElementById('plotRow').hidden=!PLOT;
  if (!PLOT) return;
  const P=PLOT;
  const side=(x0,z0,x1,z1)=>{ const h=z0===z1, L=h?x1-x0:z1-z0, cx=(x0+x1)/2, cz=(z0+z1)/2;
    B(plotG,wallM,h?L:.25,.7,h?.25:L,cx,-.03,cz); B(plotG,fenceM,h?L:.04,.04,h?.04:L,cx,1.75,cz); B(plotG,fenceM,h?L:.03,.03,h?.03:L,cx,.85,cz);
    for(let t=.12;t<L;t+=.15){ const bb=new THREE.Mesh(new THREE.BoxGeometry(.018,1.05,.018),fenceM); bb.position.set(h?x0+t:x0,1.195,h?z0:z0+t); plotG.add(bb); }
    const band=new THREE.Mesh(new THREE.BoxGeometry(h?L:.32,.02,h?.32:L),bndM); band.position.set(cx,.03,cz); band.renderOrder=3; plotHi.add(band);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(h?L:.27,.03,h?.27:L),bndM); cap.position.set(cx,.69,cz); cap.renderOrder=3; plotHi.add(cap); };
  side(P.x0,P.z0,P.x1,P.z0); side(P.x1,P.z0,P.x1,P.z1); side(P.x0,P.z1,P.x1,P.z1); side(P.x0,P.z0,P.x0,P.z1);
  for (const [x,z] of [[P.x0,P.z0],[P.x1,P.z0],[P.x1,P.z1],[P.x0,P.z1]]){ const st=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,2.6,12),stakeM); st.position.set(x,1.3,z); plotHi.add(st); }
  if (BLD){ const dash=(x0,z0,x1,z1)=>{ const h=z0===z1, a0=h?x0:z0, a1=h?x1:z1; for(let t=a0;t<a1;t+=.9){ const e=Math.min(a1,t+.55), m=(t+e)/2; const d=new THREE.Mesh(new THREE.BoxGeometry(h?e-t:.12,.02,h?.12:e-t),bldM); d.position.set(h?m:x0,.04,h?z0:m); d.renderOrder=3; plotHi.add(d); } };
    const Bl=BLD; dash(Bl.x0,Bl.z0,Bl.x1,Bl.z0); dash(Bl.x1,Bl.z0,Bl.x1,Bl.z1); dash(Bl.x0,Bl.z1,Bl.x1,Bl.z1); dash(Bl.x0,Bl.z0,Bl.x0,Bl.z1); }
}
