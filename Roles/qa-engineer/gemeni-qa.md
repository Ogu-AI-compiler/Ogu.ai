# QA Engineering Role Decomposition: Domain Compiler Network

**Role:** Staff/Principal QA Engineer
**Context:** Building a QA Tier for a Domain Compiler Network. All outputs are formal, static, and deterministic.

## סדר בנייה מומלץ ל-Compilers (Dependency Graph)
1. `qa_test_harness` (תשתית בסיסית)
2. `qa_coverage_policy` (מדיניות אישור קוד)
3. `qa_test_data_manager` (תשתית נתונים לטסטים)
4. `qa_contract_test` (אימות מול ה-Backend)
5. `qa_e2e_suite` (בדיקות פונקציונליות מקיפות)
6. `qa_visual_regression` + `qa_accessibility_audit` (בדיקות UI/UX)
7. `qa_performance_budget` + `qa_load_stress_suite` (בדיקות NFRs)
8. `qa_security_scan` (מעטפת אבטחה בסיסית)

---

## 1. Test Harness & Configuration

**מחקר:**
1. **ארטיפקט:** קובצי הגדרות גלובליים (`vitest.workspace.ts`, `playwright.config.ts`), סקריפטים של Setup/Teardown, והגדרות MSW handlers.
2. **כלים (2025):** Vitest שולט ב-Frontend וב-Backend (במיוחד מבוסס ESM), יחד עם Node.js native test runner. ל-Mocking, MSW (Mock Service Worker) הפך לסטנדרט כי הוא מונע Mocking שביר ברמת ה-Code ומדמה רשת אמיתית. `vi.spyOn` משמש ללוגיקה פנימית.
3. **אכיפה סטטית:** מניעת שימוש בנתיבים לוקאליים (`C:/dev/...`), וידוא שכל Mock גלובלי מלווה בפונקציית Teardown, וידוא הגדרת רפורטר ל-CI (כמו JUnit/GitHub).
4. **Cross-compiler checks:** ה-Harness חייב לקבל את ה-Aliases מ-`frontend-build-config` ואת סכמות הנתונים מ-`ts-schema` עבור MSW.
5. **Safe Default (ללא QA):** אין יכולת להריץ טסטים ב-CI; כל קומפיילר קוד נכשל מראש כי אין "סביבת ריצה בטוחה" לאישור ה-Artifact שלו.

**Compiler Spec:**
* **Compiler name:** `qa_test_harness`
* **Spec file:** `harness.spec.json`
* **Output artifact:** `vitest.config.ts`, `msw.setup.ts`, `globalTeardown.ts`
* **Static gates:**
  * `require_ci_reporter`: מוודא שמוגדר רפורטר מותאם CI ולא רק `console`.
  * `strict_teardown`: סורק AST לוודא שקיימת קריאה ל-`server.resetHandlers()` ב-`afterEach`.
* **Cross-compiler dependencies:** תלוי ב-`ts-schema` (עבור Mocks).
* **Error codes:** `QA101` (Missing teardown), `QA102` (Unsafe global mock).
* **Key invariant:** סביבת הבדיקות חייבת להיות מבודדת לחלוטין (Isolated), דטרמיניסטית, ולא להשאיר שאריות State בין טסט לטסט.

---

## 2. E2E Testing

**מחקר:**
1. **ארטיפקט:** קובצי סקריפטים לריצה (Spec files של E2E), הגדרות Fixtures, וקובץ תצורת מקביליות ל-CI.
2. **כלים (2025):** Playwright הוא הסטנדרט המוחלט. Cypress נדחק הצידה בגלל מגבלות ארכיטקטוניות. מודל ה-POM (Page Object Model) ננטש לטובת App Actions ו-Fixtures שמזריקים State נקי לכל טסט.
3. **אכיפה סטטית:** פסילת קריאות `sleep()` קשיחות (חובה לחכות ל-State או Network). פסילת שימוש ב-XPath שביר (חובה להשתמש ב-Accessibility locators כמו `getByRole`).
4. **Cross-compiler checks:** Spec של E2E חייב לכסות כל ראוט שמוגדר ב-`react-routing-artifact`.
5. **Safe Default:** אפס ביטחון שהמערכת עובדת מקצה לקצה; ה-CI לא מאשר Deploy ל-Production.

