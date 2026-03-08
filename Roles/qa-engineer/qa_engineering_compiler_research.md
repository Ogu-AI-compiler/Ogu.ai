# QA Engineering לתכנון Domain Compiler Network

תאריך: 2026-03-08

## Executive overview

אני ממליץ להתחיל עם **10 QA compilers** ברמת policy ו project-level, ולא ברמת test case בודד. המטרה שלהם איננה "לכתוב בדיקות" במקום הצוות, אלא לייצר ארטיפקטים פורמליים, מגודרים, עם cross-checks מול compilers אחרים, כך שאפשר יהיה להוכיח מה מכוסה, מה לא מכוסה, ואיפה יש פער בין spec, routes, API surface, stories, feature flags ו user flows.

### ההמלצה על הסדר

1. `qa_harness_config`
2. `qa_coverage_policy`
3. `qa_test_data_policy`
4. `qa_e2e_flow_policy`
5. `qa_visual_regression_policy`
6. `qa_accessibility_audit_policy`
7. `qa_contract_policy`
8. `qa_performance_budget`
9. `qa_load_profile`
10. `qa_security_scan_policy`

### למה זה הסדר הנכון

- `qa_harness_config` הוא הבסיס לכל שאר ה compilers: בלי harness, reporters, environments ו setup/teardown, אין execution substrate אמין.
- `qa_coverage_policy` ו `qa_test_data_policy` חייבים להגיע מוקדם כי הם מגדירים איך בכלל מודדים אמינות, ומהו test isolation חוקי.
- `qa_e2e_flow_policy` הוא ה compiler הראשון שנותן ערך product-level אמיתי: הוא מחבר בין routes, auth, feature flags ו user flows.
- `qa_visual_regression_policy` ו `qa_accessibility_audit_policy` נשענים על routes/stories/rendered UI ולכן בנויים טוב יותר אחרי שיש harness ו flow model.
- `qa_contract_policy` נשען על `openapi-spec`, `api-route` ו provider/consumer mapping, ולכן מתאים אחרי שיש layer תפעולי של QA.
- `qa_performance_budget` ו `qa_load_profile` הם policy compilers חזקים, אבל הם שווים פחות אם עוד לא הוגדרו flows, routes, budgets ו environments.
- `qa_security_scan_policy` צריך להגיע אחרי שיש target inventory ברור, auth flows, route surface ו env rules, אחרת הוא נהיה noisy ולא deterministic.

### המלצה ארכיטקטונית

לכל QA compiler כדאי להפיק **שני outputs**:

1. **Runtime artifact**: קבצי config/spec שהכלים עצמם יודעים להריץ.
2. **Normalized manifest**: קובץ JSON יציב שה network יודע לצרוך ל cross-compiler checks.

דוגמה:

- runtime: `playwright.config.ts`
- manifest: `qa-artifacts/e2e-flow-policy.manifest.json`

### Safe default גלובלי כש QA compiler חסר

במערכת פורמלית, safe default לא צריך להיות "pass silent". הוא צריך להיות:

- **fail-open על build execution**: המוצר עדיין יכול להיבנות.
- **fail-closed על attestation**: אסור לטעון שנבדק משהו שלא הוגדר.

לכן, כאשר QA compiler חסר, ההמלצה היא להפיק sentinel artifact בסגנון:

`qa-artifacts/<compiler>.absent.json`

עם semantic מפורש:

- `status: "absent"`
- `claims: []`
- `blocks: []`
- `warnings: ["no formal QA policy for this dimension"]`

כך ה network לא ממציא איכות שלא קיימת.

---

# 1. Test Harness & Configuration

## Compiler name

`qa_harness_config`

## Spec file

`qa.harness.spec.json`

## Output artifact

