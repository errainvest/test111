/* ============================== UPLOAD → CLAUDE → PLAN ============================== */
const floorsUp=document.getElementById('floorsUp'), genStatus=document.getElementById('genStatus');
let UP=[]; // {name, img, crop, thumb}
const say=(el,msg,err)=>{ el.textContent=msg; el.classList.toggle('err',!!err); };
function floorDefaultName(i){ return i===0?'קומת קרקע':i===1?'קומה שנייה':i===2?'קומה שלישית':`קומה ${i+1}`; }
function renderUploads(){
  floorsUp.textContent='';
  UP.forEach((f,i)=>{
    const row=document.createElement('div'); row.className='floor';
    const th=document.createElement('div'); th.className='th'; if(f.thumb) th.style.backgroundImage=`url(${f.thumb})`;
    const mid=document.createElement('div'); mid.innerHTML=`<div class="nm">${esc(f.name)}</div><div class="st">${f.img?(f.crop?'אזור השרטוט סומן':'כל הדף'):'לא הועלה קובץ'}</div>`;
    const acts=document.createElement('div'); acts.className='acts';
    const up=document.createElement('label'); up.className='up'; up.textContent=f.img?'החלפה':'העלאת קובץ';
    const inp=document.createElement('input'); inp.type='file'; inp.accept='application/pdf,image/*'; inp.hidden=true; inp.id='up'+i;
    inp.addEventListener('change',()=>{ if(inp.files[0]) readFile(inp.files[0],i); }); up.appendChild(inp);
    acts.appendChild(up);
    if (f.img){ const cb=document.createElement('button'); cb.type='button'; cb.className='up'; cb.style.cssText='height:34px;border:1px solid var(--cyan);background:#fff;border-radius:8px;font:400 13px var(--f-body);padding:0 10px;cursor:pointer'; cb.textContent='סימון אזור'; cb.addEventListener('click',()=>startCrop(i)); acts.appendChild(cb); }
    if (UP.length>1){ const x=document.createElement('button'); x.type='button'; x.className='x'; x.setAttribute('aria-label','הסרת קומה'); x.textContent='×'; x.addEventListener('click',()=>{ UP.splice(i,1); renderUploads(); }); acts.appendChild(x); }
    row.append(th,mid,acts); floorsUp.appendChild(row);
  });
}
document.getElementById('addFloor').addEventListener('click',()=>{ if(UP.length<4){ UP.push({name:floorDefaultName(UP.length)}); renderUploads(); } });
UP=[{name:floorDefaultName(0)}]; renderUploads();

async function readFile(file, i){
  try{
    say(genStatus,'קורא את הקובץ…');
    let canvas;
    if (file.type==='application/pdf' || /\.pdf$/i.test(file.name)){
      if (!window.pdfjsLib) throw new Error('pdf');
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      const page=await pdf.getPage(1), vp0=page.getViewport({scale:1});
      const sc=Math.min(4, 3600/Math.max(vp0.width,vp0.height)), vp=page.getViewport({scale:sc});
      canvas=document.createElement('canvas'); canvas.width=Math.round(vp.width); canvas.height=Math.round(vp.height);
      const cx=canvas.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:cx, viewport:vp}).promise;
    } else {
      const url=URL.createObjectURL(file); const im=await new Promise((res,rej)=>{ const m=new Image(); m.onload=()=>res(m); m.onerror=rej; m.src=url; });
      canvas=document.createElement('canvas'); canvas.width=im.naturalWidth; canvas.height=im.naturalHeight; canvas.getContext('2d').drawImage(im,0,0); URL.revokeObjectURL(url);
    }
    UP[i].img=canvas; UP[i].crop=null; UP[i].thumb=thumbOf(canvas,null);
    renderUploads(); say(genStatus,'הקובץ נטען. כדאי לסמן את אזור השרטוט של הקומה כדי ש־Claude יקרא את המידות טוב יותר.');
    startCrop(i);
  }catch(e){ say(genStatus, e.message==='pdf' ? 'לא הצלחתי לפתוח PDF בדפדפן הזה. נסו להעלות תמונה (PNG או JPG) של השרטוט.' : 'לא הצלחתי לקרוא את הקובץ. נסו PDF, PNG או JPG.', true); }
}
function thumbOf(c, cr){ const t=document.createElement('canvas'); const r=cr||{x:0,y:0,w:c.width,h:c.height}; const s=112/Math.max(r.w,r.h); t.width=Math.max(1,Math.round(r.w*s)); t.height=Math.max(1,Math.round(r.h*s)); t.getContext('2d').drawImage(c,r.x,r.y,r.w,r.h,0,0,t.width,t.height); return t.toDataURL('image/jpeg',.7); }

