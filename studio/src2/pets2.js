/* ============================== PETS: two cats playing with a ball (PROJECT.site.pets) ============================== */
// PROJECT.site.pets = [{a:[x,z], b:[x,z], label}]: two cats sit at a and b, facing each other, and bat a ball back and forth;
// {kind:'dog', bld, level, c:[x,z], r, label}: a dog chases a butterfly within r metres of c on that building floor (a roof terrace).
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
/* ---------- a dog on a roof terrace chasing a butterfly: PROJECT.site.pets {kind:'dog', bld, level, c:[x,z], r} ---------- */
const petDogNoseM = M({color:'#1d1612', roughness:.3}, true, .8);
const petDogEyeM  = M({color:'#21140c', roughness:.06}, true, 1);
const petMouthM   = M({color:'#7a2e2a', roughness:.6}, true, .3);
const bflyBodyM   = M({color:'#17120e', roughness:.6}, true, .4);
const DOGC = { white:new THREE.Color('#f2eee6'), tan:new THREE.Color('#b8743c'), dark:new THREE.Color('#6b4426') };
function dogColour(part,x,y,z,s){   // a Jack Russell: white, tan saddle and head patches, a white blaze and muzzle
  const c=DOGC.white.clone();
  if (part==='torso'){ const phi=Math.abs(Math.atan2(x,y)), n=.015*Math.sin(x*70+z*40)+.012*Math.sin(z*95+1); c.lerp(DOGC.tan, sm01(-.03+n,-.085+n,z)*sm01(1.45,.95,phi)); }
  else if (part==='head'){ const side=sm01(.011,.024,Math.abs(x))*sm01(-.004,.016,y)*sm01(.078,.05,z); c.lerp(DOGC.tan,side); c.lerp(DOGC.dark,side*sm01(.06,.088,y)*.4); }
  else if (part==='ear'){ c.copy(DOGC.tan); c.lerp(DOGC.dark, sm01(-.01,-.05,y)*.55); }
  else if (part==='tail') c.lerp(DOGC.tan, sm01(.32,.12,s));
  c.multiplyScalar(1+.05*Math.sin(x*173+y*97+z*41)*Math.sin(z*131+x*61-y*29));
  return c;
}
function makeDog(){
  const root=new THREE.Group(), torso=new THREE.Group(); torso.position.y=.27; root.add(torso);
  petMesh(torso, petPaint(petMerge([petEllip(.082,.09,.2, 0,0,0, 0,32,22), petEllip(.078,.095,.09, 0,.012,.13), petEllip(.055,.075,.08, .045,0,-.13), petEllip(.055,.075,.08, -.045,0,-.13), petEllip(.05,.062,.085, 0,.07,.19, -.85)]),
    (x,y,z)=>dogColour('torso',x,y,z)), petFurM);
  const head=new THREE.Group(); head.position.set(0,.115,.225); head.rotation.order='YXZ'; torso.add(head);
  petMesh(head, petPaint(petMerge([petEllip(.058,.056,.066, 0,.035,0), petEllip(.034,.03,.06, 0,.008,.075)]),(x,y,z)=>dogColour('head',x,y,z)), petFurM);
  petMesh(head, petEllip(.016,.012,.012, 0,.024,.133), petDogNoseM, false);
  petMesh(head, petEllip(.024,.009,.04, 0,-.012,.07), petMouthM, false);   // the inside of the mouth, seen when the jaw drops
  const jaw=new THREE.Group(); jaw.position.set(0,-.012,.03); head.add(jaw);
  petMesh(jaw, petPaint(petEllip(.027,.009,.05, 0,-.004,.05),(x,y,z)=>dogColour('head',x,y-.012,z+.03)), petFurM, false);
  const eyes=new THREE.Group(); eyes.position.y=.048; head.add(eyes);
  petMesh(eyes, petMerge([-1,1].map(sx=>{ const g=petEllip(.0115,.0115,.008, 0,0,0); g.rotateY(sx*.35); g.translate(sx*.03,0,.05); return g; })), petDogEyeM, false);
  const ears=[-1,1].map(sx=>{ const e=new THREE.Group(); e.position.set(sx*.047,.075,0); e.rotation.set(-.25,0,sx*.35); head.add(e);   // drop ears folded forward
    petMesh(e, petPaint(petEllip(.03,.045,.007, 0,-.032,.012),(x,y,z)=>dogColour('ear',x,y,z)), petFurM); e.userData.rz=e.rotation.z; e.userData.sx=sx; return e; });
  const tail=[]; const NT=6, SL=.034; const tp=new THREE.Group(); tp.position.set(0,.05,-.185); torso.add(tp);
  for (let i=0;i<NT;i++){ const j=i===0?tp:new THREE.Group(); if (i>0){ j.position.z=-SL; tail[i-1].add(j); }
    const r=.019-.008*i/(NT-1), g=new THREE.CapsuleGeometry(r,SL,3,10); g.rotateX(Math.PI/2); g.translate(0,0,-SL/2);
    petMesh(j, petPaint(g,(x,y,z)=>dogColour('tail',x,y,z,(i+Math.min(1,Math.max(0,-z/SL)))/NT)), petFurM);
    j.userData.rx = i===0 ? 1.0 : .06; j.rotation.x=j.userData.rx; tail.push(j); }   // carried high
  const legs=[];
  const LEG=(sx,front)=>{ const a=front?.115:.12, b=front?.105:.115, ra=front?.027:.03, rb=front?.019:.02, pr=front?.025:.026, W=g=>petPaint(g,(x,y,z)=>dogColour('leg',x,y,z));
    legs.push({ a, b, ra, th:0, front, piv:new THREE.Vector3(sx*(front?.045:.05), front?-.055:-.045, front?.135:-.135), rest:new THREE.Vector3(sx*(front?.048:.052), .018, front?.155:-.165),
      up:petMesh(root, W(new THREE.CapsuleGeometry(ra,a,3,10)), petFurM), lo:petMesh(root, W(new THREE.CapsuleGeometry(rb,b,3,10)), petFurM), paw:petMesh(root, W(petEllip(pr,pr*.6,pr*1.35, 0,0,.006)), petFurM),
      P:new THREE.Vector3(), T:new THREE.Vector3(), K:new THREE.Vector3(), foot:new THREE.Vector3(), from:new THREE.Vector3(), su:-1, sdur:.2 }); };
  LEG(-1,true); LEG(1,true); LEG(-1,false); LEG(1,false);   // trot pairs: [0,3] and [1,2]
  return { root, torso, head, jaw, eyes, ears, tail, legs, pos:new THREE.Vector3(), th:0, v:0, jump:null, lastJump:-9, lastPair:1, hy:0, hp:0, tailPh:0, tailAmp:.4, tPrev:null };
}
function makeButterfly(){   // a monarch, a little larger than life so it reads from the street
  const g=new THREE.Group(); g.scale.setScalar(1.5);
  const body=new THREE.CapsuleGeometry(.0035,.022,3,6); body.rotateX(Math.PI/2); petMesh(g, body, bflyBodyM, false);
  const fore=[[0,.003],[.02,.014,.05,.032,.06,.024],[.066,.012,.05,-.003,.03,-.005],[0,-.001]], hind=[[0,-.001],[.02,-.004,.045,-.012,.042,-.03],[.036,-.044,.012,-.036,0,-.012]];
  const shape=d=>{ const s=new THREE.Shape(); s.moveTo(d[0][0],d[0][1]); for (const q of d.slice(1)) q.length===6 ? s.bezierCurveTo(...q) : s.lineTo(q[0],q[1]); return s; };
  const U=x=>x/.07, V=y=>(y+.045)/.08;   // shape space → texture space (both wings share one texture)
  const tex=ctex('monarchWing',256,(x,N)=>{ const P=(a,b)=>[U(a)*N,(1-V(b))*N], path=d=>{ x.beginPath(); x.moveTo(...P(d[0][0],d[0][1])); for (const q of d.slice(1)) q.length===6 ? x.bezierCurveTo(...P(q[0],q[1]),...P(q[2],q[3]),...P(q[4],q[5])) : x.lineTo(...P(q[0],q[1])); x.closePath(); };
    x.fillStyle='#120c08'; x.fillRect(0,0,N,N);
    for (const [d,k] of [[fore,.8],[hind,.78]]){ x.save(); const o=P(0,0); x.translate(o[0],o[1]); x.scale(k,k); x.translate(-o[0],-o[1]); path(d); x.fillStyle='#f08a1c'; x.fill(); x.restore(); }
    x.strokeStyle='#120c08'; x.lineWidth=N/110; const o=P(0,0);
    for (const [a,b] of [[.06,.024],[.052,.03],[.045,.012],[.035,-.002],[.042,-.03],[.03,-.038],[.02,-.03]]){ x.beginPath(); x.moveTo(o[0],o[1]); x.lineTo(...P(a*.85,b*.85)); x.stroke(); }
    x.fillStyle='#f6f1e6'; for (const [a,b] of [[.058,.02],[.055,.026],[.048,.029],[.062,.016],[.04,-.032],[.034,-.038],[.025,-.036],[.044,-.024]]){ x.beginPath(); x.arc(...P(a*.94,b*.94),N/110,0,7); x.fill(); } });
  const wingM=M({map:tex, side:THREE.DoubleSide, roughness:.6}, true, .4);
  const wing=d=>{ const geo=new THREE.ShapeGeometry(shape(d),10), p=geo.attributes.position, uv=geo.attributes.uv; for (let i=0;i<p.count;i++) uv.setXY(i,U(p.getX(i)),V(p.getY(i))); geo.rotateX(Math.PI/2); return geo; };   // shape y → forward (+z)
  const wR=new THREE.Group(), wL=new THREE.Group(); g.add(wR, wL);
  const gR=petMerge([wing(fore),wing(hind)]); petMesh(wR, gR, wingM, true); const gL=gR.clone(); gL.scale(-1,1,1); petMesh(wL, gL, wingM, true);
  return { g, wR, wL };
}
const _dv=new THREE.Vector3(), _dv2=new THREE.Vector3(), _dw=new THREE.Vector3();
function bflyAt(P, t, out){   // a wandering flight over the play area, dipping low now and then; it climbs away whenever the dog leaps
  const u=t*.55, rb=P.r-.45, e=sm01(P.esc,P.esc+.3,t)*(1-sm01(P.esc+.9,P.esc+2.4,t));
  return out.set(P.c.x+rb*(.62*Math.sin(u*.83+1.3)+.38*Math.sin(u*1.91+.4)),
                 P.deck+.6+.32*Math.sin(u*1.13+.7)+.12*Math.sin(u*3.1)+.025*Math.sin(t*17)+.55*e,
                 P.c.z+rb*(.62*Math.cos(u*.67+.2)+.38*Math.sin(u*1.37+2.1)));
}
function dogFootIdeal(D, L, out){ out.copy(L.rest); out.z += D.v*.11; return D.root.localToWorld(out); }   // a little ahead when moving
function dogReset(P, t){ const D=P.dog; P.headW.set(P.c.x,P.deck+.4,P.c.z+.22); P.torsoW.set(P.c.x,P.deck+.27,P.c.z); D.pos.set(P.c.x,P.deck,P.c.z); D.th=0; D.v=0; D.jump=null; D.lastJump=-9; D.tPrev=t; P.esc=-9;
  D.root.position.copy(D.pos); D.root.rotation.set(0,0,0); D.root.updateMatrixWorld();
  for (const L of D.legs){ dogFootIdeal(D,L,L.foot); L.su=-1; L.th=0; } }
