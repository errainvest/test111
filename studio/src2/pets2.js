/* ============================== PETS: two cats playing with a ball (PROJECT.site.pets) ============================== */
// PROJECT.site.pets = [{a:[x,z], b:[x,z]}]: the two cats sit at a and b, facing each other, and bat a ball back and forth.
// Everything is procedural (no assets): ellipsoid bodies with baked vertex-colour coats, 2-bone IK legs, a 9-joint tail.
const petsRoot = new THREE.Group(); petsRoot.name='pets'; scene.add(petsRoot);
let PETS = [], petsFrozen = false, petsFixedT = null, petsPinned = null;   // petsFixedT: a debug hook pins the animation to one moment
// ball radius (m); one swat-to-swat half cycle and the roll time (s); where the ball stops ahead of a cat, torso length factor, front paw radius (cat units)
const PET_BALL_R = .036, PET_HALF = 2.1, PET_TRAVEL = 1.45, PET_ZB = .28, ZS = .93, PAW_R = .023;
const petFurM   = M({vertexColors:true, roughness:.9}, true, .3);
const petBallM  = M({vertexColors:true, roughness:.38}, true, .7);
const petPupilM = M({color:'#070707', roughness:.06}, true, 1);
const petNoseM  = M({color:'#c4837d', roughness:.55}, true, .4);
const petEarInM = M({color:'#d9a7a1', roughness:.85}, true, .3);
const petEyeM   = { green:M({color:'#9dbb37', roughness:.1}, true, 1), amber:M({color:'#d8a334', roughness:.1}, true, 1) };
const COATS = {
  ginger:    { id:'ginger',    base:'#c8783a', dark:'#8a481b', light:'#f0d1a2', eye:'green' },
  greywhite: { id:'greywhite', base:'#82858c', dark:'#5d6066', light:'#f3f1ec', eye:'amber' },
};
for (const k in COATS){ const c=COATS[k]; c.C={ base:new THREE.Color(c.base), dark:new THREE.Color(c.dark), light:new THREE.Color(c.light) }; }
const sm01 = (a,b,x) => { const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
const hash1 = n => { const s=Math.sin(n*127.1+311.7)*43758.5453; return s-Math.floor(s); };
const _pv=new THREE.Vector3(), _pv2=new THREE.Vector3(), _pv3=new THREE.Vector3(), _pv4=new THREE.Vector3(), _pq=new THREE.Quaternion(), _pm=new THREE.Matrix4(), _pY=new THREE.Vector3(0,1,0);

// coat colour of a vertex. torso: torso-local (spine along +z, centre at 0); head: head-local; tail/leg: s = 0 at the root → 1 at the tip
function coatColour(coat, part, x, y, z, s){
  const C=coat.C, gw=coat.id==='greywhite', c=C.base.clone();
  if (part==='torso'){
    const phi=Math.abs(Math.atan2(x,y));                               // 0 along the spine, π under the belly
    const belly=sm01(gw?1.5:1.85, gw?2.15:2.45, phi);
    if (gw) c.lerp(C.dark, sm01(.8,0,phi)*.45);
    else { const st=Math.sin(z*46+Math.sin(phi*2.3)*1.2+x*5); c.lerp(C.dark, sm01(.2,.75,st)*(1-belly)*.8); c.lerp(C.dark, sm01(.45,0,phi)*.3); }
    c.lerp(C.light, belly*.92);
    c.lerp(C.light, sm01(gw?.1:.12, gw?.17:.2, z)*sm01(.03,-.04,y)*.9);            // bib
    c.lerp(C.light, sm01(.15,.2,z)*sm01(.05,-.01,y-(z-.15)*.6)*(gw?.95:.7));       // throat
  } else if (part==='head'){
    let lt=sm01(.038,.058,z)*sm01(.012,-.004,y);                                    // muzzle and chin
    if (gw) lt=Math.max(lt, sm01(.017,.007,Math.abs(x))*sm01(.03,.062,z)*sm01(.07,.035,y));   // white blaze
    else { c.lerp(C.dark, sm01(.55,.85,Math.cos(x*235))*sm01(.032,.05,y)*sm01(.042,.03,Math.abs(x))*.85);   // forehead "M" stripes
           c.lerp(C.dark, sm01(.03,.045,Math.abs(x))*sm01(-.014,-.004,y)*sm01(.012,.002,y)*sm01(.012,.03,z)*.45); }  // cheek stripe
    c.lerp(C.light, lt*.95);
    c.lerp(C.dark, sm01(.07,.1,y)*.3);                                               // ear tips
  } else if (part==='tail'){
    if (gw) c.lerp(C.dark, sm01(.5,1,s)*.6);
    else { c.lerp(C.dark, sm01(.3,.8,Math.sin(s*29))*.75); c.lerp(C.dark, sm01(.86,.95,s)); }
  } else if (part==='leg'){
    if (gw) c.lerp(C.light, sm01(.35,.55,s));                                        // white socks
    else { c.lerp(C.dark, sm01(.55,.9,Math.sin(s*14))*.35); c.lerp(C.light, sm01(.85,1,s)*.5); }
  } else if (part==='paw') c.lerp(C.light, gw?.95:.5);
  c.multiplyScalar(1+.06*Math.sin(x*173+y*97+z*41)*Math.sin(z*131+x*61-y*29));      // a little fur noise
  return c;
}
function petPaint(geo, fn){ const p=geo.attributes.position, col=new Float32Array(p.count*3);
  for (let i=0;i<p.count;i++){ const c=fn(p.getX(i),p.getY(i),p.getZ(i)); col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col,3)); return geo; }
