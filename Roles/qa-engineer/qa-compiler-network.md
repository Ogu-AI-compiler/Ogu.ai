# QA Engineering — Domain Compiler Network
## מחקר מעמיק לבניית QA Compilers

> **Tier:** Cross-cutting (מעל frontend / backend / shared)
> **פורמט כל gate:** `export async function run({ dir, projectRoot }) => { pass, code, message, detail? }`
> **Attestation:** `sha256(spec + timestamp)` לכל compiler output

---

## Overview — כמה Compilers לבנות ובאיזה סדר

### המלצה: 9 Compilers, 4 פאזות

הגיון הפירוק: QA compilers פועלים ב-**שתי רמות**:

1. **Policy compilers** — מגדירים מדיניות פרויקטלית (thresholds, budgets, rules)
2. **Attestation compilers** — מאמתים שהמדיניות נאכפת בפועל

```
פאז 0 — Config Foundation
  └── test-harness-config      (vitest/jest/playwright config policy)

פאז 1 — Quality Gates (parallel)
  ├── coverage-policy          (thresholds, gates, anti-cheating)
  ├── performance-budget       (CWV, bundle size, JS execution)
  └── accessibility-policy     (WCAG level, automated rules)

פאז 2 — Test Suites (parallel)
  ├── e2e-spec                 (user flows, page objects, isolation)
  ├── contract-test            (Pact consumer/provider)
  └── load-test-spec           (k6 scenarios, thresholds)

פאז 3 — Advanced Verification (parallel)
  ├── visual-regression        (baseline, thresholds, Storybook bridge)
  └── test-data-policy         (factories, PII, isolation strategy)
```

**סדר בנייה מנומק:**
- `test-harness-config` ראשון — כל compiler אחר מניח שהtest runner מוגדר
- `coverage-policy` לפני `e2e-spec` — coverage gates חלים גם על E2E
- `contract-test` דורש `openapi-spec` שכבר קיים — בנה אחרי backend compilers
- `visual-regression` דורש Storybook stories — בנה אחרי frontend compilers
- `test-data-policy` cross-cutting — חייב לפני כל test suite שנוגע ב-DB

---

## 1. `test_harness_config`

### Test Harness & Configuration Compiler

**Compiler name:** `test_harness_config`
**Spec file:** `qa/test-harness.spec.json`

```json
{
  "runner": "vitest",
  "environments": {
    "unit": "node",
    "component": "jsdom",
    "integration": "node"
  },
  "coverage": {
    "provider": "v8",
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["src/**/*.stories.*", "src/**/*.d.ts"]
  },
  "reporters": ["junit", "html", "lcov"],
  "globalSetup": "src/tests/setup/global.ts",
  "mockStrategy": "msw",
  "timeouts": {
    "unit": 5000,
    "integration": 30000,
    "e2e": 60000
  }
}
```

**Output artifact:** `vitest.config.ts` / `jest.config.ts` / `playwright.config.ts` (generated, validated)

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `runner-version-pinned` | גרסת test runner מוגדרת exact (`"vitest": "2.1.4"`, לא `"^2"`) |
| `coverage-provider-explicit` | `provider: "v8"` או `"istanbul"` — לא default ריק |
| `include-excludes-test-files` | `coverage.include` לא מכיל `*.test.*` או `*.spec.*` — test files לא מוזנות לcoverage |
| `reporters-contain-junit` | `reporters` כולל `"junit"` — נדרש לCI artifact ingestion |
| `timeout-per-environment` | כל environment מגדיר timeout — אין `timeout: 0` (infinite) |
| `global-setup-file-exists` | אם `globalSetup` מוגדר — הקובץ קיים בפועל בפרויקט |
| `mock-strategy-declared` | `mockStrategy` ∈ `{msw, jest.mock, vi.spyOn, manual}` — לא ריק |
| `no-only-in-config` | config לא כולל `testNamePattern` שמרמז על `.only` נשכח |
| `parallel-settings-explicit` | `pool` ו-`poolOptions` מוגדרים (לא default) — מונע flakiness מ-resource contention |
| `environment-vars-not-hardcoded` | config לא מכיל `process.env.DATABASE_URL = "..."` — env vars מוזרקים מ-outside |

---

### כלים בתעשייה 2024-2025

**Vitest** — הבחירה הדומיננטית לReact/TypeScript projects. מהיר פי 10 מ-Jest על HMR, native ESM support, browser mode ב-1.x. **Jest** נשאר נפוץ ב-legacy codebases ו-full-stack Node projects. **Playwright Test** — runner נפרד לE2E עם built-in parallelism.

**Istanbul vs V8 Coverage:**
- **Istanbul**: instruments source code (transforms AST) — מדויק יותר לbranch coverage, עובד עם כל transpiler
- **V8**: משתמש ב-Chrome's built-in coverage — מהיר יותר, אבל branch coverage פחות אמין לTypeScript decorated code
- **המלצה 2025**: V8 לunit tests (מהיר), Istanbul לcoverage reports שמוגשים לmanagement

