# פירוק תפקיד מפתח פרונטאנד לרשת קומפיילרים דומייניים

## הקשר והגדרות תפעוליות

### מה כבר קיים ברשת הקומפיילרים ומה מוחרג
ברשת כבר קיימים קומפיילרים למשימות הבאות, ולכן הן אינן נכללות ברשימת סוגי המשימות להלן: `react-component`, `react-form`, `react-hook`, `react-page`, `ts-schema`, `api-route`, `auth-middleware`, `db-migration`.

במקום זאת, הדו"ח מפרק את שאר העבודה שמפתח פרונטאנד מבצע בפועל במערכת מודרנית המבוססת React, TypeScript, Router מודרני, Tailwind, ניהול state, וניהול server-state. ההנחה היא שקיימת אפשרות לבנות קומפיילרים ייעודיים שמייצרים ארטיפקטים קונקרטיים עם בדיקות נכונות אוטומטיות.

### מה זה correctness gate ולמה זה חשוב
Correctness gate היא בדיקה בינארית ואוטומטית: עוברת או נכשלת. היא חייבת להיות מיתרגמת לכלל בדיקה סטטית או דינמית שאפשר להריץ ללא שיפוט אנושי.

דוגמה לבדיקת gate טובה: ״לכל שדה קלט שמקבל אינטראקציה חייב להיות שם נגיש, ועדיפות ל label מקושר״. זו דרישה שאפשר לבדוק באמצעות lint, בדיקות DOM, או engine כמו axe. citeturn0search2turn0search15turn5search16turn10search7  
דוגמה ל gate לא טובה: ״נראה טוב״ או ״ה UX סבבה״, כי אין קריטריון בינארי.  

חשוב גם לציין שבתקני נגישות, הקריטריונים מנוסחים כStatements שניתנים לבדיקה, מה שמתיישב היטב עם רשת קומפיילרים שמחייבת gates אוטומטיים. citeturn2search5

### תדירות כמפתח לתיעדוף
כל סוג משימה מסווג לאחת משלוש תדירויות: `daily`, `per-feature`, `per-project`. הרציונל: לבנות קומפיילרים למשימות `daily` ראשונות, אבל בפועל חלק מהן תלויות בקומפיילרי יסוד `per-project`, ולכן סדר הבנייה בסוף הדו"ח מאזכר גם תלויות.

## טבלת סוגי משימות

הטבלה מסודרת לפי תדירות: daily ואז per-feature ואז per-project. עמודות הקלט והפלט הן תמציתיות, הפירוט המלא מיד אחריה.

| שם משימה | תדירות | קלט טיפוסי | פלט טיפוסי |
|---|---|---|---|
| `tanstack-query-query-module` | daily | חוזה API, פרמטרים, טיפוסי response, מדיניות cache | `src/**/queries/*.query.ts` |
| `tanstack-query-mutation-module` | daily | חוזה API ל write, טיפוסי payload, מדיניות invalidation | `src/**/mutations/*.mutation.ts` |
| `tanstack-query-invalidation-map` | daily | רשימת queries להשפעה, אירועי דומיין, כללי refetch | `src/lib/server-state/invalidation.ts` |
| `swr-resource-module` | daily | key, fetcher spec, מדיניות revalidation | `src/**/swr/*.ts` |
| `zustand-slice-module` | daily | מודל state מקומי, פעולות, persist policy | `src/**/state/*.zustand.ts` |
| `redux-slice-module` | daily | מודל state, reducers, actions, selectors | `src/**/state/*.slice.ts` |
| `url-searchparams-contract` | daily | רשימת פרמטרים, defaulting, parse/serialize rules | `src/lib/routing/searchParams/*.ts` |
| `react-router-route-module` | daily | נתיב, params, lazy boundary, error UI policy | `src/lib/routing/routes/*.ts` |
| `navigation-config-entry` | daily | route יעד, הרשאות, label i18n, אייקון | `src/lib/navigation/nav.ts` |
| `i18n-message-entry` | daily | מחרוזת מקור, key, הקשר, placeholders | `src/locales/*/*.json` |
| `i18n-namespace-file` | daily | namespace חדש, רשימת keys, fallback | `src/locales/*/<ns>.json` |
| `analytics-event-module` | daily | שם אירוע, payload shape, triggers | `src/lib/analytics/events.ts` |
| `feature-flag-definition` | daily | שם flag, סוג flag, תנאי הדלקה, ברירות מחדל | `src/lib/flags/flags.ts` |
| `experiment-variant-wrapper` | daily | experiment id, variants, allocation, exposure event | `src/lib/experiments/*.tsx` |
| `error-boundary-wrapper` | daily | scope, fallback UI, report hook, retry policy | `src/lib/errors/ErrorBoundary.tsx` |
| `loading-skeleton-module` | daily | שלד UI, רמות צפיפות, tokens, RTL | `src/lib/loading/*.tsx` |
| `motion-preset-module` | daily | תיאור אנימציה, duration, easing, reduced-motion | `src/lib/motion/presets.ts` |
| `unit-test-module` | daily | spec התנהגות, מצבי קצה, mocks, selectors | `src/**/__tests__/*.test.tsx` |
| `a11y-test-module` | daily | קומפוננטה/סטורי יעד, חריגים מותרים, WCAG focus rules | `src/**/__tests__/*.a11y.test.tsx` |
| `storybook-story-module` | daily | קומפוננטה, states, args, play steps | `src/**/**/*.stories.tsx` |
| `security-safe-html-module` | daily | מקור HTML, מדיניות sanitization, allowed tags | `src/lib/security/safeHtml.tsx` |
| `route-resilience-bundle` | per-feature | segment/route, מדיניות not-found, loading, error | `app/**/loading.tsx`, `app/**/error.tsx`, `app/**/not-found.tsx` או מודול route |
| `client-route-guard` | per-feature | כלל הרשאה, מקור session, redirect יעד | `src/lib/routing/guards/*.tsx` |
| `feature-module-scaffold` | per-feature | שם פיצר, גבולות מודול, exports ציבוריים | `src/features/<feature>/**` |
| `design-tokens-and-tailwind-theme` | per-project | token set, naming rules, צבעים, טיפוגרפיה, ספייסינג | `src/styles/tokens.json`, `src/styles/theme.css` |
| `providers-scaffold` | per-project | בחירת libs, init options, סדר providers | `src/app/providers.tsx` או `src/main.tsx` |
| `testing-harness-config` | per-project | runner, environment, setupFiles, ts types | `vitest.config.ts`, `src/test/setup.ts` |
| `storybook-harness-config` | per-project | story globs, addons, builders, TS config | `.storybook/main.ts`, `.storybook/preview.ts` |
| `a11y-harness-config` | per-project | axe integration, סף שגיאות, storybook addon | `src/test/a11y.ts`, `.storybook/main.ts` |

