/* ============================== SITE v2: terrain, surfaces, retaining walls, fences, trees, cars, plot ============================== */
const siteRoot = new THREE.Group(); scene.add(siteRoot);
const plotHi = new THREE.Group(); scene.add(plotHi);
const dryTex = () => ctex('dry',1024,(x,N)=>{ x.fillStyle='#8f8a66'; x.fillRect(0,0,N,N); blotch(x,N,5,.32,61,'#5f5a3c','#c9bf91'); blotch(x,N,22,.2,62,'#4f5a33','#d8cfa2'); blotch(x,N,64,.12,64,'#3f4a2a','#e0d6ad');
  const r=rng(63); for(let i=0;i<16000;i++){ const X=r()*N, Y=r()*N; x.fillStyle=r()<.5?`rgba(70,62,40,${.18+r()*.3})`:`rgba(96,112,58,${.22+r()*.35})`; x.fillRect(X,Y,1+r()*2.4,1+r()*2.4); }
  for(let i=0;i<9000;i++){ const X=r()*N, Y=r()*N, l=2+r()*6; x.strokeStyle=`hsla(${48+r()*40},${22+r()*25}%,${34+r()*28}%,.55)`; x.lineWidth=1; x.beginPath(); x.moveTo(X,Y); x.lineTo(X+(r()-.5)*3,Y-l); x.stroke(); }
  for(let i=0;i<140;i++){ const X=r()*N, Y=r()*N, rr=.8+r()*2.2; x.fillStyle=`rgba(${165+r()*35},${160+r()*30},${140+r()*30},.55)`; x.beginPath(); x.ellipse(X,Y,rr,rr*.7,r()*3,0,7); x.fill(); } },[1/5,1/5]);
const terrM  = M({map:dryTex(), roughness:.97}, true);
const lawnM  = M({map:grassTex(), roughness:.95, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-2}, true);
const asphM  = M({map:tileTex('asph',{base:'#55585a',grout:'#55585a',cols:1,rows:1,sizeU:3,sizeV:3,style:'speckle',seed:401,groutPx:0,N:512}), roughness:.92, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4}, true);
const paverM = M({map:tileTex('paver',{base:'#bdb4a5',grout:'#968d7f',cols:6,rows:12,sizeU:1.2,sizeV:1.2,bond:true,style:'concrete',seed:402,groutPx:2,vary:.05}), roughness:.85, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-6}, true);
const parkM  = M({map:tileTex('parkRed',{base:'#9a5a4c',grout:'#7a463b',cols:5,rows:10,sizeU:1.0,sizeV:1.0,bond:true,style:'concrete',seed:403,groutPx:2,vary:.05}), roughness:.88, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-6}, true);
const driveM = M({map:tileTex('driveGrey',{base:'#9a968f',grout:'#7f7b74',cols:5,rows:10,sizeU:1.0,sizeV:1.0,bond:true,style:'concrete',seed:404,groutPx:2,vary:.04}), roughness:.88, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-5}, true);
const walkM  = M({map:tileTex('walkRed',{base:'#a3634f',grout:'#80493b',cols:6,rows:12,sizeU:1.2,sizeV:1.2,bond:true,style:'concrete',seed:405,groutPx:2,vary:.05}), roughness:.86, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-6}, true);
const poleM = M({color:'#3a3d40', roughness:.5, metalness:.6}, true);
const lampM = M({color:'#fff3dc', roughness:.3, emissive:new THREE.Color('#ffe2b8'), emissiveIntensity:.05}, true);
const GEMIT = [{m:lampM, day:.05, night:3.5}];
const lineM  = M({color:'#f3f3ef', roughness:.6, polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-10}, true);
const fenceM = M({color:'#2a2c2e', roughness:.5, metalness:.6}, true);
const copingM= M({color:'#d9d0bd', roughness:.7}, true);
const nbM    = M({color:'#ebe7df', roughness:.9}, true);
const nbRoofM= M({color:'#c9c5bd', roughness:.95}, true);
const trunkM = M({color:'#5b4636',roughness:.9},true), leafAM=M({color:'#3e6430',roughness:.8},true), leafBM=M({color:'#56793a',roughness:.8},true), oliveM=M({color:'#6f7d52',roughness:.85},true), scrubM=M({color:'#5a6640',roughness:.9},true), cypM=M({color:'#2f4a2a',roughness:.85},true);
const carPaint = ['#e9e9e6','#1d1f22','#8b9096','#2b3f5c','#8c1f1f','#c9c3b5','#3c4a3f'].map(c=>M({color:c, roughness:.28, metalness:.55}, true));
const tyreM = M({color:'#141414', roughness:.8}, true), carGlassM = M({color:'#1b232b', roughness:.08, metalness:.6}, true);
const bndM = new THREE.MeshBasicMaterial({color:0xff4d1a, transparent:true, opacity:.95, depthWrite:false, side:THREE.DoubleSide});
const bldM = new THREE.MeshBasicMaterial({color:0x1f7ae0, transparent:true, opacity:.9, depthWrite:false, side:THREE.DoubleSide});
const stakeM = new THREE.MeshBasicMaterial({color:0xff4d1a});

