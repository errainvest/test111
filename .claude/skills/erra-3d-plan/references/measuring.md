# Measuring drawings accurately

The viewer is only as good as the floor JSON. These are the habits that produced a model within ~10 cm of the
drawings in the Modiin B-43 set, and the mistakes that cost the most time.

## The kit (`scripts/`)

All of them read the project's `reg.json` (`$ERRA_REG`, or `./reg.json`). Run as `python3 -I`.

| script | what it does |
|---|---|
| `register.py REG SHEET PNG --p1 PX,PY,X,Z --p2 PX,PY,X,Z` | adds a sheet's pixel→metre transform (scale, offset, scan tilt) from two known points; prints the residual |
| `geo.py px2m SHEET px py` / `m2px` / `f2g` / `g2f` | conversions between pixels, global metres and a rotated reading frame |
| `mgrid.py SHEET OUT.png --box=U0,V0,U1,V1 [--frame ox,oz,deg] [--res 100] [--step 0.5]` | resamples a region into the metric frame with a labelled metre grid (red = u, blue = v). Read coordinates off the picture. Keep images ≤ ~1600 px a side; zoom by shrinking the box |
| `scan.py SHEET --p0=U,V --p1=U,V [--frame …] [--band 0.15] [--thr 150]` | darkness along a line across a wall → the two faces (centreline = midpoint, thickness = run length) |
| `overlay2.py FLOOR.json SHEET OUT.png [--box …] [--frame …]` | draws a floor JSON back on the sheet: walls red to thickness, railings orange, doors green, windows cyan, rooms blue. The check |
| `pxgrid.py SRC OUT x0,y0,x1,y1 SCALE STEP` | a plain pixel grid for unregistered sheets (sections, elevations, cover page) |
| `align.py A.json B.json --kinds=core,mamad [--apply=OUT.json]` | rigid fit of floor A onto floor B on walls that must stack; prints rotation, shift, residuals |
| `stack_check.py OUT.png X0,Z0,X1,Z1 PX_PER_M f1.json f2.json …` | all floors' walls in one picture, one colour each |
| `site_tf.py SITE.json OUT.json THETA,DX,DZ` | moves a site file into the aligned frame |

## Registration

- Pick the global origin on something that exists on every floor sheet: a long dimension chain of the main building
  (x = its west end), and a block that stacks (the ממ״ד or the stair core) for z. Write the choice into `reg.json`'s
  `_doc` so every reader uses the same frame.
- Register on two points far apart on a dimension chain, never on wall faces (a face is 2–3 px wide at 200 dpi, a chain
  tick is sharp). `register.py` prints the error at the second point; above 2 cm, re-read the pixels.
- Scanned sheets are tilted by up to ~1° and scaled slightly differently in x and y. Use `--aniso` with a third point
  when the residual stays above 2 cm.
- A wing drawn at an angle gets a reading frame (`--frame ox,oz,deg`) in which its walls are axis-aligned; measure
  in that frame, the kit converts to global.

## Reading a floor

1. `mgrid.py` the whole floor at `--res 60` to see it, then rooms at `--res 100–140`.
2. Walls: take the dimension chains first (they are what the builder uses), then confirm with `scan.py` across each wall.
   Exterior walls: block + plaster ≈ 0.25; concrete (blue hatch) ≈ 0.25–0.40; partitions 0.10. Measure the total
   depth and width of the building too: a first pass is easy to get short by half a metre at the far end.
3. Openings: the `width/height` labels; sills from `uk`/`ok` marks or the window schedule; door swings as drawn.
4. Rooms: polygons on the centrelines you just wrote. Compare each area with the number printed in the room; the model
   is gross (to centrelines), so a room is ~5–8 % larger than the net figure, more next to a ממ״ד.
5. Outdoor: balconies, terraces and gardens with their level; railings along their open edges.
6. `overlay2.py`, look, fix, repeat until red sits on the drawn walls and blue polygons close on them.

## Stacking floors

- Overlay the floors with `stack_check.py`. Cores, shelters and facade lines must coincide within ~5 cm.
- When they don't, the sheets disagree (registration), not the building. Fit with `align.py --kinds=core,mamad`
  (B-43: residuals ~1 cm after a 0.4° rotation and a 0.7 m shift between sheets). Apply the transform to the floor,
  and to the site with `site_tf.py` or a blend between buildings.
- Levels come from the sections: ±0.00 absolute per building, slab levels, roof and parapet tops. Floor height =
  next level − this level; the top floor's height comes from the roof level.

## The apartment shown inside

Two independent readers extract fixtures (counters with sink/cooktop/fridge, bath, shower, toilets, basins, washer,
AC, door swings) into the fixtures JSON, each with notes on what it saw; a reconciler compares them and a verifier
checks the merged file on the overlay. Where the readers disagree, the floor JSON is usually wrong there (a wall
missing, a door in the wrong wall): fix the floor, don't average the readings.

## Site plan

- Plot polygon with vertex coordinates from the survey table when there is one; building lines as polylines.
- Spot levels: a dozen well-spread ones, plus the levels written on gardens, parking and paths.
- Retaining walls with their top level; fences on top of them with `base`; trees with crown radius; street furniture.
- North: the arrow on the site plan, as a unit vector in drawing coordinates (z down).
- Neighbours: a polygon, a height and a base level each; they only need to look right from the street.

## Facade and views

- Elevations: stone vs plaster zones, railing type and colour, window heads. Photos of the real building or a 3D
  city model are better: they settle colours and show which corner the client will recognise. Put that viewpoint
  in `views.ext` and check the exterior screenshot against the photo.

## Things that went wrong before (and the cure)

| symptom | cause | cure |
|---|---|---|
| a floor a storey too high, or the terrain 100 m up | absolute and relative heights mixed up | a height within ±60 m of `datum` is taken as absolute and converted; anything else is relative. Set `datum` to the site's real height (sections' ±0.00) and keep `zero` per building right |
| entrance steps a full storey high | stairs without `from_level`/`to_level` | add them |
| living room empty, bedroom without a bed | every wall blocked by door zones | check `__studio.why(roomId)` and `edges(roomId)` in the page; usually a door drawn in the wrong wall |
| white strips on a roof terrace | sliver polygons from nearly-coincident walls | engine drops slivers < 0.6 m; make facade lines coincide across floors |
| washed-out colours | colour management | fixed in the engine (`legacyMode=false`); do not re-add sRGB conversions |
| cats / dog hidden by HUD on phones | animals placed where the minimap sits in the opening view | the hint carries links to them; still, place them where the exterior view shows them |
| the ext view blocked by the other building | fixed viewpoint | `views.ext` from the photo; the engine also searches unobstructed directions |