**Compiler Spec:**
* **Compiler name:** `qa_e2e_suite`
* **Spec file:** `e2e_flows.spec.json`
* **Output artifact:** Playwright tests scaffolding (`*.spec.ts`), Fixtures.
* **Static gates:**
  * `no_hard_sleeps`: AST gate שנכשל אם יש `waitForTimeout`.
  * `a11y_locators_only`: נכשל אם יש שימוש ב-`.locator('css')` במקום `getByRole/Text`.
* **Cross-compiler dependencies:** `react-routing-artifact` (לווידוא כיסוי נתיבים), `qa_test_data_manager` (להזרקת נתונים ל-Fixtures).
* **Error codes:** `QA201` (Hard sleep detected), `QA202` (Uncovered Route in E2E), `QA203` (Brittle selector).
* **Key invariant:** כל flow משתמש חייב להיות מבוסס על סמנטיקת נגישות (Locators) וללא התערבות ידנית בתזמונים (Zero explicit sleeps).

---

## 3. Coverage Policy

**מחקר:**
1. **ארטיפקט:** קובץ תצורת Coverage (Thresholds) וסקריפט בדיקה ל-CI (`coverage-gate.mjs`).
2. **כלים (2025):** V8 Coverage (מובנה ב-Vitest/Node) עדיף משמעותית על Istanbul כי הוא מדויק יותר ורץ על קוד מקומפל מהר יותר. Branch Coverage הוא המדד החשוב ביותר (מעיד על מסלולי לוגיקה), יותר מ-Line Coverage.
3. **אכיפה סטטית:** מניעת טסטים ללא Assertions (מפתחים שקוראים לפונקציה רק כדי לקבל כיסוי). מניעת ירידה של Threshold מתחת לקו הבסיס.
4. **Cross-compiler checks:** קומפיילרים כמו `api-route` יחפשו את מדיניות הכיסוי כדי לדעת אם הם עברו קומפילציה מוצלחת.
5. **Safe Default:** דורש 100% Branch Coverage כברירת מחדל אלא אם הוגדר אחרת, או לחילופין חוסם שחרור עקב חוסר ודאות.

**Compiler Spec:**
* **Compiler name:** `qa_coverage_policy`
* **Spec file:** `coverage_policy.spec.json`
* **Output artifact:** `vitest.coverage.ts`, CI threshold validation script.
* **Static gates:**
  * `no_assertionless_tests`: AST שמחפש בלוקים של `test/it` שאין בתוכם `expect`.
  * `monotonic_thresholds`: ה-Thresholds בקובץ ה-JSON לא יכולים להיות נמוכים מהגרסה הקודמת (חייב לעלות או להישאר זהה).
* **Cross-compiler dependencies:** `qa_test_harness`.
* **Error codes:** `QA301` (Assertionless test cheating), `QA302` (Coverage threshold decreased).
* **Key invariant:** כיסוי קוד יכול להיות מאושר רק אם הוא מלווה באימות לוגי אמיתי (Assertions), ורף הכיסוי לעולם אינו יורד.

---

## 4. Performance Budget

**מחקר:**
1. **ארטיפקט:** הגדרות Lighthouse CI, קובץ התראות משקל (Bundle size config), ויעדי Web Vitals.
2. **כלים (2025):** Core Web Vitals (במיוחד INP, LCP, CLS). כלים: Lighthouse CI ב-Pipeline, ו-`size-limit` כדי לחסום Pull Requests שמנפחים את ה-JavaScript.
3. **אכיפה סטטית:** וידוא שהוגדרו ערכים מקסימליים (למשל `maxBundleSize: "200kB"`). וידוא שהקונפיגורציה ב-CI מוגדרת להכשיל Build (Exit Code 1) ולא רק להזהיר.
4. **Cross-compiler checks:** חייב לפעול על ה-Artifacts שיוצאים מ-`react-page` ו-`react-component`.
5. **Safe Default:** חוקי משקל דרקוניים (למשל מקסימום 50KB פר ראוט), עד שה-QA יעשה אופטימיזציה של ה-Budget.