## משימות יומיומיות

### `tanstack-query-query-module`

**תדירות:** daily (כמעט כל פיצר חדש מוסיף לפחות query אחד ל server-state).

**קלט:**  
Spec שמכיל לפחות: `resourceName`, `params` (אופציונלי), `responseType` או reference ל `ts-schema`, `fetch contract` (URL/endpoint abstraction), `caching policy` (staleTime, gcTime), ו namespace פיצרי.

**פלט:**  
קובץ מודול query, למשל:  
`src/features/<feature>/queries/<resource>.query.ts`  
בפרויקטים רבים זה יכלול export של: `queryKeyFactory`, `fetchFn`, ו wrapper hook לשימוש אחיד.

**Correctness gates:**  
- `queryKey` הוא מערך ברמת top-level, וכולל את כל פרמטרי הבקשה שמשנים את תוצאת ה data, כדי למנוע התנגשות cache. ניתן לבדוק זאת מול spec של הפרמטרים. citeturn0search6  
- `queryKey` סריאליזבילי וללא פונקציות או ערכים לא יציבים. בדיקה סטטית יכולה לאסור types מסוימים בפרמטרים או לכפות JSON-serializable. citeturn0search6  
- קיימת עקביות naming: exports מינימליים ומוגדרים מראש (`<resource>QueryKey`, `<resource>QueryOptions`, וכו) כדי לאפשר צרכנים במורד הזרם לעבוד ללא reflection.  
- הפונקציה שמבצעת fetch מחזירה `Promise<ResponseType>` ותואמת לטיפוסים (typecheck).  
- אם יש `enabled`/guard ל query, הוא נגזר חד משמעית מנוכחות פרמטרים חובה, ולא נשאר תמיד true כשהפרמטר חסר (כדי למנוע קריאות עם undefined).  
- אם מוגדרים retries או error mapping, הם מתואמים למדיניות שגיאות אפליקטיבית (למשל הבחנה בין 404 לבין 500), וניתנים לבדיקה באמצעות unit tests ייעודיים.

**תלויות:**  
`providers-scaffold` (כדי שקיים QueryClientProvider), וכן קונבנציות query key אחידות. citeturn11search4turn12search4  
לעיתים, תלות ב `ts-schema` עבור טיפוסי בקשה ותשובה.

**צרכנים בהמשך:**  
`react-page` ו `react-component` (טוענים data), `tanstack-query-invalidation-map` (refetch), `a11y-test-module` (מצבי טעינה ושגיאה), ו `analytics-event-module` (מדידת latency או errors לפי צורך).

### `tanstack-query-mutation-module`

**תדירות:** daily (כל פעולה שמעדכנת שרת: create/update/delete).

**קלט:**  
Spec שמכיל: `mutationName`, `input payload type`, `response type`, `side effects` (איזה queries מתיישנים), ומדיניות optimistic update אם נדרש.

**פלט:**  
`src/features/<feature>/mutations/<mutation>.mutation.ts`  
כולל `mutationFn` ו hooks/utility לשימוש אחיד.

**Correctness gates:**  
- למוטציה יש רשימת invalidation מפורשת של query keys או key factories שמושפעים, או החלטה מפורשת "no invalidation" עם סיבה שניתנת לאכיפה (למשל פעולה שלא משנה state). בדיקת gate יכולה לאסור מוטציה ללא invalidationSpec. citeturn12search0turn12search4  
- אם יש optimistic update, מוגדר rollback data שמועבר דרך `onMutate` ונצרך ב `onError` או `onSettled`. ניתן לבדוק שקיימת פונקציית rollback ושנעשה שימוש עקבי. citeturn12search1turn12search5  
- handlers (`onSuccess`, `onError`, `onSettled`) לא תלויים בהנחה שהקומפוננטה עדיין mounted, או שיש מדיניות שמגדירה מה קורה כאשר ה UI נעלם. citeturn12search7  
- הטיפוסים של payload ותשובה תואמים, ואין any.  
- אם המוטציה מעלה error מפורמט, קיים normalization אחיד שמחזיר מבנה error צפוי (למשל `DomainError`), כדי ש UI יוכל למפות הודעות.

**תלויות:**  
`providers-scaffold` (QueryClient), `tanstack-query-query-module` (כדי שיהיו query keys targets), ולעיתים `analytics-event-module` (לוג אירוע success/fail).

**צרכנים בהמשך:**  
`tanstack-query-invalidation-map`, UI components, וטסטים שמוודאים invalidation והתנהגות optimistic.

### `tanstack-query-invalidation-map`

**תדירות:** daily (מתעדכן כמעט בכל מוטציה משמעותית).

**קלט:**  
Spec של `domain events` כגון `UserUpdated`, `CartItemAdded`, ומיפוי אילו query keys צריכים invalidate או refetch.

**פלט:**  
`src/lib/server-state/invalidation.ts` or `src/lib/server-state/invalidationMap.ts`  
מבנה שמרכז מדיניות invalidation, כדי למנוע פיזור קריאות invalidate בכל קוד ה UI.