let SITE={}, SPOTS=[], FLATS=[], FOOTS=[], TERRAIN=null, TERR_BB=null;
const toY = v => (v==null||isNaN(+v)) ? null : (+v > 100 ? +v-DATUM : +v);   // absolute (e.g. 246.40) or already relative
let PLANE=null; // [h0, dh/dx, dh/dz] relative to the datum: the survey's best-fit ground plane
const planeH = (x,z) => PLANE ? PLANE[0]+PLANE[1]*x+PLANE[2]*z : 0;
function idw(x,z){
  if (!SPOTS.length) return planeH(x,z);
  let sw=PLANE?.02:0, s=0;
  for (const p of SPOTS){ const d2=(p.x-x)*(p.x-x)+(p.z-z)*(p.z-z); const w=1/Math.pow(d2+.35,1.3); sw+=w; s+=w*(p.y-planeH(p.x,p.z)); }
  return planeH(x,z) + (sw>0 ? s/sw : 0);
}
function polyDist(P,x,z){ let d=1e9; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length]; d=Math.min(d,segPoint(x,z,a[0],a[1],b[0],b[1]).d); } return d; }
function terrainH(x,z){
  for (const f of FOOTS) if (inPoly(f.poly,x,z)) return f.y;
  for (const f of FLATS) if (inPoly(f.poly,x,z)) return f.y;
  let h=idw(x,z), wsum=1, acc=h;
  for (const f of [...FOOTS,...FLATS]){ const d=polyDist(f.poly,x,z); if (d<f.blend){ const w=Math.pow(1-d/f.blend,2)*4; acc+=w*f.y; wsum+=w; } }
  return acc/wsum;
}
function plinthBottom(B_){
  if (B_.levels[0] && B_.levels[0].below) return -.6;
  const f=FOOTS.find(f=>f.bld===B_.id); if(!f) return -.6;
  let m=1e9; const P=f.poly; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length]; for(let t=0;t<=1;t+=.1){ const x=a[0]+(b[0]-a[0])*t, z=a[1]+(b[1]-a[1])*t; let h=idw(x,z); for (const g of FLATS){ if(polyDist(g.poly,x,z)<.6){ h=Math.min(h,g.y); } } m=Math.min(m,h); } }
  return Math.min(-.6, m-B_.base-.15);
}
// subdivide a flat ShapeGeometry so it can drape over the terrain
function drape(geo, yOff, maxEdge=1.2){
  let g=geo.index ? geo.toNonIndexed() : geo; const P=g.attributes.position.array, U=g.attributes.uv.array;
  let tris=[]; for(let i=0;i<P.length/9;i++){ tris.push([[P[i*9],P[i*9+2],U[i*6],U[i*6+1]],[P[i*9+3],P[i*9+5],U[i*6+2],U[i*6+3]],[P[i*9+6],P[i*9+8],U[i*6+4],U[i*6+5]]]); }
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,(a[3]+b[3])/2], el=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  for (let pass=0; pass<7; pass++){ let any=false; const nt=[];
    for (const [a,b,c] of tris){ if (Math.max(el(a,b),el(b,c),el(c,a))<=maxEdge){ nt.push([a,b,c]); continue; } any=true; const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a); nt.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]); }
    tris=nt; if(!any) break; }
  const pos=new Float32Array(tris.length*9), uv=new Float32Array(tris.length*6);
  tris.forEach((t,i)=>t.forEach((v,j)=>{ pos[i*9+j*3]=v[0]; pos[i*9+j*3+1]=terrainH(v[0],v[1])+yOff; pos[i*9+j*3+2]=v[1]; uv[i*6+j*2]=v[2]; uv[i*6+j*2+1]=v[3]; }));
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.BufferAttribute(pos,3)); out.setAttribute('uv',new THREE.BufferAttribute(uv,2)); out.computeVertexNormals();
  return out;
}
function surface(poly, mat, yOff){ const sh=shapesOf([[ring(poly)]]); if(!sh.length) return null; const g0=new THREE.ShapeGeometry(sh); g0.rotateX(-Math.PI/2); const m=new THREE.Mesh(drape(g0,yOff),mat); m.receiveShadow=true; siteRoot.add(m); return m; }
function strip(pts, width, yOff, mat, parent, closed){
  // a flat ribbon following a polyline over the terrain
  const P=[], idx=[]; const seq=[]; const n=pts.length, segs=closed?n:n-1;
  for (let i=0;i<segs;i++){ const a=pts[i], b=pts[(i+1)%n], L=Math.hypot(b[0]-a[0],b[1]-a[1]), k=Math.max(1,Math.ceil(L/.5)); for(let j=0;j<k;j++){ const t=j/k; seq.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, (b[0]-a[0])/L, (b[1]-a[1])/L]); } }
  if (!closed){ const a=pts[n-2], b=pts[n-1], L=Math.hypot(b[0]-a[0],b[1]-a[1]); seq.push([b[0],b[1],(b[0]-a[0])/L,(b[1]-a[1])/L]); } else seq.push(seq[0]);
  seq.forEach(([x,z,ux,uz],i)=>{ const nx=-uz*width/2, nz=ux*width/2, y=terrainH(x,z)+yOff; P.push(x+nx,y,z+nz, x-nx,y,z-nz); if(i){ const q=i*2; idx.push(q-2,q-1,q, q-1,q+1,q); } });
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat); m.renderOrder=3; parent.add(m); return m;
}
function treeAt(g,x,z,r){
  const y=terrainH(x,z), s=Math.max(.5,Math.min(2.2,(r||2)/2)), kind = (r||2)<1.1 ? 'cyp' : (Math.floor(x*7+z*13)%3===0 ? 'olive' : 'broad');
  const t=G(g,x,z,0,y);
  if (kind==='cyp'){ C(t,trunkM,.08,.1,.6,0,0,0,8); const c=new THREE.Mesh(new THREE.ConeGeometry(.55,5.2,14,4),cypM); c.position.y=3.1; c.scale.set(1,1,1); c.castShadow=true; t.add(c); const c2=new THREE.Mesh(new THREE.SphereGeometry(.6,14,10),cypM); c2.position.y=1.2; c2.scale.set(1,1.6,1); t.add(c2); return; }
  t.scale.setScalar(s); C(t,trunkM,.12,.2,kind==='olive'?1.5:2.4,0,0,0,10); const rr=rng(Math.floor(x*31+z*17+999));
  const n=kind==='olive'?5:7;
  for (let i=0;i<n;i++){ const geo=new THREE.SphereGeometry(.9+rr()*.6,20,14); const p=geo.attributes.position, s1=rr()*9, s2=rr()*9; for(let k=0;k<p.count;k++){ const X=p.getX(k),Y=p.getY(k),Z=p.getZ(k); const f=1+.16*Math.sin(X*3.1+s1)*Math.sin(Y*2.7+s2)*Math.sin(Z*3.4)+.06*Math.sin(X*9+Z*7+s2); p.setXYZ(k,X*f,Y*f*.8,Z*f); } geo.computeVertexNormals();
    const m=new THREE.Mesh(geo, kind==='olive'?oliveM:(rr()<.5?leafAM:leafBM)); m.position.set((rr()-.5)*1.8,(kind==='olive'?1.6:2.4)+rr()*1.5,(rr()-.5)*1.8); m.castShadow=true; m.receiveShadow=true; t.add(m); }
}
function carAt(g, cx, cz, ang, k){
  const y=terrainH(cx,cz), c=G(g,cx,cz,ang,y), paint=carPaint[k%carPaint.length];
  B(c,paint,1.8,.62,4.45,0,.32,0,.16); const cab=B(c,carGlassM,1.6,.5,2.3,0,.9,-.15,.18); cab.scale.set(1,1,1);
  B(c,paint,1.62,.05,2.0,0,1.38,-.2,.02);
  for (const [wx,wz] of [[-.82,1.38],[.82,1.38],[-.82,-1.38],[.82,-1.38]]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.24,20),tyreM); w.rotation.z=Math.PI/2; w.position.set(wx,.33,wz); w.castShadow=true; c.add(w); }
  for (const sx of [-.6,.6]){ B(c,M({color:'#fff6e0',roughness:.3,emissive:new THREE.Color('#000')},true),.32,.08,.03,sx,.62,2.225); B(c,M({color:'#a01818',roughness:.4},true),.3,.08,.03,sx,.66,-2.225); }
}
function buildSite(){
  for (const c of [...siteRoot.children]){ siteRoot.remove(c); disposeTree(c); }
  for (const c of [...plotHi.children]){ plotHi.remove(c); disposeTree(c); }
  SITE = PROJECT.site || {};
  SPOTS = (SITE.spot_levels||[]).map(p=>({x:+p.x, z:+p.z, y:toY(p.v)})).filter(p=>p.y!=null && isFinite(p.x) && isFinite(p.z));
  PLANE = Array.isArray(SITE.terrain_plane) ? [toY(SITE.terrain_plane[0]), +SITE.terrain_plane[1], +SITE.terrain_plane[2]] : null;
  // building footprints: union of the ground-floor rooms, at the building's ±0.00 (slightly below)
  FOOTS=[]; FLATS=[];
  for (const B_ of BLDS){ const L0=B_.levels.find(L=>L.ground)||B_.levels[0]; if(!L0) continue; const mp=mpUnion(L0.rooms.map(r=>r.poly)); for (const poly of mp) FOOTS.push({bld:B_.id, poly:poly[0], y:B_.base+L0.level-.02, blend:.3});
    for (const o of L0.outdoor) FLATS.push({poly:o.poly, y:B_.base+(o.level!=null?o.level:0)-.02, blend:1.6, kind:o.kind});
    for (const L of B_.levels) if (L!==L0) for (const o of L.outdoor) if (o.kind==='garden') FLATS.push({poly:o.poly, y:B_.base+(o.level!=null?o.level:L.level)-.02, blend:1.6, kind:'garden'}); }
  if (!SPOTS.length){ for (const f of FOOTS){ const [x,z]=polyCentroid(f.poly); SPOTS.push({x,z,y:f.y}); } }
  for (const p of (SITE.parking||[])) if (p.poly && p.poly.length>=3){ const y=p.level!=null?toY(p.level):idw(...polyCentroid(p.poly)); FLATS.push({poly:ring(p.poly), y, blend:1.0, kind:'parking'}); }
  for (const p of (SITE.flats||[])) if (p.poly && p.poly.length>=3) FLATS.push({poly:ring(p.poly), y:toY(p.level), blend:p.blend||1.5, kind:p.kind||'flat'});
  // terrain grid
  const xs=[], zs=[]; const addPts=P=>P.forEach(q=>{ xs.push(q[0]); zs.push(q[1]); });
  if (PLOT) addPts(PLOT); LEVELS.forEach(L=>L.walls.forEach(w=>{ xs.push(w.a[0],w.b[0]); zs.push(w.a[1],w.b[1]); }));
  const bb={x0:Math.min(...xs)-45, x1:Math.max(...xs)+45, z0:Math.min(...zs)-45, z1:Math.max(...zs)+45}; TERR_BB=bb;
  const st=.6, nx=Math.ceil((bb.x1-bb.x0)/st), nz=Math.ceil((bb.z1-bb.z0)/st);
  const pos=new Float32Array((nx+1)*(nz+1)*3), uv=new Float32Array((nx+1)*(nz+1)*2), idx=[];
  for (let j=0;j<=nz;j++) for (let i=0;i<=nx;i++){ const x=bb.x0+i*st, z=bb.z0+j*st, k=j*(nx+1)+i; pos[k*3]=x; pos[k*3+1]=terrainH(x,z); pos[k*3+2]=z; uv[k*2]=x; uv[k*2+1]=-z; }
  for (let j=0;j<nz;j++) for (let i=0;i<nx;i++){ const a=j*(nx+1)+i, b=a+1, c=a+nx+1, d=c+1; idx.push(a,c,b, b,c,d); }
  const tg=new THREE.BufferGeometry(); tg.setAttribute('position',new THREE.BufferAttribute(pos,3)); tg.setAttribute('uv',new THREE.BufferAttribute(uv,2)); tg.setIndex(idx); tg.computeVertexNormals();
  TERRAIN=new THREE.Mesh(tg,terrM); TERRAIN.receiveShadow=true; TERRAIN.userData.keep=true; siteRoot.add(TERRAIN);
  const edgeY=(terrainH(bb.x0,bb.z0)+terrainH(bb.x1,bb.z0)+terrainH(bb.x0,bb.z1)+terrainH(bb.x1,bb.z1))/4;
  ground.position.set((bb.x0+bb.x1)/2, edgeY-.08, (bb.z0+bb.z1)/2); ground.material=terrM; ground.scale.set(3,1,3);
  sky.position.set(PCEN[0],0,PCEN[1]);
  // surfaces
  for (const r of (SITE.roads||[])) if (r.poly) surface(r.poly, asphM, .03);
  for (const d of (SITE.driveways||[])) if (d.poly) surface(d.poly, d.kind==='asphalt'?asphM:driveM, .035);
  for (const d of (SITE.sidewalks||[])) if (d.poly) surface(d.poly, walkM, .04);
  for (const g of (SITE.gardens||[])) if (g.poly) surface(g.poly, lawnM, .025);
  for (const B_ of BLDS) for (const L of B_.levels) for (const o of L.outdoor) if (o.kind==='garden') surface(o.poly, lawnM, .028);
  for (const p of (SITE.paths||[])) if (p.poly) surface(p.poly, p.kind==='red'?walkM:paverM, .045);
  (SITE.parking||[]).forEach((p,k)=>{ if(!p.poly||p.poly.length<4) return; surface(p.poly, parkM, .045);
    const P=ring(p.poly), E=P.map((a,i)=>{ const b=P[(i+1)%P.length]; return {a,b,l:Math.hypot(b[0]-a[0],b[1]-a[1])}; }).sort((m,n)=>n.l-m.l);
    for (const e of E.slice(0,2)) strip([e.a,e.b], .1, .06, lineM, siteRoot, false);
    const L0=E[0], ang=Math.atan2(L0.b[0]-L0.a[0], L0.b[1]-L0.a[1]); const [cx,cz]=polyCentroid(P);
    if ((k*7+3)%10<6 && L0.l>4.4) carAt(siteRoot, cx, cz, ang+((k%2)?Math.PI:0), k);
  });
  // retaining walls: from below the lower side to the given top (or just above the higher side)
  for (const w of (SITE.retaining_walls||[])){
    if (!w.a||!w.b) continue; const a=w.a, b=w.b, L=Math.hypot(b[0]-a[0],b[1]-a[1]); if (L<.2) continue;
    const u=[(b[0]-a[0])/L,(b[1]-a[1])/L], n=[-u[1],u[0]], t=Math.max(.2,+w.t||.3), k=Math.max(1,Math.ceil(L/1.5));
    for (let i=0;i<k;i++){ const s0=i*L/k, s1=(i+1)*L/k, m=(s0+s1)/2, x=a[0]+u[0]*m, z=a[1]+u[1]*m;
      const h1=terrainH(x+n[0]*(t/2+.7), z+n[1]*(t/2+.7)), h2=terrainH(x-n[0]*(t/2+.7), z-n[1]*(t/2+.7));
      const top = w.top!=null ? toY(w.top) : Math.max(h1,h2)+.3, bot=Math.min(h1,h2)-.4; if (top-bot<.1) continue;
      const ry=Math.atan2(-u[1],u[0]);
      const m1=new THREE.Mesh(meterUV(new THREE.BoxGeometry(s1-s0+.01,top-bot,t),x,(top+bot)/2,z),stoneM); m1.position.set(x,(top+bot)/2,z); m1.rotation.y=ry; m1.castShadow=m1.receiveShadow=true; siteRoot.add(m1);
      const cp=new THREE.Mesh(new THREE.BoxGeometry(s1-s0+.01,.06,t+.06),copingM); cp.position.set(x,top+.03,z); cp.rotation.y=ry; cp.castShadow=true; siteRoot.add(cp); }
  }
  // fences: painted metal railings (on retaining walls or on the ground), split so they follow the terrain
  const fM = RAIL.style==='metal-x' ? M({color:RAIL.color, roughness:.45, metalness:.45}, true) : fenceM;
  for (const f of (SITE.fences||[])){
    if (!f.a||!f.b) continue; const a=f.a, b=f.b, L=Math.hypot(b[0]-a[0],b[1]-a[1]); if (L<.3) continue; const h=+f.h||1.1, base=f.base!=null?toY(f.base):null;
    const n=Math.max(1,Math.ceil(L/3));
    for (let i=0;i<n;i++){ const p0=[a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n], p1=[a[0]+(b[0]-a[0])*(i+1)/n, a[1]+(b[1]-a[1])*(i+1)/n];
      const top=(x,z)=>{ if (base!=null) return base; let y=terrainH(x,z); for (const w of (SITE.retaining_walls||[])){ if(!w.a||!w.b) continue; const q=segPoint(x,z,w.a[0],w.a[1],w.b[0],w.b[1]); if (q.d<.45){ const t=w.top!=null?toY(w.top):null; y = t!=null ? Math.max(y,t) : y; } } return y; };
      metalRail(siteRoot, p0, p1, top(p0[0],p0[1]), top(p1[0],p1[1]), h, fM); }
  }
  for (const t of (SITE.trees||[])) if (t.x!=null) treeAt(siteRoot,+t.x,+t.z,+t.r||2);
  for (const p of (SITE.poles||[])) if (p.x!=null){ const y=terrainH(+p.x,+p.z), h=+p.h||3.5; C(siteRoot,poleM,.05,.07,h,+p.x,y,+p.z,12); const hd=C(siteRoot,lampM,.2,.12,.18,+p.x,y+h,+p.z,20); hd.castShadow=false; C(siteRoot,poleM,.22,.22,.03,+p.x,y+h+.18,+p.z,20); }
  { // low scrub on the open land around the plot (not on surfaces, buildings or roads)
    const rr=rng(907), pts=[], hard=[...(SITE.roads||[]),...(SITE.driveways||[]),...(SITE.parking||[]),...(SITE.paths||[]),...(SITE.neighbours||[])].filter(p=>p.poly).map(p=>p.poly);
    for (let i=0;i<900 && pts.length<260;i++){ const x=bb.x0+10+rr()*(bb.x1-bb.x0-20), z=bb.z0+10+rr()*(bb.z1-bb.z0-20);
      if (PLOT && (inPoly(PLOT,x,z) || polyDist(PLOT,x,z)<1.5)) continue; if (hard.some(P=>inPoly(P,x,z))) continue; if (FOOTS.some(f=>polyDist(f.poly,x,z)<3)) continue; pts.push([x,z,.35+rr()*.7]); }
    if (pts.length){ const geo=new THREE.IcosahedronGeometry(1,1); const p=geo.attributes.position; for(let k=0;k<p.count;k++){ const X=p.getX(k),Y=p.getY(k),Z=p.getZ(k); const f=1+.18*Math.sin(X*5+Z*3)+.12*Math.sin(Y*7); p.setXYZ(k,X*f,Math.max(-.2,Y)*f*.65,Z*f); } geo.computeVertexNormals();
      const im=new THREE.InstancedMesh(geo,scrubM,pts.length), mt=new THREE.Matrix4(), q=new THREE.Quaternion(), sv=new THREE.Vector3();
      pts.forEach(([x,z,s],i)=>{ q.setFromAxisAngle(new THREE.Vector3(0,1,0),rr()*6); sv.set(s*(1+rr()*.6),s,s*(1+rr()*.6)); mt.compose(new THREE.Vector3(x,terrainH(x,z)+s*.1,z),q,sv); im.setMatrixAt(i,mt); });
      im.castShadow=true; im.receiveShadow=true; im.userData.keep=true; siteRoot.add(im); } }
  for (const nb of (SITE.neighbours||[])){ if(!nb.poly||nb.poly.length<3) continue; const P=ring(nb.poly); const y0=Math.min(...P.map(q=>terrainH(q[0],q[1])))-.3, h=+nb.h||7.5;
    const g=slabGeom([[P]], y0, h+.3); if(g){ const m=new THREE.Mesh(g,[nbRoofM,nbM]); m.castShadow=m.receiveShadow=true; siteRoot.add(m); } }
  // plot boundary, stakes, building lines
  if (PLOT){
    strip(PLOT, .34, .07, bndM, plotHi, true);
    for (const [x,z] of PLOT){ const y=terrainH(x,z); const st_=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,2.4,12),stakeM); st_.position.set(x,y+1.2,z); plotHi.add(st_); const cone=new THREE.Mesh(new THREE.ConeGeometry(.16,.3,16),stakeM); cone.position.set(x,y+2.55,z); plotHi.add(cone); }
  }
  for (const bl of (SITE.building_lines||[])){ const P=(bl.pts||bl).map(q=>[+q[0],+q[1]]); if (P.length<2) continue;
    for (let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1], L=Math.hypot(b[0]-a[0],b[1]-a[1]); for (let t=0;t<L;t+=1.0){ const e=Math.min(L,t+.6); strip([[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L],[a[0]+(b[0]-a[0])*e/L,a[1]+(b[1]-a[1])*e/L]], .14, .08, bldM, plotHi, false); } } }
  siteRoot.traverse(o=>{ if (o.isInstancedMesh) o.userData.keep=true; }); mergeGroup(siteRoot);
  const ext=Math.max(TERR_BB.x1-TERR_BB.x0, TERR_BB.z1-TERR_BB.z0)/2-25; sc.left=-ext; sc.right=ext; sc.top=ext; sc.bottom=-ext; sc.far=260; sc.updateProjectionMatrix();
}