function petEllip(rx,ry,rz, x,y,z, rotX=0, ws=26, hs=18){ const g=new THREE.SphereGeometry(1,ws,hs); g.scale(rx,ry,rz); if (rotX) g.rotateX(rotX); g.translate(x,y,z); return g; }
const petMerge = gs => { const g=THREE.BufferGeometryUtils.mergeBufferGeometries(gs); gs.forEach(q=>q.dispose()); return g; };
function petMesh(parent, geo, mat, shadow=true){ const m=new THREE.Mesh(geo,mat); m.castShadow=shadow; m.receiveShadow=true; parent.add(m); return m; }

function makeCat(coat, scale, seed, side){
  const root=new THREE.Group(); root.scale.setScalar(scale);
  const torso=new THREE.Group(); torso.position.y=.17; root.add(torso);
  // torso, chest, haunches and neck: one mesh in torso space
  const body=petEllip(.07,.078,.2, 0,0,0, 0, 32, 22);
  { const p=body.attributes.position; for (let i=0;i<p.count;i++){ const z=p.getZ(i), k=1+.1*(z/.2); p.setX(i,p.getX(i)*k); const y=p.getY(i); p.setY(i, y<0 ? y*(1+.05*(1-Math.abs(z)/.2)) : y*k); } }
  const tGeo=petMerge([body, petEllip(.064,.072,.075, 0,.004,.135), petEllip(.048,.066,.074, .04,-.004,-.122), petEllip(.048,.066,.074, -.04,-.004,-.122), petEllip(.046,.054,.07, 0,.048,.185, -.65)]);
  tGeo.scale(1,1,ZS);   // a compact cat, not a ferret
  petMesh(torso, petPaint(tGeo,(x,y,z)=>coatColour(coat,'torso',x,y,z)), petFurM);
  // head (pivot at the top of the neck), with separate ears and eyes so they can twitch and blink
  const head=new THREE.Group(); head.position.set(0,.083,.212*ZS); head.rotation.order='YXZ'; head.scale.setScalar(1.12); torso.add(head);
  const hGeo=petMerge([petEllip(.058,.053,.056, 0,.02,.015), petEllip(.052,.036,.042, 0,.002,.03), petEllip(.025,.018,.02, 0,-.006,.064), petEllip(.015,.011,.014, 0,-.02,.058)]);
  petMesh(head, petPaint(hGeo,(x,y,z)=>coatColour(coat,'head',x,y,z)), petFurM);
  petMesh(head, petEllip(.0085,.0062,.0055, 0,.003,.083), petNoseM, false);
  const ears=[-1,1].map(sx=>{ const e=new THREE.Group(); e.position.set(sx*.03,.058,.004); e.rotation.set(-.12,0,sx*-.32); head.add(e);
    const o=new THREE.ConeGeometry(.025,.052,4,1); o.rotateY(Math.PI/4); o.scale(1,1,.55); o.translate(0,.026,0);
    petMesh(e, petPaint(o,(x,y,z)=>coatColour(coat,'head',x+sx*.03,y+.058,z+.004)), petFurM);
    const i=new THREE.ConeGeometry(.017,.036,4,1); i.rotateY(Math.PI/4); i.scale(1,1,.3); i.translate(0,.02,.007); petMesh(e, i, petEarInM, false);
    e.userData.rz=e.rotation.z; return e; });
  const eyes=new THREE.Group(); eyes.position.y=.023; head.add(eyes);
  const ir=[], pu=[];
  for (const sx of [-1,1]){ const a=sx*.33, fx=Math.sin(a), fz=Math.cos(a), ex=sx*.0245, ez=.063;
    const g1=petEllip(.0125,.0125,.0075, 0,0,0); g1.rotateY(a); g1.translate(ex,0,ez); ir.push(g1);
    const g2=petEllip(.0068,.0098,.0035, 0,0,0); g2.rotateY(a); g2.translate(ex+fx*.0058,0,ez+fz*.0058); pu.push(g2); }
  petMesh(eyes, petMerge(ir), petEyeM[coat.eye], false); petMesh(eyes, petMerge(pu), petPupilM, false);
  // tail: a chain of capsules hanging from the rump, low and curling up at the tip (hunting/playing carriage)
  const tail=[]; const NT=9, SL=.034;
  let tp=new THREE.Group(); tp.position.set(0,.03,-.175*ZS); torso.add(tp);
  for (let i=0;i<NT;i++){ const j=i===0?tp:new THREE.Group(); if (i>0){ j.position.z=-SL; tail[i-1].add(j); }
    const r=.0185-.007*i/(NT-1), g=new THREE.CapsuleGeometry(r,SL,3,10); g.rotateX(Math.PI/2); g.translate(0,0,-SL/2);
    petMesh(j, petPaint(g,(x,y,z)=>coatColour(coat,'tail',x,y,z,(i+Math.min(1,Math.max(0,-z/SL)))/NT)), petFurM);
    j.userData.rx = i===0 ? -.55 : .12; j.rotation.x=j.userData.rx; tail.push(j); }
  // legs: 2 capsules + a paw each, placed by IK every frame (root space)
  const legs=[];
  const LEG=(sx,front)=>{ const a=front?.08:.078, b=front?.074:.075, ra=front?.022:.024, rb=front?.0165:.017, pr=front?PAW_R:.024;
    const up=new THREE.CapsuleGeometry(ra,a,3,10), lo=new THREE.CapsuleGeometry(rb,b,3,10), pw=petEllip(pr,pr*.62,pr*1.3, 0,0,.004);
    const L={ a, b, ra, th:0, front, piv:new THREE.Vector3(sx*(front?.04:.044), front?-.04:-.035, (front?.135:-.125)*ZS),
      rest:new THREE.Vector3(sx*(front?.04:.043), .016, (front?.145:-.155)*ZS),
      up:petMesh(root, petPaint(up,(x,y,z)=>coatColour(coat,'leg',x,y,z,Math.min(1,Math.max(0,.5-y/a))*.5)), petFurM),
      lo:petMesh(root, petPaint(lo,(x,y,z)=>coatColour(coat,'leg',x,y,z,.5+.5*Math.min(1,Math.max(0,.5-y/b)))), petFurM),
      paw:petMesh(root, petPaint(pw,(x,y,z)=>coatColour(coat,'paw',x,y,z)), petFurM),
      P:new THREE.Vector3(), T:new THREE.Vector3(), K:new THREE.Vector3() };
    legs.push(L); return L; };
  const fl=LEG(-1,true), fr=LEG(1,true); LEG(-1,false); LEG(1,false);
  const sx=side;   // which front paw plays: -1 / +1
  const V=(x,y,z)=>new THREE.Vector3(x,y,z), br=PET_BALL_R/scale, pr=PAW_R;   // the ball's radius in this cat's units; the paw rests on it, it does not sink in
  const cat={ root, torso, head, ears, eyes, tail, legs, play: sx<0?fl:fr, scale, seed, ph:seed*2.17,
    REST:V(sx*.04,.016,.145*ZS), RAISE:V(sx*.032,.1,.19), COCK:V(sx*.028,.1,.17), FOLLOW:V(sx*.008,.045,PET_ZB-.01),
    TRAP:V(sx*.012, br+(br+pr-.004)*Math.sin(.95), PET_ZB-(br+pr-.004)*Math.cos(.95)), STRIKE:V(sx*.012, br+.005, PET_ZB-br-pr+.002),
    cr:.3, lunge:0, hy:0, hp:0, roll:.05, tailAmp:.4, tailPh:seed, paw:new THREE.Vector3() };
  cat.play.rest=cat.REST;
  return cat;
}