**Correctness gates:**  
- כל event דומיין מוצהר ממופה לפחות לפעולה אחת: invalidateQueries או setQueryData או no-op מוצהר. citeturn12search4  
- אין הפניות ל query keys שאינם קיימים במערכת (בדיקה סטטית מול registry של query keys).  
- אין invalidation גורף מדי לפי prefix שלא עומד במדיניות (למשל invalidate של כל cache על כל שינוי), אלא אם spec מאשר זאת.

**תלויות:**  
`tanstack-query-query-module` (קיומם של keys), `tanstack-query-mutation-module` (מייצר events), ו `providers-scaffold` (QueryClient).

**צרכנים בהמשך:**  
כל מוטציה ו flows מורכבים, וגם `unit-test-module` שמאמת שהאינבלידציה פוגעת בדיוק ב queries הנכונים.

### `swr-resource-module`

**תדירות:** daily (בפרויקטים שבוחרים SWR כ server-state).

**קלט:**  
Spec שמכיל: `key` (כולל פרמטרים), `fetcher`, ותצורת revalidation (revalidateOnFocus, dedupe, fallbackData).

**פלט:**  
`src/features/<feature>/swr/<resource>.ts`  
כולל wrapper אחיד סביב `useSWR` ולעיתים helper ל `mutate`.

**Correctness gates:**  
- key הוא ייחודי לנתונים ומכיל את הפרמטרים שמשנים את התשובה, כדי למנוע שיתוף cache שגוי. citeturn11search18turn12search6  
- מנגנון revalidation מוגדר במפורש, ומדיניות default ידועה דרך SWRConfig או במודול עצמו. citeturn11search1turn1search3  
- שימוש ב `mutate` נעשה דרך API רשמיות ולא על ידי כתיבה ישירה ל cache, כדי להימנע מ undefined behavior. ניתן לאכוף gate שמונע import של cache internals. citeturn12search2turn12search9  
- ה hook תמיד מחזיר state-friendly shape ל UI: data, error, isLoading, ומיפוי עקבי של empty vs error.

**תלויות:**  
`providers-scaffold` אם האפליקציה משתמשת ב SWRConfig גלובלי. citeturn11search1

**צרכנים בהמשך:**  
קומפוננטות ועמודים, `navigation-config-entry` במקרה של נתונים שמופיעים ב nav, וטסטים.

### `zustand-slice-module`

**תדירות:** daily בפרויקטים שמנהלים client-state גלובלי ב Zustand.

**קלט:**  
Spec של slice: `sliceName`, state fields, actions, ו policy ל persist אם נדרש.

**פלט:**  
`src/features/<feature>/state/<slice>.zustand.ts`  
יכול לכלול create של store או slice factory, לפי הקונבנציות שלכם.

**Correctness gates:**  
- ה slice מייצא selectorים יציבים כדי למנוע re-render מיותר, ושימוש ב selector function עקבי.  
- אין side effects בלתי צפויים בתוך setters.  
- אם משתמשים ב persist middleware, מוגדר storage key ייחודי ומנגנון migrate אם צריך. citeturn1search2  
- אין תלות מעגלית בין slices (בדיקה סטטית של import graph).  
- לא נדרשים providers כדי להשתמש store hook, וה usage תואם ל API של Zustand. citeturn11search19turn11search2

**תלויות:**  
`providers-scaffold` רק אם אתם עוטפים Zustand בקונטקסט מסיבה ארכיטקטונית, אחרת תלות עיקרית היא קונבנציות קבצים.

**צרכנים בהמשך:**  
`react-component` ו `react-page` משתמשים ב selectors ו actions, `unit-test-module` מאמת transitions.

### `redux-slice-module`

**תדירות:** daily בפרויקטים שמנהלים client-state ב Redux Toolkit.

**קלט:**  
Spec של `sliceName`, initialState, reducers, ותצורת selectors, plus async thunk policy אם רלוונטי.

**פלט:**  
`src/features/<feature>/state/<slice>.slice.ts`  
ולעיתים `selectors.ts` צמוד.

**Correctness gates:**  
- slice נוצר באמצעות `createSlice` ולא באמצעות boilerplate ידני, כדי לשמר קונסיסטנטיות ויכולת אוטומציה. citeturn1search5  
- ה exports כוללים reducers ו actions בצורה צפויה, ו selectors אינם משתמשים ב props לא יציבים.  
- קיים סוג `RootState` ותצורה TypeScript תקינה לפי ההנחיות, כדי למנוע any ב dispatch ו useSelector. citeturn1search1turn11search3  
- יש חיבור ל store דרך `configureStore` ו Provider אפליקטיבי, כך ש slice באמת נצרך. citeturn11search3turn11search6

**תלויות:**  
`providers-scaffold` (store + Provider), ולעיתים `testing-harness-config` כדי לאפשר store mocking.

**צרכנים בהמשך:**  
עמודים/קומפוננטות, route guards, ו `unit-test-module`.

### `url-searchparams-contract`

**תדירות:** daily (כל מסך עם פילטרים, pagination, sorting, או deep-linking).

**קלט:**  
Spec שמכיל: רשימת params, טיפוס לכל param, defaulting, ורכיבי policy (למשל param שמותר להיעלם מה URL אם הוא default).

**פלט:**  
`src/lib/routing/searchParams/<domain>.ts`  
כולל `parse`, `serialize`, ו typed helpers.

**Correctness gates:**  
- parse הוא total: כל input string מחזיר מבנה תקין או error ידוע, אין throwing לא מטופל.  
- serialize הוא canonical: אותו object תמיד מייצר URL זהה, כדי שניתן יהיה להשוות ולמנוע rerender loops.  
- defaulting עקבי: אם ערך שווה ל default הוא לא נכתב ל URL, כדי לשמור URL נקי לפי policy.  
- ב Next App Router, שימוש ב API הרשמית לקריאת search params (Client Component) ואיסור על שימוש לא נתמך ב Server Components. citeturn4search2turn4search6

