# Ogu — הסבר מלא על המערכת

## מה זה Ogu?

Ogu הוא **מהדר (compiler) שהופך רעיון לאפליקציה עובדת** — לא כלי שמריץ משימות, אלא מערכת שכל שלב בה מייצר פלט מאומת שמזין את השלב הבא, בדיוק כמו שלבי קומפילציה בשפת תכנות.

ההבדל המהותי מ"עוזר AI" רגיל: Ogu לא סומך על זה שקוד "נראה נכון". הוא מפעיל **10 שערי איכות אוטומטיים** שכל אחד מהם חייב לעבור לפני שפיצ'ר נחשב גמור. אם שער נכשל — הפיצ'ר לא עובר.

---

## הפילוסופיה

חמישה עקרונות שמנחים כל החלטה במערכת:

1. **מהדר, לא מריץ משימות** — כל שלב מייצר ארטיפקט (קובץ) שהשלב הבא תלוי בו. אי אפשר לדלג.
2. **נכונות מעל מהירות** — קוד חייב לעבור שערים, לא רק להיכתב.
3. **Spec הוא חוק** — המפרט הטכני הוא החוזה. קוד שסוטה ממנו — נדחה.
4. **אפס עבודה ידנית** — גם אחרי ביקורת אנושית, המערכת מתעדכנת אוטומטית.
5. **הכל בקבצים** — אין בסיסי נתונים, אין שירותים חיצוניים. הכל Markdown ו-JSON ב-Git.

---

## הצינור (Pipeline) — 15 שלבים

### שלב 1: `/idea` → IDEA.md
**מה קורה:** המשתמש מתאר רעיון. Ogu חוקר אותו, שואל שאלות, ומגבש אותו למסמך מובנה.

**מה נוצר:**
- תיאור הרעיון, מסכים, פיצ'רים
- **רמת מעורבות** — autopilot (הכל אוטומטי), guided (בודקים החלטות מפתח), product-focused (מגדירים מוצר, אוגו מטפל בטכנולוגיה), hands-on (שולטים בכל שלב)
- **סגנון ויזואלי** — cyberpunk, minimal, brutalist, playful, corporate, retro-pixel

**למה זה חשוב:** במקום לצלול ישר לקוד, Ogu מוודא שהרעיון מובן לעומק לפני שמתחילים.

---

### שלב 2: `/feature` → PRD.md + Spec skeleton + QA.md
**מה קורה:** הרעיון הופך לדרישות מוצר פורמליות.

**מה נוצר:**
- **PRD.md** — Product Requirements Document: מה הבעיה, מי המשתמשים, מה הדרישות הקונקרטיות
- **Spec.md (שלד)** — חוויית משתמש: מסכים, אינטראקציות, זרימות
- **QA.md** — תוכנית בדיקות: תרחישים שמחים, קצוות, רגרסיות

**למה זה חשוב:** לפני שכותבים שורת קוד אחת, צריך להבין בדיוק *מה* בונים ואיך בודקים שזה עובד.

---

### שלב 3: `/architect` → Spec.md (מלא) + Plan.json
**מה קורה:** הארכיטקט הטכני לוקח את ה-PRD והשלד ומתכנן את הכל.

**מה נוצר:**
- **Spec.md (מלא)** — מודל נתונים, עיצוב API, קומפוננטות UI, Mock API
- **Plan.json** — תוכנית ביצוע עם משימות ממוספרות, תלויות ביניהן, ותנאי סיום (`done_when`)
- **ADRs** — אם נדרשת סטייה מהסטאק ברירת המחדל, נכתב רשומת החלטה ארכיטקטונית