**Mock Strategies:**
- **MSW (Mock Service Worker)** — gold standard לHTTP mocking. מיירט ברמת network layer, עובד גם ב-browser וגם ב-Node (v2+). מונע false-positives מ-mocked functions
- **`vi.spyOn`** — לunit tests שבודקים implementation details
- **`vi.mock` / `jest.mock`** — factory mocking, נדרש לmodule-level dependencies

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `tsconfig.json` | TypeScript compiler | `paths` aliases ב-tsconfig חייבים להיות מוגדרים גם ב-`moduleNameMapper` |
| `package.json` | project root | test runner packages קיימים ב-`devDependencies` |
| `env-config` artifact | backend compiler | env vars שנדרשים לtest environment מוגדרים ב-test env schema |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA001` | Test runner לא מוגדר בפרויקט (אין vitest/jest ב-devDependencies) |
| `QA002` | `coverage.include` ריק — coverage לא יחושב על שום קובץ |
| `QA003` | `globalSetup` מצביע לקובץ שלא קיים |
| `QA004` | Timeout מוגדר כ-0 או אינסופי על environment שאינו E2E |
| `QA005` | reporters לא כולל junit — CI לא יוכל לקרוא test results |

**Key invariant:**
> _הcompiler נכשל אם test runner לא מוגדר, או אם coverage provider לא explicit — כי כל gate אחר תלוי בהגדרות אלו_

---

### Safe Default (אם QA לא קיים)

ללא `test_harness_config`: כל developer מגדיר config בצורה שונה. אין coverage reports, אין JUnit artifacts לCI, timeouts שרירותיים. הtests רצים אבל שום gate לא נאכף. **תוצאה:** tests עוברים locally ונכשלים בCI בצורות בלתי צפויות.

---

## 2. `coverage_policy`

### Coverage Policy Compiler

**Compiler name:** `coverage_policy`
**Spec file:** `qa/coverage-policy.spec.json`

```json
{
  "global": {
    "lines": 80,
    "branches": 75,
    "functions": 80,
    "statements": 80
  },
  "perFile": {
    "src/lib/**/*.ts": { "lines": 90, "branches": 85 },
    "src/components/**/*.tsx": { "lines": 70 },
    "src/utils/**/*.ts": { "lines": 95 }
  },
  "excludeFromThresholds": [
    "src/**/*.stories.*",
    "src/**/*.mock.*",
    "src/types/**"
  ],
  "antiCheatingGates": {
    "requireAssertionsPerTest": true,
    "minAssertionsPerTest": 1,
    "forbidEmptyDescribe": true,
    "forbidSkippedTests": "warn"
  },
  "failBuildBelow": "global"
}
```

**Output artifact:** `coverage-thresholds.json` (injected into vitest.config), coverage gate configuration

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `global-thresholds-defined` | כל 4 סוגי coverage מוגדרים (`lines`, `branches`, `functions`, `statements`) |
| `branch-not-below-lines` | `branches` threshold ≤ `lines` threshold (branch coverage תמיד קשה יותר להשיג) |
| `per-file-not-exceed-100` | אף per-file threshold לא > 100 |
| `excluded-patterns-valid-glob` | כל pattern ב-`excludeFromThresholds` הוא valid glob — לא regex מוסתר |
| `critical-paths-higher-threshold` | `src/lib/**` ו-`src/utils/**` מוגדרים עם threshold גבוה מה-global (library code דורש יותר coverage) |
| `no-test-files-in-thresholds` | patterns ב-`perFile` לא מכוונים לקבצי test עצמם |
| `anti-cheating-assertions-required` | `requireAssertionsPerTest: true` — מונע tests שמריצים קוד ללא assertions |
| `fail-build-configured` | `failBuildBelow` ≠ `"none"` — אחרת coverage policy לא מבוצעת |

---

### Istanbul vs V8 — מתי להשתמש במה

**Istanbul:**
```
✓ TypeScript decorators (@Injectable, @Controller)
✓ Conditional compilation (/* istanbul ignore if */)
✓ Branch coverage לternary expressions
✓ Projects עם Babel transforms
✗ איטי יותר (~30% overhead)
✗ דורש instrumentation pass נפרד
```

**V8:**
```
✓ מהיר (native runtime coverage)
✓ דייקן ל-plain JS/TS ללא decorators
✓ משתלב ישיר עם Vitest
✗ Branch coverage בעייתי לTypeScript optional chaining (?.)
✗ פחות אמין עם source maps מורכבות
```

---

### Anti-Cheating Patterns שחייב לאכוף

אלו הpatterns הנפוצים ביותר שמעלים coverage מדומה:

```typescript
// ❌ Pattern 1: Test ללא assertions
it('should render component', () => {
  render(<MyComponent />);
  // אין expect() — coverage עולה, איכות אפס
});

// ❌ Pattern 2: expect(true).toBe(true)
it('loads data', async () => {
  await fetchData();
  expect(true).toBe(true); // assertion טריוויאלית
});

// ❌ Pattern 3: Coverage via side-effects
it('imports module', () => {
  require('./heavyModule'); // מריץ קוד רק לcoverage
  expect(1).toBe(1);
});

