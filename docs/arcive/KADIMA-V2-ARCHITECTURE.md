# KADIMA v2 — Architecture & Implementation Plan

> תאריך: פברואר 2026
> סטטוס: ארכיטקטורה מוסכמת, טרם יישום
> מטרה: KADIMA כOS שמריץ Ogu workers מתמחים במקביל

---

## 1. הויז'ן

KADIMA היא לא כלי למפתחים. היא מוצר לאנשים שיש להם רעיון ורוצים שיבנו אותו — בלי לגעת בטרמינל, בלי להבין קוד, בלי להגדיר ארכיטקטורה.

מתחת לפני השטח: מנוע של Ogu workers מתמחים שרצים במקביל ובונים מוצר אמיתי, מוודא, ומוכן לproduction.

```
User:    "בנה לי אפליקציה לניהול הזמנות"
KADIMA:  [בניה... 60%...]
User:    "מוכן. האפליקציה שלך כאן: app.kadima.ai/xyz"
```

---

## 2. שתי שכבות

```
┌─────────────────────────────────────────────┐
│              HUMAN INTERFACE                │
│         Browser Chat / WhatsApp             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│              KADIMA LAYER                   │
│                                             │
│  • Manager Agent    (Claude API — Sonnet)   │
│  • Architect Gate   (Claude API — Haiku)    │
│  • Worker Pool      (lifecycle management)  │
│  • OguStateBridge   (reads .ogu/ files)     │
│  • Dashboard        (progress + status)     │
│  • SQLite           (orchestration state)   │
└─────────────────┬───────────────────────────┘
                  │ spawns Claude Code subprocesses
┌─────────────────▼───────────────────────────┐
│               OGU LAYER                     │
│                                             │
│  Product Ogu   → /idea + /feature           │
│  CTO Ogu       → /architect + ogu compile   │
│  Designer Ogu  → /design                    │
│  Backend Ogu   → /build (backend tasks)     │
│  UI Ogu        → /build (frontend tasks)    │
│  Security Ogu  → /build (security tasks)    │
│  QA Ogu        → /smoke + /verify-ui        │
│  DevOps Ogu    → /observe + deploy          │
└─────────────────────────────────────────────┘
```

**כלל ברזל:** KADIMA מנהלת. Ogu בונה. KADIMA לא כותבת שורת קוד אחת.

---

## 3. החלטות טכניות מרכזיות

| נושא | החלטה | סיבה |
|------|--------|-------|
| Manager + Architects | Claude API | stateless, זול, model-flexible |
| Ogu Workers | Claude Code subprocess | חייבים לרוץ Ogu CLI + skills |
| Architect model | Claude Haiku | מספיק לmission review, פי 10 זול |
| Manager model | Claude Sonnet | צריך שיקול דעת |
| Worker model | Claude (Ogu מחליט) | Ogu שולט במודל שלו |
| State | SQLite (KADIMA) + files (Ogu) | כל אחד מנהל state משלו |
| Sandbox | e2b / Docker per worker | בטיחות + isolation |
| Multi-model | ארכיטקטורה abstracted | start עם Claude, extend later |

---

## 4. הFlow המלא

