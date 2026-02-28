# דו״ח ביקורת פרויקט Ogu (AI Compiler 2)
תאריך: 2026-02-28 01:06 UTC

## למה הדו״ח קיים
ביקשת לבדוק האם המימוש בפועל מחזיק את תוכנית ה OS המפורטת שלנו, או שהכל נשען על פרומפטים ו״משמעת עצמית״ של מודל.
עברתי על הקבצים הרלוונטיים בפרויקט, בדגש על: system prompt, skills, CLI commands, Studio server, gates, compile, orchestration.

## קבצים מרכזיים שנבדקו
- CLAUDE.md
- .claude/skills/*/SKILL.md (idea, feature, architect, preflight, lock, build, build-parallel, verify-ui, smoke, vision, enforce, preview, done, observe, design, reference, pipeline)
- tools/ogu/cli.mjs
- tools/ogu/commands/compile.mjs
- tools/ogu/commands/gates.mjs
- tools/ogu/commands/vision.mjs
- tools/ogu/commands/orchestrate.mjs
- tools/ogu/commands/doctor.mjs
- tools/ogu/commands/context-lock.mjs
- tools/studio/server/api/pipeline.ts
- tools/studio/server/api/chat.ts
- tools/studio/server/api/phase-guard.ts
- tools/studio/server/api/router.ts
- tools/studio/server/ws/*

## מה חזק כבר עכשיו (עמודים שנושאים משקל)
### 1) Phase Guard אמיתי בצד שרת
tools/studio/server/api/phase-guard.ts + שימוש ב chat.ts.
זה חוסם דילוג על פאזות על בסיס filesystem, לא על STATE.json בלבד.
זה load-bearing, לא רק טקסט בפרומפט.

### 2) Completion Gates בפועל עם checkpoint
tools/ogu/commands/gates.mjs מגדיר 14 שערים עם GATE_STATE.json.
יש שערים עם הרצה אמיתית: smoke_test מריץ טסטים, vision מריץ vision command, preview, doctor.

### 3) Vision אמיתי
vision מופעל כשער וגם כפקודה.
יש artifacts של דוח: .ogu/vision/<slug>/VISION_REPORT.md, והגייט מזהה FAIL.

### 4) Orchestrate קיים ומייצר DAG עם גילוי קונפליקטים
tools/ogu/commands/orchestrate.mjs מייצר PLAN_DAG.json, מחשב waves, מזהה קונפליקטים לפי touches ותלותים.
זה בסיס נכון ל build-parallel.

### 5) Context Lock מבוסס hash ולא רק ״תזכור״
tools/ogu/commands/context-lock.mjs + doctor שמפעיל אותו.
יש CONTEXT_LOCK.json שמגן מפני עבודה על הקשר מיושן.

## איפה אתה לא עדיין ברמת התוכנית המפורטת (הפערים המסוכנים)
### פער 1: verify-ui קיים כ skill אבל לא קיים כ command אמיתי
ב .claude/skills/verify-ui/SKILL.md יש מפרט חזק מאוד.
אבל ב tools/ogu/commands אין verify-ui.mjs, וגם cli.mjs לא ממפה פקודה כזאת.
מה שקיים בפועל זה gateUIFunctional בתוך gates.mjs והוא עושה בדיקה סטטית מבוססת regex בלבד (onClick ריק, href="#").
זה לא ״כל כפתור עובד״, זה רק ״אין placeholder ברור״.

סיכון:
אתה יכול לחשוב שעברת UI gate, אבל בפועל יש routes שבורים, handlers שלא עושים API, מצבים שלא מתעדכנים, ו flows שלא עובדים.

### פער 2: Runtime Verification ב compile חלש מדי
tools/ogu/commands/compile.mjs Phase 6:
בודק רק אם משהו זמין ב http://localhost:3000 או 5173.
אם לא רץ, הוא מסמן skipped. אם כן רץ, הוא כותב ש״בדיקות מפורטות דורשות gates״.
כלומר compile לא מבטיח פונקציונליות, רק שהשירות אולי קיים.

סיכון:
compile נשמע כמו ״חותמת״ אבל בפועל לא מאמת התנהגות.

### פער 3: יש כפילות לוגיקה של phase detection
router.ts מגדיר detectPhase משלו.
phase-guard.ts מגדיר detectCurrentPhase משלו.
chat.ts משתמש ב phase-guard, אבל route אחרים יכולים להסתמך על הלוגיקה השניה.
כפילות כזאת נוטה ליצור מצבים שבהם UI מציג phase אחת וה guard חושב אחרת.

סיכון:
שבירה של הדטרמיניזם וחוויית משתמש לא יציבה.

### פער 4: אין עדיין מנגנון Semantic Locks כ load-bearing בקוד
יש Context Lock (מצוין), אבל אין lock אמיתי ברמת קובץ בזמן build-parallel:
- אין מנגנון ש״מונע שני writers״ על אותו path בזמן אמת
- אין preempt/hijack אמיתי של lock
- אין audit event מחייב סביב lock acquire/release
orchestrate מזהה קונפליקטים אבל זה תכנון, לא אכיפה בזמן ביצוע.

סיכון:
ב build-parallel העולם עדיין נשען על זה שהסוכנים יתנהגו יפה.

### פער 5: Governance ו Policy AST קיימים בעיקר כ שפה, לא כ מנגנון חסימה מלא
יש שפה עשירה במסמכים על governance, אבל בצד הכלים לא ראיתי policy engine שמנתח AST ומחליט block/allow על שינויי קוד רגישים.
יש gates, אבל governance ברמת ״צריך אישור CTO״ לא נכפה באופן כללי על diff רגיש.

סיכון:
הבטחה של ״אי אפשר לשנות X בלי אישור״ עלולה להתגלות כ guideline בלבד.

### פער 6: Attestation קריפטוגרפי מלא לא קיים עדיין כ end to end
יש hash locking, יש GATE_STATE, אבל אין pipeline שמייצר חתימות, verify, ו chain של commitHash לכל פעולה.
כרגע זה יותר ״יש קבצים שמסכמים״ ופחות ״הוכחה״.

סיכון:
קשה להגן על claim של determinism והוכחה בדיעבד.

## האם זה ״משענת קנה רצוץ״
לא.
יש פה חלקים שהם כבר מוצר אמיתי: gates, vision, smoke execution, phase guard, orchestrate, context lock.
הסיכון האמיתי כרגע מרוכז סביב שתי נקודות:
- UI functional verification לא באמת קיים כ מערכת בדיקה מלאה
- parallelism ו locks הם בעיקר תכנון, לא אכיפה

## מה הייתי עושה עכשיו, לפי סדר עדיפות (כדי להפוך את זה לעמודים קשיחים)
1) להוסיף tools/ogu/commands/verify-ui.mjs ולחבר ב cli.mjs
   Minimum: route existence + handler non-empty + fetch endpoint exist + basic Playwright click-through לפי Spec routes.
2) להפוך compile למריץ gates כברירת מחדל, או לפחות: gates 1-10
   או להוסיף flag compile --strict שמחייב gates.
3) לבטל כפילות detectPhase ולהפוך phase-guard ל source of truth יחיד
4) להוסיף מנגנון file mutex אמיתי בשכבת build-parallel
   אפילו Redis/SQLite lock מקומי, או lockfile atomically, עם audit log
5) להוסיף governance hook: diff classifier שמפעיל require-approval
6) להוסיף attestation בסיסי: hash chain + signature על gate results + snapshot id

## משפט אחד מסכם
הבסיס לא חלש, אבל כדי לא להיתקע על ״מודל מתנהג יפה״ אתה צריך להפוך verify-ui ו locks לבלתי ניתנים לעקיפה בקוד.