/* ---------------- crop & check canvas ---------------- */
const chk=document.getElementById('check'), cctx=chk.getContext('2d'), cropBar=document.getElementById('cropBar');
let cropIdx=-1, cropSel=null, cropDrag=null, chkMode=null, chkFloor=0;
function fitRect(iw,ih){ const W=chk.width, H=chk.height, s=Math.min((W-40)/iw,(H-40)/ih); return {s, ox:(W-iw*s)/2, oy:(H-ih*s)/2}; }
function sizeChk(){ const r=view.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio); chk.width=Math.round(r.width*dpr); chk.height=Math.round(r.height*dpr); }
function startCrop(i){ stopTour(); cropIdx=i; cropSel=UP[i].crop?{...UP[i].crop}:null; chkMode='crop'; chk.hidden=false; cropBar.hidden=false; sizeChk(); drawCheck(); }
function endCrop(){ chkMode=null; chk.hidden=true; cropBar.hidden=true; cropIdx=-1; if (state.pane==='2d') setPane('2d'); }
document.getElementById('cropOk').addEventListener('click',()=>{ if(cropIdx<0) return; const f=UP[cropIdx]; if(cropSel && cropSel.w>40 && cropSel.h>40){ f.crop=cropSel; } f.thumb=thumbOf(f.img,f.crop); renderUploads(); endCrop(); });
document.getElementById('cropAll').addEventListener('click',()=>{ if(cropIdx<0) return; const f=UP[cropIdx]; f.crop=null; f.thumb=thumbOf(f.img,null); renderUploads(); endCrop(); });
function evImg(e){ const r=chk.getBoundingClientRect(), dpr=chk.width/r.width; const img=UP[cropIdx].img, {s,ox,oy}=fitRect(img.width,img.height); return [((e.clientX-r.left)*dpr-ox)/s, ((e.clientY-r.top)*dpr-oy)/s]; }
chk.addEventListener('pointerdown',e=>{ if(chkMode!=='crop') return; chk.setPointerCapture(e.pointerId); const [x,y]=evImg(e); cropDrag=[x,y]; cropSel={x,y,w:0,h:0}; drawCheck(); });
chk.addEventListener('pointermove',e=>{ if(chkMode!=='crop'||!cropDrag) return; const [x,y]=evImg(e), img=UP[cropIdx].img; const x0=Math.max(0,Math.min(cropDrag[0],x)), y0=Math.max(0,Math.min(cropDrag[1],y)), x1=Math.min(img.width,Math.max(cropDrag[0],x)), y1=Math.min(img.height,Math.max(cropDrag[1],y)); cropSel={x:Math.round(x0),y:Math.round(y0),w:Math.round(x1-x0),h:Math.round(y1-y0)}; drawCheck(); });
chk.addEventListener('pointerup',()=>{ cropDrag=null; });
function drawCheck(){
  const W=chk.width, H=chk.height; cctx.fillStyle='#f7f7f7'; cctx.fillRect(0,0,W,H);
  if (chkMode==='crop'){
    const img=UP[cropIdx].img, {s,ox,oy}=fitRect(img.width,img.height);
    cctx.drawImage(img,ox,oy,img.width*s,img.height*s);
    if (cropSel){ cctx.fillStyle='rgba(0,0,0,.35)'; cctx.fillRect(0,0,W,H); const r=[ox+cropSel.x*s,oy+cropSel.y*s,cropSel.w*s,cropSel.h*s];
      cctx.drawImage(img,cropSel.x,cropSel.y,cropSel.w,cropSel.h,...r); cctx.strokeStyle='#0050c9'; cctx.lineWidth=3; cctx.strokeRect(...r); }
    return;
  }
  // overlay check: the floor's source image with the model drawn on top
  const src=FLOORS_SRC[chkFloor], L=LEVELS[chkFloor], rt=LV[chkFloor];
  if (!src || !src.img || !L){ cctx.fillStyle='#6e6e6e'; cctx.font=`${Math.round(16*W/view.clientWidth)}px Arimo, Arial`; cctx.textAlign='center'; cctx.fillText('אין שרטוט מקור לקומה הזאת. ההשוואה זמינה לפרויקטים שנוצרו מהעלאת קובץ.',W/2,H/2); return; }
  const im=src.img, cr=src.crop||{x:0,y:0,w:im.width,h:im.height}, {s,ox,oy}=fitRect(cr.w,cr.h);
  cctx.drawImage(im,cr.x,cr.y,cr.w,cr.h,ox,oy,cr.w*s,cr.h*s);
  const cal=src.cal||{pxPerM:100,origin:[0,0]}, k=+document.getElementById('ovScale').value, dx=+document.getElementById('ovX').value, dy=+document.getElementById('ovY').value;
  const P=(x,z)=>[ox+(cal.origin[0]+x*cal.pxPerM*k)*s*(src.sendScale||1)+dx*s*3, oy+(cal.origin[1]+z*cal.pxPerM*k)*s*(src.sendScale||1)+dy*s*3];
  cctx.lineCap='round';
  for (const r of L.rooms){ const [a,b]=P(r.x0,r.z0),[c,d]=P(r.x1,r.z1); cctx.fillStyle=r.type==='wet'?'rgba(42,189,213,.18)':r.type==='balcony'?'rgba(80,160,60,.15)':'rgba(0,80,201,.08)'; cctx.fillRect(a,b,c-a,d-b);
    cctx.fillStyle='#0050c9'; cctx.font=`700 ${Math.max(11,Math.round(13*W/view.clientWidth))}px Arimo, Arial`; cctx.textAlign='center'; cctx.fillText(r.name,(a+c)/2,(b+d)/2); }
  cctx.strokeStyle='rgba(230,30,30,.9)'; for (const w of L.walls){ const [a,b]=P(...w.a),[c,d]=P(...w.b); cctx.lineWidth=Math.max(2,w.t*cal.pxPerM*k*s*.6); cctx.beginPath(); cctx.moveTo(a,b); cctx.lineTo(c,d); cctx.stroke(); }
  if (rt) for (const o of rt.OPEN){ const [a,b]= o.axis==='h'?P(o.s,o.coord):P(o.coord,o.s), [c,d]= o.axis==='h'?P(o.e,o.coord):P(o.coord,o.e); cctx.strokeStyle=o.bot>0?'#2abdd5':'#19a748'; cctx.lineWidth=6; cctx.beginPath(); cctx.moveTo(a,b); cctx.lineTo(c,d); cctx.stroke(); }
}
['ovScale','ovX','ovY'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{ const s=FLOORS_SRC[chkFloor]; if(s){ s.adj={k:+ovScale.value,dx:+ovX.value,dy:+ovY.value}; } drawCheck(); }));
const ovScale=document.getElementById('ovScale'), ovX=document.getElementById('ovX'), ovY=document.getElementById('ovY');
function setPane(p){
  state.pane=p;
  document.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===p)));
  if (chkMode==='crop') return;
  chk.hidden = p!=='2d'; if (p==='2d'){ chkMode='check'; sizeChk(); const a=(FLOORS_SRC[chkFloor]||{}).adj||{k:1,dx:0,dy:0}; ovScale.value=a.k; ovX.value=a.dx; ovY.value=a.dy; drawCheck(); } else chkMode=null;
}
document.querySelectorAll('[data-pane]').forEach(b=>b.addEventListener('click',()=>setPane(b.dataset.pane)));
function renderCheckFloors(){ const el=document.getElementById('checkFloor'); el.textContent=''; el.hidden=LEVELS.length<2; el.style.gridTemplateColumns=`repeat(${Math.max(1,LEVELS.length)},1fr)`;
  LEVELS.forEach((L,i)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=L.name; b.setAttribute('aria-pressed',String(i===chkFloor)); b.addEventListener('click',()=>{ chkFloor=i; renderCheckFloors(); renderRoomsEdit(); setPane('2d'); }); el.appendChild(b); }); }