```
Mission: "בנה אפליקציה לניהול הזמנות"
    │
    ▼
[KADIMA Manager]
  • מבין: project, slug, scope
  • יוצר Mission ב-SQLite
    │
    ▼
[Architect Gate — במקביל]
  • Scope: האם המשימה מוגדרת?
  • Dependencies: יש תלויות על דברים שלא קיימים?
  • Feasibility: מתאים ל-stack הקיים?
  → אם concerns: חוזרים למשתמש
  → אם approved: ממשיכים
    │
    ▼
[Product Ogu Worker]
  runs: claude /idea → /feature
  outputs: IDEA.md, PRD.md, Spec.md skeleton, QA.md
    │
    ▼
[CTO Ogu Worker]
  runs: claude /architect
  outputs: Spec.md complete, Plan.json עם IR מלא
    │
    ▼
[ogu orchestrate]
  builds: DAG מ-Plan.json
  output: waves של tasks לפי תלויות ו-domain

  Wave 1: [DB schema, design tokens]
  Wave 2: [API routes] + [React components] + [Security layer]
  Wave 3: [Integration] + [E2E tests]
    │
    ├─── [Backend Ogu]  → tasks עם touches: ["apps/api/**"]
    ├─── [UI Ogu]       → tasks עם touches: ["apps/web/**"]
    ├─── [Mobile Ogu]   → tasks עם touches: ["apps/mobile/**"]
    └─── [Security Ogu] → tasks עם touches: ["**/auth/**", "**/middleware/**"]
         (רצים במקביל, לפי waves, כל אחד isolated בworktree)
    │
    ▼
[QA Ogu Worker]
  runs: /smoke + /verify-ui + /vision
    │
    ▼
[CTO Ogu Worker — compilation]
  runs: ogu compile <slug>
  עבר? → Deploy → משתמש מקבל link
  נכשל? → KADIMA מנתבת OGU#### errors לworker הרלוונטי → retry
```

---

## 5. ה-8 Ogu Workers המתמחים

### 5.1 Product Ogu
**תפקיד:** הבנת הדרישות ותרגומן לSpec
**מריץ:** `/idea` → `/feature`
**מייצר:**
- `IDEA.md` — מה בונים ולמה
- `PRD.md` — requirements מפורטים
- `Spec.md` — skeleton טכני
- `QA.md` — תוכנית בדיקות

**System Prompt Addition:**
```
You are the Product Ogu. Your job is to deeply understand what the user wants to build
and translate it into a precise, complete product specification.
Focus on: user needs, acceptance criteria, edge cases, out-of-scope items.
Never assume. Ask if unclear. Be specific.
```

---

### 5.2 CTO Ogu
**תפקיד:** ארכיטקטורה טכנית + compilation סופית
**מריץ (פתיחה):** `/architect` — Plan.json + IR
**מריץ (סגירה):** `ogu compile` — 14 gates
**מייצר:**
- `Spec.md` complete עם data model, API, components
- `Plan.json` עם tasks + IR inputs/outputs

**System Prompt Addition:**
```
You are the CTO Ogu. You make all technical decisions.
At the start: define architecture, data model, API contracts, create Plan.json.
At the end: run ogu compile and ensure 0 errors before declaring done.
You are the first and last worker — you open and close every feature.
```

---

### 5.3 Designer Ogu
**תפקיד:** זהות ויזואלית ומערכת עיצוב
**מריץ:** `/design`
**מייצר:**
- `DESIGN.md` — visual identity, variants, assertions
- עדכון `design.tokens.json` — colors, typography, spacing

**System Prompt Addition:**
```
You are the Designer Ogu. You define how the product looks and feels.
Create bold, non-generic design directions. Avoid defaults.
Every design decision must be a token — no hardcoded values.
```

**הערה:** רץ במקביל ל-CTO Ogu אחרי Product Ogu מסיים.

---

### 5.4 Backend Ogu
**תפקיד:** API, database, business logic
**מריץ:** `/build` — tasks מ-Plan.json שנוגעים ב-backend
**Domain:** `apps/api/**`, `packages/api/**`, `prisma/**`

**System Prompt Addition:**
```
You are the Backend Ogu. You implement server-side code only.
Your scope: API routes, database models, services, business logic.
You MUST NOT touch frontend files. Check your task's `touches` field.
Every endpoint needs: Zod validation, auth policy, typed response.
```

---

### 5.5 UI Ogu
**תפקיד:** Frontend, components, pages
**מריץ:** `/build` — tasks מ-Plan.json שנוגעים ב-frontend
**Domain:** `apps/web/**`, `packages/ui/**`

**System Prompt Addition:**
```
You are the UI Ogu. You implement client-side code only.
Your scope: React components, pages, hooks, state management.
You MUST NOT touch backend files. Check your task's `touches` field.
Use design tokens only — no hardcoded colors, spacing, or fonts.
All UI actions must have real handlers — no dead buttons.
```

---

### 5.6 Mobile Ogu
**תפקיד:** React Native / Expo
**מריץ:** `/build` — tasks שנוגעים ב-mobile
**Domain:** `apps/mobile/**`