// ❌ Pattern 4: Snapshot ריק
it('renders', () => {
  const { container } = render(<A />);
  expect(container).toMatchSnapshot(); // snapshot של <div></div>
});
```

**Static detection:**
- `eslint-plugin-jest` rules: `expect-expect`, `no-standalone-expect`, `valid-expect`
- `vitest-plugin-coverage-validator` — custom plugin שסופר assertions per test
- AST analysis: חפש `it(` blocks שלא מכילים `expect(` בתוכם

---

### Coverage Gates בCI

```yaml
# GitHub Actions pattern
- name: Check Coverage
  run: vitest run --coverage
  env:
    COVERAGE_THRESHOLD_LINES: 80
    COVERAGE_THRESHOLD_BRANCHES: 75

# Fail condition — vitest exits non-zero automatically
# Additional gate: upload to Codecov with threshold
- name: Upload Coverage
  uses: codecov/codecov-action@v4
  with:
    fail_ci_if_error: true
    threshold: 80%
```

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `test-harness-config` output | `test_harness_config` | coverage provider תואם לmock strategy |
| `ts-schema` artifacts | backend/shared compiler | type-only files מוחרגים מcoverage (`*.d.ts`) |
| component list | frontend compiler | כל component file מופיע ב-`perFile` thresholds |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA010` | Global coverage threshold מתחת ל-60% — ערך לא ריאלי, מרמז על config שגוי |
| `QA011` | `branches` threshold גבוה מ-`lines` — לוגית בלתי אפשרי |
| `QA012` | Test file כולל תבנית cheating — test ללא assertions (static ESLint detection) |
| `QA013` | `failBuildBelow: "none"` — coverage policy מוגדרת אבל לא נאכפת |
| `QA014` | per-file threshold לנתיב שלא קיים בפרויקט — glob לא matches שום קובץ |

**Key invariant:**
> _הcompiler נכשל אם `failBuildBelow` הוא `"none"`, או אם branch threshold גבוה מline threshold — כי אלו מרמזים על policy שלא תיאכף לעולם_

---

## 3. `e2e_spec`

### E2E Specification Compiler

**Compiler name:** `e2e_spec`
**Spec file:** `qa/e2e.spec.json`

```json
{
  "framework": "playwright",
  "baseUrl": "${E2E_BASE_URL}",
  "userFlows": [
    {
      "id": "UF-001",
      "name": "user-registration",
      "routesCovered": ["/register", "/verify-email", "/onboarding"],
      "authState": "unauthenticated",
      "criticalPath": true
    },
    {
      "id": "UF-002",
      "name": "checkout-flow",
      "routesCovered": ["/cart", "/checkout", "/payment", "/confirmation"],
      "authState": "authenticated",
      "criticalPath": true
    }
  ],
  "pageObjects": true,
  "isolation": "per-test",
  "parallelization": {
    "workers": 4,
    "shards": 3
  },
  "failureArtifacts": {
    "screenshot": true,
    "video": "on-failure",
    "trace": "on-retry"
  },
  "retries": {
    "ci": 2,
    "local": 0
  },
  "slowTestThresholdMs": 30000
}
```

**Output artifact:** `playwright.config.ts`, page object templates, CI shard configuration

---

### Playwright vs Cypress vs WebdriverIO ב-2025

**Playwright (המלצה ברורה ב-2025):**
```
✓ Multi-browser: Chromium, Firefox, WebKit — אותו API
✓ Built-in parallelism + sharding
✓ Network interception מלא (route(), fulfill())
✓ Trace viewer — debugging חזותי
✓ Component testing (experimental אבל stable)
✓ Auto-wait (אין sleep(), אין waitFor() ידני)
✓ Mobile viewport emulation
✓ TypeScript first
```

**Cypress (עדיין רלוונטי):**
```
✓ DX מעולה לteam שמתחיל
✓ Real-time test runner UI
✓ Component testing mature
✗ Chromium-only (Firefox beta)
✗ Parallelism דורש Cypress Cloud (תשלום)
✗ Async handling מוזר (Promises + chainable)
✗ iframe support חלקי
```

**WebdriverIO:**
```
✓ W3C WebDriver standard (לא CDP)
✓ Mobile testing (Appium integration)
✗ Setup מורכב יותר
✗ Slower than Playwright
```

**מסקנה:** Playwright לכל project חדש. Cypress רק אם team כבר invested.

---

### Page Object Model ב-2025 — עדיין רלוונטי?

**כן, אבל בצורה שונה.** הPOM הקלאסי (class עם selectors) הוחלף ב-**Fixture-based POM**:

```typescript
// ❌ POM קלאסי — בעייתי
class LoginPage {
  private page: Page;
  constructor(page: Page) { this.page = page; }
  async login(email: string, password: string) {
    await this.page.fill('#email', email);
    // בעיה: selectors hardcoded, לא reusable
  }
}

// ✅ Playwright Fixtures POM — מומלץ 2025
const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  }
});

// ✅ Component Locators (Playwright recommendation)
class LoginPage {
  readonly emailInput = this.page.getByLabel('Email address');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly submitButton = this.page.getByRole('button', { name: 'Sign in' });
  // selectors מבוססי accessibility — לא CSS
}
```

**Static gate:** selectors בpage objects לא משתמשים ב-`#id` או `.class` — רק `getByRole`, `getByLabel`, `getByTestId`

---

### User Flows vs Pages

```
❌ Page-centric thinking:
  - "test the login page"
  - "test the dashboard page"

✅ Flow-centric thinking:
  - "user registers and verifies email" (spans /register → /verify → /onboarding)
  - "guest adds to cart and checks out" (spans /product → /cart → /checkout → /confirm)
```

**Compiler gate:** כל `userFlow` חייב לכסות לפחות 2 routes — single-page "flows" הם בעצם unit tests

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `all-routes-covered` | כל route ב-routing artifact מכוסה על ידי לפחות flow אחד |
| `critical-paths-defined` | לפחות flow אחד מסומן `criticalPath: true` |
| `selectors-are-accessible` | page objects לא משתמשים ב-`.class` / `#id` selectors |
| `isolation-strategy-defined` | `isolation` ∈ `{per-test, per-file, shared}` — לא ריק |
| `failure-artifacts-configured` | screenshot ו-video מוגדרים — לא optional בCI |
| `retries-ci-only` | `retries.local === 0` — local retries מסתירים flaky tests |
| `slow-test-threshold-defined` | `slowTestThresholdMs` מוגדר — alerts על tests שלוקחים יותר מדי |
| `baseUrl-uses-env-var` | `baseUrl` מכיל `${...}` — לא hardcoded URL |
| `no-hardcoded-credentials` | `userFlows` לא מכילים `password`, `token` כvalues |

---

### CI Integration Patterns

```yaml
# Sharding — E2E על 3 machines במקביל
strategy:
  matrix:
    shard: [1, 2, 3]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/3

# Merge reports after shards
  - run: npx playwright merge-reports ./all-blob-reports --reporter=html

# Retry flaky tests (CI only)
  - run: npx playwright test --retries=2

# Slow test detection
  - run: npx playwright test --reporter=json | jq '.suites[].specs[] | select(.duration > 30000)'
```

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `routing-artifact.json` | frontend routing compiler | כל route מכוסה בלפחות user flow אחד |
| `api-route` artifacts | backend compiler | כל API endpoint מופעל ע"י לפחות flow אחד |
| `auth-middleware` artifact | backend compiler | flows מסומנים `authenticated` בודקים שנדחה ללא auth |
| `openapi-spec` | backend compiler | E2E flows לא קוראים לendpoints שאינם ב-spec |
| `test-data-policy` output | `test_data_policy` | isolation strategy תואם לtest data strategy |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA020` | Route מ-routing artifact לא מכוסה בשום user flow |
| `QA021` | User flow מכסה רק route אחד — זה component test, לא E2E |
| `QA022` | Page object משתמש ב-CSS class selector |
| `QA023` | `baseUrl` מכיל hardcoded `localhost` — לא יעבוד בCI |
| `QA024` | אין flow מסומן `criticalPath: true` — לא ניתן לדעת מה לרוץ בpre-deploy gate |

**Key invariant:**
> _הcompiler נכשל אם יש route ב-routing artifact שלא מכוסה בשום user flow — E2E coverage חייב להיות exhaustive על critical paths_

---

## 4. `performance_budget`

### Performance Budget Compiler

**Compiler name:** `performance_budget`
**Spec file:** `qa/performance-budget.spec.json`

```json
{
  "coreWebVitals": {
    "LCP": { "good": 2500, "needsImprovement": 4000 },
    "CLS": { "good": 0.1, "needsImprovement": 0.25 },
    "INP": { "good": 200, "needsImprovement": 500 },
    "FCP": { "good": 1800 },
    "TTFB": { "good": 800 }
  },
  "bundleSizeBudgets": {
    "totalJS": { "maxBytes": 300000, "compressionAlgorithm": "gzip" },
    "totalCSS": { "maxBytes": 50000 },
    "perRoute": {
      "/": { "maxInitialJS": 150000 },
      "/dashboard": { "maxInitialJS": 200000 }
    },
    "perDependency": {
      "lodash": { "maxBytes": 10000, "note": "must use lodash-es with tree-shaking" }
    }
  },
  "lighthouseThresholds": {
    "performance": 85,
    "accessibility": 95,
    "bestPractices": 90,
    "seo": 85
  },
  "jsExecutionBudget": {
    "mainThread": { "maxMs": 3000 },
    "longTasks": { "maxCount": 5, "maxDurationMs": 50 }
  },
  "ciAction": "fail"
}
```

**Output artifact:** `lighthouserc.json`, `size-limit.config.js`, bundle size report

---

### Core Web Vitals — ערכי Threshold

| Metric | Good | Needs Improvement | Poor | מה מודד |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5s–4.0s | > 4.0s | זמן טעינת תוכן ראשי |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 | יציבות layout |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200–500ms | > 500ms | תגובתיות לאינטראקציה |
| **FCP** (First Contentful Paint) | ≤ 1.8s | 1.8–3.0s | > 3.0s | זמן תוכן ראשון |
| **TTFB** (Time to First Byte) | ≤ 800ms | 800ms–1.8s | > 1.8s | Server response time |

**שינוי 2024:** FID (First Input Delay) הוחלף ב-**INP** (Interaction to Next Paint) כ-Core Web Vital רשמי. INP מודד את כל האינטראקציות בדף, לא רק הראשונה.

---

### Bundle Size Budgets

```javascript
// size-limit.config.js (generated by compiler)
module.exports = [
  {
    name: 'Total JS (gzipped)',
    path: 'dist/**/*.js',
    limit: '300 kB',
    gzip: true
  },
  {
    name: 'Initial route (/)',
    path: 'dist/assets/index-*.js',
    limit: '150 kB',
    gzip: true
  },
  {
    name: 'lodash (must use ES modules)',
    path: 'node_modules/lodash-es/lodash.js',
    import: '{ debounce }',
    limit: '10 kB'
  }
];
```

**הכי נפוץ שמפוצץ budget:**
1. `moment.js` — 70kB gzipped (replace with `date-fns`)
2. `lodash` (CommonJS) — tree-shaking לא עובד
3. `@mui/icons-material` — barrel imports מכניסים כל icon
4. Images ללא optimization (WebP, AVIF)
5. Polyfills מיותרים (IE11 polyfills בprod)

---

### Lighthouse CI Integration

```yaml
# lighthouserc.json (generated)
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "url": ["http://localhost:3000", "http://localhost:3000/dashboard"],
      "settings": {
        "preset": "desktop",
        "throttlingMethod": "simulate"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1800}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "interactive": ["error", {"maxNumericValue": 5000}]
      }
    },
    "upload": {
      "target": "lhci",
      "serverBaseUrl": "${LHCI_SERVER_URL}"
    }
  }
}
```

**מה קורה כש-budget מפוצץ בCI:**
- `ciAction: "fail"` — build נכשל, PR לא merge-able
- `ciAction: "warn"` — build עובר, comment אוטומטי ב-PR עם regression details
- **המלצה:** `"fail"` לperformance + CLS. `"warn"` לLighthouse scores (יכולים להשתנות בגלל flakiness של measurement)

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `inp-not-fid` | spec לא מכיל `FID` — deprecated, מחליפים ב-`INP` |
| `lcp-threshold-realistic` | `LCP.good` ∈ [1000, 4000] — לא ערך שרירותי |
| `cls-is-decimal` | `CLS.good` < 1 (CLS הוא score, לא milliseconds) |
| `per-route-budgets-match-routes` | כל route ב-`perRoute` קיים ב-routing artifact |
| `gzip-compression-specified` | `compressionAlgorithm` ∈ `{gzip, brotli}` — לא raw bytes |
| `ci-action-not-none` | `ciAction` ≠ `"none"` — budget שלא נאכף הוא decoration |
| `lighthouse-runs-gte-3` | `numberOfRuns ≥ 3` — פחות מ-3 runs לLighthouse יוצר noisy results |
| `dependency-budgets-no-wildcards` | `perDependency` keys הם שמות package מדויקים, לא glob patterns |

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `routing-artifact.json` | frontend routing compiler | per-route budgets מוגדרים לכל route שקיים |
| `code-splitting` output | frontend compiler | bundle budgets ריאליסטיים — lazy-loaded routes לא בbudget הראשי |
| `cdn-config` artifact | DevOps compiler | compression algorithm תואם לCDN config |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA030` | `FID` מוגדר ב-spec — deprecated metric מ-2024 |
| `QA031` | `CLS` threshold הוא integer (למשל `1`) — CLS הוא decimal score |
| `QA032` | Route ב-`perRoute` budgets לא קיים ב-routing artifact |
| `QA033` | `ciAction: "none"` — budget מוגדר אבל לא נאכף |
| `QA034` | `numberOfRuns: 1` לLighthouse — single run לא אמין |

