/* ============================== PLAN MODEL (generic) ============================== */
// Plan file: {name, roof:'hip'|'flat', floors:[{name,height,walls:[{a,b,t}],openings:[{type,x,z,w,sill,h}],rooms:[{name,kind,x0,z0,x1,z1}],image?}], plot?}
// Units are meters; x runs left→right on the drawing, z runs top→bottom.
const KINDS = {
  living:{n:'סלון',t:'living'}, kitchen:{n:'מטבח',t:'living'}, dining:{n:'פינת אוכל',t:'living'}, hall:{n:'מבואה',t:'living'},
  bed:{n:'חדר שינה',t:'bed'}, master:{n:'חדר הורים',t:'bed'}, kids:{n:'חדר ילדים',t:'bed'}, office:{n:'חדר עבודה',t:'bed'}, mamad:{n:'ממ״ד',t:'bed'},
  closet:{n:'חדר ארונות',t:'closet'}, storage:{n:'מחסן',t:'closet'},
  bath:{n:'חדר רחצה',t:'wet'}, wc:{n:'שירותים',t:'wet'}, laundry:{n:'חדר כביסה',t:'wet'},
  stair:{n:'מדרגות',t:'living'}, balcony:{n:'מרפסת',t:'balcony'}, void:{n:'חלל',t:'living'},
};
const KIND_ORDER = ['living','kitchen','dining','hall','master','bed','kids','office','mamad','closet','storage','bath','wc','laundry','stair','balcony','void'];
function guessKind(name=''){
  const n=name;
  const t=[['ממ',  'mamad'],['הורים','master'],['ילד','kids'],['שינה','bed'],['עבודה','office'],['קליניק','office'],['משרד','office'],['סלון','living'],['משפחה','living'],['מטבח','kitchen'],['אוכל','dining'],
    ['מקלחת','bath'],['רחצה','bath'],['אמבט','bath'],['שירות','wc'],['שרותים','wc'],['כביסה','laundry'],['ארונות','closet'],['מחסן','storage'],['מדרג','stair'],['מרפסת','balcony'],['פרגולה','balcony'],['חצר','balcony'],['מבוא','hall'],['מעבר','hall'],['פרוזדור','hall'],['כניסה','hall']];
  for (const [k,v] of t) if (n.includes(k)) return v;
  return 'hall';
}
let PLAN=null, LEVELS=[], ALLROOMS=[], PLOT=null, BLD=null, BOUNDS={x0:0,x1:10,z0:0,z1:10}, C0=[5,5], PC=[5,5], BUILT=0, BALC=0, SETBACK=null;
const R = id => ALLROOMS.find(r=>r.id===id);
const area = r => (r.x1-r.x0)*(r.z1-r.z0);
const snap = v => Math.round(v*20)/20;