**System Prompt Addition:**
```
You are the Mobile Ogu. You implement React Native code only.
Your scope: screens, navigation, mobile-specific components.
Use shared contracts from packages/shared. Never duplicate backend logic.
```

---

### 5.7 Security Ogu
**תפקיד:** Auth, authorization, input validation, hardening
**מריץ:** `/build` — security tasks (cross-cutting)
**Domain:** `**/auth/**`, `**/middleware/**`, `**/guards/**`

**System Prompt Addition:**
```
You are the Security Ogu. You implement security across the entire codebase.
Your scope: authentication, authorization, input validation, rate limiting, CORS.
Review every API endpoint for missing auth. Review every form for missing validation.
No endpoint ships without explicit auth policy.
```

---

### 5.8 QA Ogu
**תפקיד:** בדיקות ו-verification
**מריץ:** `/smoke` + `/verify-ui` + `/vision`
**מייצר:** E2E tests, smoke tests, visual assertions

**System Prompt Addition:**
```
You are the QA Ogu. You verify the product works end-to-end.
Write tests from QA.md. Every acceptance criterion needs a test.
UI verification: every button, link, and form must work.
Report failures with exact file + line references.
```

---

### 5.9 DevOps Ogu
**תפקיד:** Infrastructure, CI/CD, monitoring
**מריץ:** `/observe` + deployment scripts
**מייצר:** docker-compose, CI/CD config, monitoring setup

---

## 6. שינויים ב-Ogu (מינימליים)

Ogu כמעט לא צריך להשתנות. רק 4 שינויים קטנים:

### 6.1 STATE.json — תמיכה במספר features במקביל

```json
// לפני:
{ "current_task": "user-auth" }

// אחרי:
{ "current_tasks": ["user-auth", "dashboard", "payments"] }
```

### 6.2 CONTEXT — per-feature file

```
// לפני:  .ogu/CONTEXT.md
// אחרי:  .ogu/CONTEXT_<slug>.md
```

`ogu context --feature <slug>` כבר כמעט עושה את זה — שינוי ב-output path בלבד.

### 6.3 GATE_STATE — per-feature file

```
// לפני:  .ogu/GATE_STATE.json
// אחרי:  .ogu/GATE_STATE_<slug>.json
```

### 6.4 `ogu status --json` — חדש

```bash
ogu status --json
# output:
{
  "feature": "user-auth",
  "phase": "build",
  "gatesPassed": 7,
  "gatesTotal": 14,
  "lastError": null,
  "kadima_mission_id": "M-007"
}
```

KADIMA קוראת את זה כדי לדווח progress למשתמש.

---

## 7. שינויים ב-KADIMA מהספק המקורי

### מה נמחק
- ❌ `validation/` directory (QA runner, E2E runner) — Ogu מטפל
- ❌ Task decomposition (3-10 tasks) — Plan.json מטפל
- ❌ QA/E2E toggles per task — Ogu מטפל
- ❌ Worker system prompt "You write code" — Workers מריצים Ogu

### מה מתווסף
- ✅ `projects` table ב-SQLite
- ✅ `project_path` + `ogu_feature_slug` ב-Mission schema
- ✅ `OguStateBridge` — קורא .ogu/ files, מסנכרן ל-SQLite
- ✅ Worker = Claude Code subprocess (לא API call)
- ✅ Git worktrees לisolation בין workers
- ✅ Vault mutex לscript של ADR numbering

### מה נשאר
- ✅ Manager Agent (API)
- ✅ Architect Gate (API, Haiku) — אבל reviews mission, לא קוד
- ✅ Worker Pool lifecycle (hire/fire)
- ✅ SQLite לorchestration state
- ✅ Dashboard + WebSocket
- ✅ WhatsApp interface

---

## 8. Database Schema — מה מתווסף