**Key invariant:**
> _הcompiler נכשל אם `ciAction` הוא `"none"` או אם `CLS` threshold הוא integer — אחד מרמז על policy לא נאכפת, השני על הבנה שגויה של המטריקה_

---

## 5. `load_test_spec`

### Load Test Specification Compiler

**Compiler name:** `load_test_spec`
**Spec file:** `qa/load-test.spec.json`

```json
{
  "tool": "k6",
  "scenarios": {
    "smoke": {
      "vus": 1,
      "duration": "30s",
      "thresholds": {
        "http_req_failed": ["rate<0.01"],
        "http_req_duration": ["p(95)<500"]
      }
    },
    "load": {
      "executor": "ramping-vus",
      "stages": [
        { "duration": "5m", "target": 100 },
        { "duration": "10m", "target": 100 },
        { "duration": "5m", "target": 0 }
      ],
      "thresholds": {
        "http_req_failed": ["rate<0.05"],
        "http_req_duration": ["p(95)<2000", "p(99)<5000"]
      }
    },
    "stress": {
      "executor": "ramping-vus",
      "stages": [
        { "duration": "5m", "target": 500 },
        { "duration": "5m", "target": 1000 }
      ],
      "thresholds": {
        "http_req_failed": ["rate<0.10"]
      }
    },
    "soak": {
      "executor": "constant-vus",
      "vus": 50,
      "duration": "4h",
      "thresholds": {
        "http_req_failed": ["rate<0.01"],
        "http_req_duration": ["p(95)<1000"]
      }
    }
  },
  "targetEnvironments": ["staging"],
  "outputArtifacts": ["summary-json", "influxdb-metrics"],
  "baselineComparison": true
}
```

**Output artifact:** `k6-scripts/*.js`, threshold configuration, CI integration script

---

### k6 vs Artillery vs Locust vs Gatling ב-2025

| כלי | שפת script | VUs model | CI integration | המלצה |
|---|---|---|---|---|
| **k6** | JavaScript/TypeScript | Goroutines (efficient) | Native, Cloud option | **בחירה ראשונה 2025** |
| **Artillery** | YAML + JS hooks | Node.js async | CLI + CI plugin | טוב לteams ללא כתיבת קוד |
| **Locust** | Python | Greenlets | Docker-friendly | מעולה לPython shops |
| **Gatling** | Scala DSL | Akka actors | Maven/Gradle | Java/enterprise |

