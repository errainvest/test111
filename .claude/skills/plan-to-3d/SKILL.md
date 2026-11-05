---
name: plan-to-3d
description: Turn an architect's floor plan (PDF/DWG export/image, often Hebrew, 1:50) into an accurate plan JSON and a 3D walkthrough in the ERRA studio. Use when the user asks for a 3D visualization / הדמיה / סיור תלת-ממד of a house from plans, or to check a model against its drawings.
---

# Plan → 3D (precise workflow)

The studio lives in `studio/`. Read `studio/README.md` for the plan JSON format. The generator page `studio/plan-to-3d.html` renders any plan JSON (auto-furnished, 3 design tiers); `studio/tools/` has the measuring helpers.

## Steps

1. **Get the drawings.** If they are in Google Drive, search by place/plot/family name (try spelling variants, e.g. מלאכיה/מלכיה) and list the parent folder: plan sets usually sit together (`תכנית קומת קרקע`, `תכנית קומה שניה`, `חתכים`, `חזיתות`, a contractor's `כתב כמויות`). Download PDFs and decode them into the scratchpad.
2. **Render** each sheet: `pdftoppm -r 150 -png sheet.pdf out`. At 1:50 and 150 dpi, 1 m = 118.1 px. Look at a low-res render first (`-r 40`) to find the plan area. Sheets are often A1 and rotated.
3. **Register.** Find the pixel of the outer top-left corner of the building, then the centerline origin (corner + 0.125 m × 118.1 for a 25 cm wall). Check with `grid.py`, which draws a meter grid over a crop.
4. **Measure, don't eyeball.** Read the dimension chains (cm) and confirm wall faces with `measure.py` (pairs of faces → centerline = midpoint). Measure the total depth too: a first pass is easy to get short by half a meter.
5. **Write the plan JSON** in `studio/plans/<name>.json`: walls on centerlines, openings at their wall-center points (window sill/head from `uk`/`ok` marks), rooms as rectangles (split L-shapes), the correct `kind` for each room. Upper floors use the ground floor's origin; find their offset from the roof/terrace outline of the floor below.
6. **Overlay check.** Run `overlay.py` on every floor and look at the result. Fix anything that does not sit on the drawn walls before going on. Compare room areas with the areas written on the plan. The model gives gross area (to centerlines), so walls such as a ממ״ד's make it larger than the net figure.
7. **Plot.** Plot boundaries (ג.מ.) and building lines (ק.ב.) with their setbacks are usually only on the elevations and sections. Read them there and put them in `plot`.
8. **Deliver.** Load the JSON into the generator (import, or save it into the artifact's `projects` collection with the same fields the page writes: `name`, `updatedAt`, `floors`, `area`, `plan` as a JSON string). Report what was measured, what is approximate, and the overlay result. Never claim accuracy that wasn't checked against the drawing.

## Rebuilding the generator after code changes

Edit `studio/src/*`, then run `python3 studio/tools/build_generator.py`. It assembles `studio/plan-to-3d.html` from the sources, the shared engine in `house-malkiya-erra.html`, and the sample plan.