**Compiler Spec:**
* **Compiler name:** `qa_performance_budget`
* **Spec file:** `perf_budget.spec.json`
* **Output artifact:** `.lighthouserc.json`, `.size-limit.json`.
* **Static gates:**
  * `strict_ci_blocking`: מוודא ש-`assert.preset` של Lighthouse לא מוגדר כ-`warn` אלא כ-`error`.
  * `bundle_limits_exist`: מוודא שכל Entrypoint מרכזי במערכת קיבל מגבלת משקל.
* **Cross-compiler dependencies:** `react-page`, `react-routing-artifact`.
* **Error codes:** `QA401` (Missing chunk size limit), `QA402` (Lighthouse set to non-blocking).
* **Key invariant:** שום תוספת קוד לא תאושר אם היא גורמת לחריגה דטרמיניסטית מתקציב הביצועים והמשקל המוגדרים למערכת.

---

## 5. Load & Stress Testing

**מחקר:**
1. **ארטיפקט:** סקריפטים של עומס, פרופילי הרצה (Stages), והגדרות Threshold (SLOs).
2. **כלים (2025):** k6 (Grafana) הוא השליט הבלתי מעורער בגלל כתיבה ב-JS/TS וביצועים של Go. סוגי הטסטים מופרדים בבירור: Smoke (חיות בסיסית), Load (עומס צפוי), Stress (שבירת המערכת), Soak (דליפות זיכרון לאורך זמן).
3. **אכיפה סטטית:** וידוא שקיימים Thresholds (למשל `p(95) < 200`). מניעת סקריפטים ללא Ramp-up (קפיצה מיידית ל-10K משתמשים שגויה מתודולוגית).
4. **Cross-compiler checks:** ה-Spec חייב ליירט Endpoints אמיתיים המוגדרים ב-`openapi-spec` של ה-Backend.
5. **Safe Default:** המערכת לא תשוחרר בלי לעבור לפחות Smoke test בסיסי של 5 VUs.

**Compiler Spec:**
* **Compiler name:** `qa_load_stress_suite`
* **Spec file:** `load_profile.spec.json`
* **Output artifact:** `k6-script.js`, SLO configuration file.
* **Static gates:**
  * `has_slo_thresholds`: מוודא שמוגדר `thresholds` על `http_req_duration` ו-`http_req_failed`.
  * `safe_ramp_up`: מוודא שה-`stages` מכילים לפחות שלב אחד של עלייה הדרגתית בעומס.
* **Cross-compiler dependencies:** `openapi-spec` (לאימות נתיבים ומתודות).
* **Error codes:** `QA501` (Missing SLO threshold), `QA502` (Missing ramp-up stage).
* **Key invariant:** בדיקת עומסים חסרת משמעות ללא הגדרת סף כישלון (SLO) ברור ויכולת לדמות התנהגות משתמשים ריאליסטית.

---

## 6. Contract Testing (Consumer-Driven)

**מחקר:**
1. **ארטיפקט:** חוזים (Contracts) בין ה-Frontend (Consumer) ל-Backend (Provider).
2. **כלים (2025):** בעוד Pact המסורתי עדיין קיים, המגמה היא Bi-directional Contract Testing — וידוא (בזמן הקומפילציה או ה-CI) שה-Queries של ה-Frontend תואמים בדיוק ל-OpenAPI Spec, ללא צורך ב-Pact Broker כבד.
3. **אכיפה סטטית:** האם ה-Types שה-Frontend מצפה לקבל ב-`react-queries` קיימים וזהים למה שמוגדר ב-OpenAPI של ה-Backend.
4. **Cross-compiler checks:** חייב לקרוא את `react-queries` (Frontend) ולהשוות ל-`openapi-spec` (Backend).
5. **Safe Default:** אם אין חוזה, הקומפיילר מניח שכל שינוי ב-Backend שובר את ה-Frontend (Fail-closed).

**Compiler Spec:**
* **Compiler name:** `qa_contract_test`
* **Spec file:** `contract.spec.json`
* **Output artifact:** `contract.validator.ts` (Type comparison scripts).
* **Static gates:**
  * `consumer_fields_exist`: מוודא שכל שדה שה-Frontend דורש קיים תחת אותו מסלול ב-OpenAPI.