- `vitest.config.ts` או `jest.config.ts`
- `playwright.config.ts`
- `tests/setup/global.setup.ts`
- `tests/setup/global.teardown.ts`
- `tests/setup/test-env.ts`
- `qa-artifacts/harness.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

ה QA Engineer מגדיר את שכבת ההרצה עצמה: test runner, browser runner, setup/teardown, environments, reporters, output directories, retry policy, mock strategy defaults, attachments, traces, screenshots, videos ו coverage provider.

זהו compiler foundational. הוא לא אמור לתאר test cases, אלא את machine that runs them.

## אילו כלים משמשים בתעשייה 2024-2025

- **Vitest**: ברירת המחדל הטובה ל Vite/ESM/TS projects חדשים. תומך coverage providers `v8` ו `istanbul`, threshold-per-glob, reporters ו `expect.requireAssertions` [R5][R6][R7].
- **Jest**: עדיין נפוץ במונורפו ותיקים ובארגונים גדולים. תומך `coverageThreshold`, `coverageProvider`, `globalSetup`, `globalTeardown`, `testEnvironment` ו reporters [R8].
- **Playwright Test**: ברירת המחדל הנכונה ל browser-level harness. תומך project dependencies, fixtures, retries, reporters, screenshots/videos/traces, sharding ו cross-browser execution [R1][R2][R3][R4][R9][R10][R11][R12].
- **MSW**: ברירת מחדל טובה ל network mocking ברמת browser/Node כי הוא intercepts REST וגם GraphQL ללא coupling ל fetch client מסוים [R13].
- `vi.spyOn` / `jest.spyOn`: טובים ל unit-level observation של collaborators, לא להחלפת network boundary שלם [R14][R15].

## הכרעת tooling

ל network שלך:

- unit/integration harness: **Vitest-first**
- browser/E2E harness: **Playwright-first**
- network mocking default: **MSW-first**, ורק אחריו `spyOn/mock`

## Static gates

- **QA001 `primary_test_runner_declared`**: יש בדיוק unit runner אחד primary מתוך `vitest | jest`.
- **QA002 `browser_runner_declared`**: אם יש `e2e_enabled=true`, יש browser runner primary מוגדר.
- **QA003 `config_files_exist`**: כל file path שמופיע ב spec אכן נוצר.
- **QA004 `coverage_provider_valid`**: provider הוא אחד מתוך enum חוקי בלבד.
- **QA005 `reporters_machine_readable`**: מוגדר לפחות reporter אחד machine-readable, למשל `junit` או `json`, ולפחות reporter אנושי אחד, למשל `html` או `text`.
- **QA006 `setup_exports_valid`**: קבצי global setup/teardown מייצאים פונקציה חוקית ב ESM.
- **QA007 `artifact_output_dir_declared`**: output directory לכל attachments/tests/results מוגדר ואינו מצביע ל path אסור.
- **QA008 `mock_strategy_non_conflicting`**: לכל boundary יש strategy אחד default בלבד: `msw`, `module-mock`, `spy`, או `real`.
- **QA009 `playwright_projects_resolve`**: אם יש Playwright projects/dependencies, כל project reference resolve-able.
- **QA010 `assertion_policy_declared`**: ה spec מגדיר במפורש האם `requireAssertions`/equivalent פעיל.

## אילו invariants/rules ניתן לאכוף statically

- אסור לערבב unit runner primary כפול.
- אסור להצהיר `globalSetup` ללא file קיים.
- אסור להגדיר reporters רק אנושיים ללא output machine-readable.
- אסור ש network mocking strategy יהיה implicit.
- אסור ש browser artifacts ייכתבו ל path לא יציב או לתיקיית source.

## Cross-compiler dependencies

- `frontend-routing.manifest.json` לצורך browser baseURLs/projects
- `feature-flag.manifest.json` לצורך env matrix
- `auth-middleware` / auth artifacts לצורך login bootstrap
- `api-route` / `openapi-spec` לצורך mock maps
- `shared a11y-test compiler` אם נרצה לשלבו ב Playwright fixtures

## אילו cross-compiler checks הגיוניים

- אם `qa_e2e_flow_policy` קיים, חייב להיות `playwright.config.ts` או equivalent browser harness.
- אם `qa_contract_policy` דורש provider verification pipelines, חייב להיות reporter machine-readable ו artifact path ידוע.
- אם `qa_visual_regression_policy` קיים, חייב להיות outputDir ל screenshots/traces.

## Safe default

אם compiler זה לא קיים:

- build לא נחסם.
- אין שום claim על QA orchestration.
- downstream compilers כמו E2E/visual/a11y לא יכולים להצהיר על runnable policy.

## Error codes

- `QA001` missing primary runner
- `QA002` invalid browser harness declaration
- `QA003` missing setup/teardown file
- `QA004` unsupported coverage provider
- `QA005` no machine-readable reporter

## Key invariant

**אין QA policy runnable בלי harness מפורש, deterministic ומגובה ב config קיים.**

---

# 2. E2E Testing

## Compiler name

`qa_e2e_flow_policy`

## Spec file

`qa.e2e-flows.spec.json`

## Output artifact

- `tests/e2e/flows/*.spec.ts`
- `tests/e2e/fixtures/*.ts`
- `tests/e2e/flows/flow-map.json`
- `qa-artifacts/e2e-flow-policy.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

לא "בדיקות לכל דף", אלא **flow policy**:

- אילו user journeys קריטיים קיימים
- איזה preconditions צריך
- איזה assertions מסיימים כל flow
- אילו fixtures ו roles מעורבים
- מהו isolation model
- איזה artifacts נשמרים בכשלון

## אילו כלים משמשים בתעשייה 2024-2025

- **Playwright**: הבחירה הטובה ביותר כברירת מחדל ב 2025 ל stacks מודרניים, בגלל cross-browser projects, fixtures, retries, sharding, traces, screenshots/videos ו project dependencies [R1][R2][R3][R4][R9][R10][R11][R12].
- **Cypress**: עדיין רלוונטי בעיקר ל legacy suites או teams שכבר שקועים ב Cypress Cloud. תומך screenshots/videos on failure, retries ו cross-browser execution, אבל בארכיטקטורת compiler network הוא בדרך כלל פחות נוח מ Playwright כ default project policy [R16][R17].
- **WebdriverIO**: רלוונטי במיוחד אם יש צורך חזק ב Appium / mobile-web / native / visual service באותו אקו-סיסטם [R18].

## הכרעת tooling ל 2025

- **ברירת מחדל**: Playwright.
- **Cypress**: רק אם יש כבר investment כבד.
- **WebdriverIO**: רק אם ה QA tier חייב לאחד web + mobile/native/Appium תחת framework אחד.

## Page Object Model: האם עדיין רלוונטי?

כן, אבל לא כ abstraction ראשי.

POM עדיין שימושי כ helper layer לאזורים יציבים של UI, ו Playwright עצמו עדיין מתעד אותו כ pattern לגיטימי [R19]. אבל ב compiler network מודרני עדיף שהארטיפקט הראשי יהיה **flow-oriented** ולא **page-oriented**:

- `login_flow`
- `checkout_flow`
- `upgrade_subscription_flow`

ולא `LoginPage`, `DashboardPage`, `BillingPage` כמבנה הכרחי.

כלל מעשי:

- POM מותר כהתממשקות פנימית
- ה compiler עצמו צריך לחשוב ב user flows, state transitions ו terminal assertions

## Static gates

- **QA101 `flow_ids_unique`**: כל flow id ייחודי.
- **QA102 `flow_has_terminal_assertion`**: לכל flow יש לפחות terminal assertion אחד.
- **QA103 `flow_step_kinds_valid`**: כל step הוא מסוג חוקי בלבד: `navigate | act | assert | wait | seed | login | logout`.
- **QA104 `route_references_resolve`**: כל route reference resolve-able מול routing artifact.
- **QA105 `critical_flows_cover_route_surface`**: כל route שמסומן `critical=true` ב routing artifact מופיע לפחות flow אחד.
- **QA106 `locator_policy_valid`**: locators מותרים הם semantic בלבד כברירת מחדל: `role`, `label`, `placeholder`, `testid`. XPath/CSS brittle patterns מחייבים allowlist.
- **QA107 `auth_preconditions_declared`**: flow שדורש auth מצהיר על role/session fixture.
- **QA108 `isolation_model_declared`**: כל flow מצהיר על isolation strategy.
- **QA109 `artifact_capture_policy_declared`**: לכל suite יש policy ל trace/screenshot/video on failure.
- **QA110 `parallel_safety_declared`**: flow שמסומן parallelizable חייב להצהיר שאין shared mutable data ללא worker isolation.

## אילו invariants/rules ניתן לאכוף statically

- כל flow חייב להתחיל מ precondition מפורש או route entry.
- כל flow חייב להסתיים ב observable assertion, לא רק ב no-throw.
- אין flow שמבוסס על `nth-child`/DOM-shape brittle locator אלא אם יש exemption.
- אין flow critical בלי owner, tags ו target environments.
- אין שימוש implicit ב session קודמת.

## Cross-compiler dependencies

- `routing-artifact.json`
- `react-page` / page manifests
- `auth` artifacts
- `feature-flag.manifest.json`
- `analytics-event.manifest.json` לבדיקת instrumentation על flows קריטיים
- `i18n` artifact אם בודקים locale matrix

## אילו cross-compiler checks הגיוניים

- כל route marked `critical` ב routing artifact חייב להופיע ב E2E flow אחד לפחות.
- כל feature flag שמסומן `user_visible` חייב להיות משויך לפחות flow אחד ב variant matrix.
- flow שמצהיר `expects_event` חייב למפות ל analytics-event artifact קיים.
- flow שמצהיר locale-specific content חייב למפות ל key/namespace ב i18n artifact.

## Safe default

אם compiler זה חסר:

- אין claim על user-flow verification.
- לכל היותר נשענים על tests-pass קיימים של frontend/backend.
- deployment gates לא יכולים להשתמש במושג "critical user journeys verified".

## Error codes

- `QA101` duplicate flow id
- `QA102` missing terminal assertion
- `QA103` unresolved route reference
- `QA104` brittle locator forbidden
- `QA105` critical route uncovered

## Key invariant

**E2E policy תקין מוכיח coverage של user flows קריטיים, לא רק אוסף בדיקות לדפים.**

---

# 3. Coverage Policy

## Compiler name

`qa_coverage_policy`

## Spec file

`qa.coverage-policy.spec.json`

## Output artifact

- `coverage.config.ts` או inline config ב `vitest.config.ts` / `jest.config.ts`
- `qa-artifacts/coverage-policy.manifest.json`
- `coverage-exemptions.json`

## מה הארטיפקט שה QA Engineer מייצר

מדיניות coverage פורמלית:

- איזה provider
- אילו thresholds גלובליים
- אילו per-file/per-glob thresholds
- אילו folders excluded
- מה נחשב exemption חוקי
- איך מונעים coverage cheating

## אילו כלים משמשים בתעשייה 2024-2025

- **Vitest coverage** עם providers `v8` ו `istanbul`, thresholds per glob/per file ו reporters [R5][R6][R7].
- **Jest** עם `coverageProvider`, `coverageThreshold`, globs/directories/files [R8].
- **Istanbul**: battle-tested, pre-instrumented, שליטה טובה יותר על instrumentation scope, אבל מוסיף overhead [R20].
- **V8 coverage**: לרוב מהיר יותר ובלי pre-instrumentation, אבל ב Vitest הוא instrument-all-modules ולכן צריך include/exclude מדויקים [R20].

## Istanbul/V8: ההבדל המעשי

- **V8**: עדיף כ default ב stacks מודרניים עם Vitest, בעיקר בגלל פשטות ומהירות.
- **Istanbul**: עדיף כשצריך שליטה מפורטת יותר על instrumentation או כשיש edge cases של source maps/transpilation.

## Coverage cheating patterns שצריך לאכוף נגדם

1. בדיקות שמריצות קוד בלי assertions.
2. assertions לא awaited ב browser tests.
3. exclude רחב מדי שמוציא folders קריטיים.
4. thresholds גלובליים גבוהים אבל per-file קריטיים לא מכוסים.
5. snapshot-only tests כתחליף ל behavioral assertions.

Vitest מספק `expect.requireAssertions` כדי לוודא שלכל test יש assertions, ו Vitest/Jest תומכים ב `expect.hasAssertions()` / assertion count patterns [R21][R22]. Playwright ממליץ על web-first assertions ולא על manual boolean checks [R23][R24].

## Static gates

- **QA201 `coverage_provider_supported`**: provider הוא `v8` או `istanbul` בלבד.
- **QA202 `global_thresholds_declared`**: מוגדרים thresholds ל `lines`, `functions`, `branches`, `statements` או מדיניות שקולה.
- **QA203 `critical_globs_have_thresholds`**: לכל glob שממופה ל code critical יש threshold משלו.
- **QA204 `coverage_include_declared`**: אין policy ללא include globs מפורשים.
- **QA205 `coverage_exclusions_justified`**: כל exclusion חייב reason code.
- **QA206 `assertion_enforcement_declared`**: policy מגדיר `requireAssertions` או חלופה שקולה.
- **QA207 `zero_thresholds_forbidden`**: threshold אפס אסור ללא exemption.
- **QA208 `reporters_declared`**: coverage reporters כוללים לפחות `json` או `lcov` ועוד output אנושי.
- **QA209 `critical_files_not_globally_ignored`**: globs שמגיעים מ compilers קיימים לא ignored בטעות.
- **QA210 `threshold_scope_non_overlapping`**: אין rule ambiguity שבו שני globs חלים על אותו file עם policies סותרות ללא precedence מוגדרת.

## אילו invariants/rules ניתן לאכוף statically

- חייב להיות distinction בין global thresholds ל critical thresholds.
- אסור להוציא `src/routes`, `src/pages`, `src/hooks`, `src/api` בלי exemption.
- files generated או barrels יכולים להיות excluded, אבל חייב להיות classification.
- snapshot-only directories לא יכולים להיות marked as sufficient behavioral coverage.

## Cross-compiler dependencies

- כל manifests של `react-component`, `react-form`, `react-hook`, `react-page`
- `api-route`
- `auth-middleware`
- `ts-schema`
- `openapi-spec`

## אילו cross-compiler checks הגיוניים

- כל artifact class שמסומן `critical` ב compiler אחר חייב להיכנס ל per-file/per-glob coverage policy.
- כל route handler public חייב להיות ממופה ל coverage bucket.
- כל auth path חייב להיות ב stricter threshold class.

## Safe default

אם compiler זה חסר:

- אסור להציג claim של project coverage quality.
- אפשר להשאיר את gate הישן `coverage-80%` אם כבר קיים, אבל הוא מסווג כ legacy coarse gate בלבד.
- אין per-file correctness claim.

## Error codes

- `QA201` missing critical thresholds
- `QA202` unsupported provider
- `QA203` unjustified exclusion
- `QA204` no assertion enforcement policy
- `QA205` critical artifacts omitted from coverage scope

## Key invariant

**coverage policy תקין לא מודד רק כמה קוד רץ, אלא מגדיר במפורש איזה קוד קריטי חייב להיות מכוסה ובאיזו רזולוציה.**

---

# 4. Performance Budget

## Compiler name

`qa_performance_budget`

## Spec file

`qa.performance-budget.spec.json`

## Output artifact

- `lighthouserc.json` או `lighthouserc.js`
- `.size-limit.json` או `package.json#size-limit`
- `perf-budgets.json`
- `qa-artifacts/performance-budget.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

מדיניות ביצועים אכיפה:

- budgets ל Core Web Vitals
- budgets ל bundle size
- budgets ל JavaScript execution
- route groups שחל עליהם התקן
- fail behavior ב CI

## אילו כלים משמשים בתעשייה 2024-2025

- **Lighthouse CI**: assertions ב pipeline, fail/pass לפי audit thresholds [R25].
- **Size Limit**: budget ל real cost ו bundle size, כולל CI failure ו execution-time plugin [R26].
- **webpack-bundle-analyzer**: כלי חקירה מצוין ל bundle composition, לא כלי budget policy בפני עצמו [R27].
- **bundle-stats**: טוב כשצריך comparison build-to-build ב webpack/vite/rollup [R28].

## Core Web Vitals: מה נכון ב 2025

המדדים המרכזיים הם:

- **LCP <= 2.5s**
- **INP <= 200ms**
- **CLS <= 0.1**

והמדידה אמורה להיות ב p75, מופרד mobile/desktop [R29][R30][R31].

חשוב: **FID הוחלף רשמית על ידי INP כ Core Web Vital במרץ 2024**, ולכן compiler חדש לא צריך לבנות policy חדשה סביב FID אלא רק לאפשר legacy compatibility flag אם יש telemetry ישן [R32].

## JavaScript execution budgets

אין תקן יחיד כמו CWV, ולכן ההמלצה היא לשמור policy פורמלי במונחים של:

- total JS per route group
- initial JS per route group
- execution time budget דרך `size-limit` time plugin כשיש צורך [R26]

## Static gates

- **QA301 `cwv_thresholds_declared`**: LCP/INP/CLS budgets מוגדרים.
- **QA302 `fid_not_primary_metric`**: FID לא מוגדר primary metric אלא אם `legacyTelemetry=true`.
- **QA303 `route_groups_declared`**: budgets ממופים ל route groups או page groups.
- **QA304 `bundle_budget_declared`**: קיים לפחות budget אחד לגודל JS/CSS.
- **QA305 `ci_fail_mode_declared`**: מוגדר `warn | fail` לכל budget class.
- **QA306 `lhci_assertions_valid`**: config של Lighthouse CI syntactically valid.
- **QA307 `budget_owners_declared`**: כל budget critical כולל owner/team.
- **QA308 `measurement_mode_declared`**: מצוין אם budget הוא lab, field, או both.
- **QA309 `artifact_paths_declared`**: report outputs ידועים מראש.

## אילו invariants/rules ניתן לאכוף statically

- אין CWV policy בלי INP.
- אין route critical בלי budget class.
- אין budget file בלי fail behavior מפורש.
- performance budget חייב להיות attached ל surface אמיתי, לא רק למספר גלובלי אחד.

## Cross-compiler dependencies

- `routing-artifact.json`
- page manifests
- bundle manifests/build stats אם קיימים
- feature-flag manifest לצורך variant-specific budgets

## אילו cross-compiler checks הגיוניים

- כל route marked `public_entry` חייב budget class.
- כל page שמסומנת revenue-critical או SEO-critical חייבת להיות ב strict budget tier.
- routes מאחורי feature flags גדולים צריכים budget override או variant budget.

## Safe default

אם compiler זה חסר:

- אין claim של performance conformance.
- אפשר עדיין להריץ Lighthouse ad hoc, אבל אי אפשר להצהיר "budget enforced".
- CWV הופך observational בלבד, לא formal gate.

## Error codes

- `QA301` missing INP/LCP/CLS budget
- `QA302` FID used as primary metric
- `QA303` no route mapping for budgets
- `QA304` no CI fail behavior
- `QA305` missing bundle budget

## Key invariant

**performance policy תקין מחבר בין user-facing surfaces לבין budgets אכיפים, ולא מסתפק בציון Lighthouse כללי.**

---

# 5. Load & Stress Testing

## Compiler name

`qa_load_profile`

## Spec file

`qa.load-profile.spec.json`

## Output artifact

- `tests/load/*.js` או `tests/load/*.ts` ל k6/Artillery
- `load/profiles/*.json`
- `qa-artifacts/load-profile.manifest.json`
- `load/reports/manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

לא רק סקריפט הרצה, אלא **performance experiment spec**:

- test class: smoke/load/stress/soak
- environment
- traffic shape
- thresholds
- datasets
- target endpoints
- outputs לשמירה

## אילו כלים משמשים בתעשייה 2024-2025

- **k6**: ברירת המחדל הכי פרקטית ל network כזה. thresholds הם first-class, ה DSL קריא, ו pass/fail הוא חלק מהשפה עצמה [R33].
- **Artillery**: חלופה טובה מאוד במיוחד ל teams שיותר טבעי להם YAML/Node workflows; phases, arrivalRate ו rampTo ברורים מאוד [R34][R35].
- **Locust**: מתאים יותר לצוותים עם Python-heavy infra [R36].
- **Gatling**: חזק מאוד בארגוני JVM ו enterprise performance teams, עם assertions ו percentile controls עשירים [R37].

## הכרעת tooling ל 2025

- **ברירת מחדל**: `k6`
- **חלופה Node-native**: `Artillery`
- `Locust` / `Gatling` רק אם הארגון כבר חי בהם

## הבדלים בין סוגי הטסטים

- **smoke**: מעט traffic, בודק שהמערכת מגיבה בכלל ושה thresholds מינימליים לא נשברים.
- **load**: traffic סביב expected peak.
- **stress**: דוחף מעבר ל peak כדי להבין breaking point.
- **soak**: משך ארוך, מחפש leaks/degradation לאורך זמן.

## Static gates

- **QA401 `test_class_declared`**: test type הוא `smoke | load | stress | soak` בלבד.
- **QA402 `environment_declared`**: environment מפורש.
- **QA403 `prod_run_forbidden_by_default`**: `production` אסור אלא אם `allowProduction=true`.
- **QA404 `traffic_shape_declared`**: מוגדרים `vus/users/arrivalRate` ו `duration` או profile equivalent.
- **QA405 `thresholds_declared`**: מוגדרים thresholds ל latency/error rate לפחות.
- **QA406 `endpoint_targets_resolve`**: כל target endpoint resolve-able מול `openapi-spec` או route registry.
- **QA407 `auth_material_not_inline`**: tokens/secrets לא hardcoded ב spec.
- **QA408 `artifact_outputs_declared`**: report outputs מוגדרים.
- **QA409 `dataset_policy_declared`**: dataset/test data mode מוגדר.

## אילו invariants/rules ניתן לאכוף statically

- אין load spec בלי thresholds.
- אין stress/soak בלי explicit env approval class.
- אין profile שמכוון ל endpoint לא public או לא קיים.
- אין auth secret inline.
- אין soak test בלי duration ארוך מספיק לפי policy.

## Cross-compiler dependencies

- `openapi-spec`
- `api-route`
- `auth` artifacts
- `qa_test_data_policy`
- `feature-flag` אם profile תלוי variants

## אילו cross-compiler checks הגיוניים

- כל endpoint שמסומן `high_traffic=true` ב API surface חייב להיות ממופה לפחות load profile אחד.
- endpoints שדורשים auth חייבים למפות ל auth fixture class חוקי.
- endpoints שמוגדרים write-heavy חייבים להשתמש ב test data isolation strategy חוקי.

## מה שומרים מריצת load test

ה compiler צריך להכתיב manifest של outputs:

- summary JSON
- percentile tables
- threshold pass/fail
- git SHA / spec hash
- environment metadata
- run timestamp

## היכן מריצים

safe default: **staging בלבד**. production רק עם explicit allow flag ומבחני smoke/low-impact בלבד.

## Safe default

אם compiler זה חסר:

- אין claim על capacity או latency behavior תחת עומס.
- performance budgets נשארים page-level בלבד.
- deployment לא יכול לטעון "load-verified".

## Error codes

- `QA401` invalid load test class
- `QA402` missing thresholds
- `QA403` prod target forbidden
- `QA404` unresolved endpoint target
- `QA405` inline secret detected

## Key invariant

**load policy תקין מגדיר traffic shape ו thresholds אכיפים על surface קיים וממופה, לא רק script שמפציץ URL.**

---

# 6. Contract Testing

## Compiler name

`qa_contract_policy`

## Spec file

`qa.contract-policy.spec.json`

## Output artifact

- `contracts/pact/**/*.json`
- `contracts/provider-states.json`
- `contracts/pact-broker.config.json`
- `qa-artifacts/contract-policy.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

