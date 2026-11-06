# Examples

| folder | what it is | use it for |
|---|---|---|
| `mini-house/` | a 10×8 m single-storey house with a terrace, garden, fence, parking, a neighbour and two cats: the smallest complete recipe | the shape of every file; a template for a small job |
| `modiin-b43/` | the Modiin B-43 permit set as measured: two buildings (E, M2), 9 floor files, roofs with items, a full SITE.json, apartment 4's fixtures and door swings, areas table, pets | a reference for every key the assembler reads; the recipe for a multi-building project |

Both build with

```
python3 -I scripts/permit_to_project.py examples/<name>/recipe.json out/project.json
python3 -I scripts/build_page.py out/project.json out/page.html --title "..."
node scripts/render_check.js out/page.html out/shot
```