**דוגמה ל-Plan.json:**
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Setup project structure",
      "depends_on": [],
      "touches": ["apps/web/", "apps/api/"],
      "done_when": "pnpm install succeeds, dev server starts"
    },
    {
      "id": 2,
      "title": "Create data model",
      "depends_on": [1],
      "touches": ["packages/db/prisma/schema.prisma"],
      "done_when": "prisma generate succeeds"
    }
  ]
}
```

---

### שלב 4: `/preflight` → בדיקת בריאות
**מה קורה:** לפני שמתחילים לבנות, Ogu מוודא שהכל תקין.

**מה נבדק:**
- `ogu doctor` עובר בהצלחה
- הקונטקסט בנוי ועדכני
- כל האינוריאנטים (חוקים בלתי ניתנים לשינוי) זוהו
- כל החוזים (contracts) רלוונטיים
- הנושא הויזואלי (theme) מוגדר

---

### שלב 5: `/lock` → נעילת קונטקסט
**מה קורה:** Ogu נועל את מצב המערכת כדי למנוע בנייה על בסיס מידע מיושן.

**מה נעשה:**
- חישוב Hash של CONTEXT.md, STATE.json, Repo_Map.md
- שמירה ב-CONTEXT_LOCK.json
- אם משהו השתנה מאז הנעילה — אי אפשר לבנות בלי לנעול מחדש

**למה זה חשוב:** מונע מצב שבו הקוד נבנה לפי מפרט ישן בזמן שהמפרט כבר השתנה.

---

### שלב 6: `/build` → בנייה סדרתית
**מה קורה:** Ogu מממש כל משימה מ-Plan.json, אחת אחרי השנייה.

**כללים:**
- כל משימה ממומשת לפי `done_when` שלה
- לא לגעת בקבצים שלא מופיעים ב-`touches`
- לכבד תלויות (`depends_on`)
- לעמוד בכל האינוריאנטים והחוזים
- אפס TODO/FIXME בקוד — או שזה גמור או שזה לא קיים

---

### שלב 7: `/build-parallel` → בנייה מקבילית (DAG)
**מה קורה:** אלטרנטיבה ל-`/build` — במקום לבנות סדרתית, Ogu בונה גרף תלויות (DAG) ומריץ משימות עצמאיות במקביל.

**איך זה עובד:**
```
גל 1: [משימה 1, משימה 2, משימה 3]  ← רצות במקביל
גל 2: [משימה 4, משימה 5]            ← תלויות בגל 1, רצות במקביל
גל 3: [משימה 6]                      ← תלויה בגל 2
```

- בין גלים: וולידציה שאין קונפליקטים בקבצים
- כל משימה יודעת אילו קבצים מותר לה לגעת (`touches`) ואילו אסור (`forbidden`)

---

### שלב 8: `/verify-ui` → ביקורת UI
**מה קורה:** Ogu סורק כל אלמנט אינטראקטיבי באפליקציה.

**מה נבדק:**
- אין כפתורים "מתים" (handler ריק, `onClick={() => {}}`)
- אין קישורים שבורים (`href="#"`)
- אין טפסים בלי submit handler
- כל פעולת UI מחוברת ללוגיקה אמיתית עם אפקט גלוי למשתמש

**למה זה חשוב:** אחת הבעיות הנפוצות ביותר ב-AI-generated code — כפתורים שלא עושים כלום. Ogu מאתר ומסמן כל אחד מהם.

---

### שלב 9: `/smoke` → בדיקות E2E
**מה קורה:** Ogu כותב ומריץ בדיקות end-to-end מינימליות.

**הכלים:**
- **Web:** Playwright
- **Mobile:** Detox או Maestro

**מה נבדק:** Happy path — הזרימה הבסיסית ביותר עובדת מקצה לקצה. לחיצה אמיתית על כפתורים, ניווט, assertions.

---

### שלב 10: `/vision` → אימות ויזואלי (3 שכבות)
**מה קורה:** Ogu בודק שהאפליקציה **נראית** כמו שהמפרט מתאר.

**3 שכבות:**

| שכבה | מה נבדק | כלי |
|---|---|---|
| Tier 1: DOM | סלקטורים קיימים, טקסט נכון, layout attributes | Playwright |
| Tier 2: Screenshots | צילומי מסך מול baselines שנשמרו | Playwright + diff |
| Tier 3: AI Vision | AI מנתח את הצילום: האם מתאים לspec? hierarchy נכון? סגנון עקבי? | AI model |

**דירוג:** כל מסך מקבל PASS / WARN / FAIL עם הסבר.

---

### שלב 11: `/enforce` → אכיפת חוזים
**מה קורה:** Ogu מוודא שהקוד לא שובר אף חוזה או אינוריאנט.

**מה נבדק:**
- חוזי API (הendpoints תואמים ל-api.contract.json)
- חוזי ניווט (הנתיבים תואמים ל-navigation.contract.json)
- טוקנים ויזואליים (אין צבעים/ריווחים hardcoded)
- דפוסים ארכיטקטוניים (domain לא מייבא מ-infrastructure)

---

### שלב 12: `/preview` → תצוגה מקדימה מקומית
**מה קורה:** Ogu מרים את האפליקציה מקומית ומוודא שהיא עובדת.

**קריטריונים:**
1. Web נגיש: `GET /api/health` מחזיר `{ status: "ok" }`
2. Mock-API נגיש: `GET /health` מחזיר `{ status: "ok" }`
3. Web מדבר עם Mock-API: לפחות עמוד אחד מושך נתונים בהצלחה
4. אין crash loops: כל השירותים עולים ונשארים 30+ שניות

---

### שלב 13: `/done` → 10 שערי סיום
**מה קורה:** Ogu מריץ 10 בדיקות סופיות. **כולן** חייבות לעבור.

| # | שער | מה נבדק |
|---|---|---|
| 1 | Doctor | בדיקת בריאות מלאה |
| 2 | Context Lock | הקונטקסט עדכני ונעול |
| 3 | Plan Tasks | כל משימה ב-Plan.json עומדת ב-done_when שלה |
| 4 | No TODOs | אין TODO/FIXME/HACK בקוד הפיצ'ר |
| 5 | UI Functional | אין כפתורים מתים |
| 6 | Smoke Test | בדיקות E2E עוברות |
| 7 | Vision | 3 שכבות אימות ויזואלי עוברות |
| 8 | Contracts | חוזים תקינים |
| 9 | Preview | שירותים בריאים |
| 10 | Memory | דפוסים נלמדו ונשמרו |

**מנגנון checkpoint:** אם שער 6 נכשל, מתקנים ומריצים מחדש מ-6 — לא מ-1.

---

### שלב 14: `/observe` → מעקב פרודקשן
**מה קורה:** אחרי deploy, Ogu עוקב אחרי שגיאות, ביצועים ו-uptime.

**מה נאסף:**
- שגיאות (מ-Sentry, LogRocket וכו')
- אנליטיקס (שימוש, funnel)
- זמינות (uptime)

**מה נעשה:**
- קורלציה עם releases (האם הגרסה האחרונה שברה משהו?)
- הצעות תיקון
- אופציונלי: יצירת טיקטים אוטומטית שהופכים לפיצ'רים חדשים

---

### שלב 15: `/pipeline` → אוטופילוט מלא
**מה קורה:** מריץ את כל שלבים 1-13 ברצף. עוצר בכשל ראשון.

---

## מערכת הזיכרון (שתי שכבות)

### שכבה א': Knowledge Vault (`docs/vault/`)
**ספריית הידע הקבועה** — מקור האמת היחיד.

```
docs/vault/
├── 01_Architecture/
│   ├── Invariants.md         ← ~30 חוקים בלתי ניתנים לשינוי
│   ├── Default_Stack.md      ← סטאק ברירת מחדל
│   ├── Patterns.md           ← דפוסים ומוסכמות
│   ├── Module_Boundaries.md  ← 3 שכבות: Domain ← Application ← Infrastructure
│   └── Repo_Map.md           ← מפת הריפו
├── 02_Contracts/
│   ├── api.contract.json     ← חוזי API
│   ├── navigation.contract.json ← חוזי ניווט
│   ├── design.tokens.json    ← טוקני עיצוב
│   └── ...                   ← עוד חוזים
├── 03_ADRs/                  ← רשומות החלטות ארכיטקטוניות
├── 04_Features/              ← ספריות פיצ'רים (IDEA, PRD, Spec, QA, Plan)
└── 05_Runbooks/              ← מדריכי הפעלה
```

**כללים:**
- שינויים רק דרך ADR (Architecture Decision Record)
- חוזים הם חוק עד שמשנים אותם רשמית
- אינוריאנטים תמיד מנצחים — הקוד מתכופף אליהם, לעולם לא הפוך

### שכבה ב': Runtime Memory (`.ogu/`)
**מצב תפעולי** — משתנה תדיר, מתעדכן אוטומטית.

```
.ogu/
├── STATE.json           ← מצב מכונה (פיצ'ר נוכחי, timestamps)
├── CONTEXT.md           ← קונטקסט מורכב (נוצר אוטומטית, לא לערוך ידנית!)
├── CONTEXT_LOCK.json    ← נעילת hashes
├── MEMORY.md            ← זיכרון מצטבר (עובדות, לא דעות)
├── SESSION.md           ← מצב סשן נוכחי
├── SOUL.md              ← זהות וערכים
├── THEME.json           ← סגנון ויזואלי
├── PROFILE.json         ← פרופיל פרויקט (platform, services)
├── GATE_STATE.json      ← מצב שערי סיום
├── GRAPH.json           ← גרף תלויות
├── memory/
│   └── YYYY-MM-DD.md    ← לוגים יומיים (append-only)
└── orchestrate/
    └── <slug>/
        └── PLAN_DAG.json ← גרף DAG לבנייה מקבילית
```

### הרכבת קונטקסט (דטרמיניסטית)

CONTEXT.md נבנה בסדר קבוע תמיד:

1. אינוריאנטים (Invariants.md)
2. חוזים (כל הקבצים ב-02_Contracts/ בסדר אלפביתי)
3. מפת ריפו (Repo_Map.md)
4. דפוסים (Patterns.md)
5. מפרט פיצ'ר (אם רלוונטי)
6. זיכרון (MEMORY.md)
7. לוגים אחרונים (3 ימים אחרונים)

**פונקציה טהורה:** אותם קלטים → תמיד אותה תוצאה. לעולם לא לערוך ידנית.

---

## מערכת האינוריאנטים (~30 חוקים)

אינוריאנטים הם **חוקים שלא ניתנים לשינוי** בלי ADR פורמלי. דוגמאות:

### ארכיטקטורה
- שכבת Domain **לא מייבאת** מ-Infrastructure. אפס תלויות ב-DB, HTTP, storage בקוד domain.
- Controllers מכילים **אפס לוגיקה עסקית**. רק validation + delegation.
- כל גישה ל-DB דרך repository interfaces בלבד.
- סודות/טוקנים נקראים דרך שכבת config בלבד. אין `process.env` מפוזר.
- כל endpoint חייב auth policy מפורש או הכרזת `public`.

### UI
- **אין כפתורים מתים.** כל פעולת UI חייבת handler אמיתי עם אפקט גלוי.
- אין צבעים/ריווחים/גופנים hardcoded. טוקנים בלבד.
- קוד אפליקציה מייבא מ-`packages/ui/` בלבד. לעולם לא shadcn/Tamagui ישירות.

### נתונים
- אין מידע סטטי mock באפליקציית web. כל הנתונים זורמים דרך HTTP.
- Mock API הוא שרת HTTP אמיתי שמשתמש בחוזים משותפים.

### סיום פיצ'ר
- אין TODO/FIXME/placeholder בקוד שנשלח.
- אין פיצ'ר שלם בלי בדיקת E2E עוברת.
- אין שירות חיצוני חדש בלי ADR + interface abstraction.
- אין endpoint חדש בלי הגדרת חוזה.

---

## CLI — 34 פקודות

כלי שורת הפקודה של Ogu (`node tools/ogu/cli.mjs`) מספק 34 פקודות:

### ליבה
| פקודה | מה עושה |
|---|---|
| `ogu doctor` | בדיקת בריאות מלאה |
| `ogu context` | הרכבת CONTEXT.md |
| `ogu context:lock` | נעילת hashes |
| `ogu feature:create <slug>` | יצירת תיקיית פיצ'ר עם templates |
| `ogu feature:validate <slug>` | וולידציה (`--phase-1` אחרי /feature, `--phase-2` אחרי /architect) |
| `ogu gates run <slug>` | הרצת 10 שערי סיום |
| `ogu preview` | הרמת preview מקומי |

### ארכיטקטורה וחוזים
| פקודה | מה עושה |
|---|---|
| `ogu profile` | זיהוי platform ושירותים |
| `ogu graph` | בניית גרף תלויות |
| `ogu impact <file>` | הצגת קבצים מושפעים משינוי |
| `ogu adr "<title>"` | יצירת ADR |
| `ogu contracts:validate` | וולידציה של חוזים |
| `ogu contract:version` | העלאת גרסת חוזה |
| `ogu contract:diff` | הצגת שינויים בחוזה |
| `ogu contract:migrate` | זיהוי שינויים שוברים |

### ויזואלי ובדיקות
| פקודה | מה עושה |
|---|---|
| `ogu vision <slug>` | אימות ויזואלי 3-שכבות |
| `ogu vision:baseline` | ניהול baselines (record, update, list) |

### זיכרון ולמידה
| פקודה | מה עושה |
|---|---|
| `ogu remember` | עדכון זיכרון (`--apply`, `--auto`, `--prune`) |
| `ogu learn` | חילוץ דפוסים מפיצ'ר שהושלם |
| `ogu recall` | שליפה מזיכרון גלובלי |
| `ogu trends` | ניתוח שיעורי כשל, זמני השלמה |

### אורקסטרציה ומצב
| פקודה | מה עושה |
|---|---|
| `ogu orchestrate <slug>` | בניית DAG לבנייה מקבילית |
| `ogu wip` | הצגת כל הפיצ'רים ושלבם הנוכחי |
| `ogu switch <slug>` | החלפת פיצ'ר פעיל |
| `ogu status` | דשבורד פרויקט מלא |

### פרודקשן
| פקודה | מה עושה |
|---|---|
| `ogu observe:setup` | הגדרת מקורות מעקב |
| `ogu observe` | שליפת נתוני פרודקשן (`--create-tickets`) |

### סגנון ויזואלי
| פקודה | מה עושה |
|---|---|
| `ogu theme set <mood>` | הגדרת מצב רוח ויזואלי |
| `ogu theme show` | הצגת סגנון נוכחי |
| `ogu theme apply` | כתיבת טוקנים ל-design.tokens.json |
| `ogu theme presets` | הצגת presets מובנים |

### תחזוקה
| פקודה | מה עושה |
|---|---|
| `ogu init` | יצירת מבנה .ogu/ |
| `ogu validate` | וולידציה של מבנה |
| `ogu log "<msg>"` | הוספה ללוג יומי |
| `ogu repo-map` | סריקה ועדכון Repo_Map.md |
| `ogu clean` | ניקוי ארטיפקטים ישנים |
| `ogu migrate` | מיגרציה למבנה עדכני |

---

## מערכת הסגנון הויזואלי (Theme)

Ogu מאפשר להגדיר **מצב רוח ויזואלי** שמתורגם לטוקני עיצוב קונקרטיים:

| מצב רוח | תיאור | דוגמה |
|---|---|---|
| cyberpunk | כהה, ניאון, עתידני | Cyberpunk 2077, Matrix |
| minimal | נקי, לבן, הרבה רווח | Apple, Linear |
| brutalist | גס, פונקציונלי, ישיר | Craigslist, Bloomberg Terminal |
| playful | צבעוני, עגול, שמח | Slack, Notion |
| corporate | מקצועי, מסודר, שמרני | IBM, SAP |
| retro-pixel | פיקסלי, 8-bit, נוסטלגי | Pokemon, Minecraft UI |

**מה נוצר:**
```json
{
  "mood": "cyberpunk",
  "generated_tokens": {
    "colors": {
      "primary": "#00ff9f",
      "background": "#0a0a0f",
      "error": "#ff0044"
    },
    "spacing": { "xs": "4px", "sm": "8px", "md": "16px" },
    "radius": { "sm": "2px", "md": "4px" },
    "typography": { "font_body": "Inter", "font_mono": "JetBrains Mono" },
    "effects": { "glow": "0 0 20px rgba(0,255,159,0.3)" }
  }
}
```

הטוקנים האלה מועברים ל-`design.tokens.json` ומשם לקומפוננטות UI דרך שרשרת: **tokens → primitives → components**.

---

## סטאק ברירת מחדל

| שכבה | טכנולוגיה |
|---|---|
| שפה | TypeScript (בכל מקום — client, server, contracts, config) |
| Frontend | Next.js (App Router) + React + Tailwind CSS + Zod + React Query |
| Backend | Node.js + Fastify (שרת נפרד, לא API routes של Next) |
| Mock API | Fastify + in-memory state (Maps/arrays) |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |
| Queue | BullMQ + Redis |
| Auth | httpOnly cookies (web), JWT + refresh (mobile), RBAC |
| Storage | S3-compatible (AWS S3, R2, MinIO) |
| Design System | shadcn/ui (web), Tamagui (mobile/cross-platform) |
| Testing | Vitest (unit), Playwright (E2E web), Maestro/Detox (E2E mobile) |
| Monorepo | pnpm workspaces |
| DevOps | Docker Compose (local), structured logging |

**סטייה מברירת המחדל דורשת ADR** — רשומת החלטה ארכיטקטונית מפורשת.

---

## ADR — רשומות החלטות ארכיטקטוניות

כל החלטה שמשנה את ברירת המחדל נרשמת ב-ADR:

```markdown
# ADR 0005 — Use Redis for session storage

## Status: Accepted

## Context
Session cookies require server-side storage for invalidation.

## Decision
Use Redis for session storage instead of DB.

## Consequences
- Added Redis dependency
- Sessions expire automatically via TTL
- Need Redis in Docker Compose
```

**כללים:**
- ADRs **לעולם לא נמחקים** — רק deprecated או superseded
- שינוי אינוריאנט = ADR חובה
- שינוי חוזה = ADR חובה
- שימוש בטכנולוגיה מחוץ לסטאק = ADR חובה

---

## מערכת הלמידה

Ogu **לומד מניסיון** ומשתפר לאורך זמן:

### זיכרון מקומי (MEMORY.md)
עובדות מצטברות, לא לוג. רק מידע שאושר ונבדק:
```
- Convention: kebab-case for all file names
- Next.js App Router requires 'use client' for interactive components
- Prisma schema location: packages/db/prisma/schema.prisma
```

### לוגים יומיים (.ogu/memory/YYYY-MM-DD.md)
```markdown
# 2026-02-22

## Summary
Built auth feature, passed 8/10 gates.

## Decisions
- Used httpOnly cookies — more secure than localStorage

## Notes
- Gate 7 (vision) failed on dark mode contrast
```

### למידה גלובלית (~/.ogu/global-memory/)
- `ogu learn` — מחלץ דפוסים מפיצ'ר שהושלם
- `ogu recall` — שולף דפוסים רלוונטיים מכל הפרויקטים
- `ogu trends` — מנתח שיעורי כשל ומגמות לאורך זמן

---

## איך הכל מתחבר — דוגמה מקצה לקצה

```
1. משתמש: "אני רוצה אפליקציית ניהול משימות"
   └── /idea → IDEA.md (רעיון + סגנון cyberpunk + autopilot)

2. /feature → PRD.md (דרישות: CRUD, priorities, due dates)
             + Spec.md skeleton (מסכים, זרימות)
             + QA.md (20 תרחישי בדיקה)

3. /architect → Spec.md (מלא: data model, API, UI components)
              + Plan.json (12 משימות עם תלויות)
              + ADR: "Use Prisma for ORM"

4. /preflight → ✅ doctor passes, invariants loaded, theme applied

5. /lock → ✅ context locked (hash: abc123)

6. /build → 12 tasks implemented sequentially
   Task 1: Project structure ✅
   Task 2: Data model ✅
   Task 3: API endpoints ✅
   ...
   Task 12: Polish UI ✅

7. /verify-ui → ✅ No dead buttons found

8. /smoke → ✅ 3 E2E tests pass (create, edit, delete task)

9. /vision → ✅ All screens match spec
   Tier 1: DOM ✅  Tier 2: Screenshots ✅  Tier 3: AI Vision ✅

10. /enforce → ✅ All contracts respected

11. /preview → ✅ Web + Mock API healthy for 60 seconds

12. /done → 10/10 gates pass ✅
    Feature marked COMPLETE.

13. /observe → Monitoring production errors, latency, uptime
```

---

## מה מבדיל את Ogu?

| גישה רגילה | Ogu |
|---|---|
| "תבנה לי אפליקציה" → AI כותב קוד | רעיון → דרישות → ארכיטקטורה → בנייה → בדיקות → אימות |
| סומך על AI שהקוד "נראה נכון" | 10 שערים אוטומטיים שמוודאים שהקוד **עובד** |
| אין זיכרון בין סשנים | זיכרון מצטבר + למידה גלובלית |
| אין חוזים | חוזי API, ניווט, עיצוב — קוד שסוטה נדחה |
| בלי מבנה | Vault + Runtime + ADRs + 34 פקודות CLI |
| "done" כשזה נראה מוכן | "done" רק כש-10 שערים עוברים |
| אין מעקב אחרי פרודקשן | `/observe` סוגר את הלולאה: פרודקשן → תיקונים → פיצ'רים |
