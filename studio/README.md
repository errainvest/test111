# סטודיו הדמיות תלת־ממד

מעלים תוכנית של בית (PDF או תמונה) ומקבלים הדמיה תלת־ממדית: סיור בתוך הבית, מבט־על, תוכנית ומבט חוץ, שלושה סגנונות עיצוב, עם ריהוט או בלי, ביום ובערב.

## הקבצים

| קובץ | מה זה |
|---|---|
| `studio/plan-to-3d.html` | **מחולל ההדמיות.** מעלים תוכנית לכל קומה, Claude קורא אותה, והמחולל בונה מודל, מרהט אותו ושומר אותו כפרויקט. נבנה מ־`studio/src` עם `studio/tools/build_generator.py`. |
| `studio/plans/*.json` | קובצי תוכנית (פורמט בהמשך). `malkiya-12.json` הוא הבית במלכיה, כפי שנמדד מהשרטוטים. |
| `house-malkiya.html` | הדמיה שנבנתה ידנית לבית במלכיה, עם הערכת עלות. לשימוש פנימי. |
| `house-malkiya-erra.html` | אותה הדמיה בלי מחירים, בעיצוב של erra.co.il. מיועדת ללקוח. |
| `house-3d-studio.html` | הגרסה הראשונה, עם דירה לדוגמה. |
| `studio/tools/` | כלים למדידה מדויקת מול שרטוט: `overlay.py` (מצייר את המודל על הסריקה), `measure.py` (מאתר קירות לפי פיקסלים), `grid.py` (רשת מטרים על השרטוט). |

## דרך 1: המחולל (מהיר, בקירוב)

1. פותחים את המחולל, כותבים שם לפרויקט ומעלים קובץ לכל קומה.
2. מסמנים מלבן סביב השרטוט של הקומה, בלי הכותרת והחתכים. כך Claude קורא את המידות טוב יותר.
3. אם ידוע, כותבים את רוחב הבית הכולל במטרים, ואז לוחצים **"צור הדמיה מהתוכנית"**.
4. במצב **"השוואה לשרטוט"** מציירים את המודל על השרטוט ומתקנים שמות וסוגי חדרים.
5. **"שמירת הפרויקט"** שומרת את המודל ואת השרטוט. הפרויקט יופיע ברשימה ואפשר לפתוח אותו שוב. **"הורדת קובץ התוכנית"** מורידה JSON שאפשר לייבא בהמשך.

המחולל קורא את השרטוט אוטומטית, ולכן הדיוק תלוי באיכות השרטוט. לפני שמציגים ללקוח, תמיד משווים לשרטוט.

## דרך 2: מדידה מדויקת עם Claude Code

לבית שמציגים ללקוח עדיף לבקש מ־Claude Code: "תכין הדמיה מהתוכנית ב־<קישור/תיקייה בדרייב>". ה־skill `plan-to-3d` שב־`.claude/skills` מריץ את התהליך:
1. מרנדר את ה־PDF ב־150 dpi. בקנ״מ 1:50 מטר אחד הוא 118.1 פיקסלים.
2. מודד כל קיר מול הסריקה עם `measure.py`.
3. כותב קובץ תוכנית לתוך `studio/plans`.
4. מצייר את המודל על השרטוט עם `overlay.py` ומתקן עד שהקווים מתלכדים.
5. טוען את התוכנית למחולל ושומר אותה כפרויקט.

## פורמט קובץ התוכנית

```json
{
  "name": "שם הפרויקט",
  "roof": "hip | flat",
  "floors": [{
    "name": "קומת קרקע", "height": 2.9,
    "walls":    [{"a": [x, z], "b": [x, z], "t": 0.25}],
    "openings": [{"type": "door|entry|window|slider|pass", "x": 0, "z": 0, "w": 0.9, "sill": 0.9, "h": 1.3}],
    "rooms":    [{"name": "סלון", "kind": "living", "x0": 0, "z0": 0, "x1": 5, "z1": 4}]
  }],
  "plot": {"x0": -3, "z0": -3, "x1": 21, "z1": 29.5, "setbacks": {"n": 3, "s": 5, "w": 3, "e": 2}}
}
```

- המידות במטרים. x גדל ימינה על השרטוט ו־z גדל כלפי מטה, כלומר צפון הוא ‎−z. הנקודה (0,0) היא קו המרכז של הפינה השמאלית־העליונה של המבנה, וכל הקומות משתמשות באותה נקודה.
- הקירות עוברים על קווי המרכז ויכולים להיות אופקיים או אנכיים בלבד. כשלא מציינים עובי, הקיר מקבל 0.25 אם הוא חיצוני ו־0.12 אם הוא פנימי.
- כל פתח מוצמד לקיר הקרוב אליו. כיוון הפתיחה של דלת נקבע אוטומטית, לכיוון החדר הפרטי יותר.
- סוגי החדרים (`kind`): `living`, `kitchen`, `dining`, `hall`, `bed`, `master`, `kids`, `office`, `mamad`, `closet`, `storage`, `bath`, `wc`, `laundry`, `stair`, `balcony`, `void`. לפי הסוג נקבעים הריצוף והריהוט. חדר מסוג `stair` פותח חור בתקרה שמעליו.

## Multi-building projects (permit sets) — engine v2

A permit set (היתר בנייה) with several buildings, many floors and walls at any angle goes through engine v2:

| File | What it is |
|---|---|
| `studio/src2/engine2.js` | The engine. Rooms are polygons, walls can run at any angle, and a site can hold several buildings with floors at different levels. Slabs, roofs and terraces are cut with polygon operations (polygon-clipping). Facade materials come from stone rules. |
| `studio/src2/furnish2.js` | Furnishes polygonal rooms automatically: furniture goes against walls, keeps doors clear and does not collide with other pieces. |
| `studio/src2/site2.js` | Terrain (interpolated from spot levels), driveways, parking with cars, retaining walls clad in stone, fences, trees, and the plot boundary. |
| `studio/src2/app2.js`, `body.html`, `style.css` | ERRA-style menu: building, floor and apartment pickers, walkthrough between buildings, three design styles, furniture on/off, day and evening. |
| `studio/tools/permit_to_project.py` | Combines the per-floor measurement files into a single project file (PROJECT JSON). |
| `studio/tools/build_project.py` | Builds the HTML page from the project file. |

```bash
python3 -I studio/tools/permit_to_project.py RECIPE.json studio/plans/<project>.json
python3 studio/tools/build_project.py studio/plans/<project>.json <project>.html --title "..."
```

PROJECT JSON: `{name, place, datum, north:[nx,nz], railing:{style:'metal-x'|'glass', color}, buildings:[{id, name, zero (absolute ±0.00), floors:[{name, level, walls, openings, rooms:[{name,kind,apt,poly}], outdoor:[{name,kind,apt,poly,level}], railings, stairs:[{poly,up_dir}], lifts}], stone:[{floors:[i], kinds:[...], zone:[[x,z]...]}]}], site:{plot, building_lines, parking, driveways, paths, retaining_walls, fences, trees, spot_levels:[{x,z,v}], gardens, roads, neighbours}}`.
Coordinates are metres in one global frame (x right, z down the drawing). Floor `level` is relative to its building's ±0.00. The roof is a floor with `roof:true`: parapet walls (`kind:'low'`, `h`) and `items` (solar, tank, hatch, ac, machine_room).