פורמליזציה של consumer-driven contracts:

- מי consumer
- מי provider
- איזה interactions מכוסים
- אילו provider states נדרשים
- האם יש broker/pactflow
- באילו environments אוכפים `can-i-deploy`

## אילו כלים משמשים בתעשייה 2024-2025

- **Pact** לקבצי consumer/provider contracts, provider states ו verification [R38][R39].
- **Pact Broker / PactFlow** לצורך matrix, verification publication ו `can-i-deploy` [R40][R41][R42].
- **Bi-directional contract testing עם OpenAPI**: PactFlow תומך provider contracts המבוססים על OpenAPI ו comparison מול consumer contracts [R43][R44][R45][R46].

## מה הקשר ל OpenAPI spec שכבר יש לכם

OpenAPI ו Pact לא מחליפים זה את זה:

- **OpenAPI** מתאר את מה שה provider מצהיר שהוא מסוגל לספק.
- **Pact** מתאר את מה ש consumer אמיתי מצפה ומפעיל בפועל.

כלומר:

- OpenAPI הוא provider capability contract.
- Pact הוא consumer expectation contract.

ב 2025 הגישה הכי בריאה היא:

1. להמשיך להחזיק `openapi-spec` כ source of provider truth.
2. לבנות `qa_contract_policy` כך ש consumer contracts ייבדקו מולו.
3. להוסיף cross-check: כל pact interaction צריך להיות compatible עם OpenAPI path/operation/shape, או להיות exempted במפורש.