```sql
-- Projects registry (חדש)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,         -- "/Users/.../my-saas"
  ogu_initialized BOOLEAN DEFAULT 0,
  active_missions TEXT DEFAULT '[]', -- JSON array of mission IDs
  created_at TEXT DEFAULT (datetime('now'))
);

-- Missions — שדות חדשים
ALTER TABLE missions ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE missions ADD COLUMN ogu_feature_slug TEXT;  -- "user-auth"
ALTER TABLE missions ADD COLUMN ogu_phase TEXT;         -- "build", "done", etc.

-- Ogu gate progress (חדש)
CREATE TABLE ogu_gate_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  gate_number INTEGER NOT NULL,
  gate_name TEXT NOT NULL,
  status TEXT NOT NULL,              -- "passed", "failed", "pending"
  error_code TEXT,                   -- "OGU0305" if failed
  error_message TEXT,
  checked_at TEXT DEFAULT (datetime('now'))
);
```

---

## 9. OguStateBridge

הcomponent שמגשר בין Ogu files ל-KADIMA SQLite:

```typescript
class OguStateBridge {
  // קורא .ogu/STATE.json + GATE_STATE_<slug>.json
  async syncMissionProgress(mission: Mission): Promise<OguProgress> {
    const stateJson    = readJSON(`${mission.projectPath}/.ogu/STATE.json`);
    const gateState    = readJSON(`${mission.projectPath}/.ogu/GATE_STATE_${mission.oguFeatureSlug}.json`);
    const statusJson   = await runCommand(`ogu status --json`, mission.projectPath);

    return {
      currentPhase:    statusJson.phase,
      gatesPassed:     countPassedGates(gateState),
      gatesTotal:      14,
      lastError:       statusJson.lastError,
      lastActivity:    stateJson.last_context_build,
    };
  }

  // מאזין לשינויים ב-.ogu/ ומעדכן SQLite + WebSocket
  watchProject(project: Project, onUpdate: (progress: OguProgress) => void) {
    fs.watch(`${project.path}/.ogu/`, () => {
      this.syncMissionProgress(...).then(onUpdate);
    });
  }
}
```

---

## 10. Worker Execution — Claude Code Subprocess

```typescript
class OguWorker {
  async execute(mission: Mission, workerType: OguWorkerType): Promise<void> {
    const worktreePath = await createWorktree(mission.projectPath, workerType);

    const session = spawn('claude', [
      '--dangerously-skip-permissions',
      '--model', 'claude-sonnet-4-6',
    ], {
      cwd: worktreePath,
      env: { ...process.env, ANTHROPIC_API_KEY: config.claude.apiKey }
    });

    // שלח את הפקודה לworker
    const command = buildWorkerCommand(workerType, mission.oguFeatureSlug);
    session.stdin.write(command + '\n');

    // עקוב אחרי output
    session.stdout.on('data', (data) => {
      this.streamToWebSocket(mission.id, data.toString());
    });

    await waitForCompletion(session);
    await mergeWorktree(worktreePath, mission.projectPath);
  }
}

function buildWorkerCommand(type: OguWorkerType, slug: string): string {
  const commands = {
    'product':  `/idea ${slug}\n/feature ${slug}`,
    'cto':      `/architect ${slug}`,
    'designer': `/design ${slug}`,
    'backend':  `/build ${slug}`,
    'ui':       `/build ${slug}`,
    'security': `/build ${slug}`,
    'qa':       `/smoke ${slug}\n/verify-ui ${slug}`,
    'cto-compile': `/done ${slug}`,
  };
  return commands[type];
}
```

---

## 11. Git Worktrees לisolation

כאשר Backend Ogu ו-UI Ogu רצים במקביל על אותו project — worktrees מונעים conflicts:

```
/my-saas/                              ← main branch
  .git/
  apps/api/
  apps/web/

/my-saas/.git/worktrees/
  backend-ogu/                         ← Worker 1 branch
    apps/api/                          ← רק backend עובד כאן
    .ogu/                              ← STATE.json נפרד

  ui-ogu/                              ← Worker 2 branch
    apps/web/                          ← רק frontend עובד כאן
    .ogu/                              ← STATE.json נפרד
```

אחרי שכל worker מסיים — KADIMA עושה merge לmain branch.

---

## 12. תוכנית יישום

