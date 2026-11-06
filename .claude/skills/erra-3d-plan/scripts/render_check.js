// Headless render test of a built page: loads it with the bundled libraries (no network), fails on page errors,
// and takes screenshots of the exterior view, the cut-away view and a walk into the first room.
//
// usage: node render_check.js PAGE.html OUT_PREFIX ['[{"js":"...","wait":3000,"name":"x","click":"#id"}]']
//   With no steps it runs the default set: ext, doll, walk. Each step may run JS in the page (window.__studio is the
//   debug API: setMode, goRoom, selectBld/selectFloor/selectApt, pets, lookAtPets, petsTime, camera, controls).
// Page load takes 30-60 s with software GL; a 1280x780 viewport matches the artifact's desktop layout.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
// the JS libraries for offline tests: bundled in the installed skill; in the repo checkout they are not committed, so fetch
// them once with scripts/fetch_libs.sh (or point ERRA_LIBS at a folder that has them)
const LIBS = process.env.ERRA_LIBS || [path.join(__dirname, '..', 'engine', 'libs')].find(d => fs.existsSync(path.join(d, 'three.min.js'))) || path.join(__dirname, '..', 'engine', 'libs');
if (!fs.existsSync(path.join(LIBS, 'three.min.js'))) { console.log('libraries missing in ' + LIBS + ': run scripts/fetch_libs.sh'); process.exit(2); }
const page = process.argv[2], out = process.argv[3];
const steps = process.argv[4] ? JSON.parse(process.argv[4].startsWith('@') ? fs.readFileSync(process.argv[4].slice(1), 'utf8') : process.argv[4]) : [
  { js: "__studio.stopIntro && __studio.stopIntro(); __studio.setMode('ext')", wait: 4500, name: 'ext' },
  { js: "__studio.setMode('doll')", wait: 4500, name: 'doll' },
  { js: "__studio.setMode('walk')", wait: 4500, name: 'walk' },
];
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(page, 'utf8') + '</body></html>';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 780 } }); p.setDefaultTimeout(400000);
  let errors = 0;
  p.on('pageerror', e => { errors++; console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); });
  p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !t.includes('ERR_FAILED')) console.log('CONSOLE', m.type(), t.slice(0, 300)); });
  await p.route('**/*', r => { const u = r.request().url(); const f = u.split('/').pop();
    if (u.includes('three@') || u.includes('polygon-clipping')) return r.fulfill({ body: fs.readFileSync(path.join(LIBS, f)), contentType: 'application/javascript' });
    if (u.startsWith('http://local/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort(); });
  const t0 = Date.now();
  await p.goto('http://local/'); await p.waitForFunction(() => window.__studio, { timeout: 400000 }); console.log('loaded in', (Date.now() - t0) / 1000, 's');
  await p.waitForTimeout(3000);
  let i = 0;
  for (const s of steps) {
    if (s.js) { const r = await p.evaluate(s.js); if (r !== undefined) console.log((s.name || i) + ' js:', JSON.stringify(r).slice(0, 2000)); }
    if (s.click) await p.click(s.click);
    await p.waitForTimeout(s.wait || 3500);
    if (s.after) { const r = await p.evaluate(s.after); console.log((s.name || i) + ' after:', JSON.stringify(r).slice(0, 2000)); }
    if (s.shot !== false) await p.screenshot({ path: `${out}-${String(i).padStart(2, '0')}${s.name ? '-' + s.name : ''}.png` });
    i++;
  }
  await b.close();
  console.log(errors ? `FAILED: ${errors} page error(s)` : 'OK: no page errors');
  process.exit(errors ? 1 : 0);
})();