function dogStep(P, t, dt){
  const D=P.dog, B=bflyAt(P,t,_dv), r0=P.r-.35;
  for (const [Q,R] of [[P.headW,.24],[P.torsoW,.3]]){ const dx=B.x-Q.x, dy=B.y-Q.y, dz=B.z-Q.z, d=Math.hypot(dx,dy,dz)||1e-3;   // it flits past the dog, never through it
    if (d<R){ const k=(R-d)/d; B.x+=dx*k; B.z+=dz*k; B.y+=Math.abs(dy)*k+.5*(R-d); } }
  if (!D.jump){   // steer for the spot under the butterfly, never leaving the play area
    let tx=B.x, tz=B.z; const ox=tx-P.c.x, oz=tz-P.c.z, ol=Math.hypot(ox,oz); if (ol>r0-.3){ tx=P.c.x+ox*(r0-.3)/ol; tz=P.c.z+oz*(r0-.3)/ol; }
    const dx=tx-D.pos.x, dz=tz-D.pos.z, dist=Math.hypot(dx,dz);
    if (dist>.05){ const want=Math.atan2(dx,dz), turn=Math.atan2(Math.sin(want-D.th),Math.cos(want-D.th)); D.th+=Math.max(-3.5*dt,Math.min(3.5*dt,turn));
      const vd = dist>.38 ? Math.min(1.3,(dist-.3)*2.4)*Math.max(.15,Math.cos(turn)) : 0; D.v += Math.max(-4*dt,Math.min(3*dt,vd-D.v)); }
    else D.v=Math.max(0,D.v-4*dt);
  }
  D.pos.x+=Math.sin(D.th)*D.v*dt; D.pos.z+=Math.cos(D.th)*D.v*dt;
  { const ox=D.pos.x-P.c.x, oz=D.pos.z-P.c.z, ol=Math.hypot(ox,oz); if (ol>r0){ D.pos.x=P.c.x+ox*r0/ol; D.pos.z=P.c.z+oz*r0/ol; } }
  D.root.position.set(D.pos.x,P.deck,D.pos.z); D.root.rotation.set(0,D.th,0); D.root.updateMatrixWorld();
  // leap when the butterfly dips within reach in front of the nose
  const bl=D.root.worldToLocal(_dw.copy(B));
  if (!D.jump && t-D.lastJump>3 && bl.z>.12 && bl.z<.62 && Math.abs(bl.x)<.28 && bl.y<.8){ D.jump={t0:t, dur:.72, H:Math.max(.12,Math.min(.3,bl.y-.42)), landed:false}; D.lastJump=t; }
  let ju=-1, jw=0;
  if (D.jump){ ju=(t-D.jump.t0)/D.jump.dur; if (ju>=1){ D.jump=null; ju=-1; } }
  if (ju>=0){
    if (ju>=.12 && P.esc<D.jump.t0) P.esc=t;   // the butterfly flutters up and away
    jw = ju<.12 ? 0 : ju<.85 ? (ju-.12)/.73 : 1;
    D.root.position.y = P.deck + (ju>=.12 && ju<.85 ? D.jump.H*4*jw*(1-jw) : 0); D.root.updateMatrixWorld();
    if (ju>=.85 && !D.jump.landed){ D.jump.landed=true; for (const L of D.legs){ dogFootIdeal(D,L,L.foot); L.foot.y=P.deck+.018; L.su=-1; } }
  }
  const air = ju>=.12 && ju<.85, run=Math.min(1,D.v);
  const crouch = ju<0 ? 0 : ju<.12 ? -.045*sm01(0,.12,ju) : ju>=.85 ? -.035*(1-sm01(.85,1,ju)) : 0;
  D.torso.position.set(0,.27+crouch+.007*Math.sin(t*31)*run,0); D.torso.rotation.set((air?-.38*Math.sin(Math.PI*jw):ju>=0&&ju<.12?.08:0)+.04*run,0,0); D.torso.updateMatrix();
  if (air) D.legs.forEach(L=>{ const sx=Math.sign(L.rest.x); if (L.front) L.T.set(sx*.035,.1+.12*Math.sin(Math.PI*jw),.22); else L.T.set(sx*.05,.03+.03*Math.sin(Math.PI*jw),-.22); });   // front paws reach for it, hind legs trail
  else {
    if (ju<0){   // trot: the diagonal pair whose feet fall furthest behind steps; feet stay planted on the deck in between
      for (const L of D.legs) if (L.su>=0){ L.su+=dt/L.sdur; dogFootIdeal(D,L,_dw); if (L.su>=1){ L.su=-1; L.foot.copy(_dw); L.foot.y=P.deck+.018; } else { const e=L.su*L.su*(3-2*L.su); L.foot.lerpVectors(L.from,_dw,e); L.foot.y=P.deck+.018+.06*Math.sin(Math.PI*L.su); } }
      if (!D.legs.some(L=>L.su>=0)){ const err=[[0,3],[1,2]].map(pr=>Math.max(...pr.map(i=>dogFootIdeal(D,D.legs[i],_dw).distanceTo(D.legs[i].foot))));
        let k = err[0]>=err[1] ? 0 : 1; if (err[1-k]>.06 && k===D.lastPair) k=1-k;
        if (err[k]>.06){ D.lastPair=k; for (const i of (k?[1,2]:[0,3])){ const L=D.legs[i]; L.from.copy(L.foot); L.su=0; L.sdur=Math.max(.13,.24-.07*D.v); } } }
    }
    for (const L of D.legs) D.root.worldToLocal(L.T.copy(L.foot));
  }
  for (const L of D.legs){ L.P.copy(L.piv).applyMatrix4(D.torso.matrix); petLeg(L); }
  // head on the butterfly, jaw snapping at the top of a leap (panting otherwise), ears flapping, tail wagging
  _dw.copy(B); D.root.worldToLocal(_dw); _pm.copy(D.torso.matrix).invert(); _dw.applyMatrix4(_pm).sub(D.head.position);
  const ty=Math.max(-1,Math.min(1,Math.atan2(_dw.x,_dw.z))), tp=Math.max(-1.1,Math.min(.5,Math.atan2(-_dw.y,Math.hypot(_dw.x,_dw.z)))), kh=1-Math.exp(-dt*12);
  D.hy+=(ty-D.hy)*kh; D.hp+=(tp-D.hp)*kh; D.head.rotation.set(D.hp,D.hy,0);
  D.jaw.rotation.x = air ? .5*sm01(.15,.4,jw)*(1-sm01(.55,.62,jw)) : .07+.05*Math.sin(t*14);
  D.ears.forEach(e=>{ e.rotation.z = e.userData.rz + e.userData.sx*((air?.55*Math.sin(Math.PI*jw):0) + .08*run*Math.sin(t*31+1)); });
  const near=sm01(1.8,.5,_dw.length()), amp=.25+.45*near+(ju>=0?.2:0), f=3.5+3*near; D.tailAmp+=(amp-D.tailAmp)*(1-Math.exp(-dt*6)); D.tailPh+=2*Math.PI*f*dt;
  D.tail.forEach((j,i)=>{ j.rotation.y = D.tailAmp*(i?.25:1)*Math.sin(D.tailPh-i*.5); });
  const bq=(t*1.3+.7)%4.3, bu=bq/.14; D.eyes.scale.y = bu<1 ? 1-.92*Math.sin(Math.PI*bu) : 1;
  // the butterfly: along its path, wings beating (with a glide now and then)
  const bf=P.bfly, B2=bflyAt(P,t+.05,_dv2); bf.g.position.copy(B); bf.g.rotation.set(-.15, Math.atan2(B2.x-B.x,B2.z-B.z), .12*Math.sin(t*3));
  const a = Math.sin(t*.7+.4)>.75 ? .35+.05*Math.sin(t*3) : .25+.85*(.5+.5*Math.sin(t*2*Math.PI*9)); bf.wR.rotation.z=a; bf.wL.rotation.z=-a;
  P.hit[0].center.set(D.pos.x, D.root.position.y+.25, D.pos.z);
  D.root.updateMatrixWorld(true); D.head.getWorldPosition(P.headW); D.torso.getWorldPosition(P.torsoW);
}
function dogSimTo(P, t){ dogReset(P,0); for (let s=0; s<t; s+=1/60) dogStep(P,s,1/60); }   // deterministic: the same moment always gives the same pose
function petStill(P, t){ if (P.kind==='dog') dogSimTo(P, t); else petPair(P, t, 1); }
function petsUpdate(now, dt){
  if (!PETS.length || !petsRoot.visible) return;
  for (const P of PETS) if (P.Li!=null) P.g.visible = !LV[P.Li] || LV[P.Li].root.visible;   // the roof dog hides with its floor in a cut-away view
  if (petsFixedT!=null){ if (petsFixedT!==petsPinned){ petsPinned=petsFixedT; for (const P of PETS) petStill(P, petsFixedT); } return; }
  petsPinned=null;
  if (reduceMotion){ if (petsFrozen) return; petsFrozen=true; for (const P of PETS) petStill(P, P.kind==='dog'?3.2:.3); return; }   // one still frame each
  const t=now/1000;
  for (const P of PETS){ if (!P.g.visible) continue;
    if (P.kind==='dog'){ if (P.dog.tPrev==null || t-P.dog.tPrev>1) dogReset(P,t); P.dog.tPrev=t; dogStep(P,t,dt); }
    else petPair(P, t, dt); }
}
function buildPets(){
  for (const c of [...petsRoot.children]){ petsRoot.remove(c); disposeTree(c); }
  PETS=[]; petsFrozen=false;
  for (const sp of ((PROJECT.site||{}).pets||[])){
    if (sp.kind==='dog'){
      const B_=BLDS.find(b=>b.id===sp.bld), L=B_ && B_.levels.find(L=>Math.abs(L.level-(+sp.level||0))<.3);
      if (!L || !Array.isArray(sp.c)) continue;
      const g=new THREE.Group(); petsRoot.add(g);
      const dog=makeDog(), bfly=makeButterfly(); g.add(dog.root, bfly.g);
      const deck=L.y+.006, c=new THREE.Vector3(+sp.c[0],deck,+sp.c[1]);   // terrace finish sits 6 mm above the slab
      const P={ kind:'dog', g, dog, bfly, c, r:Math.max(1,+sp.r||2), deck, Li:LEVELS.indexOf(L), esc:-9, headW:new THREE.Vector3(), torsoW:new THREE.Vector3(), center:c.clone(), elev:true, label:sp.label||'בכלב',
        hit:[new THREE.Sphere(new THREE.Vector3(c.x,deck+.25,c.z), .4)] };
      P.fitW=2*P.r+.6; PETS.push(P); dogReset(P,0); dogStep(P,0,1/60); continue;
    }
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
    PETS.push({ kind:'cats', g, cats, ball, E, n:new THREE.Vector3(dir.z,0,-dir.x), dir, center:ctr, fitW:2.7, label:sp.label||'בחתולים',
      hit:cats.map(c=>new THREE.Sphere(new THREE.Vector3(c.root.position.x, c.root.position.y+.2*c.scale, c.root.position.z), .3*c.scale)) });
  }
  petsRoot.updateMatrixWorld(true);
  for (const P of PETS) if (P.kind==='cats') petPair(P, 0, 1);
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
  for (const P of PETS) if (P.g.visible) for (const s of P.hit){ if (!_pRay.ray.intersectSphere(s,_pHitP)) continue;
    if (occl){ const d=_pHitP.distanceTo(_pRay.ray.origin); if (d>.4 && petBlockers(d-.35).length) continue; }
    return P; }
  return null;
}
const petInside = p => LEVELS.some(L => p.y>L.y-.3 && p.y<L.y+L.floorH && L.rooms.some(r=>inPoly(r.poly,p.x,p.z)));   // a camera inside a room
function lookAtPets(P){
  if (state.mode!=='ext') setMode('ext');
  const c=P.center, tgt=new THREE.Vector3(c.x,c.y+(P.elev?.3:.16),c.z), here=new THREE.Vector3().subVectors(camera.position,c); here.y=0;
  const n = P.n ? P.n.clone() : here.clone(); if (n.lengthSq()<1e-6) n.set(0,0,-1); n.normalize(); if (n.dot(here)<0) n.negate();   // cats: across their line; dog: from the side the camera is on
  const base=Math.atan2(n.x,n.z);
  const half=Math.tan(THREE.MathUtils.degToRad(50)/2)*Math.min(1.6,camera.aspect), d0=Math.max(2.7,Math.min(P.elev?9:6,(P.fitW||2.7)/2/half));   // fit the play area across the view
  const rings = P.elev ? [[d0,.45*d0],[d0*1.15,.7*d0*1.15]] : [[d0,.43*d0],[d0*1.2,.7*d0*1.2]];
  let best=null;
  pick: for (const da of [0,.45,-.45,.9,-.9,1.35,-1.35,Math.PI]) for (const [dist,h] of rings){
    const a=base+da, pos=new THREE.Vector3(c.x+Math.sin(a)*dist, c.y+h, c.z+Math.cos(a)*dist);
    if (petInside(pos)) continue;
    if (pos.y < terrainH(pos.x,pos.z)+.6) continue;
    if (((PROJECT.site||{}).trees||[]).some(t=>Math.hypot(pos.x-t.x,pos.z-t.z) < (+t.r||2)*1.3+.4 && pos.y < terrainH(t.x,t.z)+6)) continue;   // a ray cannot see a canopy it starts inside
    const toT=new THREE.Vector3().subVectors(tgt,pos), L=toT.length(); _pRay.set(pos,toT.normalize());
    if (!petBlockers(L-.35).length){ best=pos; break pick; }
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
    el.style.cursor = petAt(e,false) ? 'pointer' : ''; });   // the sphere test only: a full occlusion raycast costs ~7 ms (r147 does not cull by ray length); the click checks it
}
