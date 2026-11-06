# Project format

Three layers of JSON, all in metres in one global frame (x right, z DOWN the drawing). Heights are relative to each
building's ±0.00, or absolute (surveyed): a value within ±60 m of the project `datum` is read as absolute and converted,
so give `datum` the site's real height from the sections (e.g. 246.4) and write SITE.json levels as surveyed.

1. **Floor JSON** — one per sheet, written while measuring (`<dir>/E1.json`, `M3.json`, `MR.json` for a roof, `SITE.json`).
2. **Recipe** — names the buildings, their floor files and settings. Input to `scripts/permit_to_project.py`.
3. **PROJECT JSON** — what the page embeds. Output of the assembler; you rarely edit it by hand.

## 1. Floor JSON

```json
{
 "building": "M2", "floor": "קומה ג׳", "sheet": "fpC", "level": 6.0,
 "level_marks": [{"text": "+6.00", "x": -8, "z": 4}],
 "walls":    [{"a": [x,z], "b": [x,z], "t": 0.25, "kind": "ext|int|mamad|core|low", "h": null}],
 "railings": [{"a": [x,z], "b": [x,z], "h": 1.10}],
 "openings": [{"type": "door|entry|window|slider|pass", "x": 0, "z": 0, "w": 0.9, "h": 2.1, "sill": 0, "label": "80/210"}],
 "rooms":    [{"name": "ח. שינה", "kind": "bed", "apt": "4", "poly": [[x,z], ...]}],
 "outdoor":  [{"name": "מרפסת", "kind": "balcony|terrace|garden|pergola|parking|path", "apt": "4", "poly": [[x,z], ...], "level": 5.98}],
 "stairs":   [{"poly": [[x,z], ...], "up_dir": [dx,dz], "from_level": 6.0, "to_level": 9.0}],
 "lifts":    [{"poly": [[x,z], ...]}],
 "apartments": [{"apt": "4", "main_area": 111.88, "rooms": 5}],
 "notes": ["anything uncertain, with the sheet reference"]
}
```

- **Walls** run on centrelines, as straight segments, split where they meet another wall or change thickness. Openings
  are NOT gaps: walls run through them and openings are listed separately with their centre on the wall centreline.
  Thickness from the drawing: exterior block + plaster 0.20–0.30, ממ״ד / core concrete 0.25–0.40, partitions 0.10.
  `kind`: `ext` exterior, `int` partition, `mamad` shelter, `core` stair/lift concrete (stone-clad by the default stone
  rule), `low` parapet or low wall (give `h`; on a roof also `base`/`top`).
- **Openings**: windows are labelled `width/height` in cm ("120/105"); sill = 2.15 − h unless marked. Doors "80/210".
  `slider` = glazed sliding door to a balcony or garden, `entry` = apartment or building front door, `pass` = an opening
  without a door. The engine attaches each opening to the nearest wall (within half the thickness + 35 cm).
- **Rooms**: one polygon per room on wall centrelines, vertices in order, the name as written on the plan. `kind` ∈
  `living kitchen dining hall lobby bed master kids office mamad closet storage shaft bath wc laundry service stair`
  (`service` = מעבה, the AC ledge). `apt` = the circled apartment number, or `common` for lobby and stairs. Open-plan
  living/dining/kitchen: split into the named polygons if the plan names them, else one `living`.
- **Outdoor**: balconies, roof terraces (often drawn with their level on the sheet of the floor above the roof they sit
  on), private gardens (חצר), pergolas (a pergola named "בעתיד" / FUTURE is skipped), parking stalls, paths. Give
  `level` when known; a garden or a balcony within 45 cm of the floor level becomes walkable.
- **Stairs**: a polygon and the direction of climbing. `from_level`/`to_level` matter for entrance steps and basement
  stairs — without them a stair is built a full storey high.
- Do not copy dashed outlines that belong to another level (the floor below, a roof) unless they are a walkable
  terrace at this level.