**k6 יתרונות מכריעים ב-2025:**
- k6 Operator — runs load tests as K8s Job
- Built-in Web Dashboard
- **k6 Scenarios** — smoke/load/stress/soak בfile אחד
- TypeScript support (native עם bundler)
- `k6/experimental/browser` — browser-based load testing

---

### ה-4 סוגי Load Tests

| סוג | מטרה | VUs | משך | איפה רץ |
|---|---|---|---|---|
| **Smoke** | ולידציה בסיסית — האם מערכת עולה | 1–5 | 30s–2min | Pre-deploy hook |
| **Load** | בדיקת תחת עומס נורמלי/צפוי | 100–500 | 20–30min | Staging, Pre-release |
| **Stress** | מציאת breaking point | 500–5000+ | עד שנופל | Staging (planned) |
| **Soak** | memory leaks, DB connection leaks לאורך זמן | 50–100 | 4–24h | Staging (scheduled) |

---

### Output Artifacts שחייבים להישמר

```json
// k6 summary JSON (חייב להישמר per-run)
{
  "metrics": {
    "http_req_duration": {
      "p50": 145,
      "p95": 890,
      "p99": 1250,
      "max": 3400
    },
    "http_req_failed": { "rate": 0.002 },
    "vus_max": 100
  },
  "thresholds": {
    "http_req_duration": { "p(95)<2000": true },
    "http_req_failed": { "rate<0.05": true }
  },
  "timestamp": "2025-01-15T10:30:00Z",
  "gitCommit": "abc123",
  "environment": "staging"
}
```

**חייב לשמור:** summary JSON + git commit hash + environment. מאפשר baseline comparison בין runs.

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `smoke-scenario-required` | `scenarios.smoke` מוגדר — ה-minimal sanity check |
| `thresholds-per-scenario` | כל scenario מכיל `thresholds` — ללא thresholds load test לא נכשל |
| `error-rate-threshold-defined` | כל scenario מגדיר `http_req_failed` threshold |
| `p95-not-above-5s` | `p(95)` threshold ≤ 5000ms — ערך גבוה יותר לא מעשי |
| `staging-only-for-stress` | `stress` ו-`soak` scenarios מוגדרים רק ל-`targetEnvironments: ["staging"]` |
| `output-artifacts-defined` | `outputArtifacts` לא ריק — אחרת load test רץ ולא משאיר עקבות |
| `baseline-comparison-enabled` | `baselineComparison: true` — מאפשר regression detection |
| `vus-not-zero` | אף scenario לא מגדיר `vus: 0` |

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `openapi-spec` | backend compiler | כל endpoint ב-load test קיים ב-OpenAPI spec |
| `api-route` artifacts | backend compiler | load test לא קורא לendpoints שלא קיימים |
| `db-connection-pool` config | DevOps compiler | max VUs לא עולה על pool size (load test לא יכול לעבוד בפועל) |
| `rate-limiter` config | backend/DevOps | thresholds מתחשבים בrate limits — לא בודקים errors שנגרמים מrate limiting |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA040` | `scenarios.smoke` לא מוגדר |
| `QA041` | Scenario ללא `thresholds` — load test לא יכול לgfail |
| `QA042` | `production` מוגדר ב-`targetEnvironments` לscenario שאינו smoke |
| `QA043` | endpoint ב-load test script לא קיים ב-OpenAPI spec |
| `QA044` | `outputArtifacts` ריק — ריצת load test לא שמורה |

**Key invariant:**
> _הcompiler נכשל אם `scenarios.smoke` לא מוגדר, או אם יש scenario ללא `thresholds` — load test ללא thresholds הוא measurement, לא gate_

---

## 6. `contract_test`

### Contract Testing Compiler (Consumer-Driven)

**Compiler name:** `contract_test`
**Spec file:** `qa/contract-test.spec.json`

```json
{
  "tool": "pact",
  "broker": {
    "url": "${PACT_BROKER_URL}",
    "publishResults": true,
    "enablePending": true
  },
  "consumers": [
    {
      "name": "web-frontend",
      "provider": "user-api",
      "interactions": [
        {
          "description": "GET /users/:id returns user object",
          "request": { "method": "GET", "path": "/users/1" },
          "response": {
            "status": 200,
            "body": {
              "id": 1,
              "email": "user@example.com",
              "name": "Test User"
            }
          }
        }
      ]
    }
  ],
  "providerVerification": {
    "stateHandlers": true,
    "publishVerificationResults": true
  },
  "openApiValidation": {
    "enabled": true,
    "openApiSpec": "openapi.json"
  }
}
```

**Output artifact:** Pact files (`*.pact.json`), provider verification results, Pact Broker publication

---

### Pact — Consumer vs Provider

```
Consumer (frontend/BFF):
  1. כותב test שמגדיר ציפיות מה-API
  2. Pact יוצר mock server מהציפיות
  3. Test רץ נגד mock server
  4. .pact.json נשמר ומועלה ל-Pact Broker

Provider (backend API):
  1. קורא .pact.json מ-Pact Broker
  2. מריץ ולידציה שה-API עומד בציפיות
  3. מפרסם verification result
  4. "Can I Deploy" — שואל broker אם ריצה בטוחה
