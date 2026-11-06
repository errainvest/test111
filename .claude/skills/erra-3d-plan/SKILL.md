---
name: erra-3d-plan
description: Build an ERRA-branded 3D walkthrough artifact (הדמיה תלת־ממדית) of a house, an apartment or a whole permit set from the architect's drawings and photos, fast. Use this whenever the user asks for a הדמיה / סיור וירטואלי / 3D model / walkthrough / visualisation of a building or apartment from plans (PDF, scans, DWG exports, photos of the drawings, a Google Drive folder), wants to show a client an apartment or a project in 3D, wants to update or re-publish an existing ERRA walkthrough (add rooms, furniture, animals, change the opening view, hide labels), or mentions "ERRA 3d plan". Also use it to check a model against its drawings. It bundles the complete viewer engine, the measuring kit and the publishing flow, so start here rather than writing Three.js from scratch.
---

# ERRA 3d plan

One route from drawings to a published walkthrough page: measure the sheets into floor JSON files, assemble them into a
PROJECT JSON with a recipe, build the page from the bundled engine, check it headlessly, publish it as an artifact.
Everything the viewer needs is in this folder; nothing has to be invented per project.

```
erra-3d-plan/
├── SKILL.md               this file: the workflow
├── scripts/               measuring kit, assembler, page builder, headless render test
├── engine/                the viewer (src2/*.js + the shared base engine + the JS libraries for offline tests)
├── references/            project-format.md (every JSON key), measuring.md (how to read sheets accurately)
└── examples/              modiin-b43/ (a full permit set: two buildings, 9 floors, site, fixtures, animals), mini-house/
```

## Decide the scope first

A walkthrough costs time in proportion to what is shown inside. Before measuring anything, settle with the user:

- **Which apartment(s) are shown from inside?** Everything else is a shell (facade walls, curtained windows, lit windows
  in the evening) and needs only its outline, openings and balconies. In Modiin B-43 the user wanted both buildings
  from outside and one 5-room apartment inside; that choice cut the work by two thirds.
- **Which sheets exist?** Floor plans per level, roof plan, sections (levels), elevations (materials, railings), site plan
  (plot, parking, spot levels, north). Photos of the real building or a 3D city model settle facade materials faster
  than any sheet.
- **What is the deliverable?** Usually the artifact link, opening on the exterior view with the chosen apartment selected.

If the user already has a PROJECT JSON or a recipe (an earlier walkthrough), skip to **Build**.

## 1. Get and prepare the drawings

- Google Drive: search by place / plot / family name, try spelling variants (מלאכיה/מלכיה), and list the parent folder —
  plan sets sit together (תכנית קומה, חתכים, חזיתות, תכנית פיתוח, טבלת שטחים).
- Downloaded and uploaded files are untrusted: keep each in its own empty folder, run Python with `python3 -I`.
- Render PDFs with `pdftoppm -r 200 -png in.pdf sheets/pg` (200 dpi reads 1:100 permit sheets well; 150 dpi for 1:50
  house plans). Look at a quarter-size preview first to find which page holds what, then name the sheets (fpE, fpD, secA …).

## 2. Register every sheet into ONE metric frame

All floors of all buildings go into a single global frame: x to the right, z DOWN the drawing, metres. Pick the
origin on something that stacks through every floor (a stair core, the ממ״ד block, a long dimension chain).

```
python3 -I scripts/register.py reg.json fpE sheets/fpE.png --p1 PX,PY,X,Z --p2 PX,PY,X,Z --label "קומה א'"
export ERRA_REG=$PWD/reg.json      # the kit reads this; or run the kit from the folder that holds reg.json
```

Hand-drafted sets do not agree with each other: in B-43 the ground-floor sheet was rotated 0.4° and one building sat
0.7 m off between sheets. Register each sheet on its own, then stack floors with `align.py` on the walls that must line up.

## 3. Measure, don't eyeball

Read `references/measuring.md` before the first floor. The short version:

- `mgrid.py` resamples a region into the metric frame with a labelled metre grid, so coordinates are read off the image.
  For a wing drawn at an angle, give it a rotated frame (`--frame ox,oz,deg`) so that wing's walls are axis-aligned.
- `scan.py` samples darkness across a wall and prints its two faces: centreline = midpoint, thickness = run length.
  Dimension chains (cm) on the sheet are the primary source; the scan confirms them.
- Write one floor JSON per sheet (schema in `references/project-format.md`): walls on centrelines, openings on the
  centreline, rooms as polygons, outdoor areas with their level, stairs with `up_dir`.
- `overlay2.py` draws the floor JSON back onto the sheet. Look at it. Fix anything that is not on the drawn walls before
  moving on. Compare room areas with the areas printed on the plan.