### Roof JSON (`roof: true`)

```json
{"roof": true, "level": 11.85,
 "walls": [{"a": [x,z], "b": [x,z], "t": 0.2, "kind": "low", "h": 1.25, "base": 11.85, "top": 13.1}],
 "lower_walls": [ ...parapets of a lower roof, the same shape... ],
 "items": [{"type": "solar|tank|boiler|hatch|ac|machine_room", "poly": [[x,z],...], "x": 0, "z": 0, "w": 1.25, "d": 1.51, "tilt_deg": 40, "h": 1.55, "level": 11.85, "top": 15.05}]}
```

Solar collectors face south (`PROJECT.north`), tilted `tilt_deg`; a `machine_room` is a box with its own `top`.

### SITE.json

```json
{"plot": [[x,z],...], "plot_area": 1381, "north": [nx, nz], "datum": 246.4,
 "building_lines": [[[x,z],...]],
 "parking":   [{"poly": [...], "label": "1\\M2", "level": 247.75}],
 "driveways": [{"poly": [...], "kind": "paved|asphalt", "name": "..."}],
 "paths":     [{"poly": [...], "kind": "path|red", "level": 246.75}],
 "sidewalks": [{"poly": [...]}],  "roads": [{"poly": [...]}],
 "gardens":   [{"poly": [...], "label": "...", "owner": "M2 apt 1", "level": 247.5}],
 "retaining_walls": [{"a": [x,z], "b": [x,z], "t": 0.3, "top": 247.8}],
 "fences":    [{"a": [x,z], "b": [x,z], "h": 1.1, "base": 247.8}],
 "gates":     [{"x": 0, "z": 0, "w": 1.9, "h": 2.7, "arch": true}],
 "trees":     [{"x": 0, "z": 0, "r": 2.0}],  "poles": [{"x": 0, "z": 0, "h": 3.5}],
 "kerbs":     [{"pts": [[x,z],[x,z]], "paint": "redwhite|grey"}],
 "crosswalks": [{"a": [x,z], "b": [x,z], "w": 3.2}],
 "spot_levels": [{"x": 0, "z": 0, "v": 247.8}],
 "terrain_plane": [246.51, -0.052, 0.038],
 "neighbours": [{"poly": [...], "label": "M1 (6 units)", "h": 11.0, "base_abs": 243.0}]}
```

`north` is the drawing-frame vector that points north (unit length; z is down, so straight up the sheet is `[0,-1]`).
Levels in SITE.json are absolute; `datum` converts them. `terrain_plane` = `[h0, dh/dx, dh/dz]` best-fit ground plane,
with the spot levels interpolated on top of it. Gardens and parking stalls become flat patches at their level.

### Fixtures JSON (the apartment shown inside)

```json
{"apt": "4", "building": "M2", "floor": "M3.json",
 "fixtures": [
  {"type": "counter", "room": "מטבח", "a": [x,z], "b": [x,z], "depth": 0.6, "sink": [x,z], "cook": [x,z], "fridge": [x,z], "facing": [nx,nz]},
  {"type": "bathtub|shower", "room": "ח. רחצה", "poly": [[x,z],...]},
  {"type": "toilet|basin|washer|ac", "room": "...", "x": 0, "z": 0, "w": 0.6, "facing": [nx,nz]},
  {"type": "closet", "room": "...", "a": [x,z], "b": [x,z], "depth": 0.6}],
 "door_swings": [{"x": 0, "z": 0, "w": 0.8, "hinge": [x,z], "opens_into": "ח. שינה הורים"}]}
```

`a`→`b` is the front edge of a run seen from the room; `facing` points into the room. Rooms with no fixtures are
furnished automatically by kind (beds against the longest free wall, sofa facing the TV wall, a dining table that
fits, wardrobes), keeping door zones clear.

## 2. Recipe