### Phase 1 — Ogu כ-Worker (שבוע 1-2)
**מטרה:** Ogu יכול לרוץ כsubprocess שKADIMA שולטת בו

- [ ] שינוי `current_task` → `current_tasks[]` ב-STATE.json
- [ ] CONTEXT per-feature: `.ogu/CONTEXT_<slug>.md`
- [ ] GATE_STATE per-feature: `.ogu/GATE_STATE_<slug>.json`
- [ ] `ogu status --json` command חדש
- [ ] `kadima_mission_id` שדה ב-STATE.json
- [ ] בדיקה: הרצת `/pipeline user-auth` כsubprocess

---

### Phase 2 — KADIMA Foundation (שבוע 2-3)
**מטרה:** KADIMA core תשתית

- [ ] Projects registry (table + API)
- [ ] Mission schema עם `project_path` + `ogu_feature_slug`
- [ ] `OguStateBridge` — קריאת .ogu/ files
- [ ] Worker execution: Claude Code subprocess
- [ ] Git worktree management
- [ ] WebSocket streaming של worker output

---

### Phase 3 — Sequential Workers (שבוע 3-4)
**מטרה:** Pipeline שלם, עדיין sequential

- [ ] Product Ogu Worker (system prompt + execution)
- [ ] CTO Ogu Worker — architect phase
- [ ] Mission flow: Product → CTO → done
- [ ] Progress reporting ל-dashboard
- [ ] Error handling: OGU errors → retry routing

---

### Phase 4 — Parallel Workers (שבוע 4-5)
**מטרה:** Backend + UI + Security רצים במקביל

- [ ] Backend Ogu Worker (domain isolation)
- [ ] UI Ogu Worker (domain isolation)
- [ ] Security Ogu Worker
- [ ] DAG execution engine (לפי waves מ-Plan.json)
- [ ] Vault mutex (ADR numbering conflicts)
- [ ] Worktree merge אחרי כל worker

---

### Phase 5 — Verification (שבוע 5-6)
**מטרה:** QA + compilation

- [ ] QA Ogu Worker (`/smoke` + `/verify-ui`)
- [ ] CTO Ogu — compilation phase (`ogu compile`)
- [ ] Error → fix routing (OGU#### → relevant worker)
- [ ] Designer Ogu Worker (אופציונלי לMVP)
- [ ] DevOps Ogu Worker (אופציונלי לMVP)

---

### Phase 6 — KADIMA Interface (שבוע 6-8)
**מטרה:** Human interface מלא

- [ ] Manager Agent (Claude API)
- [ ] Architect Gate (Haiku — mission review)
- [ ] Browser Dashboard (React)
  - Multi-project view
  - Worker progress bars
  - Gate status per mission
- [ ] WhatsApp integration
- [ ] Deployment pipeline (Vercel/Railway integration)

---

## 13. מדדי הצלחה

| מדד | יעד |
|-----|-----|
| זמן build לapp פשוט | < 2 שעות |
| זמן build לapp בינוני | < 6 שעות |
| עלות build לapp פשוט | < $10 |
| עלות build לapp בינוני | < $30 |
| שיעור הצלחה (ogu compile עובר) | > 80% בניסיון ראשון |
| זמן setup למשתמש חדש | < 5 דקות |

---

## 14. מה לא בscope (עדיין)

- ❌ Visual editor (המשתמש מבקש שינויים בchat)
- ❌ Photoshop/InDesign compiler
- ❌ Mobile app של KADIMA
- ❌ Multi-user / collaboration
- ❌ Custom Ogu worker types (user-defined specialists)

---

## סיכום

KADIMA v2 היא לא מוצר AI חדש. היא **OS לOgu**.

המשתמש מדבר בשפה טבעית. KADIMA מתרגמת לmissions. Ogu workers מתמחים בונים במקביל. התוצאה היא מוצר עובד שעבר 14 gates של verification — בלי שהמשתמש ידע שום דבר מזה.

**הבידול מ-Lovable:** לא UI פשוט יותר — תוצאה טובה יותר, על פרויקטים מורכבים יותר, מהר יותר.