**תלויות:**  
router קיים (React Router או Next), ו `ts-schema` אם אתם רוצים enforce סכמה.

**צרכנים בהמשך:**  
`react-page`, `navigation-config-entry` (לינקים עם params), `analytics-event-module` (capture querystring state), וטסטים.

### `react-router-route-module`

**תדירות:** daily בפרויקטים עם React Router.

**קלט:**  
Spec שמכיל: path, params, lazy loading policy, error UI policy, ו metadata פנימי ל nav (label, icon).

**פלט:**  
`src/lib/routing/routes/<route>.ts`  
מייצא RouteObject, ולעיתים loader/action references אם אתם משתמשים ב Data Router.

**Correctness gates:**  
- הנתיב עומד בחוקי תבנית (למשל אין פרמטרים לא מוגדרים).  
- אם מוגדר error handling, קיים `errorElement` או ErrorBoundary route-level במקום להסתמך על global בלבד, כדי לבודד כשלי route. citeturn4search0turn4search4  
- אם הפרויקט משתמש ב Data Router, יצירה דרך `createBrowserRouter` ומבנה routes תקין. citeturn4search16turn4search3  
- lazy loading, אם קיים, עוטף fallback אמיתי ולא null.

**תלויות:**  
router setup קיים בפרויקט, ו UI pages קיימים דרך `react-page`.

**צרכנים בהמשך:**  
`navigation-config-entry`, `client-route-guard`, ו `route-resilience-bundle` כאשר מיישמים מדיניות errors אחידה.

### `navigation-config-entry`

**תדירות:** daily (כל feature שמוסיף entry בתפריט או משנה היררכיה).

**קלט:**  
Spec: route target, הרשאות, label key ל i18n, ותצורת prefetch אם נדרש.

**פלט:**  
`src/lib/navigation/nav.ts` או `src/lib/navigation/<area>.nav.ts`

**Correctness gates:**  
- כל entry מפנה ל route קיים (בדיקה סטטית מול route registry).  
- label הוא key ל i18n ולא מחרוזת קשיחה.  
- אם יש הרשאות, ה guard הוא פונקציה טהורה שניתנת לבדיקה עם fixtures (אין קריאות רשת בתוך nav config).

**תלויות:**  
`react-router-route-module` או מודול routes של Next, `i18n-message-entry`, ולעיתים `client-route-guard`.

**צרכנים בהמשך:**  
קומפוננטות ניווט, analytics (click events), הטמעות אייקונים.

### `i18n-message-entry`

**תדירות:** daily (כמעט כל שינוי UI משמעותי).

**קלט:**  
Spec: `key`, `defaultMessage`, locale target, placeholders, ו context למתרגמים.

**פלט:**  
עדכון לקובצי תרגום, לדוגמה:  
`src/locales/en/<ns>.json`, `src/locales/he/<ns>.json`

**Correctness gates:**  
- key עומד בקונבנציית naming, ואינו מכיל תווים אסורים על פי מדיניות הפרויקט.  
- לכל locale שהפרויקט תומך בו קיים ערך, או קיים fallback rule מוצהר (למשל fallback ל en).  
- placeholders תואמים בין locales (אותם שמות, אותם סוגים). אם אתם משתמשים ב ICU, ניתן לבצע parse סטטי להשוואה. citeturn2search1turn2search4  
- אין concatenation של מחרוזות UI בקוד כאשר יש key מתאים, כדי למנוע תרגומים חלקיים.

**תלויות:**  
`providers-scaffold` עבור i18n provider, ו `i18n-namespace-file` לקיום namespace.

**צרכנים בהמשך:**  
`navigation-config-entry`, קומפוננטות, תצוגות error ו loading.

### `i18n-namespace-file`

**תדירות:** daily אך לרוב מעט פחות מ message entry (כשהפיצר גדל ומצריך פיצול קבצים).

**קלט:**  
Spec: namespace name, רשימת keys ראשונית, מדיניות lazy loading של namespaces.

**פלט:**  
קבצים חדשים:  
`src/locales/en/<ns>.json`, `src/locales/he/<ns>.json`  
ולעיתים עדכון לרשימת namespaces טעינים.

**Correctness gates:**  
- הקובץ הוא JSON תקין, עם UTF-8 ללא בעיות parsing.  
- namespace רשום במנגנון טעינה, אם עובדים עם פיצול namespaces כדי להקטין payload. citeturn2search0turn2search3  
- אין duplicate keys בין namespaces אם המדיניות דורשת ייחודיות.

**תלויות:**  
i18n framework setup בפרויקט, ו convention של תיקיות locales. לעיתים Next i18n routing. citeturn2search11turn2search19

**צרכנים בהמשך:**  
כל קומפוננטה או עמוד בפיצר החדש.

### `analytics-event-module`

**תדירות:** daily (תלוי מוצר, אבל כמעט כל פיצר דורש לפחות event אחד למדידה).

**קלט:**  
Spec: eventName, payload properties, trigger points, ומדיניות privacy (מה אסור לשלוח).

**פלט:**  
`src/lib/analytics/events.ts` או מודול per-feature כגון `src/features/<feature>/analytics.ts`.

**Correctness gates:**  
- eventName נמצא ברשימת allowed names, בלי typos, ועם naming convention.  
- payload הוא JSON-serializable, ללא מידע רגיש לפי allowlist או denylist.  
- לכל trigger נקבע מקום יחיד בקוד כדי למנוע double-fire (בדיקה סטטית: אין יותר מקריאה אחת לאותו event באותו flow).

**תלויות:**  
analytics runtime קיים, ועקרונות routing/state לפי הצורך.

**צרכנים בהמשך:**  
experiment wrappers (exposure), dashboards פנימיים, ו debugging.

### `feature-flag-definition`

**תדירות:** daily (feature work בשחרור הדרגתי, kill-switches, ניסויים).

