/* ============================== AUTO FURNISHING v2: polygon rooms, any wall angle ============================== */
// Every room edge that is backed by a wall becomes a "side": free intervals along it (not blocked by doors, low windows or
// door swing zones), the wall thickness and the inward normal. Pieces are placed against sides; each piece has a footprint
// that must lie inside the room and must not overlap earlier pieces or the clearance in front of a door.
function doorZone(L, rt, r){
  const pts=[];
  for (const o of rt.open){
    if (o.win) continue;
    const w=Math.hypot(o.bx-o.ax,o.bz-o.az); if (w<.3) continue;
    const u=[(o.bx-o.ax)/w,(o.bz-o.az)/w], n=[-u[1],u[0]], cx=(o.ax+o.bx)/2, cz=(o.az+o.bz)/2, h=(o.t||.12)/2;
    for (const sg of [1,-1]){
      if (!inPoly(r.poly, cx+n[0]*sg*(h+.25), cz+n[1]*sg*(h+.25))) continue;
      if (o.type==='door'){ const R=Math.max(.75, w+.05);
        for (let k=0;k<=8;k++) for (const f of [.35,.7,1]){ const a=k/8*Math.PI, dx=Math.cos(a)*R*f, dd=Math.sin(a)*R*f+.05; pts.push([cx+u[0]*dx+n[0]*sg*(h+dd), cz+u[1]*dx+n[1]*sg*(h+dd)]); } }
      else for (let k=0;k<=6;k++) for (const dd of [.1,.45,.85]){ const dx=(k/6-.5)*w; pts.push([cx+u[0]*dx+n[0]*sg*(h+dd), cz+u[1]*dx+n[1]*sg*(h+dd)]); }
    }
  }
  return pts;
}
function roomEdges(L, rt, r, maxSill=1.0){
  const P=r.poly, out=[];
  for (let i=0;i<P.length;i++){
    const a=P[i], b=P[(i+1)%P.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]); if (len<.5) continue;
    const u=[(b[0]-a[0])/len,(b[1]-a[1])/len]; let n=[-u[1],u[0]];
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
    if (!inPoly(P,mx+n[0]*.15,mz+n[1]*.15)) n=[-n[0],-n[1]];
    const proj=(x,z)=>(x-a[0])*u[0]+(z-a[1])*u[1], perp=(x,z)=>(x-a[0])*n[0]+(z-a[1])*n[1];
    const cov=[]; let t=0;
    for (const w of L.walls){
      if (w.kind==='low') continue;
      if (Math.abs(w.u[0]*u[1]-w.u[1]*u[0])>.035) continue;
      if (Math.abs(perp(w.a[0],w.a[1]))>.16) continue;
      const s0=proj(w.a[0],w.a[1]), s1=proj(w.b[0],w.b[1]), lo=Math.min(s0,s1), hi=Math.max(s0,s1);
      if (hi<0||lo>len) continue; cov.push([lo,hi]); t=Math.max(t,w.t);
    }
    const ops=[];
    for (const o of rt.open){
      if (o.win && o.sill>=maxSill) continue;
      if (Math.abs(perp(o.ax,o.az))>.18 || Math.abs(perp(o.bx,o.bz))>.18) continue;
      const s0=proj(o.ax,o.az), s1=proj(o.bx,o.bz); ops.push([Math.min(s0,s1),Math.max(s0,s1)]);
    }
    const ints=[]; let st=null;
    for (let p=0; p<=len+1e-6; p+=.05){
      const covered=cov.some(c=>p>=c[0]-.03&&p<=c[1]+.03);
      const qx=a[0]+u[0]*p+n[0]*(t/2+.25), qz=a[1]+u[1]*p+n[1]*(t/2+.25);
      const blocked=!covered || ops.some(o=>p>o[0]-.1&&p<o[1]+.1) || !inPoly(P,qx,qz);
      if (!blocked && st===null) st=p;
      if ((blocked||p>len-1e-6) && st!==null){ const e=blocked?p-.05:p; if(e-st>.3) ints.push({a:st+.06,b:e-.06}); st=null; }
    }
    let depth=0; for (const v of P) depth=Math.max(depth, perp(v[0],v[1])); depth-=t/2;
    out.push({i,a,u,n,len,t,ints,depth,used:[],ry:Math.atan2(n[0],n[1])});
  }
  return out;
}
function freeSegs(si){
  const segs=[];
  for (const it of si.ints){
    let s=[[it.a,it.b]];
    for (const [u0,u1] of si.used){ const nx=[]; for (const [s0,s1] of s){ if(u1<=s0||u0>=s1){ nx.push([s0,s1]); continue; } if(u0-s0>.05) nx.push([s0,u0]); if(s1-u1>.05) nx.push([u1,s1]); } s=nx; }
    segs.push(...s);
  }
  return segs;
}
const freeLen = si => freeSegs(si).reduce((m,[a,b])=>Math.max(m,b-a),0);
function atE(si, along, d){ const off=si.t/2+d; return [si.a[0]+si.u[0]*along+si.n[0]*off, si.a[1]+si.u[1]*along+si.n[1]*off]; }
function FP(si, c, w, d0, d1){ return [[c-w/2,d0],[c+w/2,d0],[c+w/2,d1],[c-w/2,d1]].map(([s,d])=>atE(si,s,d)); }
function depthAt(r, si, c){ let d=0; for (; d<14; d+=.05){ const [x,z]=atE(si,c,d+.05); if(!inPoly(r.poly,x,z)) break; } return d; }
function fpFree(ctx, fp){
  const [cx,cz]=polyCentroid(fp);
  const pts=fp.map(q=>[cx+(q[0]-cx)*.94, cz+(q[1]-cz)*.94]).concat([[cx,cz]]);
  for (const q of fp.map((q,i)=>{ const n=fp[(i+1)%fp.length]; return [(q[0]+n[0])/2,(q[1]+n[1])/2]; })) pts.push([cx+(q[0]-cx)*.94, cz+(q[1]-cz)*.94]);
  for (const q of pts) if (!inPoly(ctx.r.poly,q[0],q[1])) return false;
  for (const o of ctx.occ){ for (const q of pts) if (inPoly(o,q[0],q[1])) return false; for (const q of o) if (inPoly(fp,q[0],q[1])) return false; }
  for (const q of ctx.doors) if (inPoly(fp,q[0],q[1])) return false;
  return true;
}
// put a piece of width w (along the wall) occupying depth d0..d1 from the wall face; returns the centre along the side
function takeE(ctx, si, w, d0, d1, minDepth=0){
  const segs=freeSegs(si).filter(([a,b])=>b-a>=w).sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]));
  const cands=[]; for (const [a,b] of segs){ cands.push((a+b)/2); for (let s=a+w/2; s<=b-w/2+1e-6; s+=.1) cands.push(s); }
  for (const c of cands){
    if (minDepth && depthAt(ctx.r,si,c)<minDepth) continue;
    const fp=FP(si,c,w,d0,d1); if (!fpFree(ctx,fp)) continue;
    si.used.push([c-w/2,c+w/2]); ctx.occ.push(fp); return c;
  }
  return null;
}
function occupy(ctx, fp){ if (!fpFree(ctx,fp)) return false; ctx.occ.push(fp); return true; }
function mainAxis(r){ let best=0, u=[1,0]; const P=r.poly; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if(l>best){ best=l; u=[(b[0]-a[0])/l,(b[1]-a[1])/l]; } } return u; }
function rectFP(cx,cz,u,w,d){ const n=[-u[1],u[0]]; return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[cx+u[0]*a+n[0]*b, cz+u[1]*a+n[1]*b]); }
function cornerSpots(r, inset=.45){
  const P=r.poly, out=[];
  for (let i=0;i<P.length;i++){
    const p=P[(i+P.length-1)%P.length], q=P[i], s=P[(i+1)%P.length];
    const a=[p[0]-q[0],p[1]-q[1]], b=[s[0]-q[0],s[1]-q[1]], la=Math.hypot(...a)||1, lb=Math.hypot(...b)||1;
    let bis=[a[0]/la+b[0]/lb, a[1]/la+b[1]/lb]; const lb2=Math.hypot(...bis); if (lb2<1e-3) continue; bis=[bis[0]/lb2,bis[1]/lb2];
    const x=q[0]+bis[0]*inset*1.41, z=q[1]+bis[1]*inset*1.41; if (inPoly(P,x,z)) out.push([x,z]);
  }
  return out;
}
function plantIn(ctx, g, F, s=1, k=0){
  const sp=cornerSpots(ctx.r, .42); if (!sp.length) return;
  for (let j=0;j<sp.length;j++){ const [x,z]=sp[(j+k)%sp.length]; const fp=rectFP(x,z,[1,0],.5,.5); if (occupy(ctx,fp)){ plant(g,F,x,z,s); return; } }
}