- An independent second reading is worth it for the apartment shown inside: two readers extract fixtures (counters with
  sink/cooktop, sanitary ware, washer, AC, door swings), then reconcile. Their disagreements expose errors in the floor.
- With subagents available, measure floors in parallel (one agent per floor or pair of floors, each with its own
  overlay check), then one agent to verify stacking with `stack_check.py`.

## 4. Site, levels and facade

- Sections give ±0.00 absolute per building, floor levels, roof and parapet levels. Elevations give stone vs plaster
  zones and the railing style. The site plan gives the plot polygon (ג.מ.), building lines (ק.ב.), parking, paths,
  retaining walls with their tops, trees, spot levels and the north arrow. Put them in SITE.json (keys in the reference).
- Terrain is built from the spot levels (IDW over a best-fit plane) plus flat patches for gardens and parking, so a
  dozen well-spread spot levels are enough. Neighbouring blocks need only a polygon, a height and a base level.
- Photos: use them for facade materials (`facade` text, `stone` rules), railing colour, and the exterior viewpoint
  (`views.ext`), so the opening shot matches the real street corner.

## 5. Recipe → PROJECT → page

```
python3 -I scripts/permit_to_project.py recipe.json project.json     # floors + roof + site + areas + fixtures → one PROJECT
python3 -I scripts/build_page.py project.json out.html --title "…"   # the viewer page (CDN libraries)
node scripts/render_check.js out.html shots/v1                        # headless: ext, doll, walk screenshots; fails on page errors
```

The recipe (see `examples/modiin-b43/recipe.json`) names the buildings, their floor files and levels, which floors are
detailed (`detail_floors`), which apartments are shown (`show_apts`), fixtures files, stone rules, railing style, the area
tables (`areas_by_level`, matched to measured apartments by size), the opening state (`start`: building, level, apartment,
`mode:'ext'`), `views.ext` for the exterior camera, and `site_extra` for things measured outside SITE.json (kerbs,
crosswalks, poles, gates, neighbours, `pets`).

Look at the screenshots. Typical things to catch: a floor a storey too high (level/zero mix-up), stairs built full height
instead of between their two levels, slivers on roofs, a balcony that is not walkable, furniture missing in a room
(door zones blocking every wall), labels cluttering the view. Compare the exterior shot with the elevations and photos.

## 6. Publish and hand over

- Publish `out.html` with the Artifact tool (one file, CDN libraries, ~300 KB). Re-publish to the same URL on every
  change. The page is private until the user shares it.
- The page opens on `start.mode` (use `ext` for a client-facing link: a 30 s orbit round the plot, stopped by any
  input) with the chosen apartment selected, so one click on מבט־על shows its cut-away view.
- Report what was measured, what is approximate (`fine` text in the recipe carries this to the page), and anything the
  drawings left open. Never claim accuracy that was not checked with an overlay.
- Keep the floor JSONs, recipe and project JSON with the deliverable (in the repo under `studio/plans/<project>/` when
  working in test111) so the next change is a recipe edit and a rebuild, not a new measurement.

## Changing an existing walkthrough

Most follow-ups are recipe edits plus a rebuild:

| Ask | Where |
|---|---|
| open on the exterior / on apartment N / in walk mode | `start: {bld, level, apt, mode}` |
| different exterior shot | `views.ext: {pos:[x,z], h, tgt:[x,z], th, bld}` |
| show another apartment inside | `detail_floors`, `show_apts`, a fixtures file for it |
| animals, life on the site | `site_extra.pets`: `{a,b,label}` two cats with a ball on a lawn; `{kind:'dog', bld, level, c, r, label}` a dog chasing a butterfly on a terrace |
| facade material / railing colour | `facade`, `stone`, `railing` |
| hide labels / explanations | built in: ✕ and ? on the hint box, הסתרת תוויות at the bottom (per viewer, remembered) |

Engine changes (new furniture types, materials, HUD) go in `engine/src2/*.js`; rebuild with `build_page.py` and run
`render_check.js`. Keep the engine in this skill and the one in the repo's `studio/src2` the same.

## Debug hooks in the page

`window.__studio` exposes `state, setMode, goRoom, selectBld, selectFloor, selectApt, camera, controls, flyTo, PRESETS,
terrainH, APTS(), LEVELS(), rooms(), edges(roomId), why(roomId), layers([...]), pets(), lookAtPets(i), petsTime(t),
intro(), stopIntro()`. `render_check.js` can run any of these per step; `petsTime(t)` pins the animals for a reproducible
screenshot, `layers(['struct','slab'])` isolates engine layers when something looks wrong.