**קלט:**  
Spec: flag key, סוג flag (release, ops, experiment), default, targeting rules (אם יש), ורמת סיכון.

**פלט:**  
`src/lib/flags/flags.ts`  
כולל typed accessors.

**Correctness gates:**  
- לכל flag יש default מפורש.  
- אין שימוש ב string literals מפוזרים בקוד, רק דרך accessor, כדי לאפשר ריכוז בדיקות.  
- flag מסווג לקטגוריה, כי דפוסי feature toggles כוללים וריאנטים ושימושים שונים עם השלכות שונות על ניהול מורכבות. citeturn6search3turn6search7

**תלויות:**  
runtime של flags (לוקאלי או remote). אם יש AB testing, תלות ב `experiment-variant-wrapper`.

**צרכנים בהמשך:**  
קומפוננטות ופיצרים, `navigation-config-entry`, route guards.

### `experiment-variant-wrapper`

**תדירות:** daily (כאשר עובדים עם ניסויים וריאנטים).

**קלט:**  
Spec: experiment id, variants, חלוקת טראפיק, תנאי הכללה, ו exposure event.

**פלט:**  
`src/lib/experiments/<exp>.tsx`  
wrapper שמחליט וריאנט ומרנדר variant component או render prop.

**Correctness gates:**  
- הקצאה אקראית או deterministic לפי user id, לפי מדיניות ניסוי, כדי לשמור על חלוקה עקבית. A/B testing נשען על הקצאה אקראית בין וריאנטים לצורך השוואה. citeturn6search4turn6search0  
- לוג exposure נשלח פעם אחת לכל user-session per experiment (gate שניתן לבדוק ב unit test עם mock clock).  
- הרינדור משתמש ב conditional rendering עקבי ומוגדר, ולא ב branching מפוזר. citeturn6search1  
- כל variant חייב להיות מוגדר, אין מצב שאין fallback.  

**תלויות:**  
`feature-flag-definition` (לעיתים experiment הוא סוג flag), `analytics-event-module`.

**צרכנים בהמשך:**  
`react-component`, `react-page`, וטסטים שמוודאים חלוקה ו exposure.

### `error-boundary-wrapper`

**תדירות:** daily (כמעט כל פיצר מורכב ירצה בידוד שגיאות לפחות ברמת אזור).

**קלט:**  
Spec: scope, fallback UI, report sink, ומדיניות retry.

**פלט:**  
`src/lib/errors/ErrorBoundary.tsx` או per-feature error boundary.

**Correctness gates:**  
- Implemented לפי API הרשמי: קיים `static getDerivedStateFromError` ו או `componentDidCatch`, אחרת זה לא Error Boundary. citeturn0search4turn0search0  
- fallback UI לא זורק שגיאה בעצמו, ויש לו render path בטוח.  
- אם יש report, `componentDidCatch` שולח מידע structured ולא רק console.log. citeturn0search4  
- ה wrapper לא משמש כתחליף לטיפול ב errors באירועים אסינכרוניים או event handlers, אלא רק למקרים שנתפסים ב rendering tree, לפי החוזה של React error boundaries. citeturn0search0

**תלויות:**  
framework error reporting hook אם קיים, ולעיתים `route-resilience-bundle` כאשר מציבים boundary ברמת route.

**צרכנים בהמשך:**  
עמודים, מודולי routing, Suspense boundaries, ותסריטי recovery.

### `loading-skeleton-module`

**תדירות:** daily (כל query כמעט דורש loading UI שנעים לעין).

**קלט:**  
Spec: target layout, density, מספר שורות, variant ל RTL, והאם skeleton משתמש באלמנטים סמנטיים.

**פלט:**  
`src/lib/loading/<name>.tsx`

**Correctness gates:**  
- skeleton משתמש ב markup שלא מבלבל קוראי מסך, למשל שימוש ב aria attributes מתאימים או hiding לפי policy.  
- אם skeleton כולל אנימציה, קיימת התאמה ל prefers-reduced-motion. citeturn3search2  
- בפרויקטים עם Next App Router, קיימת אפשרות לחבר skeleton ל `loading.tsx` ברמת segment כדי להציג fallback מידי בזמן streaming. citeturn9search0turn9search3

**תלויות:**  
`design-tokens-and-tailwind-theme` כדי ליישר קו עם מערכת העיצוב.

**צרכנים בהמשך:**  
query modules, pages, ו Storybook stories.

### `motion-preset-module`

**תדירות:** daily אך בעיקר במוצרים עם אינטראקציות עשירות.

**קלט:**  
Spec: motion intent (fade, slide, scale), duration, easing, ו reduced-motion policy.

**פלט:**  
`src/lib/motion/presets.ts`  
בדרך כלל exports של classnames או keyframes, או wrapper hooks.

**Correctness gates:**  
- לכל preset יש branch של reduced-motion שמכבד את media query הרלוונטי, ולא מבצע motion לא חיוני כאשר המשתמש ביקש להפחית. citeturn3search2turn3search5  
- אין שימוש ב duration חריג מחוץ למדיניות (למשל max 300ms לאנימציות UI בסיסיות) אם policy מגדיר זאת.  
- preset אינו תלוי בזמן ריצה לא דטרמיניסטי (random), כדי לאפשר snapshot testing.

**תלויות:**  
`design-tokens-and-tailwind-theme` אם easing/duration הם tokens.

**צרכנים בהמשך:**  
קומפוננטות UI, skeletons, modals.

### `unit-test-module`

**תדירות:** daily (כל פונקציונליות חדשה דורשת בדיקות כדי לאפשר gates).

**קלט:**  
Spec התנהגות: what to assert, states, mocks (API, store), ו edge cases.

**פלט:**  
`src/features/<feature>/__tests__/<thing>.test.tsx`  
או co-located.