// 2-bone IK: shoulder/hip P → elbow/hock K → paw T. The joint is a hinge about the cat's sideways axis, so it bends back
// for a leg pointing down and down for a leg reaching forward, and never flips from one side of the limb to the other.
function petLeg(L){
  const P=L.P, T=L.T, a=L.a, b=L.b;
  _pv.subVectors(T,P); let d=_pv.length(); const dmax=a+b-.002, dmin=Math.abs(a-b)+.004;
  if (d>dmax){ _pv.multiplyScalar(dmax/d); T.copy(P).add(_pv); d=dmax; } else if (d<dmin){ _pv.multiplyScalar(dmin/Math.max(d,1e-6)); T.copy(P).add(_pv); d=dmin; }
  _pv.multiplyScalar(1/d);                                        // unit P→T
  _pv2.set(1,0,0).cross(_pv); if (_pv2.lengthSq()<1e-8) _pv2.set(0,0,-1); _pv2.normalize();   // x̂ × (P→T): perpendicular to the limb, in the leg's plane
  const ca=Math.min(1,Math.max(-1,(a*a+d*d-b*b)/(2*a*d))), sa=Math.sqrt(1-ca*ca);
  L.K.copy(P).addScaledVector(_pv,a*ca).addScaledVector(_pv2,a*sa);
  const ymin=L.ra+.002, rho=a*sa;
  if (L.K.y<ymin && rho>1e-6){   // a crouched cat lifting its paw would push the elbow into the lawn: swing it out to the side instead
    const O=_pv3.copy(P).addScaledVector(_pv,a*ca), e2=_pv4.crossVectors(_pv,_pv2);   // the elbow circle: O + rho·(cos θ·hinge + sin θ·e2)
    const A=rho*_pv2.y, B=rho*e2.y, R=Math.hypot(A,B), C=ymin-O.y, base=Math.atan2(B,A);
    const wrap=t=>Math.atan2(Math.sin(t),Math.cos(t));
    let th=base;   // the highest point of the circle when ymin cannot be reached
    if (R>1e-9 && Math.abs(C)<R){ const d=Math.acos(C/R), t1=wrap(base+d), t2=wrap(base-d), d1=Math.abs(wrap(t1-L.th)), d2=Math.abs(wrap(t2-L.th));
      if (Math.abs(d1-d2)>1e-3) th = d1<d2 ? t1 : t2;   // stay on the branch of the last frame: no jumps
      else { const out=Math.sign(L.piv.x)||1; th = (_pv2.x*Math.cos(t1)+e2.x*Math.sin(t1))*out >= (_pv2.x*Math.cos(t2)+e2.x*Math.sin(t2))*out ? t1 : t2; } }   // a tie: swing outwards
    L.th=th; L.K.copy(O).addScaledVector(_pv2,rho*Math.cos(th)).addScaledVector(e2,rho*Math.sin(th));
  } else L.th=0;
  const bone=(m,p0,p1)=>{ m.position.addVectors(p0,p1).multiplyScalar(.5); _pv.subVectors(p0,p1).normalize(); m.quaternion.setFromUnitVectors(_pY,_pv); };
  bone(L.up,P,L.K); bone(L.lo,L.K,T); L.paw.position.copy(T);
}
const lerpTo=(out,a,b,k)=>out.copy(a).lerp(b,k);
function petPose(c, role, p, t, dt, ballW){
  const H=PET_HALF, TR=PET_TRAVEL, k=1-Math.exp(-dt*10);
  let cr, wig=0, lunge=0; const paw=c.paw;
  if (role==='recv'){        // the ball is coming: crouch, trap it, wiggle, cock the paw, swat
    cr = p<TR ? .2+.8*sm01(0,TR*.8,p) : p<H-.3 ? 1 : 1-.35*sm01(H-.3,H,p);
    wig = sm01(TR+.08,TR+.25,p)*(1-sm01(H-.42,H-.3,p));
    lunge = sm01(H-.12,H,p);
    if (p<TR-.3) paw.copy(c.REST); else if (p<TR-.06) lerpTo(paw,c.REST,c.RAISE,sm01(TR-.3,TR-.06,p));
    else if (p<TR+.05) lerpTo(paw,c.RAISE,c.TRAP,sm01(TR-.06,TR+.05,p)); else if (p<H-.3) paw.copy(c.TRAP);
    else if (p<H-.07) lerpTo(paw,c.TRAP,c.COCK,sm01(H-.3,H-.07,p)); else lerpTo(paw,c.COCK,c.STRIKE,sm01(H-.07,H,p));
  } else {                   // just swatted: follow through, then sit up a little and watch the ball go
    cr = .65-.45*sm01(0,.7,p);
    lunge = 1-sm01(.05,.45,p);
    if (p<.08) lerpTo(paw,c.STRIKE,c.FOLLOW,sm01(0,.08,p)); else if (p<.42) lerpTo(paw,c.FOLLOW,c.REST,sm01(.08,.42,p)); else paw.copy(c.REST);
  }
  c.cr += (cr-c.cr)*k; c.lunge += (lunge-c.lunge)*Math.min(1,k*2.5);
  const C_=c.cr, br=Math.sin(t*2.7+c.ph)*.5+.5, yaw=.075*wig*Math.sin(t*26.4);
  c.torso.position.set(-.135*Math.sin(yaw), .17-.035*C_+.002*br, -.01*C_+.025*c.lunge);
  c.torso.rotation.set(.11*C_, yaw, 0); c.torso.scale.set(1,1+.012*br,1);
  c.torso.updateMatrix();
  for (const L of c.legs){ L.P.copy(L.piv).applyMatrix4(c.torso.matrix); L.T.copy(L===c.play ? paw : L.rest); petLeg(L); }
  // head follows the ball (in torso space), with a curious tilt while it rolls away
  _pv.copy(ballW); c.root.worldToLocal(_pv); _pm.copy(c.torso.matrix).invert(); _pv.applyMatrix4(_pm).sub(c.head.position);
  const ty=Math.max(-.9,Math.min(.9,Math.atan2(_pv.x,_pv.z))), tp=Math.max(-.35,Math.min(.8,Math.atan2(-_pv.y,Math.hypot(_pv.x,_pv.z))));
  const kh=1-Math.exp(-dt*14); c.hy+=(ty-c.hy)*kh; c.hp+=(tp-c.hp)*kh;
  c.roll += ((role==='send'?.16:.05)-c.roll)*k;   // smoothed: the roles swap at every swat
  c.head.rotation.set(c.hp, c.hy, c.roll*Math.sin(t*.9+c.ph));
  // tail: a travelling wave, faster and wider while waiting to pounce
  const amp = role==='recv' ? (wig>.3?1:.55) : .35, f = role==='recv' ? (wig>.3?1.7:1.0) : .6;
  c.tailAmp += (amp-c.tailAmp)*k; c.tailPh += 2*Math.PI*f*dt;
  c.tail.forEach((j,i)=>{ j.rotation.y=c.tailAmp*.16*Math.sin(c.tailPh-i*.55); j.rotation.x=j.userData.rx+.05*Math.sin(c.tailPh*.5-i*.4); });
  // an ear flick now and then, and a blink
  const q=t+c.ph, ec=Math.floor(q/4.1), u=(q-ec*4.1)/.18;
  c.ears.forEach((e,i)=>{ e.rotation.z = e.userData.rz + ((u<1 && (hash1(ec+c.seed)<.5?0:1)===i) ? (i?-1:1)*.45*Math.sin(Math.PI*u) : 0); });
  const bq=(t+c.ph*1.7)%3.7, bu=bq/.14; c.eyes.scale.y = bu<1 ? 1-.92*Math.sin(Math.PI*bu) : 1;
}
function petPair(P, t, dt){
  const k=Math.floor(t/PET_HALF), p=t-k*PET_HALF, from=((k%2)+2)%2, to=1-from;   // even halves: cat 0 swatted at p=0
  const s = p<PET_TRAVEL ? 1-Math.pow(1-p/PET_TRAVEL,2.2) : 1;
  const E0=P.E[from], E1=P.E[to], arc=(.03+.07*hash1(k))*(hash1(k+.37)<.5?-1:1)*Math.sin(Math.PI*s);
  const bx=E0.x+(E1.x-E0.x)*s+P.n.x*arc, bz=E0.z+(E1.z-E0.z)*s+P.n.z*arc;
  const hop = p<.3 ? .04*Math.sin(Math.PI*p/.3)*(.6+.4*hash1(k+.71)) : 0;
  const by=E0.y+(E1.y-E0.y)*s+PET_BALL_R+hop, b=P.ball, dx=bx-b.position.x, dz=bz-b.position.z, d=Math.hypot(dx,dz);
  if (d>1e-6 && d<.6){ _pv.set(dz,0,-dx).multiplyScalar(1/d); _pq.setFromAxisAngle(_pv,d/PET_BALL_R); b.quaternion.premultiply(_pq); }   // roll without slipping
  b.position.set(bx,by,bz);
  P.cats.forEach((c,i)=>petPose(c, i===from?'send':'recv', p, t, dt, b.position));
}
function petsUpdate(now, dt){
  if (!PETS.length || !petsRoot.visible) return;
  if (petsFixedT!=null){ if (petsFixedT!==petsPinned){ petsPinned=petsFixedT; for (const P of PETS) petPair(P, petsFixedT, 1); } return; }
  petsPinned=null;
  if (reduceMotion){ if (petsFrozen) return; petsFrozen=true; for (const P of PETS) petPair(P, .3, 1); return; }   // one still frame: the ball on its way
  const t=now/1000; for (const P of PETS) petPair(P, t, dt);
}
function buildPets(){
  for (const c of [...petsRoot.children]){ petsRoot.remove(c); disposeTree(c); }
  PETS=[]; petsFrozen=false;
  for (const sp of ((PROJECT.site||{}).pets||[])){
    if (!Array.isArray(sp.a) || !Array.isArray(sp.b)) continue;
    const A=new THREE.Vector3(+sp.a[0],0,+sp.a[1]), Bp=new THREE.Vector3(+sp.b[0],0,+sp.b[1]), dir=new THREE.Vector3().subVectors(Bp,A), len=dir.length();
    if (!(len>.9)) continue; dir.multiplyScalar(1/len);
    const g=new THREE.Group(); petsRoot.add(g);
    const yAt=(x,z)=>terrainH(x,z)+.028;   // on the lawn (gardens are draped ~.025 above the terrain)
    const cats=[makeCat(COATS.ginger,1,PETS.length*2+1,1), makeCat(COATS.greywhite,.92,PETS.length*2+2,-1)];
    [[A,dir],[Bp,dir.clone().negate()]].forEach(([p,f],i)=>{ const c=cats[i]; c.root.position.set(p.x,yAt(p.x,p.z),p.z); c.root.rotation.y=Math.atan2(f.x,f.z); g.add(c.root); });
    const E=[A.clone().addScaledVector(dir,PET_ZB*cats[0].scale), Bp.clone().addScaledVector(dir,-PET_ZB*cats[1].scale)]; E.forEach(e=>{ e.y=yAt(e.x,e.z); });
    const bg=new THREE.SphereGeometry(PET_BALL_R,24,16);
    petPaint(bg,(x,y,z)=>new THREE.Color(Math.abs(y)<PET_BALL_R*.2 ? '#f4c43a' : Math.abs(x)<PET_BALL_R*.16 ? '#f4f1ea' : '#d6372b'));
    const ball=petMesh(g,bg,petBallM); ball.position.set(E[0].x,E[0].y+PET_BALL_R,E[0].z);
    const ctr=new THREE.Vector3().addVectors(A,Bp).multiplyScalar(.5); ctr.y=yAt(ctr.x,ctr.z);
    PETS.push({ cats, ball, E, n:new THREE.Vector3(dir.z,0,-dir.x), dir, center:ctr,
      hit:cats.map(c=>new THREE.Sphere(new THREE.Vector3(c.root.position.x, c.root.position.y+.2*c.scale, c.root.position.z), .3*c.scale)) });
  }
  petsRoot.updateMatrixWorld(true);
  for (const P of PETS) petPair(P, 0, 1);
}
// a short click (not a drag) on a cat flies the camera to a close look at them; the cursor shows they can be clicked
const _pRay=new THREE.Raycaster(), _pNdc=new THREE.Vector2(), _pHitP=new THREE.Vector3();
const petVisible = o => { while (o){ if (!o.visible) return false; o=o.parent; } return true; };   // raycasts also hit hidden (cut-away) floors
const petBlockers = far => { _pRay.far=far; const objs=[houseRoot, ...(siteRoot ? siteRoot.children.filter(o=>o!==TERRAIN) : [])].filter(Boolean);   // the 95k-triangle terrain cost ~8 ms per test
  const hs=_pRay.intersectObjects(objs,true).filter(h=>petVisible(h.object)); _pRay.far=Infinity; return hs; };