## האם Pact Broker הכרחי?

- **לפרויקט קטן עם consumer אחד ו provider אחד**: לא חובה.
- **ל network אמיתי עם promotion gates**: כמעט חובה, כי בלעדיו אין matrix אמין ו `can-i-deploy` הופך ad hoc.

## Static gates

- **QA501 `pact_participants_declared`**: consumer/provider mapping מלא.
- **QA502 `provider_states_unique`**: provider state names ייחודיים.
- **QA503 `interactions_map_to_provider_surface`**: כל interaction ממופה ל path/operation קיימים ב OpenAPI או exemption.
- **QA504 `broker_mode_declared`**: מוגדר `none | broker | pactflow`.
- **QA505 `protected_envs_require_deploy_check`**: אם יש broker mode ו protected environments, מוגדר `can_i_deploy=true`.
- **QA506 `provider_state_fixture_declared`**: כל provider state מצהיר איך נבנית precondition.
- **QA507 `contract_files_valid_format`**: כל contract output ב format חוקי.
- **QA508 `self_verification_dependency_declared`**: אם משתמשים ב OpenAPI provider contract, חייב להיות provider self-verification dependency.

## אילו invariants/rules ניתן לאכוף statically

- כל interaction חייב owner ו participant mapping.
- אין interaction ללא expected status/response shape class.
- provider states לא יכולים להיות implicit.
- environments קריטיים לא יכולים להיות broker-less אם policy אומרת gated promotion.