function normalizePlan(P){
  let y=0;
  LEVELS = (P.floors||[]).map((f,i)=>{
    const H = +f.height>2.2 && +f.height<4.5 ? +f.height : 2.8;
    const rooms=(f.rooms||[]).map((r,j)=>{
      const x0=snap(Math.min(r.x0,r.x1)), x1=snap(Math.max(r.x0,r.x1)), z0=snap(Math.min(r.z0,r.z1)), z1=snap(Math.max(r.z0,r.z1));
      const kind = KINDS[r.kind] ? r.kind : guessKind(r.name);
      return {id:`f${i}r${j}`, name:r.name||KINDS[kind].n, kind, type:KINDS[kind].t, x0,z0,x1,z1, L:i, stair:kind==='stair', void:kind==='void'};
    }).filter(r=>r.x1-r.x0>.3 && r.z1-r.z0>.3);
    const L={id:'f'+i, name:f.name||(i===0?'קומת קרקע':`קומה ${i+1}`), y, H, rooms, walls:[], rails:[], kinds:{}};
    for (const w0 of (f.walls||[])){
      let [ax,az]=w0.a.map(snap), [bx,bz]=w0.b.map(snap);
      if (Math.abs(ax-bx) < Math.abs(az-bz)){ const x=snap((ax+bx)/2); ax=bx=x; } else { const z=snap((az+bz)/2); az=bz=z; }
      if (ax>bx||az>bz){ [ax,bx]=[bx,ax]; [az,bz]=[bz,az]; }
      if ((bx-ax)+(bz-az) < .15) continue;
      L.walls.push({a:[ax,az], b:[bx,bz], t:+w0.t||0, open:[]});
    }
    for (const w of L.walls){
      if (w.t>.05 && w.t<.6) continue;
      const h=w.a[1]===w.b[1], mx=(w.a[0]+w.b[0])/2, mz=(w.a[1]+w.b[1])/2;
      const s1=inside(L,mx+(h?0:.25),mz+(h?.25:0)), s2=inside(L,mx-(h?0:.25),mz-(h?.25:0));
      w.t = (s1&&s2) ? .12 : .25;
    }
    for (const o of (f.openings||[])){
      let best=null, bd=.6;
      for (const w of L.walls){
        const h=w.a[1]===w.b[1], along=h?o.x:o.z, perp=h?Math.abs(o.z-w.a[1]):Math.abs(o.x-w.a[0]);
        const a0=h?w.a[0]:w.a[1], a1=h?w.b[0]:w.b[1];
        if (along<a0-.15||along>a1+.15) continue;
        if (perp<bd){ bd=perp; best=w; }
      }
      if (!best) continue;
      const h=best.a[1]===best.b[1], a0=h?best.a[0]:best.a[1], len=(h?best.b[0]:best.b[1])-a0;
      const type = ['door','window','slider','pass','entry'].includes(o.type) ? o.type : 'window';
      let w=Math.min(Math.max(+o.w|| (type==='window'?1.2:.9), .4), len-.1); if (w<.35) continue;
      const c=Math.min(Math.max((h?o.x:o.z)-a0, w/2+.05), len-w/2-.05);
      if (best.open.some(p=>Math.abs(p.c-c)<(p.w+w)/2+.05)) continue;
      const op = {c:snap(c), w:snap(w)};
      if (type==='window'){ op.type='window'; op.sill=Math.min(Math.max(o.sill??.9,0),2); op.h=Math.min(Math.max(o.h??1.3,.4),H-.3-op.sill); }
      else if (type==='slider'){ op.type='slider'; op.h=Math.min(o.h??2.3,H-.25); }
      else if (type==='pass'){ op.type='pass'; op.h=Math.min(o.h??2.1,H-.2); }
      else { op.type='door'; op.h=Math.min(o.h??(type==='entry'?2.2:2.1),H-.2); if(type==='entry') op.front=1; }
      if (op.type==='door'){
        const d=.35, mx=h?a0+op.c:best.a[0], mz=h?best.a[1]:a0+op.c;
        const rp=roomAtL(L, mx+(h?0:d), mz+(h?d:0)), rn=roomAtL(L, mx-(h?0:d), mz-(h?d:0));
        const score=r=> !r||r.type==='balcony' ? -1 : (['living','hall','dining','kitchen','stair'].includes(r.kind)?0:1) + 1/(1+area(r));
        op.into = score(rp)>=score(rn) ? 1 : -1;
      }
      best.open.push(op);
    }
    y += H + .5;
    return L;
  });
  // stairs: hole in the slab above, void in the floor above
  LEVELS.forEach((L,i)=>{ const up=LEVELS[i+1]; L.rooms.forEach(r=>{ if(r.stair && up){ r.holes=[[r.x0,r.z0,r.x1,r.z1]]; up.stairHoles=(up.stairHoles||[]).concat([[r.x0,r.z0,r.x1,r.z1]]); } }); });
  // rails on upper balconies where no wall runs
  LEVELS.forEach((L,i)=>{ if(i===0) return; for (const r of L.rooms.filter(r=>r.type==='balcony')){
    for (const [x0,z0,x1,z1,axis,coord] of [[r.x0,r.z0,r.x1,r.z0,'h',r.z0],[r.x0,r.z1,r.x1,r.z1,'h',r.z1],[r.x0,r.z0,r.x0,r.z1,'v',r.x0],[r.x1,r.z0,r.x1,r.z1,'v',r.x1]]){
      const len=axis==='h'?x1-x0:z1-z0; let s=null;
      for(let t=0;t<=len+1e-6;t+=.1){ const px=axis==='h'?x0+t:x0, pz=axis==='h'?z0:z0+t;
        const open = !findWall(L,axis,coord,axis==='h'?px:pz) && !roomAtL(L, px+(axis==='v'?(coord===r.x0?-.2:.2):0), pz+(axis==='h'?(coord===r.z0?-.2:.2):0), true);
        if (open && s===null) s=t; if ((!open||t>len-1e-6) && s!==null){ const e=open?t:t-.1; if(e-s>.3) L.rails.push(axis==='h'?[x0+s,z0,x0+e,z0]:[x0,z0+s,x0,z0+e]); s=null; } }
    } } });
  ALLROOMS = LEVELS.flatMap(L=>L.rooms);
  ALLROOMS.forEach(r=>{ r.nav = !(r.stair||r.void) && area(r)>=1.5; r.lbl = !r.void && area(r)>=1.5; r.cam = autoCam(LEVELS[r.L], r); });
  BUILT = Math.round(ALLROOMS.filter(r=>r.type!=='balcony').reduce((s,r)=>s+area(r),0));
  BALC = Math.round(ALLROOMS.filter(r=>r.type==='balcony').reduce((s,r)=>s+area(r),0));
  const xs=ALLROOMS.flatMap(r=>[r.x0,r.x1]), zs=ALLROOMS.flatMap(r=>[r.z0,r.z1]);
  const bb={x0:Math.min(...xs,0), x1:Math.max(...xs,1), z0:Math.min(...zs,0), z1:Math.max(...zs,1)};
  C0=[(bb.x0+bb.x1)/2,(bb.z0+bb.z1)/2];
  PLOT = P.plot && P.plot.x1>P.plot.x0 ? P.plot : null;
  SETBACK = PLOT && PLOT.setbacks || null;
  BLD = PLOT && SETBACK ? {x0:PLOT.x0+SETBACK.w, x1:PLOT.x1-SETBACK.e, z0:PLOT.z0+SETBACK.n, z1:PLOT.z1-SETBACK.s} : null;
  const ob = PLOT || bb;
  BOUNDS = {x0:ob.x0-.6, x1:ob.x1+.6, z0:ob.z0-.6, z1:ob.z1+.6};
  PC = PLOT ? [(PLOT.x0+PLOT.x1)/2,(PLOT.z0+PLOT.z1)/2] : C0;
  BB = bb;
}
let BB={x0:0,x1:10,z0:0,z1:10};
function roomAtL(L,x,z,any){ return L.rooms.find(r=>(any||!r.void) && x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1); }
function autoCam(L, r){
  // stand just inside the room's door (or a corner) and look across the room
  let best=null;
  for (const w of L.walls){ const h=w.a[1]===w.b[1];
    for (const o of w.open){ if(o.type==='window') continue;
      const x=h?w.a[0]+o.c:w.a[0], z=h?w.a[1]:w.a[1]+o.c;
      if (x<r.x0-.05||x>r.x1+.05||z<r.z0-.05||z>r.z1+.05) continue;
      const onEdge = h ? (Math.abs(z-r.z0)<.05||Math.abs(z-r.z1)<.05) : (Math.abs(x-r.x0)<.05||Math.abs(x-r.x1)<.05);
      if (onEdge){ best={x,z,h}; break; } }
    if (best) break; }
  const cx=(r.x0+r.x1)/2, cz=(r.z0+r.z1)/2;
  if (best){ const inX = best.h?best.x : (Math.abs(best.x-r.x0)<.05? best.x+.55 : best.x-.55); const inZ = best.h?(Math.abs(best.z-r.z0)<.05? best.z+.55 : best.z-.55):best.z;
    return [inX, inZ, cx+(cx-inX)*.6, cz+(cz-inZ)*.6]; }
  return [r.x0+Math.min(.6,(r.x1-r.x0)/3), r.z0+Math.min(.6,(r.z1-r.z0)/3), r.x1-.3, r.z1-.3];
}