**Correctness gates:**  
- בדיקות משתמשות ב queries שמדמות שימוש משתמש, עם עדיפות ל querying לפי role ונגישות, ולא לפי פרטים מימושיים. citeturn3search0turn3search6turn3search3  
- סביבת runner מוגדרת כראוי עם Vitest ו config, כדי למנוע false positives. citeturn3search9turn3search12  
- אם משתמשים ב matchers כמו `toBeInTheDocument`, יש setup שמטעין jest-dom. citeturn10search2turn10search9  
- אין בדיקות flaky התלויות ב timers אמיתיים ללא fake timers לפי policy.

**תלויות:**  
`testing-harness-config`, ולעיתים providers scaffolds לצורך wrappers.

**צרכנים בהמשך:**  
כל הקומפיילרים, כי הם יכולים להריץ test suite כחלק מה attestation.

### `a11y-test-module`

**תדירות:** daily (במיוחד כשבונים מערכת gates איכותית ורוצים למנוע רגרסיות נגישות).

**קלט:**  
Spec: component או page target, allowed violations (אם יש החרגות זמניות), ו scope של בדיקה.

**פלט:**  
`src/**/__tests__/<thing>.a11y.test.tsx`  
או בדיקה שמופעלת דרך Storybook.

**Correctness gates:**  
- הבדיקה מריצה engine כמו axe-core על DOM שנוצר ומוודאת אפס violations, או סט חריגים חתום. citeturn5search16turn10search7  
- שימוש ב wrapper כמו jest-axe או vitest-axe כדי לקבל matcher סטנדרטי. citeturn10search0turn10search5  
- במקומות שבהם יש אינטראקציה מקלדת, נבדקת נראות focus לפי הנחיות WCAG, לפחות ברמת smoke test. citeturn10search3turn2search5  
- אם זו בדיקת Storybook a11y, נעשה שימוש ב addon הרשמי שמבוסס axe-core. citeturn13search0turn13search4

**תלויות:**  
`a11y-harness-config`, `testing-harness-config`, ולעיתים `storybook-harness-config`.

**צרכנים בהמשך:**  
כל שינוי UI משמעותי, במיוחד forms, nav, dialogs, ו flows עם אנימציה.

### `storybook-story-module`

**תדירות:** daily (בארגונים שמשתמשים ב Storybook כבסיס QA ו design system).

**קלט:**  
Spec: קומפוננטה יעד, states (default, disabled, error, loading), args schema, ו תסריטי אינטראקציה.

**פלט:**  
`src/**/<Component>.stories.tsx`

**Correctness gates:**  
- stories כתובות עם args כדרך המלך, כדי לאפשר Controls ולאפשר reuse בתיעוד ובבדיקות. citeturn3search7turn3search4  
- אם יש אינטראקציה, מוגדרת `play` function עם צעדים דטרמיניסטיים. citeturn3search10  
- ניתן להריץ אינטראקציות אוטומטית באמצעות אינטגרציה עם Vitest addon, לפי הצורך. citeturn13search2turn3search1

**תלויות:**  
`storybook-harness-config`, קומפוננטות קיימות, ולעיתים `a11y-harness-config` כדי לבצע בדיקות a11y ב Storybook.

**צרכנים בהמשך:**  
תיעוד, בדיקות אינטראקציה, בדיקות a11y ב Storybook, ושיתוף עם design.

### `security-safe-html-module`

**תדירות:** daily בפרויקטים שמציגים HTML שמגיע ממקור חיצוני או CMS.

**קלט:**  
Spec: מקור HTML, רשימת tags/attributes מותרים, policy ל URLs, ו האם מותר rich text.

**פלט:**  
`src/lib/security/safeHtml.tsx`  
wrapper שמבצע sanitization ומרנדר safely, או abstraction שמונע שימוש ישיר ב dangerouslySetInnerHTML.

**Correctness gates:**  
- אין render של HTML לא מסונן.  
- כל URL attribute נבדק לפי allowlist (למשל חסימת `javascript:`).  
- יש בדיקות unit שמוודאות ש payloads טיפוסיים של XSS לא עוברים. XSS מוגדר כיכולת להריץ קוד זדוני בהקשר האתר. citeturn6search2

**תלויות:**  
ספריית sanitization אם יש, ו `unit-test-module`.

**צרכנים בהמשך:**  
קומפוננטות rich text, דפי תוכן, ומסכים עם user-generated content.

## משימות לפי פיצר

### `route-resilience-bundle`

**תדירות:** per-feature (כל route/segment משמעותי צריך מדיניות not-found, loading, error).

**קלט:**  
Spec: route/segment identifier, מה נחשב not-found, skeleton/loading UI policy, error handling policy, SEO hints אם רלוונטי.

**פלט:**  
שני מסלולים אפשריים לפי stack:  
- ב Next App Router: יצירה או עדכון של `loading.tsx`, `error.tsx`, `not-found.tsx` תחת `app/<segment>/`. citeturn9search0turn9search5turn0search14  
- ב React Router: יצירה או עדכון של route module שמגדיר `errorElement` ו fallback. citeturn4search0turn4search12

**Correctness gates:**  
- Next: קיים `loading` שמספק fallback משמעותי ומבוסס Suspense במקום spinner אקראי, כדי לנצל streaming ו behavior מובנה. citeturn9search0turn9search3  
- Next: שימוש ב notFound function/קובץ not-found כדי להציג 404 UI בצורה קונבנציונלית. citeturn9search1turn9search5turn0search1  
- React Router: `errorElement` מוגדר כאשר יש loaders/actions או כאשר רוצים בידוד ברמת route. citeturn4search0  
- בכל stack: אין מצב בו error UI נכנס ללולאה ומפיל את כל האפליקציה, ויש כפתור retry או מסלול recovery לפי policy.

**תלויות:**  
`error-boundary-wrapper`, `loading-skeleton-module`, `navigation-config-entry`, ולעיתים `tanstack-query-query-module` עבור not-found detection לנתונים.

**צרכנים בהמשך:**  
`react-page` קומפיילר שמייצר את page עצמו, מערכות observability, וטסטי e2e אם קיימים.