/* ---------------- room editing ---------------- */
function renderRoomsEdit(){
  const box=document.getElementById('roomsEdit'); box.textContent='';
  document.getElementById('checkSec').hidden = !PLAN;
  if (!PLAN) return; renderCheckFloors();
  const f=PLAN.floors[chkFloor]; if(!f) return;
  f.rooms.forEach((r,j)=>{
    const row=document.createElement('div'); row.className='re';
    const n=document.createElement('input'); n.type='text'; n.value=r.name||''; n.setAttribute('aria-label','שם החדר'); n.addEventListener('change',()=>{ r.name=n.value; });
    const k=document.createElement('select'); k.setAttribute('aria-label','סוג החדר'); KIND_ORDER.forEach(id=>{ const o=document.createElement('option'); o.value=id; o.textContent=KINDS[id].n; if((KINDS[r.kind]?r.kind:guessKind(r.name))===id) o.selected=true; k.appendChild(o); }); k.addEventListener('change',()=>{ r.kind=k.value; });
    const del=document.createElement('button'); del.type='button'; del.textContent='×'; del.setAttribute('aria-label','מחיקת החדר'); del.addEventListener('click',()=>{ f.rooms.splice(j,1); renderRoomsEdit(); });
    row.append(n,k,del); box.appendChild(row);
  });
}
document.getElementById('applyEdit').addEventListener('click',()=>{ if(!PLAN) return; PLAN.name=document.getElementById('pName').value||PLAN.name; showLoading(()=>loadPlan(PLAN)); if(state.pane==='2d') setTimeout(()=>setPane('2d'),50); });