function petAt(e, occl){
  if (!PETS.length || !petsRoot.visible || state.mode==='walk') return null;
  const rc=renderer.domElement.getBoundingClientRect(); _pNdc.set(((e.clientX-rc.left)/rc.width)*2-1, -((e.clientY-rc.top)/rc.height)*2+1);
  _pRay.setFromCamera(_pNdc,camera);
  for (const P of PETS) for (const s of P.hit){ if (!_pRay.ray.intersectSphere(s,_pHitP)) continue;
    if (occl){ const d=_pHitP.distanceTo(_pRay.ray.origin); if (d>.4 && petBlockers(d-.35).length) continue; }
    return P; }
  return null;
}
function lookAtPets(P){
  if (state.mode!=='ext') setMode('ext');
  const c=P.center, tgt=new THREE.Vector3(c.x,c.y+.16,c.z), here=new THREE.Vector3().subVectors(camera.position,c); here.y=0;
  const n=P.n.clone(); if (n.dot(here)<0) n.negate();                 // look across the cats' line, from the side the camera is on
  const base=Math.atan2(n.x,n.z);
  let best=null;
  const half=Math.tan(THREE.MathUtils.degToRad(50)/2)*Math.min(1.6,camera.aspect), d0=Math.max(2.7,Math.min(6,1.35/half));   // fit ~2.7 m across
  pick: for (const da of [0,.45,-.45,.9,-.9,1.35,-1.35,Math.PI]) for (const [dist,h] of [[d0,.43*d0],[d0*1.2,.7*d0*1.2]]){
    const a=base+da, pos=new THREE.Vector3(c.x+Math.sin(a)*dist, c.y+h, c.z+Math.cos(a)*dist);
    if (FOOTS.some(f=>inPoly(f.poly,pos.x,pos.z))) continue;
    if (pos.y < terrainH(pos.x,pos.z)+.6) continue;
    if (((PROJECT.site||{}).trees||[]).some(t=>Math.hypot(pos.x-t.x,pos.z-t.z) < (+t.r||2)*1.3+.4)) continue;   // a ray cannot see a canopy it starts inside
    const toT=new THREE.Vector3().subVectors(tgt,pos), L=toT.length(); _pRay.set(pos,toT.normalize());
    const blocked=petBlockers(L-.35).length>0;
    if (!blocked){ best=pos; break pick; }
  }
  if (!best) best=new THREE.Vector3(c.x+n.x*d0, c.y+1.2*d0, c.z+n.z*d0);
  flyTo([best.x,best.y,best.z],[tgt.x,tgt.y,tgt.z],1500);
}
{ const el=renderer.domElement; let dn=null, hoverT=0;
  el.addEventListener('pointerdown',e=>{ const now=performance.now();   // a second finger while the first is down = a pinch, not a tap
    dn = (dn && dn.id!==e.pointerId && now-dn.t<1000) ? null : {x:e.clientX,y:e.clientY,t:now,id:e.pointerId}; });
  const up=e=>{ if(!dn || e.pointerId!==dn.id) return; const moved=Math.hypot(e.clientX-dn.x,e.clientY-dn.y), quick=performance.now()-dn.t<450; dn=null;
    if (e.type==='pointerup' && moved<6 && quick){ const P=petAt(e,true); if (P) lookAtPets(P); } };
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up);
  el.addEventListener('pointermove',e=>{ if (e.pointerType!=='mouse' || e.buttons || !PETS.length) return; const now=performance.now(); if (now-hoverT<90) return; hoverT=now;
    el.style.cursor = petAt(e,true) ? 'pointer' : ''; });
}