### `client-route-guard`

**תדירות:** per-feature (לא כל route דורש guard, אבל כמעט כל אזור מוגן כן).

**קלט:**  
Spec: requirement (auth, role, plan), מקור session בצד לקוח, redirect יעד, ומדיניות UI בזמן בדיקת הרשאה.

**פלט:**  
`src/lib/routing/guards/<guard>.tsx`  
wrapper component או HOC שמתיישב עם router.

**Correctness gates:**  
- guard הוא פונקציה טהורה במובן של החלטה: קלט session, פלט allow/deny, כדי לבדוק בקלות.  
- אין flash של תוכן מוגן אם policy אוסר, כלומר בזמן loading מוצג placeholder או skeleton.  
- ה redirect מבוצע דרך API ניווט רשמי של stack אם רלוונטי. ב Next, `<Link>` ו prefetch הם הדרך הראשית לנווט, ושימוש בהם צריך להיות עקבי עם המדיניות שלכם. citeturn4search1turn4search13

**תלויות:**  
מנגנון session בצד לקוח, router setup, `navigation-config-entry` אם nav מסתיר פריטים על בסיס הרשאה.

**צרכנים בהמשך:**  
routes מוגנים, nav, ו analytics (מדידת denial).

### `feature-module-scaffold`

**תדירות:** per-feature.

**קלט:**  
Spec: feature name, boundaries, האם feature כולל data fetching, state, i18n, stories, tests.

**פלט:**  
תיקייה שלמה, לדוגמה:  
`src/features/<feature>/`  
עם מבנה סטנדרטי כגון `components/`, `queries/`, `state/`, `i18n/`, `__tests__/`, ו `index.ts`.

**Correctness gates:**  
- אין exports פרטיים דרך barrel ציבורי, רק API רשמי.  
- אין imports חוצי פיצרים דרך paths לא מורשים, כדי לשמור על גבולות. אפשר לאכוף זאת ע"י ESLint rules מותאמים. citeturn5search3turn5search1  
- התיקייה כוללת לפחות קובץ אחד לכל capability שהספציפיקציה דרשה, כדי למנוע skeleton ריק.

**תלויות:**  
קונבנציות repo, לעיתים ESLint plugin פנימי.

**צרכנים בהמשך:**  
כל הקומפיילרים היומיומיים, כי הם ינחתו בתוך התבנית הזאת.

## משימות לפי פרויקט

### `design-tokens-and-tailwind-theme`

**תדירות:** per-project (וגם נקודתית כאשר מוסיפים tokens חדשים).

**קלט:**  
Spec: סט tokens, שמות ומבנה לפי תקן, מיפוי לעיצוב (צבעים, מרווחים, radii), ו החלטה האם עובדים ב Tailwind v4 CSS-first theme.

**פלט:**  
דוגמה סט אופייני:  
- `src/styles/tokens.json` בפורמט Design Tokens סטנדרטי  
- `src/styles/theme.css` שמגדיר theme variables, או שכבה שמייצרת CSS variables  
- עדכונים ל Tailwind theme variables לפי צורך

**Correctness gates:**  
- קובץ tokens עומד בפורמט תקני להחלפת design tokens בין כלים. citeturn5search0turn5search2  
- שמות tokens עומדים במגבלות תווים לפי מדיניות הפורמט והכלים, כדי למנוע כשלי tooling. citeturn5search4  
- Tailwind theme variables מוגדרים דרך המנגנון הרשמי, כדי לוודא ש utilities נוצרים בהתאם. citeturn1search0turn1search4  
- אין tokens יתומים שאינם נצרכים בכלל, אם המדיניות מחייבת שימוש.

**תלויות:**  
Tailwind מותקן ומחובר, ו convention ל CSS entrypoint. citeturn1search8

**צרכנים בהמשך:**  
כל קומפיילר UI שמייצר קלאסים, skeletons, motion presets, ו Storybook themes.

### `providers-scaffold`

**תדירות:** per-project.

**קלט:**  
Spec: האם הפרויקט משתמש TanStack Query או SWR, האם Zustand או Redux, האם i18n routing, סדר עיטוף providers, והאם קיימים boundaries גלובליים.

**פלט:**  
אחד מהבאים לפי תשתית:  
- `src/app/providers.tsx` (בדפוסי Next)  
- `src/main.tsx` או entrypoint אחר (בדפוסי Vite)  
כולל QueryClientProvider או SWRConfig, וכן Redux Provider אם נדרש.

**Correctness gates:**  
- אם משתמשים TanStack Query, קיים QueryClientProvider שמספק QueryClient לכל העץ. citeturn11search4  
- אם משתמשים SWR, קיים SWRConfig גלובלי כאשר רוצים להגדיר fetcher ומדיניות revalidation באופן עקבי. citeturn11search1  
- אם משתמשים Redux, store נוצר עם configureStore ומסופק לקומפוננטות דרך Provider. citeturn11search3turn11search6  
- אם משתמשים i18n routing ב Next, הגדרת locales קיימת ועומדת בהנחיות routing. citeturn2search11turn2search19  
- אין mismatch בין Server Components ל Client Components כאשר provider מחייב `use client`, לפי מדיניות stack.

**תלויות:**  
החלטת stack והתקנת ספריות, וכן `testing-harness-config` כדי לבנות wrappers לבדיקות.

**צרכנים בהמשך:**  
רוב הקומפיילרים היומיומיים: queries, mutations, guards, i18n, tests.

### `testing-harness-config`

**תדירות:** per-project.

**קלט:**  
Spec: runner (Vitest), environment (jsdom), setup files, ts types, ו ספריות בדיקה.

**פלט:**  
- `vitest.config.ts` או `vite.config.ts` עם מקטע test  
- `src/test/setup.ts` שמייבא matchers ומבצע setup