/* ---------------- ask Claude to read the drawing ---------------- */
const PROMPT = (fl, idx, widthHint) => `את/ה מומחה/ית לקריאת תוכניות אדריכליות (לרוב בעברית, עם מידות בס"מ). בתמונה מצורפת תוכנית של "${fl}" (קומה ${idx+1}) של בית או דירה.
המטרה: לחלץ גיאומטריה מדויקת לבניית מודל תלת־ממד. החזר/י JSON בלבד, בלי טקסט נוסף, במבנה:
{"height": גובה תקרה במטרים (אם לא מופיע 2.8),
 "pxPerM": כמה פיקסלים בתמונה שקיבלת שווים למטר אחד,
 "origin": [x,y] הפיקסל בתמונה של הנקודה (0,0) = הפינה השמאלית־עליונה החיצונית של המבנה,
 "walls": [{"a":[x,z],"b":[x,z],"t":עובי במטרים}],
 "openings": [{"type":"door|entry|window|slider|pass","x":..,"z":..,"w":רוחב,"sill":גובה אדן לחלון,"h":גובה}],
 "rooms": [{"name":"שם החדר כפי שכתוב","kind":"living|kitchen|dining|hall|bed|master|kids|office|mamad|closet|storage|bath|wc|laundry|stair|balcony","x0":..,"z0":..,"x1":..,"z1":..}]}
כללים:
- יחידות: מטרים. x גדל ימינה, z גדל כלפי מטה בתמונה. (0,0) בפינה השמאלית־העליונה החיצונית של המבנה.
- השתמש/י בשרשראות המידות שעל השרטוט (בס"מ) כדי לקבוע מיקומים מדויקים; אל תנחש/י מקנה מידה של פיקסלים כשיש מידה כתובה.${widthHint?` הרוחב הכולל של המבנה (בציר x) הוא ${widthHint} מ'.`:''}
- קירות: קווי מרכז, אופקיים או אנכיים בלבד. קיר חיצוני כ־0.25, פנימי כ־0.10–0.15, ממ"ד 0.30. פצל/י קיר רק כשהוא באמת נקטע.
- חדרים: מלבנים מיושרים לצירים שגבולותיהם על קווי המרכז של הקירות. חדר בצורת L מפצלים לשני מלבנים עם אותו שם. כלול/י מרפסות (balcony) ומדרגות (stair).
- פתחים: נקודת המרכז על קו הקיר. "entry" לדלת הכניסה הראשית, "slider" לויטרינה/דלת הזזה, "pass" למעבר בלי דלת. חלון: sill ו־h לפי uk/ok אם כתוב (uk=אדן, ok=ראש), אחרת sill 0.9 ו־h 1.3.
- אל תמציא/י חדרים שאינם בשרטוט. אם משהו לא ברור, השמט/י אותו.${idx>0?'\n- זו קומה עליונה: קבע/י את (0,0) בפינה השמאלית־העליונה החיצונית של קומת הקרקע (בדרך כלל מסומנת בקו מקווקו או בקו הגג/המרפסות של הקומה שמתחת), כך שהקומות יתלכדו. אם אין סימון כזה, השתמש/י בפינת הקומה הזאת.':''}`;
let sampleNS=null;
async function getSample(){ if (sampleNS!==null) return sampleNS; try{ sampleNS = window.claude ? await window.claude.use('sample') : null; }catch(e){ sampleNS=null; } return sampleNS; }
function prepImage(f){
  const c=f.img, cr=f.crop||{x:0,y:0,w:c.width,h:c.height}, s=Math.min(1, 1900/Math.max(cr.w,cr.h));
  const o=document.createElement('canvas'); o.width=Math.round(cr.w*s); o.height=Math.round(cr.h*s);
  const x=o.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,o.width,o.height); x.drawImage(c,cr.x,cr.y,cr.w,cr.h,0,0,o.width,o.height);
  return {canvas:o, scale:s};
}
const toBlob=(c,t='image/jpeg',q=.9)=>new Promise(r=>c.toBlob(r,t,q));
document.getElementById('genBtn').addEventListener('click', async ()=>{
  const ready=UP.filter(f=>f.img);
  if (!ready.length){ say(genStatus,'קודם מעלים קובץ תוכנית לפחות לקומה אחת.',true); return; }
  const sample=await getSample();
  if (!sample){ say(genStatus,'קריאת שרטוט עם Claude זמינה כשפותחים את העמוד ב־claude.ai עם חשבון מחובר. בינתיים אפשר לייבא קובץ תוכנית (JSON).',true); return; }
  const btn=document.getElementById('genBtn'); btn.disabled=true;
  const widthHint=+document.getElementById('pWidth').value||0;
  const floors=[], src=[];
  try{
    for (let i=0;i<ready.length;i++){
      const f=ready[i];
      say(genStatus,`Claude קורא את ${f.name} (${i+1} מתוך ${ready.length}). זה לוקח בדרך כלל דקה עד שתיים…`);
      const {canvas,scale}=prepImage(f); const blob=await toBlob(canvas);
      const res=await sample.json(PROMPT(f.name,i,i===0?widthHint:0), {images:[blob], modelTier:'complex', cache:false});
      if (!res || !Array.isArray(res.walls) || !Array.isArray(res.rooms)) throw {code:'bad_json'};
      floors.push({name:f.name, height:res.height, walls:res.walls, openings:res.openings||[], rooms:res.rooms});
      src.push({name:f.name, img:f.img, crop:f.crop, sendScale:1/scale, cal:{pxPerM:+res.pxPerM||100, origin:Array.isArray(res.origin)?res.origin:[0,0]}, adj:{k:1,dx:0,dy:0}});
    }
    // align floors: upper floors share the ground floor's frame (outer top-left corner of the building)
    const name=document.getElementById('pName').value.trim() || 'פרויקט חדש';
    const P={name, roof:'hip', floors, plot:null};
    if (widthHint>0 && floors[0].walls.length){ const xs=floors[0].walls.flatMap(w=>[w.a[0],w.b[0]]); const wNow=Math.max(...xs)-Math.min(...xs); if (wNow>1){ const k=widthHint/wNow; if (k<.8||k>1.25) scalePlan(P,k); } }
    say(genStatus,'ההדמיה מוכנה. כדאי לבדוק אותה מול השרטוט במצב "השוואה לשרטוט" ולתקן סוגי חדרים אם צריך.');
    document.getElementById('projEyebrow').textContent='פרויקט חדש';
    showLoading(()=>loadPlan(P, src));
    projectId=null; dirty=true;
  }catch(e){
    const code=e&&e.code;
    say(genStatus, code==='rate_limited' ? 'יותר מדי בקשות ברגע זה. נסו שוב בעוד דקה.' : code==='not_granted' ? 'לא ניתנה הרשאה ל־Claude לקרוא את השרטוט. אפשר לאשר אותה בתפריט ההרשאות של העמוד.' : 'לא הצלחתי לקרוא את השרטוט. נסו לסמן אזור קטן יותר סביב תוכנית הקומה בלבד, או להעלות תמונה ברורה יותר.', true);
  } finally { btn.disabled=false; }
});
function scalePlan(P,k){ const s=v=>v*k; for (const f of P.floors){ f.walls.forEach(w=>{ w.a=w.a.map(s); w.b=w.b.map(s); }); f.openings.forEach(o=>{ o.x=s(o.x); o.z=s(o.z); }); f.rooms.forEach(r=>{ r.x0=s(r.x0); r.x1=s(r.x1); r.z0=s(r.z0); r.z1=s(r.z1); }); } }

/* ============================== SAVE / LOAD ============================== */
let projectId=null, dirty=false, dbNS=null, assetsNS=null, downloadsNS=null;
const saveStatus=document.getElementById('saveStatus'), projList=document.getElementById('projList');
function planForSave(){
  const P=JSON.parse(JSON.stringify(PLAN)); P.name=document.getElementById('pName').value.trim()||P.name||'פרויקט';
  P.floors.forEach((f,i)=>{ const s=FLOORS_SRC[i]; if(s && s.cal) f.image={pxPerM:s.cal.pxPerM, origin:s.cal.origin, sendScale:s.sendScale||1, crop:s.crop||null, adj:s.adj||null, asset:s.assetId||null}; });
  return P;
}
document.getElementById('saveBtn').addEventListener('click', async ()=>{
  if (!PLAN) return;
  if (!dbNS){ say(saveStatus,'שמירה זמינה כשפותחים את העמוד ב־claude.ai עם חשבון מחובר. אפשר להוריד את קובץ התוכנית במקום.',true); return; }
  try{
    say(saveStatus,'שומר…');
    if (assetsNS) for (const s of FLOORS_SRC){ if (s && s.img && !s.assetId){ const {canvas}=prepImageFrom(s); const b=await toBlob(canvas,'image/jpeg',.85); try{ const up=await assetsNS.upload(b); s.assetId=up.id; }catch(e){} } }
    const P=planForSave(); PLAN.name=P.name;
    const data={name:P.name, updatedAt:new Date().toISOString(), floors:P.floors.length, area:BUILT, plan:JSON.stringify(P)};
    if (projectId) await dbNS.doc('projects/'+projectId).set(data); else { const ref=await dbNS.collection('projects').add(data); projectId=ref.id; }
    dirty=false; say(saveStatus,`נשמר: ${P.name}`);
    document.getElementById('projTitle').textContent=P.name;
  }catch(e){ say(saveStatus, e&&e.code==='not_granted' ? 'אין הרשאת כתיבה בעמוד הזה. מי שיש לו הרשאת עריכה יכול לשמור.' : 'השמירה נכשלה. נסו שוב.', true); }
});
function prepImageFrom(s){ const c=s.img, cr=s.crop||{x:0,y:0,w:c.width,h:c.height}, k=Math.min(1,2400/Math.max(cr.w,cr.h)); const o=document.createElement('canvas'); o.width=Math.round(cr.w*k); o.height=Math.round(cr.h*k); o.getContext('2d').drawImage(c,cr.x,cr.y,cr.w,cr.h,0,0,o.width,o.height); return {canvas:o, k}; }
async function openProject(id, data){
  try{
    const P=JSON.parse(data.plan); projectId=id;
    const src=await Promise.all(P.floors.map(async f=>{ const im=f.image; if(!im) return null;
      let img=null; if (im.asset){ try{ img=await new Promise((res,rej)=>{ const m=new Image(); m.crossOrigin='anonymous'; m.onload=()=>res(m); m.onerror=rej; m.src='/_blob/'+im.asset; }); }catch(e){} }
      const s={name:f.name, cal:{pxPerM:im.pxPerM, origin:im.origin}, sendScale:im.sendScale||1, adj:im.adj||{k:1,dx:0,dy:0}, assetId:im.asset||null};
      if (img){ // saved image is the cropped region, downscaled by k: map back into that frame
        const k=img.naturalWidth/((im.crop&&im.crop.w)||img.naturalWidth); s.img=img; s.crop=null; s.sendScale=(im.sendScale||1)*k; }
      return s; }));
    document.getElementById('projEyebrow').textContent='פרויקט שמור';
    showLoading(()=>loadPlan(P, src));
    say(saveStatus,`נפתח: ${P.name}`);
  }catch(e){ say(saveStatus,'לא הצלחתי לפתוח את הפרויקט.',true); }
}
document.getElementById('exportBtn').addEventListener('click', async ()=>{
  if (!PLAN) return; const txt=JSON.stringify(planForSave(),null,1), fn=(PLAN.name||'plan').replace(/[\\/:*?"<>|]+/g,'-')+'.json';
  if (!downloadsNS){ say(saveStatus,'הורדה זמינה כשפותחים את העמוד ב־claude.ai.',true); return; }
  try{ await downloadsNS.save({filename:fn, data:txt}); say(saveStatus,'הקובץ נשלח להורדה.'); }catch(e){ say(saveStatus, e&&e.code==='declined'?'ההורדה בוטלה.':'ההורדה לא הצליחה.', e&&e.code!=='declined'); }
});
document.getElementById('importIn').addEventListener('change', async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const P=JSON.parse(await f.text()); if(!P.floors) throw 0; projectId=null; document.getElementById('projEyebrow').textContent='קובץ מיובא'; showLoading(()=>loadPlan(P, P.floors.map(()=>null))); say(saveStatus,`יובא: ${P.name||f.name}`); }
  catch(_){ say(saveStatus,'הקובץ אינו קובץ תוכנית תקין.',true); }
  e.target.value='';
});
document.getElementById('sampleBtn').addEventListener('click',()=>{ projectId=null; document.getElementById('projEyebrow').textContent='דוגמה'; showLoading(()=>loadPlan(JSON.parse(JSON.stringify(SAMPLE)), SAMPLE.floors.map(()=>null))); });
function renderProjects(docs){
  projList.textContent='';
  if (!docs.length){ const li=document.createElement('li'); li.className='lbl-note'; li.textContent='עוד אין פרויקטים שמורים. אחרי שיוצרים הדמיה לוחצים "שמירת הפרויקט" והיא תופיע כאן.'; projList.appendChild(li); return; }
  for (const d of docs){ const v=d.data()||{}; const li=document.createElement('li'); const b=document.createElement('button'); b.type='button';
    const dt=v.updatedAt?new Date(v.updatedAt).toLocaleDateString('he-IL'):''; b.innerHTML=`<span>${esc(v.name||'פרויקט')}</span><small>${v.area?v.area+' מ״ר · ':''}${dt}</small>`;
    b.addEventListener('click',()=>openProject(d.id,v)); li.appendChild(b); projList.appendChild(li); }
}
(async ()=>{
  if (!window.claude) { renderProjects([]); return; }
  try{ dbNS=await window.claude.use('db'); }catch(e){}
  try{ assetsNS=await window.claude.use('assets'); }catch(e){}
  try{ downloadsNS=await window.claude.use('downloads'); }catch(e){}
  if (!dbNS){ renderProjects([]); return; }
  const timer=setTimeout(()=>{ if(!projList.children.length) renderProjects([]); },10000);
  dbNS.collection('projects').orderBy('updatedAt','desc').limit(40).onSnapshot(snap=>{ clearTimeout(timer); renderProjects(snap.docs); }, ()=>{ clearTimeout(timer); renderProjects([]); });
})();