## Cross-compiler dependencies

- `openapi-spec`
- `api-route`
- `auth-middleware`
- backend schemas/manifests
- frontend service-client manifests אם קיימים

## אילו cross-compiler checks הגיוניים

- כל pact interaction חייב להיות subset-compatible עם OpenAPI operation קיימת.
- כל `api-route` public שמסומן `consumed_by_external_app=true` חייב להיות contract strategy מוגדר: pact / bi-directional / exempt.
- service clients בפרונטאנד שממופים ל provider מסוים חייבים consumer participant mapping.

## Safe default

אם compiler זה חסר:

- נשענים רק על `openapi-spec` ו route tests.
- אין claim על consumer compatibility.
- breaking changes בין services לא נחסמות פורמלית.

## Error codes

- `QA501` missing participant mapping
- `QA502` unresolved provider state
- `QA503` pact interaction not mapped to OpenAPI
- `QA504` protected env without can-i-deploy policy
- `QA505` missing provider self-verification dependency

## Key invariant

**contract policy תקין מוכיח תאימות בין צרכן אמיתי ל surface אמיתי של provider, לא רק validity של OpenAPI או success של endpoint test בודד.**

---

# 7. Visual Regression

## Compiler name

`qa_visual_regression_policy`

## Spec file

`qa.visual-regression.spec.json`

## Output artifact

- `visual/baselines/**`
- `visual/specs/**/*.spec.ts`
- `.storybook/visual.config.ts` אם רלוונטי
- `qa-artifacts/visual-regression.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

מדיניות פורמלית של:

- source of truth לבייסליין
- tracked states
- diff thresholds
- update policy
- baseline storage
- approval mode

## אילו כלים משמשים בתעשייה 2024-2025

- **Chromatic**: מצוין אם יש Storybook טוב. בונה visual + interaction + a11y workflows סביב stories, וכל הרעיון שלו נשען על baseline snapshots והשוואות בענן [R47][R48][R49].
- **Percy**: עדיין חזק מאוד, במיוחד בארגונים שמשתמשים BrowserStack/Percy ecosystem.
- **Playwright screenshots**: פתרון מצוין ל compiler network self-hosted, עם `toHaveScreenshot`, thresholds כמו `maxDiffPixels`/`maxDiffPixelRatio`, ו update snapshots [R50].
- **WebdriverIO visual service**: חזק כשצריך web + mobile/native/Appium visual comparison [R18].

## מה לבחור

- אם יש Storybook culture טוב: **Chromatic-first**.
- אם אין Storybook או שה visual states תלויים flows אמיתיים: **Playwright screenshots-first**.
- אם אתם חייבים unified mobile/web/native visual stack: **WebdriverIO**.

## baseline management

ה compiler לא יכול להחליט אם שינוי ויזואלי הוא "נכון". הוא כן יכול לאכוף:

- baseline source מוגדר
- update mode הוא `manual` כברירת מחדל
- אין auto-approve
- כל baseline חדש חייב map ל state id ידוע

## Static gates

- **QA601 `baseline_source_declared`**: source הוא `storybook | playwright | cypress | webdriverio`.
- **QA602 `tracked_states_unique`**: כל visual state id ייחודי.
- **QA603 `state_targets_resolve`**: כל state ממופה ל story id או flow id קיים.
- **QA604 `diff_thresholds_declared`**: max diff policy מוגדרת.
- **QA605 `baseline_update_mode_declared`**: update mode הוא `manual` או policy equivalent.
- **QA606 `determinism_controls_declared`**: מוגדרים לפחות שניים מתוך freeze-time / disable-animations / stable-fonts / mock-randomness.
- **QA607 `baseline_paths_valid`**: baseline storage path מוגדר ויציב.
- **QA608 `no_auto_accept_in_ci`**: CI לא יכול לעדכן baselines אוטומטית אלא אם env explicit.

## אילו invariants/rules ניתן לאכוף statically

- אין visual tracking בלי state inventory.
- אין visual state orphan בלי story/flow target.
- אין baseline auto-accept ב protected branches.
- אין שימוש ב visual regression בלי determinism toggles.

## Cross-compiler dependencies

- storybook stories artifact אם קיים
- `react-component` / page manifests
- `qa_e2e_flow_policy`
- design token / theme artifacts אם קיימים

## אילו cross-compiler checks הגיוניים

- כל story tagged `critical_visual` חייב להיות tracked visual state.
- כל route/flow tagged `marketing` או `checkout` חייב visual coverage אם policy דורש זאת.
- design token change ב color/spacing/typography layer צריך להדליק impacted visual states list.

## threshold לפני שנחשב regression

אין מספר אוניברסלי. ה compiler צריך לייצר threshold policy לפי surface class:

- icons/atomic UI: strict מאוד
- full page עם data/avatars: permissive יותר
- animation-heavy surfaces: baseline disabled או mocked

ב Playwright זה מתורגם ל `maxDiffPixels`/`maxDiffPixelRatio` [R50].

## Safe default

אם compiler זה חסר:

- אין claim על visual stability.
- code review נשארת ידנית בלבד.
- snapshots מקומיים ad hoc אינם attested visual policy.

## Error codes

- `QA601` missing baseline source
- `QA602` unresolved story/flow target
- `QA603` missing diff threshold
- `QA604` nondeterministic state policy missing
- `QA605` auto baseline update forbidden

## Key invariant

**visual regression policy תקין מחבר כל baseline ל state ידוע, threshold ידוע ו deterministic render path.**

---

# 8. Accessibility Audit

## Compiler name

`qa_accessibility_audit_policy`

## Spec file

`qa.accessibility-policy.spec.json`

## Output artifact

- `a11y/targets.json`
- `a11y/axe.config.json`
- `a11y/pa11y.config.json` אם משתמשים
- `qa-artifacts/accessibility-policy.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

policy שמגדיר:

- אילו surfaces נסרקים
- איזה engine
- איזה WCAG level
- אילו rule suppressions חוקיים
- מה אוטומטי ומה ידני
- איך integrate עם ה `a11y-test compiler` שכבר קיים

## אילו כלים משמשים בתעשייה 2024-2025

- **axe-core**: העוגן המרכזי לאוטומציית accessibility ב web UI. axe-core תומך בחוקי WCAG 2.0/2.1/2.2 A/AA/AAA וב best practices, ומצהיר שהוא מזהה בממוצע 57% מבעיות WCAG אוטומטית [R51].
- **Storybook a11y addon**: יושב על axe-core ומאפשר לסרוק stories; Storybook מציין זאת במפורש [R52].
- **Pa11y**: טוב כ URL-based CLI/Node runner, supports WCAG2AA כברירת מחדל ויכול לרוץ עם runner של axe [R53].
- **Lighthouse accessibility audits**: טוב כ audit משלים, אבל פחות מתאים מ axe-core כ policy engine ראשי; Lighthouse accessibility score בנוי כ weighted average של pass/fail audits [R54].

## מה אוטומטי ומה ידני

אוטומטי:

- missing labels
- accessible names
- ARIA misuse
- color contrast בחלק מהסביבות
- heading/document structure חלקי

ידני:

- keyboard flow איכותי
- focus order business-correct
- screen reader phrasing
- cognitive clarity
- error message usability
- gesture / motion / context adequacy

לכן compiler policy טוב חייב להבחין בין:

- `automated_required`
- `manual_required`

## הקשר ל `a11y-test compiler` שכבר קיים

ה compiler הזה **לא** צריך להחליף את `a11y-test compiler`. הוא צריך להיות שכבת policy מעליו:

- להחליט איזה targets נסרקים
- באיזה standard
- באילו environments
- אילו suppressions מותרים
- אילו cross-checks נדרשים

## Static gates

- **QA701 `engine_declared`**: `axe-core | pa11y | lighthouse | composite`.
- **QA702 `wcag_target_declared`**: למשל `wcag21aa`.
- **QA703 `targets_declared`**: מוגדרים story ids / routes / flows / URLs.
- **QA704 `manual_checklist_declared`**: יש explicit list של checks ידניים שאינם covered by automation.
- **QA705 `suppressions_justified`**: כל suppression כולל reason code + expiry.
- **QA706 `existing_a11y_compiler_integrated`**: אם יש `a11y-test compiler` קיים, policy חייב להפנות אליו ולא לייצר duplicated engine path.
- **QA707 `target_references_resolve`**: כל target resolve-able ל route/story/flow.
- **QA708 `severity_policy_declared`**: מוגדר fail policy ל violation severities.

## אילו invariants/rules ניתן לאכוף statically

- אין a11y policy בלי WCAG target.
- אין suppression בלי justification.
- אין target orphan.
- automation policy לא יכולה לטעון שהיא מכסה manual-only categories.

## Cross-compiler dependencies

- `a11y-test compiler`
- `routing-artifact`
- storybook/story manifests אם קיימים
- `qa_e2e_flow_policy`
- `i18n` artifact עבור locale surfaces

## אילו cross-compiler checks הגיוניים

- כל route/story marked `critical_ui` חייב להיות a11y target.
- כל locale enabled ב i18n policy חייב להיבדק לפחות על shell/critical flows אם policy דורש locale coverage.
- כל component/page עם form controls חייב להיות ב a11y scan class כלשהו.

## Safe default

אם compiler זה חסר:

- אפשר להשאיר `a11y-test compiler` כ low-level tool, אבל אין project-level accessibility policy.
- אין claim על required target inventory.
- suppressions נהיים לא מנוהלים.

## Error codes

- `QA701` missing accessibility engine
- `QA702` missing WCAG target
- `QA703` unresolved accessibility target
- `QA704` unjustified suppression
- `QA705` no integration with existing a11y compiler

## Key invariant

**accessibility policy תקין מגדיר במפורש מה נסרק אוטומטית, מה נשאר ידני, ועל אילו surfaces החובה חלה.**

---

# 9. Security Testing, from QA perspective

## Compiler name

`qa_security_scan_policy`

## Spec file

`qa.security-scan.spec.json`

## Output artifact

