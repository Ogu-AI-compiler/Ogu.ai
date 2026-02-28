# תכנית עבודה: להפוך את Brand Scan ו Reference לפיצ׳רים שמייצרים ערך

מסמך זה מרכז תכנית ביצוע מסודרת לשדרוג שני הפיצ׳רים כך שהם יהיו חלק טבעי מהפייפליין של אוגו, יפיקו תוצרים שימושיים, ויאכפו שימוש אמיתי (לוגו, פונטים ועוד), תוך שימוש ב evidence (סקרינשוטים) במקום ניחושים על בסיס טוקנים בלבד.

---

## מטרות

1. להפוך את brand-scan ואת reference לשלבים בתוך השיחה, לא לשוניות צד.
2. להוסיף evidence אמיתי (סקרינשוטים) ל reference של אתרים, כך ש /design יוכל להבין עיצוב ולא להמציא.
3. להפוך assets (לוגו, פונטים) לתשתית פרויקט שנצרכת תמיד, ולא שדות ב JSON שאפשר להתעלם מהם.
4. להחליף מטריק דמיון כללי במדדים אמינים של brand rule compliance.
5. להגדיר היררכיית עדיפויות ברורה בין Brand DNA לבין Reference לבין THEME, כולל טיפול בקונפליקטים.
6. להוסיף שקיפות: דוח מיזוג קצר שמסביר מאיפה כל החלטה מגיעה.

---

## מושגים

- Brand DNA: מה שמגדיר זהות מותג קיימת. לוגו, פונטים, צבע ראשי ומערכת חוקים שאסור לשבור.
- Reference: השראה עיצובית. מיועדת להשפיע על התנהגות עיצובית כמו צפיפות, היררכיה, ריתמוס ריווחים, רמות surface, שימוש בצבעים, motion.
- Evidence: סקרינשוטים וניתוח ויזואלי שלהם שמאפשר להבין שימוש בפועל ולא רק ערכים.
- Gates: בדיקות שמריצים בסוף שלב כדי לוודא שהמימוש תואם את ההחלטות.

---

## פייפליין שיחה חדש: Design Intake כשלב מובנה

במקום לשוניות, אוגו מעלה את הנושא יזום בשלב עיצוב. המשתמש מדביק URLים בצ׳אט, ואוגו מפעיל את הפקודות.

### מצבי התחלה שאוגו חייב לזהות

1. מוצר חדש, אין מותג, אין רפרנסים.
2. הרחבה למוצר קיים, יש מותג, אין רפרנסים.
3. מוצר חדש, יש רפרנסים.
4. הרחבה למוצר קיים וגם יש רפרנסים.

### שאלות חובה בשלב עיצוב

1. האם זה מוצר חדש או הרחבה למוצר קיים?
2. אם הרחבה: תדביק URL של המוצר הקיים כדי להוציא Brand DNA.
3. האם יש השראות עיצוביות? אם כן, תדביק 1 עד 5 מקורות (אתרים, תמונות, PDF).

### ניהול מצב שיחה

אוגו מחזיק state קטן, לדוגמה:
- has_existing_brand: unknown | true | false
- brand_url: null | string
- reference_sources: array
- awaiting_brand_url: boolean
- awaiting_reference_sources: boolean

ככה אוגו יודע למה להציע את ההדבקה הבאה, ולא מדבר על רפרנסים אם לא הובאו.

---

## תוצרים חדשים של הסריקה: מה יוצא מעבר ללוגו ולפונטים

### 1) Evidence לאתרי reference

ב reference, לכל URL מקור:
- נוצר סקרינשוט נשמר בפרויקט
- מתווסף ב REFERENCE.json שדה screenshot_path ונתוני viewport
- ה reference skill מנתח את הסקרינשוט ומכניס סיכום תחת image_analysis

הערך:
- /design לא מסתמך רק על primary ושמות פונטים, אלא רואה בפועל איפה הצבע מופיע, כמה הוא נדיר, מה צפיפות המסך, רמות surface ועוד.

### 2) Image analysis גם ל URLs

image_analysis מתרחב כך שיכלול גם:
- url_screenshot עבור כל דומיין
- שדות כמו colors, mood, spacing, patterns, layout, notes

---

## Asset Pack: להפוך לוגו ופונטים לתשתית

### עיקרון

אם נמצאו לוגו או פונטים, אין מצב שלא משתמשים בהם. זה לא העדפה. זה בסיס.

### מה יוצרים

תיקיית assets פרויקטלית, לדוגמה:
- .ogu/assets/logo/
- .ogu/assets/fonts/
- .ogu/assets/manifest.json

מה שחשוב:
- לא לשמור רק שם פונט. לשמור את קובצי woff2 בפועל.
- לייצר snippet שימוש תקני: @font-face או שילוב עם next/font לפי הסטאק.

### נקודת צריכה אחת בפרויקט

המערכת מייצרת מודול יחיד שממנו UI לוקח:
- logoSrc
- fontFaces או font config
- brand tokens

כלל: אסור לקוד להשתמש בלוגו או font-family ישירות, רק דרך המודול הזה.