```json
{
 "name": "מודיעין · אתר B-43", "place": "מודיעין · גוש 5616 חלקה 14 · מגרש 2123",
 "subtitle": "דירת 5 חדרים · קומה ג׳ (+6.00) · בניין M2",
 "facade": "טיח אקרילי לבן, חדר מדרגות באבן ירושלמית, מעקות מתכת כחולים",
 "fine": "המודל נבנה מתוכניות ההיתר (1:100)... הריהוט להמחשה.",
 "datum": 246.4, "dir": ".",
 "railing": {"style": "metal-x", "color": "#2d5f8a"},
 "buildings": [
  {"id": "M2", "name": "בניין M2", "zero": 247.7,
   "floors": ["M1.json", "M2.json", "M3.json", "M4.json"], "roof": "MR.json",
   "levels": {"M1.json": 0, "M2.json": 3, "M3.json": 6, "M4.json": 9},
   "names":  {"M1.json": "קומה א׳", "M2.json": "קומה ב׳", "M3.json": "קומה ג׳", "M4.json": "קומה ד׳"},
   "stone": [{"kinds": ["core"]}], "roof_lower_walls": false,
   "detail_floors": ["M3.json"], "show_apts": {"M3.json": ["4"]}, "fixtures": {"M3.json": "apt4_fixtures.json"}}],
 "site": "SITE.json",
 "areas_by_level": {"M2": {"6": [{"area": 109.98, "rooms": 5}, {"area": 111.88, "rooms": 5}]}},
 "apartments": [{"building": "M2", "apt": "4", "main_area": 111.88, "rooms": 5}],
 "start": {"bld": "M2", "level": 6, "apt": "4", "mode": "ext"},
 "views": {"ext": {"pos": [-33, -19], "h": 17, "tgt": [-12, 6], "th": 6, "bld": "M2"}, "dir": [-0.57, -0.82]},
 "site_extra": {"terrain_plane": [246.51, -0.052, 0.038],
   "pets": [{"a": [-13.35, -3.65], "b": [-11.65, -3.80], "label": "בחתולים בגינה"},
            {"kind": "dog", "bld": "M2", "level": 9, "c": [-4.9, 4.9], "r": 1.7, "label": "בכלב במרפסת הגג"}]}
}
```

- `dir` is relative to the recipe file. `datum` is the project's reference height; each building's `zero` is its
  absolute ±0.00.
- `detail_floors` empty = the whole building is a shell. A detailed floor shows its rooms; `show_apts` limits the
  interior (furniture, labels, walk) to those apartments, the rest of the floor stays capped.
- `stone` rules: `{floors:[i]}` whole floors, `{kinds:['core']}` wall kinds, `{zone:[[x,z],...]}` a polygon. Everything
  else is plaster.
- `areas_by_level` holds the official area table per building and level; apartments are matched by size order, so
  the count must equal the measured apartments on that level (the assembler prints a mismatch). This is the canonical
  source of apartment areas; the top-level `apartments` list is a fallback for a project without a table. Do not use both.
- `views.ext` = exterior camera: position `[x,z]` at `h` above the terrain, looking at `tgt` at `th` above the
  building's base. `views.dir` = the direction the doll-house view looks from.
- `site_extra` keys are appended to SITE.json's lists: `kerbs crosswalks gates roads sidewalks driveways poles
  neighbours pets`, and `terrain_plane` replaces.

## 3. PROJECT JSON (what the page embeds)

`{name, place, subtitle, fine, facade, datum, north, railing, apartments, start, views, buildings:[{id, name, zero,
floors:[{name, level, walls, openings, rooms, outdoor, railings, stairs, lifts, shell?, show_apts?, fixtures?,
door_swings?}, {name:'גג', roof:true, level, walls, items}], stone}], site:{...}}`. Build it with the assembler; if you
must hand-edit, keep the floors sorted by level and the roof last.