```

**Pact vs OpenAPI:**
- OpenAPI: מה ה-API *יכול* לעשות (documentation contract)
- Pact: מה ה-API *חייב* לעשות לconsumer ספציפי (runtime contract)
- **שניהם ביחד:** OpenAPI כ-documentation + Pact לverify שה-OpenAPI spec מוממש בפועל

**Cross-compilation gate חזק:**
```
כל Pact interaction חייב להתאים לOpenAPI spec —
אם Pact מצפה ל-{ id: number } אבל OpenAPI מגדיר { id: string },
זה contract conflict שחייב להיתפס statically
```

---

### Pact Broker — האם הכרחי?

| תרחיש | Broker נדרש? |
|---|---|
| Monorepo עם frontend + backend | לא הכרחי — pact files בrepo |
| Microservices נפרדים | **כן, הכרחי** |
| CI עם "Can I Deploy" checks | **כן, הכרחי** |
| Teams נפרדות | **כן, הכרחי** |

**PactFlow** (hosted Pact Broker) — מומלץ לproduction, SaaS עם RBAC.

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `interactions-match-openapi` | כל Pact interaction request/response תואם ל-OpenAPI spec |
| `provider-names-match-services` | `provider` names ב-consumers תואמים לservice names ב-architecture spec |
| `no-wildcard-matching` | interactions לא משתמשות ב-`.*` regex matching — too permissive |
| `state-handlers-defined` | אם provider states מוגדרים — `stateHandlers: true` |
| `broker-url-from-env` | `broker.url` מכיל `${...}` — לא hardcoded URL |
| `publish-results-true` | `publishResults: true` ו-`publishVerificationResults: true` — אחרת Pact Broker לא יודע status |
| `openapi-validation-enabled` | `openApiValidation.enabled: true` — Pact interactions validated against OpenAPI |

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `openapi-spec` | backend compiler | כל Pact interaction תואם לOpenAPI spec paths/schemas |
| `ts-schema` | backend/shared compiler | Response body schemas תואמים לZod types |
| `api-route` artifacts | backend compiler | Provider names תואמים לroute handler service names |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA050` | Pact interaction request לpathלא קיים ב-OpenAPI spec |
| `QA051` | Response body ב-Pact interaction לא תואם לOpenAPI response schema |
| `QA052` | `publishResults: false` — verification results לא יועלו לBroker |
| `QA053` | Provider name לא תואם לservice name ב-architecture |
| `QA054` | Interaction משתמשת ב-regex wildcard matching ב-request body |

**Key invariant:**
> _הcompiler נכשל אם יש Pact interaction שhttpמתנגשת עם OpenAPI spec — contract inconsistency בין frontend וbackend_

---

## 7. `visual_regression`

### Visual Regression Compiler

**Compiler name:** `visual_regression`
**Spec file:** `qa/visual-regression.spec.json`

```json
{
  "tool": "chromatic",
  "storybookBuildDir": "storybook-static",
  "thresholds": {
    "diffPixelCount": 50,
    "diffPercentage": 0.2
  },
  "approvalWorkflow": {
    "autoAcceptOnBranch": ["main"],
    "requireApprovalOnBranch": ["feature/*", "release/*"],
    "approvers": ["design-team"]
  },
  "skipStories": {
    "tags": ["skip-visual"],
    "patterns": ["*.loading*", "*.skeleton*"]
  },
  "viewports": [
    { "name": "mobile", "width": 375, "height": 812 },
    { "name": "tablet", "width": 768, "height": 1024 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "onlyChanged": true,
  "exitOnceUploaded": false
}
```

**Output artifact:** baseline snapshots, diff report, approval workflow configuration

---

### Chromatic vs Percy vs Playwright Screenshots ב-2025

| כלי | אינטגרציה | Baseline management | מחיר | המלצה |
|---|---|---|---|---|
| **Chromatic** | Storybook-first | Git branch-aware | Snapshots בחיוב | **לStorybook projects** |
| **Percy** | Framework-agnostic | Manual approve | Per snapshot | לprojects ללא Storybook |
| **Playwright Screenshots** | Built-in | Manual baseline | חינם | לtest-specific snapshots |
| **Loki** | Storybook + Docker | Git-based | חינם (self-hosted) | חלופה לChromatic |

**Chromatic יתרון מרכזי:** מבין את מבנה Storybook — רק stories ש*השתנו* בcommit הנוכחי נצלמות מחדש (`onlyChanged: true`). חוסך 80% מsnapshotים בכל run.

---

### Baseline Management

```
מי מאשר שינויים ויזואליים?

❌ כל developer — לא scaled, אין accountability
❌ אוטומטי תמיד — מחטיא regressions אמיתיים

✅ Design token changes → design team approves
✅ Component refactors → component owner approves
✅ New stories → auto-approve (אין baseline לcompare)
✅ Animation changes → manual review always
```