---

## Gates: לא לבדוק אזכור, לבדוק שימוש

### Gate: brand compliance משודרג

חייב לבדוק:
1. פונטים: אם יש font files או font-face CSS, חייב להיות מנגנון טעינה בפועל בפרויקט.
2. System font: אם יש brand font, אסור להשאיר globals על system-ui בלי שה brand font מופיע בראש ה stack.
3. לוגו: לא מספיק שקיים קובץ ב public. חייב להיות שימוש ברכיב header או נקודת כניסה מקובלת.

הערה:
אפשר להתחיל עם heuristics סטטיים (בדיקת קבצי CSS ו layout), ובהמשך לשדרג לבדיקות מבוססות רנדר.

---

## מדדים: Brand rule compliance במקום similarity

לא מודדים האם זה נראה כמו Linear. מודדים האם חוקי שימוש עומדים.

דוגמאות למדדים מדידים:
- primary usage proportion נמוך יחסית, ומשויך לפעולות CTA.
- radius distribution: כרטיסים מעוגלים, כפתורים שטוחים.
- surface levels: עד 2 עד 3 רמות משטח.
- density: מספר אלמנטים מעל ה fold תחת סף.

---

## היררכיית עדיפויות: Brand מול Reference מול THEME

חוק בסיס:
Reference > THEME > defaults

אבל עם חלוקה לשכבות:

### שכבת brand identity (קשיחה)
- לוגו
- משפחת פונט
- גוון ראשי אם מוגדר בבירור במותג

### שכבת style behavior (גמישה)
- צפיפות, קומפוזיציה
- ריתמוס ריווחים
- רמות surface
- shadows
- motion
- שימוש בצבעים כיחסים, לא כגוון

חוק לקונפליקטים:
- צבע: הגוון נשאר של המותג, ההתנהגות של השימוש מגיעה מ reference.
- פונט: המשפחה נשארת של המותג, אבל scale, weights, spacing מושפעים מה reference.

---

## Resolution לרפרנסים שונים מאוד

כשיש 2 עד 5 רפרנסים שונים, אסור לבצע ממוצע עיצובי.

אוגו חייב לשאול:
- מה לקחת מכל רפרנס: layout, typography, colors, motion
- האם יש רפרנס מוביל
- מה אסור לקחת

תוצר:
Reference Intent Map, לדוגמה:
- Linear: layout, density
- Stripe: typography rhythm
- SiteX: motion

הקומפוזיט נעשה לפי Intent Map ולא לפי majority בלבד.

---

## שקיפות: Merge Report כחלק מה IR

אוגו חייב להוציא דוח קצר שמסביר מאיפה כל החלטה:
- logo: brand-scan
- fonts: brand-scan
- primary hue: brand-scan
- primary usage rules: reference screenshots
- density target: reference
- radius rhythm: reference

זה מוריד תחושת ניחוש ונותן אפשרות לתקן במהירות.

---

## סדר ביצוע מומלץ

### שלב 1: Screenshot ingestion ל reference
- צילומי מסך לכל URL ב reference
- כתיבת screenshot_path לתוך REFERENCE.json
- ניתוח סקרינשוטים ב reference skill והכנסה ל image_analysis

תוצאה:
עובר מ token בלבד ל evidence.

### שלב 2: Asset Pack ללוגו ופונטים
- הורדת woff2 בפועל והפקת @font-face
- הורדת לוגו SVG אם קיים
- יצירת נקודת צריכה אחת בפרויקט

תוצאה:
אין מצב שפונט מערכת או לוגו חסר.

### שלב 3: Gate שדורש שימוש אמיתי
- font-face חייב להופיע אם קיים ב brand scan
- אין system-ui ללא brand font
- לוגו חייב להופיע ברכיב כניסה

תוצאה:
Brand DNA הופך למחייב.

### שלב 4: Priority hierarchy + intent map
- חוקי התנגשות מפורשים
- שאלות resolution כשיש רפרנסים שונים מאוד
- דוח merge

תוצאה:
תהליך צפוי ולא אינטואיטיבי בלבד.

---

## הגדרה מוצעת של "הוא הבין" בתוך השיחה

במקום לספור שאלות, עוצרים כשיש Snapshot לאישור:

Design Intent Snapshot כולל:
- האם יש מותג
- מה ה assets שננעלו
- מה ה reference sources
- Intent Map אם יש רפרנסים
- 8 עד 12 החלטות מחייבות, למשל primary usage, radius, density, surface levels

רק אחרי אישור snapshot עוברים ל /design ולבנייה.

---

## תוצרים שצריכים להופיע בפועל בפרויקט אחרי התהליך

- .ogu/brands/<domain>.json וגם assets של לוגו ופונטים
- .ogu/REFERENCE.json כולל screenshot_path לכל URL ו image_analysis עבור url_screenshot
- .ogu/assets/ עם לוגו ופונטים כקבצים
- דוח merge בתוך IR או כ output של gates
- DESIGN.md שמכיל assertions מדידים שמבוססים על evidence

---