- `security/zap.yaml` או scan config equivalent
- `.semgrep.yml` או ruleset refs
- `security/dependency-scan.config.json`
- `qa-artifacts/security-scan-policy.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

אוטומציית security regression ברמת QA:

- dependency scans
- lightweight DAST/web scans
- SAST rulesets לפרויקט
- fail thresholds
- environments and exclusions

## מה QA אחראי עליו מול Security Engineer

QA Engineer אחראי בדרך כלל על:

- לשלב scans אוטומטיים ב CI
- לוודא שהם deterministic ו actionable
- לכסות regressions נפוצים
- להחזיק policy סביב thresholds ו target inventory

Security Engineer אחראי בדרך כלל על:

- threat modeling
- pen tests
- architectural risk review
- policy exceptions משמעותיים
- vuln triage process ארגוני

## אילו כלים משמשים בתעשייה 2024-2025

- **OWASP ZAP**: packaged scans, automation framework ו API scan עבור OpenAPI/GraphQL/SOAP [R55][R56][R57].
- **npm audit**: scan של dependency tree עם `audit-level` ו non-zero exit codes [R58].
- **Snyk**: `snyk test` ו `snyk monitor`, עם `--severity-threshold` ו `--fail-on` [R59][R60][R61].
- **Dependabot alerts/security updates**: לא runner קלאסי ב CI, אבל שכבת visibility ו remediation ל dependencies [R62][R63].
- **Semgrep**: טוב מאוד ל blocking findings ב CI ו rulesets סטטיים [R64].

## Static gates

- **QA801 `scan_targets_declared`**: target URLs/services/routes מוגדרים.
- **QA802 `severity_thresholds_declared`**: מוגדר threshold ל dependency scan ול SAST/DAST.
- **QA803 `prod_active_scan_forbidden`**: active DAST על production אסור ללא `allowProdActiveScan=true`.
- **QA804 `openapi_target_resolves`**: אם משתמשים ב ZAP API scan, target resolve-able ל OpenAPI artifact.
- **QA805 `rulesets_pinned`**: ruleset IDs/versions של SAST מוגדרים.
- **QA806 `dependency_scanner_declared`**: לפחות scanner אחד מוגדר.
- **QA807 `scan_exclusions_justified`**: excludes מחייבים reason code.
- **QA808 `auth_scan_mode_declared`**: אם יש auth-required targets, policy מגדיר auth scan mode.

## אילו invariants/rules ניתן לאכוף statically

- אין security policy בלי severity threshold.
- אין active web scan על production כברירת מחדל.
- אין OpenAPI scan בלי OpenAPI artifact.
- אין ignore/exclude בלי justification.

## Cross-compiler dependencies

- `openapi-spec`
- `api-route`
- auth artifacts
- environment inventory/compiler אם קיים
- `qa_test_data_policy` בשביל scan accounts/test creds

## אילו cross-compiler checks הגיוניים

- כל public API surface ב `openapi-spec` חייב להיות מסווג security-scan class: passive / active / exempt.
- auth-required routes חייבים scan auth mode תקין.
- dependency manifests בחבילות frontend/backend חייבים להיות mapped ל dependency scan policy.

## Safe default

אם compiler זה חסר:

- אין claim על automated security regression.
- Dependabot/npm audit ad hoc אינם policy מלא.
- security quality נשארת best-effort ולא attested.

## Error codes

- `QA801` missing security scan targets
- `QA802` missing severity threshold
- `QA803` production active scan forbidden
- `QA804` unresolved OpenAPI scan target
- `QA805` unjustified exclusion

## Key invariant

**security QA policy תקין מגדיר אילו scans רצים על אילו surfaces, באילו סביבות, ובאיזה threshold הם חוסמים.**

---

# 10. Test Data Management

## Compiler name

`qa_test_data_policy`

## Spec file

`qa.test-data.spec.json`

## Output artifact

- `tests/factories/**/*.ts`
- `tests/fixtures/**/*.json`
- `tests/seeds/**/*.ts`
- `tests/snapshot-policy.json`
- `qa-artifacts/test-data-policy.manifest.json`

## מה הארטיפקט שה QA Engineer מייצר

policy שמגדיר:

- factories מול fixtures מול seeded DB
- isolation strategy
- clock/randomness determinism
- snapshot usage policy
- PII restrictions
- reset/cleanup ownership

## factories vs fixtures vs seeded DB

- **factories**: ברירת המחדל הטובה ביותר לרוב הבדיקות כי הן composable ו deterministic.
- **fixtures**: טובות לדוגמאות קפואות, protocols ו edge cases שקשה לייצר on demand.
- **seeded DB**: נחוצה בעיקר ל E2E/load/contract/provider-state preconditions.

## test isolation strategies

- `transaction_rollback`
- `truncate_between_tests`
- `fresh_db_per_suite`
- `worker_scoped_namespace`

אין strategy אחת נכונה תמיד. compiler policy טוב מחייב לבחור אחת לפי test class.

## PII in test data

policy בריא צריך להיות:

- **אסור להשתמש raw production data** כברירת מחדל.
- מותר רק אם יש anonymization pipeline, explicit approval ו lineage ברור.
- ב network פורמלי עדיף להתייחס ל production-derived data כ artifact נפרד עם provenance משלו.

## snapshot testing: מתי כן, מתי לא

כן:

- small stable serializations
- generated config output
- schema-normalized output
- HTML fragments קטנים ו deterministic

לא:

- large opaque trees
- dynamic timestamps/random IDs
- full API responses עם noise גבוה
- כתחליף ל behavioral assertions

Jest ו Vitest מתארים snapshots כ reference artifacts שצריך commit ולסקור, אך הם לא תחליף ל unit tests רגילים [R65][R66].

## Static gates

- **QA901 `data_strategies_declared`**: לכל test class יש data strategy מוגדרת.
- **QA902 `isolation_model_declared`**: לכל class יש isolation mode.
- **QA903 `pii_policy_declared`**: policy מפורש סביב production-derived data.
- **QA904 `seed_paths_valid`**: seed/factory paths resolve-ables.
- **QA905 `determinism_controls_declared`**: clock/random/id generators policy מוגדרת.
- **QA906 `snapshot_scope_declared`**: snapshot allowlist/denylist מוגדרת.
- **QA907 `snapshot_large_surface_forbidden`**: אסור snapshot על surface classes forbidden לפי policy.
- **QA908 `cleanup_owner_declared`**: מוגדר מי מאפס data אחרי test class.

## אילו invariants/rules ניתן לאכוף statically

- אין E2E/load tests בלי isolation/data strategy.
- אין snapshot policy implicit.
- אין שימוש ב production-derived data ללא declared approval path.
- factories/fixtures/seeds חייבים להיות מסווגים, לא מעורבבים אקראית.

## Cross-compiler dependencies

- `ts-schema`
- `db-migration`
- `api-route`
- `auth-middleware`
- `qa_e2e_flow_policy`
- `qa_contract_policy`
- `qa_load_profile`

## אילו cross-compiler checks הגיוניים

- provider states ב contract policy חייבים למפות ל seed/factory/data fixture ידועים.
- E2E flows עם roles/auth חייבים למפות ל identity fixtures קיימים.
- load profiles write-heavy חייבים isolation strategy non-destructive.
- public schemas שמייצרים sample data יכולים למפות ל factories.

## Safe default

אם compiler זה חסר:

- אין claim על test isolation.
- flaky/shared-state risk עולה משמעותית.
- downstream compilers רצים רק במצב best-effort.

## Error codes

- `QA901` missing data strategy
- `QA902` missing isolation model
- `QA903` production-derived data forbidden
- `QA904` snapshot scope undefined
- `QA905` unresolved seed/factory reference

## Key invariant

**test data policy תקין מבטיח שכל בדיקה רצה על data חוקי, deterministic ומבודד, ולא על state מקרי שנשאר מאחור.**

---

# Recommended dependency-ordered build plan

## Phase 0: Foundation

1. `qa_harness_config`
2. `qa_coverage_policy`
3. `qa_test_data_policy`

למה:

- בלי harness אין runtime
- בלי coverage policy אין measurement semantics
- בלי test data policy אין isolation semantics

## Phase 1: Product-surface verification

4. `qa_e2e_flow_policy`
5. `qa_visual_regression_policy`
6. `qa_accessibility_audit_policy`

למה:

- שלושת אלה נשענים על rendered product surfaces, routes, flows ו fixtures
- visual ו a11y policy נהיים הרבה יותר מדויקים אחרי שיש flow inventory

## Phase 2: Interface correctness across systems

7. `qa_contract_policy`

למה:

- הוא נשען על `openapi-spec`, `api-route`, auth ו data setup
- הוא מגדיר network-level compatibility ולא רק app-local correctness

## Phase 3: Non-functional enforcement

8. `qa_performance_budget`
9. `qa_load_profile`
10. `qa_security_scan_policy`

למה:

- performance ו load צריכים target inventory ברור
- security scans צריכים surface inventory, auth strategy ו env rules ברורים

## Topological graph

```text
qa_harness_config
├── qa_coverage_policy
├── qa_test_data_policy
└── qa_e2e_flow_policy
    ├── qa_visual_regression_policy
    └── qa_accessibility_audit_policy

qa_test_data_policy
├── qa_contract_policy
└── qa_load_profile

qa_e2e_flow_policy
├── qa_performance_budget
└── qa_security_scan_policy