**Threshold שמומלץ:**
- `diffPercentage: 0.2` (0.2%) — מספיק רגיש לtextrendering differences, לא sensitiveמדי לanti-aliasing noise
- `diffPixelCount: 50` — ignore tiny anti-aliasing differences

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `storybook-build-dir-exists` | `storybookBuildDir` מצביע לdir שנוצר בbuild step |
| `all-stories-have-viewports` | כל story test רץ על כל viewport מוגדר |
| `skip-tags-documented` | כל story עם `skip-visual` tag מוסברת (comment בstory) |
| `threshold-not-zero` | `diffPercentage > 0` — 0% threshold = כל pixel change נכשל (בלתי אפשרי) |
| `approval-workflow-defined` | `requireApprovalOnBranch` לא ריק לfeature branches |
| `viewports-include-mobile` | לפחות viewport אחד עם `width ≤ 375` |
| `storybook-compiler-alignment` | כל component שיש לו Storybook story מופיע בvisual regression config |

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `storybook-story` artifacts | frontend compiler | כל story קיים ב-`storybookBuildDir` |
| `design-token` artifacts | frontend compiler | design token changes → auto-flag לapproval |
| `react-component` artifacts | frontend compiler | כל component שנשתנה מכוסה בvisual test |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA060` | `storybookBuildDir` לא קיים — visual tests לא יוכלו לרוץ |
| `QA061` | `diffPercentage: 0` — threshold בלתי ריאלי |
| `QA062` | Story מסומנת `skip-visual` ללא הסבר |
| `QA063` | אין viewport מוביל לwidth ≤ 375 — mobile לא נבדק |
| `QA064` | `approvalWorkflow` לא מוגדר לfeature branches — כל visual change עובר אוטומטית |

**Key invariant:**
> _הcompiler נכשל אם `diffPercentage: 0` (בלתי ריאלי) או אם approval workflow לא מוגדר לfeature branches — visual regressions חייבות לעבור review_

---

## 8. `accessibility_policy`

### Accessibility Policy Compiler

**Compiler name:** `accessibility_policy`
**Spec file:** `qa/accessibility-policy.spec.json`

```json
{
  "standard": "WCAG2.1",
  "level": "AA",
  "tools": {
    "automated": "axe-core",
    "ci": "axe-playwright",
    "reporting": "pa11y-ci"
  },
  "rules": {
    "critical": ["color-contrast", "label", "image-alt", "heading-order", "keyboard-navigation"],
    "serious": ["aria-roles", "form-field-multiple-labels"],
    "disabledRules": [],
    "customRules": []
  },
  "ciPolicy": {
    "failOn": ["critical", "serious"],
    "warnOn": ["moderate"],
    "ignoreOn": ["minor"]
  },
  "scope": {
    "includeRoutes": ["*"],
    "excludeRoutes": ["/admin/*"],
    "excludeSelectors": ["[data-a11y-exclude]"]
  },
  "manualCheckpoints": [
    "focus-trap-in-modals",
    "screen-reader-announcements",
    "keyboard-only-navigation"
  ]
}
```

**Output artifact:** axe-core configuration, Pa11y CI config, accessibility report schema

---

### axe-core vs Pa11y vs Lighthouse a11y

| כלי | מה בודק | Integration | False positive rate |
|---|---|---|---|
| **axe-core** | DOM violations + ARIA | Jest/Playwright/React | נמוך |
| **Pa11y** | WCAG rules + custom | CLI + CI | בינוני |
| **Lighthouse a11y** | Subset של axe-core | Chrome DevTools + CI | נמוך |

**המלצה:** axe-core לunit/component tests + Pa11y CI לfull-page scans. Lighthouse לreporting.

---

### מה נבדק Automatically vs Manually

**אוטומטי (axe-core מכסה ~35% מWCAG AA):**
- Color contrast ratios
- Alt text על images
- Form label associations
- ARIA role validity
- Heading hierarchy (h1 → h2 → h3)
- Focus indicator presence
- Language attribute
- Skip navigation links

**ידני (לא ניתן לautomation):**
- Focus trap בmodals ו-dialogs
- Screen reader announcements (VoiceOver, NVDA)
- Keyboard-only navigation flow
- Meaningful link text ("click here" vs "Read article about...")
- Error messages association
- Cognitive load assessment

**הקשר ל-a11y-test compiler קיים:**
הcompiler הקיים פועל ברמת component. `accessibility_policy` compiler פועל ברמת project:
- מגדיר **אילו rules** חלות
- מגדיר **אילו routes** נסרקות
- מגדיר **policy** (fail vs warn per severity)
- מחיל את `manualCheckpoints` כ-required test cases שחייבים להיכתב

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `wcag-level-defined` | `level` ∈ `{A, AA, AAA}` |
| `critical-rules-not-empty` | `rules.critical` לא ריק — יש לפחות critical rule אחת |
| `fail-on-critical` | `ciPolicy.failOn` כולל `"critical"` — critical violations חייבות לנכשל |
| `no-disabled-rules-without-justification` | `disabledRules` ריק, או כל entry מכיל `reason` field |
| `manual-checkpoints-defined` | `manualCheckpoints` לא ריק — יש לפחות 3 manual checks |
| `all-routes-included` | `scope.includeRoutes` כולל `"*"` או מכסה את כל routes מ-routing artifact |
| `exclude-selectors-documented` | כל selector ב-`excludeSelectors` מוסבר |

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `routing-artifact.json` | frontend routing compiler | כל route ב-includeRoutes קיים בפועל |
| `a11y-test` compiler output | existing compiler | policy זו עולה בקנה אחד עם existing axe-core rules |
| `react-component` artifacts | frontend compiler | כל interactive component מכוסה בa11y scan |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA070` | `ciPolicy.failOn` לא כולל `"critical"` — critical violations לא מנכשלות CI |
| `QA071` | Rule ב-`disabledRules` ללא `reason` field |
| `QA072` | `manualCheckpoints` ריק — אין תיעוד של manual checks הנדרשים |
| `QA073` | `standard: "WCAG1.0"` — deprecated standard |
| `QA074` | `scope.excludeRoutes` מכיל route שמכסה > 20% מהapplication |

**Key invariant:**
> _הcompiler נכשל אם `ciPolicy.failOn` לא כולל `"critical"` — critical a11y violations חייבות לנכשל build_

---

## 9. `test_data_policy`

### Test Data Policy Compiler

**Compiler name:** `test_data_policy`
**Spec file:** `qa/test-data-policy.spec.json`

```json
{
  "isolationStrategy": "per-test-transaction-rollback",
  "dataStrategy": "factories",
  "factoryFramework": "fishery",
  "seeding": {
    "required": true,
    "seedFile": "src/tests/seed/base.seed.ts",
    "deterministicSeed": 42
  },
  "piiPolicy": {
    "productionDataForbidden": true,
    "syntheticDataRequired": true,
    "piiFields": ["email", "phone", "ssn", "creditCard", "ipAddress"],
    "maskingStrategy": "faker-with-fixed-seed"
  },
  "snapshotPolicy": {
    "allowedFor": ["pure-functions", "static-config", "api-response-shapes"],
    "forbiddenFor": ["database-records", "timestamps", "generated-ids", "external-api-responses"],
    "maxSnapshotSizeBytes": 5000
  },
  "parallelismSafety": {
    "dbIsolation": true,
    "redisIsolation": true,
    "prefixStrategy": "test-{uuid}"
  }
}
```

**Output artifact:** factory base configuration, test isolation middleware, PII audit report

---

### Isolation Strategies — מה לבחור

| Strategy | מהירות | Isolation | Use case |
|---|---|---|---|
| **Transaction rollback** | 🟢 מהיר | 🟢 מצוין | Unit + integration tests |
| **Truncate per test** | 🟡 בינוני | 🟢 מצוין | E2E tests |
| **Fresh DB per test** | 🔴 איטי | 🟢 מושלם | לא מעשי לunits |
| **Shared DB + cleanup** | 🟢 מהיר | 🔴 גרוע | Anti-pattern |

**Transaction Rollback Pattern (מומלץ לintegration tests):**
```typescript
// setup.ts
beforeEach(async () => {
  await db.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await db.$executeRaw`ROLLBACK`;
});
// כל test רץ בתוך transaction שלעולם לא מתcommit
```

---

### PII בTest Data

**כלל ברזל:** אין production data בtest environments — לא מסיבות privacy בלבד, אלא גם:
1. Production data משתנה — tests הופכים flaky
2. Production data מכיל edge cases שלא תמיד רצויים בunit tests
3. GDPR/compliance — PII חייב להיות ב-controlled environments בלבד

**Faker עם seed קבוע:**
```typescript
import { faker } from '@faker-js/faker';
faker.seed(42); // deterministic — אותו run = אותם values

const userFactory = Factory.define<User>(() => ({
  email: faker.internet.email(),    // "Lola_Hirthe@example.com" — תמיד אותו
  phone: faker.phone.number(),      // "+1-555-234-5678" — תמיד אותו
  ssn: '***-**-****',               // NEVER use faker.ssn() — synthetic SSN נראה ריאלי
}));
```

---

### Snapshot Testing — מתי כן, מתי לא

**כן לsnapshots:**
```typescript
// ✅ Pure function output
expect(formatCurrency(1000, 'USD')).toMatchSnapshot();
// → "$1,000.00"

// ✅ Static config shape
expect(getDefaultConfig()).toMatchSnapshot();

// ✅ API response structure (לא values)
expect(Object.keys(apiResponse)).toMatchSnapshot();
```