* **Cross-compiler dependencies:** `openapi-spec`, `react-query-hooks`.
* **Error codes:** `QA601` (Field missing in Provider spec), `QA602` (Type mismatch in Contract).
* **Key invariant:** אסור לארטיפקט צרכן (Frontend) ולארטיפקט ספק (Backend) להתקמפל ללא הוכחה סטטית שהממשק ביניהם חופף במדויק.

---

## 7. Visual Regression

**מחקר:**
1. **ארטיפקט:** תמונות Baseline, קובץ הגדרות סובלנות פיקסלים (Threshold), והגדרות סביבת ריצה.
2. **כלים (2025):** Chromatic מצוין ברמת ה-Components (מתחבר ל-Storybook). Playwright משמש לבדיקות ויזואליות ברמת הדף השלם.
3. **אכיפה סטטית:** וידוא שה-`diff` threshold לא עולה על אחוז מזערי (למשל 0.2%). וידוא שהוגדרו Maskings לאלמנטים דינמיים (תאריכים, מזהים אקראיים).
4. **Cross-compiler checks:** קומפיילר זה צריך לדעת על כל הקומפוננטות מ-`react-component` כדי לייצר להן רשימת בדיקה.
5. **Safe Default:** כל שינוי CSS הכי קטן עוצר את ה-Pipeline עד לאישור ידני (מייצר המון רעש, ולכן צריך Spec מגודר היטב).

**Compiler Spec:**
* **Compiler name:** `qa_visual_regression`
* **Spec file:** `visual_policy.spec.json`
* **Output artifact:** `playwright.visual.config.ts`, Chromatic configuration.
* **Static gates:**
  * `max_threshold_limit`: מוודא ש-`maxDiffPixelRatio` קטן מ-`0.01`.
  * `dynamic_masks_required`: מחפש הגדרות `mask` עבור אלמנטים הידועים כדינמיים (דרך Metadata מהפרונטאנד).
* **Cross-compiler dependencies:** `react-component`, `react-page`.
* **Error codes:** `QA701` (Visual threshold too loose), `QA702` (Missing dynamic content masks).
* **Key invariant:** רגרסיה ויזואלית ניתנת להערכה רק מול Baseline יציב, עם סובלנות פיקסלים מינימלית ואטימה (Masking) מוחלטת של תוכן דינמי.

---

## 8. Accessibility Audit (automated)

**מחקר:**
1. **ארטיפקט:** קובץ מדיניות חוקי הנגישות, ויעדים (למשל סריקת WCAG 2.2 AA).
2. **כלים (2025):** `axe-core` מוזרק דרך Playwright זה הסטנדרט. Pa11y מיושן. יש הפרדה ברורה בין מה שאפשר לבדוק אוטומטית (ניגודיות, ARIA labels) למה שדורש ידני (סדר טאבים הגיוני).
3. **אכיפה סטטית:** וידוא שמדיניות הסריקה לא מכבה חוקים קריטיים (למשל `color-contrast`). וידוא שהבדיקה מכשילה את ה-Build ולא רק מדפיסה אזהרות.
4. **Cross-compiler checks:** מרחיב את `a11y-test` השיירד כדי לרוץ על כל ה-`routing-artifact` (כל העמודים המורכבים) ולא רק על קומפוננטות.
5. **Safe Default:** כישלון קומפילציה של כל דף שאינו עומד ב-WCAG 2.1 AA.

**Compiler Spec:**
* **Compiler name:** `qa_accessibility_audit`
* **Spec file:** `a11y_policy.spec.json`
* **Output artifact:** `axe.runner.ts`, A11y ruleset config.
* **Static gates:**
  * `no_critical_rules_disabled`: מוודא שכלל קריטי (כמו `html-has-lang` או `button-name`) לא בסטטוס `false` בקונפיגורציה.
  * `target_wcag_level`: מוודא שהתקן שהוגדר הוא לפחות WCAG 2.1 AA.
* **Cross-compiler dependencies:** `react-routing-artifact`, `react-page`.
* **Error codes:** `QA801` (Critical a11y rule disabled), `QA802` (Invalid WCAG target level).
* **Key invariant:** שום מסלול משתמש אינו חוקי אם סורק נגישות מזהה בו הפרה קריטית ברמת ה-DOM המונעת גישה לאוכלוסיות עם מוגבלות.

---

## 9. Security Testing (QA perspective)