openapi-spec + api-route
├── qa_contract_policy
├── qa_load_profile
└── qa_security_scan_policy
```

## מה הייתי בונה קודם בפועל

אם אתה רוצה מקסימום ROI בהתחלה:

1. `qa_harness_config`
2. `qa_test_data_policy`
3. `qa_e2e_flow_policy`
4. `qa_coverage_policy`
5. `qa_visual_regression_policy`
6. `qa_contract_policy`
7. `qa_performance_budget`
8. `qa_accessibility_audit_policy`
9. `qa_load_profile`
10. `qa_security_scan_policy`

הסיבה: בפועל, ב Domain Compiler Network, הערך הכי מיידי מגיע מיכולת לנסח user-flow coverage, data isolation ו deterministic execution. אחר כך מגיעות מדיניות מדידה ואכיפה נוספות.

---

# Design notes ל implementation של compilers

## צורת gate מומלצת

כל gate צריך להיות pure ככל האפשר, ולבדוק artifact קיים מול spec קיים ומול manifests של compilers אחרים.

מומלץ שכל compiler יפיק:

- runtime files
- normalized manifest
- `attestation.json`
- `errors.json`

## normalized manifest shape מומלצת

```json
{
  "compiler": "qa_e2e_flow_policy",
  "version": 1,
  "specHash": "sha256:...",
  "generatedAt": "2026-03-08T00:00:00.000Z",
  "claims": {
    "criticalRoutesCovered": ["/login", "/checkout"],
    "flows": ["login_flow", "checkout_happy_path"]
  },
  "dependencies": {
    "routing": "sha256:...",
    "auth": "sha256:..."
  },
  "warnings": [],
  "exemptions": []
}
```

## קו מנחה חשוב

QA compilers אצלך לא צריכים להיות "עוד דרך להריץ test command". הם צריכים להפוך את המושגים הבאים לארטיפקטים ניתנים להוכחה:

- מה נבדק
- מה לא נבדק
- מול איזה surface
- באיזה threshold
- על איזה data
- באיזה environment
- ועל סמך איזה dependencies

זה ההבדל בין test tooling רגיל לבין compiler network אמיתי.

---

# מקורות

- [R1] Playwright browsers and projects: https://playwright.dev/docs/browsers
- [R2] Playwright sharding: https://playwright.dev/docs/next/test-sharding
- [R3] Playwright trace viewer: https://playwright.dev/docs/trace-viewer-intro
- [R4] Playwright global setup and project dependencies: https://playwright.dev/docs/next/test-global-setup-teardown
- [R5] Vitest coverage config and thresholds: https://vitest.dev/config/coverage.html
- [R6] Vitest config, reporters and coverage behavior: https://v3.vitest.dev/config/
- [R7] Vitest expect.requireAssertions: https://vitest.dev/config/expect
- [R8] Jest configuration, coverageProvider and coverageThreshold: https://jestjs.io/docs/29.7/configuration
- [R9] Playwright test configuration and reporters: https://playwright.dev/docs/api/class-testconfig
- [R10] Playwright test use options for screenshot/video/trace: https://playwright.dev/docs/next/test-use-options
- [R11] Playwright videos: https://playwright.dev/docs/videos
- [R12] Playwright fixtures: https://playwright.dev/docs/test-fixtures
- [R13] MSW overview: https://mswjs.io/
- [R14] Vitest mocks and vi.spyOn: https://vitest.dev/api/mock
- [R15] Vitest mocking guide: https://vitest.dev/guide/mocking
- [R16] Cypress screenshots and videos: https://docs.cypress.io/app/guides/screenshots-and-videos
- [R17] Cypress cross-browser testing and parallelization: https://docs.cypress.io/app/guides/cross-browser-testing
- [R18] WebdriverIO visual testing: https://webdriver.io/docs/visual-testing/
- [R19] Playwright page object models: https://playwright.dev/docs/next/pom
- [R20] Vitest coverage guide, Istanbul vs V8: https://v3.vitest.dev/guide/coverage
- [R21] Vitest expect.hasAssertions: https://vitest.dev/api/expect
- [R22] Vitest expect.requireAssertions: https://vitest.dev/config/expect
- [R23] Playwright assertions: https://playwright.dev/docs/test-assertions
- [R24] Playwright best practices, web-first assertions: https://playwright.dev/docs/best-practices
- [R25] Lighthouse CI assertions: https://googlechrome.github.io/lighthouse-ci/docs/getting-started.html
- [R26] Size Limit overview: https://github.com/ai/size-limit
- [R27] webpack-bundle-analyzer: https://github.com/webpack/webpack-bundle-analyzer
- [R28] bundle-stats: https://github.com/relative-ci/bundle-stats
- [R29] Web Vitals overview and thresholds: https://web.dev/articles/vitals
- [R30] LCP threshold: https://web.dev/articles/lcp
- [R31] INP threshold: https://web.dev/articles/optimize-inp
- [R32] INP replaced FID in March 2024: https://web.dev/blog/inp-cwv-march-12
- [R33] k6 thresholds: https://grafana.com/docs/k6/latest/using-k6/thresholds/
- [R34] Artillery getting started and phases: https://www.artillery.io/docs/get-started/first-test
- [R35] Artillery test script reference: https://www.artillery.io/docs/reference/test-script
- [R36] Locust configuration: https://docs.locust.io/en/2.12.1/configuration.html
- [R37] Gatling assertions: https://docs.gatling.io/concepts/assertions/
- [R38] Pact provider verification guidance: https://docs.pact.io/provider
- [R39] Pact provider states: https://docs.pact.io/getting_started/provider_states
- [R40] Pact Broker can-i-deploy: https://docs.pact.io/pact_broker/can_i_deploy
- [R41] Pact Broker setup checklist: https://docs.pact.io/pact_broker/set_up_checklist
- [R42] Pact Broker overview and matrix: https://docs.pact.io/pact_broker/overview
- [R43] PactFlow bi-directional contract testing guide: https://docs.pactflow.io/docs/bi-directional-contract-testing/
- [R44] PactFlow tutorials using OpenAPI: https://docs.pactflow.io/docs/tutorials
- [R45] PactFlow OpenAPI Specification contracts: https://docs.pactflow.io/docs/bi-directional-contract-testing/contracts/oas/
- [R46] PactFlow OAS configuration and comparison engine: https://docs.pactflow.io/docs/bi-directional-contract-testing/contracts/oas/configuration/
- [R47] Chromatic test workflow: https://www.chromatic.com/docs/test
- [R48] Chromatic for Storybook quickstart: https://www.chromatic.com/docs/storybook
- [R49] Chromatic visual tests addon for Storybook: https://www.chromatic.com/docs/visual-tests-addon/
- [R50] Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- [R51] axe-core overview and coverage of WCAG issues: https://github.com/dequelabs/axe-core
- [R52] Storybook accessibility testing and axe-core addon: https://storybook.js.org/docs/writing-tests/accessibility-testing
- [R53] Pa11y CLI, standards and axe runner: https://github.com/pa11y/pa11y
- [R54] Lighthouse accessibility score: https://developer.chrome.com/docs/lighthouse/accessibility
- [R55] ZAP automation overview: https://www.zaproxy.org/docs/automate/
- [R56] ZAP API scan: https://www.zaproxy.org/docs/docker/api-scan/
- [R57] ZAP documentation index: https://www.zaproxy.org/docs/
- [R58] npm audit: https://docs.npmjs.com/cli/v9/commands/npm-audit/
- [R59] Snyk CI/CD test and monitor: https://docs.snyk.io/developer-tools/snyk-ci-cd-integrations/snyk-ci-cd-integration-deployment-and-strategies/snyk-test-and-snyk-monitor-in-ci-cd-integration
- [R60] Snyk severity thresholds: https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/set-severity-thresholds-for-cli-tests
- [R61] Snyk failing builds: https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/failing-of-builds-in-snyk-cli
- [R62] Dependabot alerts: https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts
- [R63] dependabot.yml: https://docs.github.com/en/code-security/concepts/supply-chain-security/about-the-dependabot-yml-file
- [R64] Semgrep blocking findings in CI: https://semgrep.dev/docs/semgrep-ci/configuring-blocking-and-errors-in-ci
- [R65] Jest snapshot testing: https://jestjs.io/docs/snapshot-testing
- [R66] Vitest snapshot guide: https://vitest.dev/guide/snapshot.html