**לא לsnapshots:**
```typescript
// ❌ Database records — IDs ו-timestamps משתנים
expect(await db.user.findMany()).toMatchSnapshot();

// ❌ Components עם dynamic content
expect(render(<UserProfile />).container).toMatchSnapshot();

// ❌ External API responses — משתנים בזמן
expect(await stripe.listProducts()).toMatchSnapshot();

// ❌ Snapshots גדולים מ-5KB
// → קשה לreview ב-PR, מסתירים שינויים אמיתיים
```

---

### Static Gates

| Gate | מה בודק |
|---|---|
| `isolation-strategy-defined` | `isolationStrategy` ∈ set of valid strategies |
| `pii-production-forbidden` | `piiPolicy.productionDataForbidden: true` |
| `pii-fields-comprehensive` | `piiFields` כולל לפחות: email, phone, ssn |
| `snapshot-forbidden-list-not-empty` | `snapshotPolicy.forbiddenFor` לא ריק |
| `snapshot-size-limit-defined` | `maxSnapshotSizeBytes` > 0 ו- ≤ 10000 |
| `factory-framework-specified` | `factoryFramework` ∈ `{fishery, factory-bot, rosie}` |
| `deterministic-seed-defined` | `seeding.deterministicSeed` הוא integer (לא undefined) |
| `parallelism-isolation-enabled` | `parallelismSafety.dbIsolation: true` אם tests רצים parallel |

---

### Cross-Compiler Dependencies

| Artifact נדרש | מאיפה | מה בודקים |
|---|---|---|
| `ts-schema` | backend/shared compiler | כל entity ב-schema מכוסה בfactory |
| `db-migration` artifacts | backend compiler | factory fields תואמים לDB schema columns |
| `db-seed` artifacts | DevOps compiler | base seed file תואם ל-factory definitions |
| `e2e-spec` | `e2e_spec` compiler | isolation strategy תואם לE2E test isolation requirements |

---

### Error Codes

| Code | משמעות |
|---|---|
| `QA080` | `piiPolicy.productionDataForbidden: false` — production PII permitted בtest data |
| `QA081` | `snapshotPolicy.forbiddenFor` ריק — כל snapshot type מותר |
| `QA082` | `snapshotPolicy.maxSnapshotSizeBytes > 10000` — snapshots גדולים מדי |
| `QA083` | `isolationStrategy: "shared-db"` — anti-pattern |
| `QA084` | `seeding.deterministicSeed` לא מוגדר — seed לא deterministic |

**Key invariant:**
> _הcompiler נכשל אם `piiPolicy.productionDataForbidden` הוא `false`, או אם `isolationStrategy` הוא `"shared-db"` — אלו anti-patterns שגורמים לflaky tests וcompliance violations_

---

## Cross-Compiler Dependency Matrix

```
test_harness_config
    │
    ├──► coverage_policy
    │       │
    │       └──► e2e_spec ◄── routing-artifact (frontend)
    │                 │          api-route (backend)
    │                 │          auth-middleware (backend)
    │                 │
    │       ┌─────────┘
    │       │
    ├──► performance_budget ◄── routing-artifact
    │                           code-splitting (frontend)
    │
    ├──► accessibility_policy ◄── routing-artifact
    │                              a11y-test (existing)
    │
    ├──► contract_test ◄── openapi-spec (backend)
    │                       ts-schema (shared)
    │
    ├──► load_test_spec ◄── openapi-spec (backend)
    │                        rate-limiter (DevOps)
    │
    ├──► visual_regression ◄── storybook-story (frontend)
    │                           design-token (frontend)
    │
    └──► test_data_policy ◄── ts-schema (shared)
                               db-migration (backend)
                               e2e_spec
```

---

## Error Code Registry — כל QA Compilers

| Range | Compiler |
|---|---|
| QA001–QA009 | `test_harness_config` |
| QA010–QA019 | `coverage_policy` |
| QA020–QA029 | `e2e_spec` |
| QA030–QA039 | `performance_budget` |
| QA040–QA049 | `load_test_spec` |
| QA050–QA059 | `contract_test` |
| QA060–QA069 | `visual_regression` |
| QA070–QA079 | `accessibility_policy` |
| QA080–QA089 | `test_data_policy` |

---

## Safe Defaults — מה קורה בלי QA Compilers

| Compiler | בלעדיו |
|---|---|
| `test_harness_config` | כל developer בוחר config שרירותי. Coverage לא מדווח. CI לא מקבל JUnit artifacts |
| `coverage_policy` | Coverage נמדד אבל לא נאכף. Anti-cheating patterns עוברים undetected |
| `e2e_spec` | Routes חדשות מתווספות ללא E2E coverage. Regressions בuser flows מתגלים בproduction |
| `performance_budget` | Bundle size גדל בלי התראה. Core Web Vitals מידרדרים בהדרגה |
| `load_test_spec` | מערכת לא נבדקת תחת עומס. Breaking point לא ידוע לפני production |
| `contract_test` | Frontend עובד נגד mock שאינו מייצג את ה-API האמיתי. Breaking changes לא מתגלים עד deploy |
| `visual_regression` | CSS regressions עוברים unnoticed. Design token changes שוברים components לא-מצופים |
| `accessibility_policy` | a11y violations מצטברים. Legal risk (ADA compliance). Users עם disabilities blocked |
| `test_data_policy` | Flaky tests עקב shared state. PII exposure risk. Snapshots גדולים מסתירים regressions |

---

## בניית Gate Function — דוגמה

```typescript
// coverage_policy/gates/branch-not-below-lines.gate.ts
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir, projectRoot }: { dir: string; projectRoot: string }) {
  const specPath = join(dir, 'qa/coverage-policy.spec.json');

  let spec: CoveragePolicySpec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf-8'));
  } catch {
    return {
      pass: false,
      code: 'QA010',
      message: 'coverage-policy.spec.json not found or invalid JSON',
    };
  }

  const { lines, branches } = spec.global;

  if (branches > lines) {
    return {
      pass: false,
      code: 'QA011',
      message: `branches threshold (${branches}) cannot exceed lines threshold (${lines})`,
      detail: {
        branches,
        lines,
        reason: 'Branch coverage is always harder to achieve than line coverage',
        fix: `Set branches ≤ ${lines}`,
      },
    };
  }

  return { pass: true, code: 'QA011', message: 'Branch threshold is valid' };
}
```

---

*Domain Compiler Network — QA Engineering Tier · 9 Compilers · Cross-cutting Layer*