**Correctness gates:**  
- תצורה תקינה של Vitest בפרויקט, לפי המנגנון הרשמי. citeturn3search12turn3search9  
- jest-dom נטען כדי לאפשר matchers סטנדרטיים ל DOM assertions. citeturn10search2turn10search9  
- בדיקות משתמשות ב Testing Library לפי עקרון "איך משתמשים באמת", כדי שיהיו stable ומכוונות נגישות. citeturn3search0turn3search3

**תלויות:**  
Vite או תשתית build קיימת.

**צרכנים בהמשך:**  
`unit-test-module`, `a11y-test-module`, ו חלק מקומפיילרי ה UI כשמריצים attestation.

### `storybook-harness-config`

**תדירות:** per-project.

**קלט:**  
Spec: location של stories, addons, framework integration, ו TypeScript story format.

**פלט:**  
- `.storybook/main.ts`  
- `.storybook/preview.ts`

**Correctness gates:**  
- main configuration נמצא ב `.storybook/main.ts` ומגדיר story globs ו addons, לפי הדוקומנטציה. citeturn13search5turn13search13  
- תמיכה ב TypeScript פעילה בצורה מובנית. citeturn13search1  
- אם רוצים להפוך stories לטסטים, מוגדרת אינטגרציה עם Vitest addon ולא test-runner מיושן. citeturn13search2turn13search6

**תלויות:**  
Storybook מותקן.

**צרכנים בהמשך:**  
`storybook-story-module`, בדיקות אינטראקציה, ו a11y addon.

### `a11y-harness-config`

**תדירות:** per-project.

**קלט:**  
Spec: האם מריצים axe דרך unit tests, דרך Storybook addon, או שניהם, ספי כשלון, ו רשימת חריגים אם קיימת.

**פלט:**  
- `src/test/a11y.ts` (helpers)  
- עדכון `.storybook/main.ts` להוספת addon  
- לעיתים config לקביעת rules מותרים

**Correctness gates:**  
- Storybook a11y addon מותקן ומוגדר, והוא אכן מבוסס על axe-core. citeturn13search0turn13search12  
- במבחני יחידה, יש wrapper תקין סביב axe כדי להפיק assertion בינארי. citeturn10search0turn10search5turn10search7  
- הסטנדרט המוצהר לנגישות בפרויקט הוא WCAG 2.2 או baseline אחר, כדי להגדיר מטריקות קבועות. citeturn2search5

**תלויות:**  
`testing-harness-config` ו `storybook-harness-config`.

**צרכנים בהמשך:**  
כל מודול UI חדש, בדגש על dialogs, nav, forms, ו flows עם מקלדת.

## סדר בנייה מומלץ לקומפיילרים לפי גרף תלות ותיעדוף תדירות

הסדר להלן ממזער חסימות תלויות ועדיין נותן קדימות למשימות יומיומיות ברגע שהבסיס קיים.

### שכבת יסוד שמאפשרת daily להיות אמיתי
1. `providers-scaffold` (בלעדיו אין QueryClientProvider, Redux Provider, SWRConfig, i18n boot) citeturn11search4turn11search3turn11search1turn2search11  
2. `testing-harness-config` (כדי שכל קומפיילר יוכל לאמת משהו בבדיקה בינארית) citeturn3search12turn10search2  
3. `a11y-harness-config` (כי gates של נגישות הם מהגבוהים בהחזר השקעה, ומתחברים אוטומטית) citeturn13search0turn10search7  
4. `design-tokens-and-tailwind-theme` (כי הרבה קומפיילרי UI תלויים בטוקנים עקביים) citeturn1search0turn5search0  
5. `storybook-harness-config` (אם Storybook הוא חלק מהתהליך היומיומי אצלכם) citeturn13search5turn13search1  

### קומפיילרים יומיומיים שמכסים את רוב העבודה בפיצרים
6. `tanstack-query-query-module` ו `tanstack-query-mutation-module` או לחלופין `swr-resource-module` לפי בחירת ה stack citeturn0search6turn12search0turn11search18  
7. `tanstack-query-invalidation-map` (מונע פיזור invalidation ומאפשר gates חזקים) citeturn12search4  
8. `zustand-slice-module` או `redux-slice-module` לפי בחירת state management citeturn11search19turn1search5  
9. `url-searchparams-contract` (מעלה את איכות deep-links ומוריד באגים של parsing) citeturn4search2turn4search6  
10. `i18n-message-entry` ואז `i18n-namespace-file` (כי כמעט כל פיצר מייצר טקסט) citeturn2search0turn2search1  
11. `unit-test-module` (מאפשר attestation פונקציונלי לכל קומפיילר upstream) citeturn3search0turn3search9  
12. `a11y-test-module` (מניעת רגרסיות, במיוחד בהקשר של labels, focus, dialogs) citeturn0search2turn10search3turn5search16  
13. `analytics-event-module`, `feature-flag-definition`, `experiment-variant-wrapper` (ביחד, כי exposure ו measurement תלויים זה בזה) citeturn6search3turn6search4turn6search1  

### קומפיילרים לפי פיצר שמייצרים יציבות מערכתית
14. `route-resilience-bundle` (Next special files או React Router errorElement) citeturn9search0turn9search5turn4search0  
15. `client-route-guard` (במיוחד באזורי מוצר מוגנים) citeturn4search1  
16. `feature-module-scaffold` (מייצב מבנה ותלויות, ומשפר סקייל) citeturn5search3turn5search1  

### שכבת polishing שמחזירה איכות גבוהה אבל פחות קריטית לפתיחה
17. `error-boundary-wrapper` (אם לא מכוסה כבר ע"י route-resilience) citeturn0search4  
18. `loading-skeleton-module` ו `motion-preset-module` (כולל reduced-motion) citeturn3search2turn9search0  
19. `storybook-story-module` (אם זה daily אצלכם, אפשר להקדים אותו לשכבת daily) citeturn3search7turn3search10  
20. `security-safe-html-module` (אם יש HTML חיצוני, זה שובר שוויון כי זה מוריד סיכון גבוה) citeturn6search2