/* ---------------- fixtures drawn on the plan ---------------- */
function inward(r, a, b){ const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1, u=[(b[0]-a[0])/l,(b[1]-a[1])/l]; let n=[-u[1],u[0]]; const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
  if (!inPoly(r.poly,mx+n[0]*.3,mz+n[1]*.3)) n=[-n[0],-n[1]]; return {u,n,l}; }
function facingRy(f){ const l=Math.hypot(f[0],f[1])||1; return Math.atan2(f[0]/l,f[1]/l); }
function buildFixture(L, rt, r, fx, F, id, ctx){
  const T=fx.type;
  if ((T==='counter'||T==='closet') && fx.a && fx.b){
    const {u,n,l}=inward(r,fx.a,fx.b); if (l<.3) return; const dep=+fx.depth||(T==='closet'?.6:.6);
    ctx.occ.push([fx.a,fx.b,[fx.b[0]+n[0]*dep,fx.b[1]+n[1]*dep],[fx.a[0]+n[0]*dep,fx.a[1]+n[1]*dep]]);
    const ry=Math.atan2(n[0],n[1]);
    if (T==='closet'){ const mx=(fx.a[0]+fx.b[0])/2+n[0]*dep/2, mz=(fx.a[1]+fx.b[1])/2+n[1]*dep/2; wardrobe(rt.fit,F,mx,mz,ry,l); return; }
    let A=fx.a, U=u; if (n[1]*u[0]-n[0]*u[1] < 0){ A=fx.b; U=[-u[0],-u[1]]; }
    const along=p=>Array.isArray(p)?Math.max(.3,Math.min(l-.3,(p[0]-A[0])*U[0]+(p[1]-A[1])*U[1])):null;
    let b0=0, b1=l; const fr=along(fx.fridge);
    if (fr!=null){ if (fr>l-.75) b1=l-.68; else if (fr<.75) b0=.68; }
    kitchenRun(rt.fit,F,id,{x:A[0],z:A[1],rot:ry,len:l,b0,b1,sink:along(fx.sink),cook:fx.cook?along(fx.cook):null,hood:!!fx.cook,fridge:fr!=null?(fr>l-.75?l-.33:fr<.75?.33:null):null,up:[b0+.05,b1],splash:[b0,b1,.92,id==='lux'?Math.min(2.5,L.H-.3):1.55]});
    return;
  }
  if ((T==='bathtub'||T==='shower') && fx.poly && fx.poly.length>=3){
    const P=fx.poly, [cx,cz]=polyCentroid(P); let best=0, u=[1,0]; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if(l>best){ best=l; u=[(b[0]-a[0])/l,(b[1]-a[1])/l]; } }
    let w=0; for (const q of P) w=Math.max(w,Math.abs((q[0]-cx)*-u[1]+(q[1]-cz)*u[0])*2);
    ctx.occ.push(P.map(q=>[q[0],q[1]]));
    const gg=G(rt.fit,cx,cz,Math.atan2(-u[1],u[0]));
    if (T==='bathtub'){ B(gg,F.ceramic,best,.55,w,0,0,0,.16); B(gg,M({color:'#e9ebea',roughness:.15}),best-.18,.02,w-.15,0,.535,0,.1); }
    else { B(gg,F.ceramic,best,.04,w,0,0,0,.01);
      let bi=-1, bd=-1; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2, d=-Math.hypot(mx-r.cent[0],mz-r.cent[1]); if (bi<0||d>bd){ bd=d; bi=i; } }
      const a=P[bi], b=P[(bi+1)%P.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); const gl=new THREE.Mesh(new THREE.PlaneGeometry(l*.9,2.0),F.showerGlass); gl.position.set((a[0]+b[0])/2,1.02,(a[1]+b[1])/2); gl.rotation.y=Math.atan2(-(b[1]-a[1])/l,(b[0]-a[0])/l); rt.fit.add(gl);
      C(rt.fit,id==='lux'?F.handle:F.chrome,.11,.11,.012,cx,L.H-.35,cz,32).castShadow=false; }
    return;
  }
  if (fx.x==null) return;
  const f=Array.isArray(fx.facing)?fx.facing:[r.cent[0]-fx.x, r.cent[1]-fx.z], fl=Math.hypot(f[0],f[1])||1, fu=[f[0]/fl,f[1]/fl], ry=facingRy(fu);
  const sq=(w,d)=>{ const s=[fu[1],-fu[0]]; return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[+fx.x+s[0]*a+fu[0]*b,+fx.z+s[1]*a+fu[1]*b]); };
  if (T==='toilet'){ ctx.occ.push(sq(.42,.62)); toilet(rt.fit,F,+fx.x-fu[0]*.3,+fx.z-fu[1]*.3,ry); }
  else if (T==='basin'){ const w=Math.max(.45,Math.min(1.4,+fx.w||.6)); ctx.occ.push(sq(w,.5)); vanity(rt.fit,F,+fx.x-fu[0]*.24,+fx.z-fu[1]*.24,ry,w,id); }
  else if (T==='washer'){ ctx.occ.push(sq(.6,.6)); const gg=G(rt.fit,+fx.x,+fx.z,ry); B(gg,F.white,.6,.85,.6,0,0,0,.02); C(gg,F.glassBlack,.17,.17,.02,0,.55,.305,24).rotation.x=Math.PI/2; }
  else if (T==='ac'){ ctx.occ.push(sq(.85,.35)); const gg=G(rt.fit,+fx.x,+fx.z,ry); B(gg,F.white,.85,.62,.32,0,.05,0,.02); C(gg,F.black,.22,.22,.02,-.12,.33,.165,28).rotation.x=Math.PI/2; }
}
function furnishRoom2(L, rt, g, r, F, id, aptHasDining){
  const k=r.kind, A=area(r);
  const ctx={r, occ:[], doors:doorZone(L,rt,r)};
  const edges=roomEdges(L,rt,r).sort((p,q)=>freeLen(q)-freeLen(p));
  const pick=(minLen,minDepth=0,excl=[])=>edges.find(si=>!excl.includes(si) && freeLen(si)>=minLen && si.depth>=minDepth);
  const [cx,cz]=r.cent;
  const FX=r.fixtures||[], has=t=>FX.some(f=>f.type===t);
  for (const fx of FX){ try{ buildFixture(L,rt,r,fx,F,id,ctx); }catch(e){ console.warn('fixture',fx,e); } }
  if (k==='kitchen' && has('counter')){ // kitchen drawn on the plan: only add an island or a small table if there is room
    if (!aptHasDining && A>11){ const u=mainAxis(r); for (const [dx,dz] of [[0,0],[.4,0],[-.4,0],[0,.4],[0,-.4]]){ const x=cx+dx, z=cz+dz; if (occupy(ctx,rectFP(x,z,u,2.4,1.9))){ const gg=G(g,x,z,Math.atan2(-u[1],u[0])); dining(gg,F,id,0,0,1.2,2); PENDANTS.push([L.id,x,z,'ring']); break; } } }
    return; }
  if ((k==='bath'||k==='wc') && (has('toilet')||has('basin')||has('bathtub')||has('shower'))) return;
  if (k==='laundry' && has('washer')) return;
  if (k==='service' && has('ac')) return;
  if (k==='bed'||k==='master'||k==='kids'||(k==='mamad'&&A>=9.5)){
    const bw = k==='master'?1.8 : k==='kids'?1.2 : A>12?1.6:1.4;
    let s1=null, c=null;
    for (const si of edges){ if (freeLen(si)<bw+.15 || si.depth<2.5) continue; const cc=takeE(ctx,si,bw+.12,0,2.2,2.55); if(cc!==null){ s1=si; c=cc; break; } }
    if (s1){
      const [x,z]=atE(s1,c,1.075+.04); bed(g,F,x,z,s1.ry,bw);
      for (const sg of [-1,1]){ const p=c+sg*(bw/2+.33); if (occupy(ctx,FP(s1,p,.5,0,.42))){ const [nx,nz]=atE(s1,p,.22); nightstand(g,F,nx,nz,s1.ry); } }
      const [ax,az]=atE(s1,c,.03); art(g,F,F.art[(r.id.length)%2],ax,1.4,az,s1.ry,Math.min(1.3,bw-.2),.7);
      const [rx,rz]=atE(s1,c,1.25); const rg=G(g,rx,rz,s1.ry); B(rg,F.rug,bw+.7,.012,2.5,0,.003,0);
    }
    if (!has('closet')) for (const s2 of edges){ if (s2===s1 || freeLen(s2)<1.0 || s2.depth<1.5) continue; const ww=Math.min(2.4,Math.floor((freeLen(s2)-.1)*10)/10); const c2=takeE(ctx,s2,ww,0,.62); if(c2!==null){ const [wx,wz]=atE(s2,c2,.3); wardrobe(g,F,wx,wz,s2.ry,ww); break; } }
    if (A>11.5 || k==='kids'){ for (const s3 of edges){ if (s3===s1 || freeLen(s3)<1.2 || s3.depth<1.9) continue; const c3=takeE(ctx,s3,1.15,0,1.1); if(c3!==null){ const [dx,dz]=atE(s3,c3,.33); desk(g,F,dx,dz,s3.ry,1.1); const [ox,oz]=atE(s3,c3,.85); officeChair(g,F,ox,oz,s3.ry+Math.PI); break; } } }
    plantIn(ctx,g,F,.9,r.id.length);
  } else if (k==='living'){
    let done=false;
    for (const s1 of edges){
      if (freeLen(s1)<1.7 || s1.depth<2.7) continue;
      const tw=Math.min(2.6,Math.floor((freeLen(s1)-.06)*10)/10), c=takeE(ctx,s1,tw,0,.45,2.7); if (c===null) continue;
      const [tx,tz]=atE(s1,c,0); tvWall(g,F,tx,tz,s1.ry,tw);
      const sl=Math.min(2.9,tw+.4), dmax=Math.min(depthAt(r,s1,c)-.55, 3.8);
      let ds=null; for (let d=dmax; d>=2.3; d-=.15){ if (occupy(ctx,FP(s1,c,sl,d-.5,d+.5))){ ds=d; break; } }
      if (ds!==null){
        const [sx,sz]=atE(s1,c,ds); sofa(g,F,sx,sz,s1.ry+Math.PI,sl,A>24);
        const [kx,kz]=atE(s1,c,ds-1.3); const kt=G(g,kx,kz,s1.ry); B(kt,F.tableTop,1.2,.05,.7,0,.36,0,.02); for(const lx of [-.5,.5]) for(const lz of [-.27,.27]) C(kt,F.metal,.015,.015,.36,lx,0,lz,8);
        B(kt,F.rug,3.0,.012,2.5,0,.003,0);
        for (const sg of [1,-1]){ const p=c+sg*(sl/2+.75); if (occupy(ctx,FP(s1,p,.85,ds-1.75,ds-.9))){ const [ax,az]=atE(s1,p,ds-1.32); armchair(g,F,ax,az,Math.atan2(-sg*s1.u[0],-sg*s1.u[1])); break; } }
      }
      done=true;
      if (!aptHasDining && A>22){
        const u=mainAxis(r);
        for (const f of [.3,-.3,.15,-.15,0]){ const bb=polyBBox(r.poly), sp=Math.max(bb.x1-bb.x0,bb.z1-bb.z0); const dx=cx+u[0]*sp*f, dz=cz+u[1]*sp*f;
          if (occupy(ctx,rectFP(dx,dz,u,3.4,2.4))){ const gg=G(g,dx,dz,Math.atan2(-u[1],u[0])); dining(gg,F,id,0,0,2.0,3); PENDANTS.push([L.id,dx,dz,'ring']); break; } }
      }
      break;
    }
    if (!done && A>6){ const s=pick(1.8,1.6); if (s){ const c=takeE(ctx,s,2.0,0,1.0); if (c!==null){ const [x,z]=atE(s,c,.52); sofa(g,F,x,z,s.ry,2.0,false); done=true; } } }
    if (!done && A>7){
      // free-standing seating group: search the room for a spot, facing the biggest window/slider, else along the room
      let f=null, best=0;
      for (const o of rt.open){ if (!(o.win||o.type==='slider')) continue; const mx=(o.ax+o.bx)/2, mz=(o.az+o.bz)/2, w=Math.hypot(o.bx-o.ax,o.bz-o.az);
        if (polyDist2(r.poly,mx,mz)>.3 || w<=best) continue; best=w; const d=Math.hypot(mx-cx,mz-cz)||1; f=[(mx-cx)/d,(mz-cz)/d]; }
      const u=mainAxis(r), dirs=[f,[-u[1],u[0]],[u[1],-u[0]],u,[-u[0],-u[1]]].filter(Boolean);
      const bb=polyBBox(r.poly), cands=[];
      for (let x=bb.x0+.6;x<bb.x1-.6;x+=.25) for (let z=bb.z0+.6;z<bb.z1-.6;z+=.25) if (inPoly(r.poly,x,z)) cands.push([x,z,Math.hypot(x-cx,z-cz)]);
      cands.sort((a,b)=>a[2]-b[2]);
      search: for (const [sl,dd,ws] of [[2.2,2.3,2.5],[1.9,2.1,2.2],[1.6,1.9,1.9]]) for (const fd of dirs) for (const [gx,gz] of cands){
        const side=[fd[1],-fd[0]]; if (!occupy(ctx,rectFP(gx,gz,side,ws,dd))) continue;
        const th=Math.atan2(fd[0],fd[1]); sofa(g,F,gx-fd[0]*(dd/2-.48),gz-fd[1]*(dd/2-.48),th,sl,false);
        const kt=G(g,gx+fd[0]*(dd/2-.45),gz+fd[1]*(dd/2-.45),th); B(kt,F.tableTop,Math.min(1.1,sl-.6),.05,.55,0,.36,0,.02); for(const lx of [-.4,.4]) for(const lz of [-.2,.2]) C(kt,F.metal,.015,.015,.36,lx*Math.min(1,(sl-.6)/1.1),0,lz,8);
        const rg=G(g,gx,gz,th); B(rg,F.rug,ws,.012,dd,0,.003,0); done=true; break search; }
    }
    plantIn(ctx,g,F,1.1,r.id.length); plantIn(ctx,g,F,.9,r.id.length+2);
  } else if (k==='kitchen'){
    let s1=null, c=null, len=0;
    for (const si of edges){ if (freeLen(si)<1.6 || si.depth<1.6) continue; len=Math.min(Math.floor(freeLen(si)*10)/10,4.4); const cc=takeE(ctx,si,len,0,.66); if(cc!==null){ s1=si; c=cc; break; } }
    if (s1){
      const start=c-len/2, end=c+len/2, lx=[s1.n[1],-s1.n[0]], rev=(lx[0]*s1.u[0]+lx[1]*s1.u[1])<0;
      const [ox,oz]=atE(s1, rev?end:start, 0);
      const fr=len>=2.6, b1=fr?len-.68:len;
      kitchenRun(rt.fit,F,id,{x:ox,z:oz,rot:s1.ry,len,b0:0,b1,sink:b1*.65,cook:Math.min(.6,b1*.25)+.05,hood:true,fridge:fr?len-.33:null,up:[.05,b1],splash:[0,b1,.92,id==='lux'?Math.min(2.5,L.H-.3):1.55]});
      // a second run on the perpendicular wall makes an L kitchen in deep rooms
      if (len<3.2){ for (const s2 of edges){ if (s2===s1 || Math.abs(s2.u[0]*s1.u[0]+s2.u[1]*s1.u[1])>.2 || freeLen(s2)<1.2) continue; const l2=Math.min(2.0,Math.floor((freeLen(s2)-.05)*10)/10); const c2=takeE(ctx,s2,l2,0,.66); if(c2!==null){ const lx2=[s2.n[1],-s2.n[0]], rv=(lx2[0]*s2.u[0]+lx2[1]*s2.u[1])<0; const [o2x,o2z]=atE(s2,rv?c2+l2/2:c2-l2/2,0); kitchenRun(rt.fit,F,id,{x:o2x,z:o2z,rot:s2.ry,len:l2,b0:0,b1:l2,up:[.05,l2],splash:[0,l2,.92,1.55]}); break; } } }
      if (depthAt(r,s1,c)>=3.8 && len>=2.4){ const il=Math.min(2.2,len-.4); if (occupy(ctx,FP(s1,c,il+.2,1.55,2.55))){ const [ix,iz]=atE(s1,c,2.05); island(rt.fit,F,id,ix,iz,il,s1.ry); PENDANTS.push([L.id,ix,iz,'cone']); for(const o of [-.5,.5]){ const [sx,sz]=atE(s1,c+o*il*.6,2.85); stool(g,F,sx,sz); } } }
      else if (!aptHasDining && A>11){ const d=Math.min(depthAt(r,s1,c)*.62, 2.6); if (d>=1.9 && occupy(ctx,FP(s1,c,2.6,d-1.1,d+1.1))){ const [dx,dz]=atE(s1,c,d); const gg=G(g,dx,dz,s1.ry); dining(gg,F,id,0,0,1.4,2); PENDANTS.push([L.id,dx,dz,'ring']); } }
    }
  } else if (k==='dining'){
    const u=mainAxis(r), bb=polyBBox(r.poly);
    for (const [len,n] of [[2.2,3],[1.8,3],[1.4,2]]){ if (occupy(ctx,rectFP(cx,cz,u,len+1.25,2.35))){ const gg=G(g,cx,cz,Math.atan2(-u[1],u[0])); dining(gg,F,id,0,0,len,n); PENDANTS.push([L.id,cx,cz,'ring']); break; } }
    plantIn(ctx,g,F,1,r.id.length);
  } else if (k==='bath'||k==='wc'||k==='laundry'){
    if (k==='laundry'){ const s1=pick(1.25); if(s1){ const c=takeE(ctx,s1,1.25,0,.62); if(c!==null) for(const o of [-.32,.32]){ const [x,z]=atE(s1,c+o,.31); const gg=G(rt.fit,x,z,s1.ry); B(gg,F.white,.6,.85,.6,0,0,0,.02); C(gg,F.glassBlack,.17,.17,.02,0,.55,.305,24).rotation.x=Math.PI/2; } } return; }
    const vw = k==='wc'?.5:Math.min(1.2,Math.max(.6,freeLen(edges[0]||{ints:[],used:[]})-.4));
    let s1=null; for (const si of edges){ const c=takeE(ctx,si,vw,0,.5); if(c!==null){ const [x,z]=atE(si,c,0); vanity(rt.fit,F,x,z,si.ry,vw,id); s1=si; break; } }
    for (const si of edges){ const c=takeE(ctx,si,.55,0,.68); if(c!==null){ const [x,z]=atE(si,c,0); toilet(rt.fit,F,x,z,si.ry); break; } }
    if (k==='bath'){
      let ok=false;
      if (A>=4.2) for (const si of edges){ if (freeLen(si)<1.7) continue; const c=takeE(ctx,si,1.7,0,.78); if(c!==null){ const [x,z]=atE(si,c,.38); const gg=G(rt.fit,x,z,si.ry); B(gg,F.ceramic,1.7,.55,.75,0,0,0,.18); B(gg,M({color:'#e9ebea',roughness:.15}),1.52,.02,.6,0,.535,0,.12); ok=true; break; } }
      if (!ok) for (const si of edges){ if (freeLen(si)<.9) continue; const c=takeE(ctx,si,.9,0,.9); if(c!==null){ const [x,z]=atE(si,c+.45,.45); const gl=new THREE.Mesh(new THREE.PlaneGeometry(.9,2.0),F.showerGlass); gl.position.set(x,1.0,z); gl.rotation.y=si.ry+Math.PI/2; rt.fit.add(gl); const [hx,hz]=atE(si,c,.15); C(rt.fit,id==='lux'?F.handle:F.chrome,.11,.11,.012,hx,L.H-.35,hz,32).castShadow=false; const [fx,fz]=atE(si,c,.45); const tr=G(rt.fit,fx,fz,si.ry); B(tr,F.ceramic,.88,.02,.88,0,0,0); break; } }
    }
  } else if (k==='office'||k==='mamad'){
    for (const s1 of edges){ if (freeLen(s1)<1.3 || s1.depth<1.7) continue; const c=takeE(ctx,s1,1.3,0,1.1); if(c!==null){ const [dx,dz]=atE(s1,c,.33); desk(g,F,dx,dz,s1.ry,1.3); const [ox,oz]=atE(s1,c,.85); officeChair(g,F,ox,oz,s1.ry+Math.PI); break; } }
    for (const s2 of edges){ if (freeLen(s2)<1.4) continue; const c=takeE(ctx,s2,1.4,0,.4); if(c!==null){ const [x,z]=atE(s2,c,.2); const bs=G(g,x,z,s2.ry); B(bs,F.joinery,1.4,2.0,.38,0,0,0); for(let i=1;i<5;i++) B(bs,F.wood,1.34,.025,.34,0,i*.4,.02);
      const rb=rng(r.id.length*7+3); for(let sh=0;sh<4;sh++){ let bx=-.63; while(bx<.5){ const bw=.03+rb()*.04, bh=.22+rb()*.12; B(bs,F.book[Math.floor(rb()*7)],bw,bh,.24,bx+bw/2,.03+sh*.4+.025,0); bx+=bw+.004; if(rb()<.08) bx+=.15; } } break; } }
    if (A>9.5) for (const s3 of edges){ if (freeLen(s3)<2.0) continue; const c=takeE(ctx,s3,2.0,0,1.0); if(c!==null){ const [x,z]=atE(s3,c,.52); sofa(g,F,x,z,s3.ry,2.0,false); break; } }
    plantIn(ctx,g,F,.85,r.id.length);
  } else if ((k==='closet'||k==='storage') && !has('closet')){
    let n=0; for (const si of edges){ if (n>=2 || freeLen(si)<.9) continue; const ww=Math.min(2.4,Math.floor((freeLen(si)-.05)*10)/10), c=takeE(ctx,si,ww,0,.62); if(c===null) continue; n++; const [x,z]=atE(si,c,.3);
      if (k==='closet') wardrobe(g,F,x,z,si.ry,ww); else { const gg=G(g,x,z,si.ry); for(let i=0;i<4;i++) B(gg,F.joinery,ww,.03,.45,0,.4+i*.5,0); for (const sx of [-ww/2+.02,ww/2-.02]) B(gg,F.metal,.03,2.0,.45,sx,0,0); const rb=rng(r.id.length+n); for(let i=0;i<4;i++){ let bx=-ww/2+.1; while(bx<ww/2-.35){ const bw=.25+rb()*.2; B(gg,F.fabric2,bw,.22+rb()*.12,.35,bx+bw/2,.43+i*.5,0,.02); bx+=bw+.08; } } } }
  } else if (k==='hall'){
    if (A>3.5){ for (const s1 of edges){ if (freeLen(s1)<1.2) continue; const c=takeE(ctx,s1,1.1,0,.38); if(c!==null){ const [x,z]=atE(s1,c,.18); const gg=G(g,x,z,s1.ry); B(gg,F.wood,1.1,.8,.35,0,0,0,.01); B(gg,F.mirror,.75,1.0,.02,0,1.15,-.17); break; } } }
    if (A>6) plantIn(ctx,g,F,.8,r.id.length);
  } else if (k==='service'){
    let n=0; for (const si of edges){ if (n>=2) break; while (n<2){ const c=takeE(ctx,si,.9,0,.36); if(c===null) break; const [x,z]=atE(si,c,.18); const gg=G(rt.fit,x,z,si.ry); B(gg,F.white,.85,.62,.32,0,.05,0,.02); C(gg,F.black,.22,.22,.02,-.12,.33,.165,28).rotation.x=Math.PI/2; n++; } }
  } else if (k==='lobby'){
    for (const si of edges){ if (freeLen(si)<1.3) continue; const c=takeE(ctx,si,1.2,0,.3); if(c!==null){ const [x,z]=atE(si,c,.15); const gg=G(rt.fit,x,z,si.ry); B(gg,F.metal,1.2,.75,.28,0,1.0,0,.01); for(let i=1;i<4;i++) B(gg,F.black,.004,.73,.004,-.6+i*.3,1.01,.141); for(let j=1;j<3;j++) B(gg,F.black,1.18,.004,.004,0,1.0+j*.25,.141); break; } }
    if (A>8) plantIn(ctx,g,F,1.1,1);
  }
}
function furnishOutdoor2(L, rt, g, o, F, id){
  const A=area(o); if (A<2.2) return;
  const r={...o, cent:polyCentroid(o.poly)};
  const ctx={r, occ:[], doors:doorZone(L,rt,r)};
  const edges=roomEdges(L,rt,r,9).sort((p,q)=>freeLen(q)-freeLen(p));
  const y=o.dy||0, gy=G(g,0,0,0,y);
  const [cx,cz]=r.cent;
  if (o.kind==='garden'){
    const u=mainAxis(r);
    if (A>12 && occupy(ctx,rectFP(cx,cz,u,2.6,2.6))){ const gg=G(gy,cx,cz,Math.atan2(-u[1],u[0])); C(gg,F.wood,.55,.55,.04,0,.72,0,40); C(gg,F.metal,.05,.07,.72,0,0,0,12); for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4; chair(gg,F,Math.cos(a)*.85,Math.sin(a)*.85,-a-Math.PI/2); } }
    for (let i=0;i<Math.min(4,Math.floor(A/12)+1);i++) plantIn(ctx,gy,F,1.2,i*2);
    return;
  }
  let placed=false;
  if (A>=7) for (const si of edges){ if (freeLen(si)<2.2 || si.depth<2.0) continue; const c=takeE(ctx,si,2.3,0,1.0); if(c===null) continue; const [x,z]=atE(si,c,.52); sofa(gy,F,x,z,si.ry,2.3,false);
    const [tx,tz]=atE(si,c,1.5); if (occupy(ctx,rectFP(tx,tz,[1,0],.8,.8))){ C(gy,F.wood,.4,.4,.04,tx,.4,tz,40); C(gy,F.metal,.06,.06,.4,tx,0,tz,12); } placed=true; break; }
  if (!placed){ const u=mainAxis(r); if (occupy(ctx,rectFP(cx,cz,u,1.7,.9))){ const gg=G(gy,cx,cz,Math.atan2(-u[1],u[0])); C(gg,F.wood,.3,.3,.03,0,.7,0,32); C(gg,F.metal,.03,.05,.7,0,0,0,10); chair(gg,F,-.55,0,Math.PI/2); chair(gg,F,.55,0,-Math.PI/2); } }
  plantIn(ctx,gy,F,1,o.id.length); if (A>=9) plantIn(ctx,gy,F,1.15,o.id.length+2);
}
function buildFurniture2(L, rt, g, F, id){
  const dining=new Set(L.rooms.filter(r=>r.kind==='dining').map(r=>r.apt));
  for (const r of L.rooms){ if (r.kind==='shaft'||r.kind==='stair'||!r.detail) continue; try{ furnishRoom2(L,rt,g,r,F,id,dining.has(r.apt)); }catch(e){ console.warn('furnish',r.id,e); } }
  for (const o of L.outdoor){ if (o.kind==='roof'||!o.detail) continue; try{ furnishOutdoor2(L,rt,g,o,F,id); }catch(e){ console.warn('furnish out',o.id,e); } }
}