**מחקר:**
1. **ארטיפקט:** חוקי סריקה של DAST וקונפיגורציות ל-Vulnerability scanners.
2. **כלים (2025):** OWASP ZAP מוטמע כקונטיינר ל-DAST אוטומטי. Dependabot/Snyk/npm-audit רצים ב-CI. SAST (כמו Semgrep) משולב. QA מתעסק בווידוא שהכלים האלה *רצים* ושה-Baseline מתוחזק; Security Engineer מתעסק ב-Pen-testing עמוק וטריאז'.
3. **אכיפה סטטית:** וידוא שאין קובץ `.auditignore` המסתיר חולשות High/Critical באופן גורף.
4. **Cross-compiler checks:** ZAP חייב לרוץ על ה-Endopoints שמיוצרים מ-`api-routes`.
5. **Safe Default:** ה-Build נחסם לחלוטין ברגע שמתגלה חולשת High CVE באחד מה-Packages או ב-Artifact.

**Compiler Spec:**
* **Compiler name:** `qa_security_scan`
* **Spec file:** `qa_sec_policy.spec.json`
* **Output artifact:** `zap.config.yaml`, CI vulnerability check steps.
* **Static gates:**
  * `no_unauthorized_ignore`: אוסר על קיום כללי התעלמות (Ignore rules) מחולשות Critical ללא חתימה מקודדת של צוות אבטחה.
  * `ci_fail_on_high`: מוודא שהסקריפטים מחזירים Error Code על רמת High ומעלה.
* **Cross-compiler dependencies:** `api-routes` (מגדיר את שטח התקיפה).
* **Error codes:** `QA901` (Unauthorized CVE ignore rule), `QA902` (Missing DAST scanning target).
* **Key invariant:** מערכת לא תאומת כמוכנה לפרודקשן כל עוד קיימת בה חולשה מתועדת הידועה כמסוכנת ללא אישור חריג וזמני.

---

## 10. Test Data Management

**מחקר:**
1. **ארטיפקט:** סקריפטים של Data Seeding, Factories לייצור מידע אקראי, ואסטרטגיות ניקוי DB.
2. **כלים (2025):** Fixtures סטטיים נחשבים לאנטי-תבנית (שבירים ומכילים לרוב PII). משתמשים ב-Factories (עם ספריות כמו Faker.js או Fishery) שמייצרים נתונים דינמיים לפי הסכמות. אסטרטגיית הניקוי המובילה: DB Transaction Rollback או DB Truncation פר-טסט. Snapshot testing שמור רק למבנים סטטיים מאוד.
3. **אכיפה סטטית:** חסימת Hardcoded Emails/Phones בקובצי טסטים. וידוא שכל אובייקט Factory מיישם את הסכמה המתאימה מה-Backend. וידוא קיומו של מנגנון Teardown לנתונים.
4. **Cross-compiler checks:** ה-Factories חייבים לגזור את הטיפוסים שלהם מ-`ts-schema` ולייצר נתונים שתואמים ל-`gen-db-schema` (של ה-Backend).
5. **Safe Default:** הטסטים רצים על In-Memory DB ריק ונדרשים לבנות לעצמם את כל עץ הנתונים מהאפס בכל ריצה (איטי אבל הכי בטוח).

**Compiler Spec:**
* **Compiler name:** `qa_test_data_manager`
* **Spec file:** `test_data.spec.json`
* **Output artifact:** `factories.ts`, `dbCleaner.ts`.
* **Static gates:**
  * `no_hardcoded_pii`: סורק AST/RegEx למניעת הכנסת מחרוזות הנראות כמו אימיילים אמיתיים או תעודות זהות בסקריפטים סטטיים.
  * `cleaner_strategy_defined`: מוודא שהוגדרה פונקציית טיהור נתונים (Truncate/Rollback).
* **Cross-compiler dependencies:** `ts-schema` (עבור Factories), `gen-db-schema`.
* **Error codes:** `QA1001` (Hardcoded PII in static fixture), `QA1002` (Missing DB cleanup strategy).
* **Key invariant:** נתוני בדיקה חייבים להיות מסונתזים דינמית בהתאמה מוחלטת למודל הנתונים העדכני (Schema), תוך בידוד מוחלט ומחיקת State בין ריצות.