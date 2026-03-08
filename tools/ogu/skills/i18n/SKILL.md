---
name: i18n
description: Compiler skill for the i18n compiler. Activates when producing i18n-artifact.json. Gates: I1001–I1008. No upstream dependency.
---

# i18n — Compiler Skill

## What This Compiler Does

Compiles an internationalization module — locale JSON files, a type-safe `useTranslation` hook or `t()` accessor, and tests. Enforces: all locale files present, all locales have the exact same keys as the default locale, interpolation variables match across locales (`{{var}}`, `{var}`, `%(var)s`), no empty translation values, RTL direction handled when Arabic/Hebrew/Farsi/Urdu locales included, and a type-safe key accessor exported.

**Upstream dependency:** none
**Output artifact:** `i18n-artifact.json`
**IR identifier:** `I18N:{module}`

---

## Spec Shape

```json
{
  "defaultLocale": "en",
  "locales": ["en", "he", "fr", "es"]
}
```

Required fields:
- `defaultLocale` — the source-of-truth locale; must be present in `locales` array
- `locales` — non-empty array of locale codes

Each locale code must have a corresponding `{locale}.json` file in the compiler directory.

---

## File Structure

```
my-i18n/
  i18n-spec.json
  en.json          ← default locale (source of truth)
  he.json          ← all keys from en.json, same interpolations
  fr.json
  es.json
  i18n.ts          ← typed hook + accessor
  i18n.test.ts
```

### en.json (default locale — defines all keys)

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm"
  },
  "auth": {
    "login": "Log in",
    "logout": "Log out",
    "welcome": "Welcome, {{name}}!"
  },
  "errors": {
    "required": "This field is required",
    "maxLength": "Must be at most {{max}} characters"
  }
}
```

### he.json (must have identical keys + matching interpolations)

```json
{
  "common": {
    "save": "שמור",
    "cancel": "ביטול",
    "confirm": "אישור"
  },
  "auth": {
    "login": "התחבר",
    "logout": "התנתק",
    "welcome": "ברוך הבא, {{name}}!"
  },
  "errors": {
    "required": "שדה זה הוא חובה",
    "maxLength": "חייב להיות לכל היותר {{max}} תווים"
  }
}
```

### i18n.ts

```ts
import en from './en.json';

// Type-safe key derivation from default locale
export type TranslationKey = keyof typeof en | string;

const locales: Record<string, typeof en> = {
  en,
  // dynamic imports in real app
};

type Locale = 'en' | 'he' | 'fr' | 'es';

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  // Set dir attribute for RTL locales
  const rtlLocales: Locale[] = ['he'];
  document.documentElement.dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

export function useTranslation() {
  const dict = locales[currentLocale] ?? locales['en'];

  function t(key: string, vars?: Record<string, string | number>): string {
    const parts = key.split('.');
    let value: unknown = dict;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }
    if (typeof value !== 'string') return key;
    if (!vars) return value;
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
  }

  return { t, locale: currentLocale };
}
```

---

## Gates

### I1001 — spec-valid
Reads `i18n-spec.json`. Required: `defaultLocale` (string), `locales` (non-empty array). The `defaultLocale` must be present in `locales`. Every locale code must have a `{locale}.json` file on disk.

BAD: `defaultLocale: "en"` but `locales: ["fr", "es"]` — default not in locales array.
BAD: `locales: ["en", "he"]` but `he.json` doesn't exist on disk.
GOOD: `{ "defaultLocale": "en", "locales": ["en", "he", "fr"] }` with `en.json`, `he.json`, `fr.json` all present.

### I1002 — ts-valid
TypeScript files must compile without errors.

### I1003 — key-parity
Every locale JSON must have the exact same set of flattened keys as the default locale. Keys are compared using dot-notation flattening (`auth.welcome`).

BAD:
```
en.json has key "errors.maxLength"
fr.json is missing "errors.maxLength"  ← violation
```
BAD:
```
fr.json has extra key "errors.networkTimeout" not in en.json  ← violation
```
GOOD: All locale files have identical key sets.

### I1004 — interpolation-parity
Interpolation variables must match across all locales. Supported formats: `{{variable}}`, `{variable}`, `%(variable)s`.

BAD:
```
en.json:  "welcome": "Welcome, {{name}}!"
fr.json:  "welcome": "Bienvenue!"         ← {{name}} missing from French
```
BAD:
```
en.json:  "maxLength": "Max {{max}} chars"
he.json:  "maxLength": "עד {{max}} ו-{{extra}} תווים"  ← {{extra}} is unexpected
```
GOOD:
```
en.json:  "welcome": "Welcome, {{name}}!"
fr.json:  "welcome": "Bienvenue, {{name}} !"
he.json:  "welcome": "ברוך הבא, {{name}}!"
```

### I1005 — no-empty-values
No translation value may be an empty or whitespace-only string in any locale file.

BAD:
```json
{ "auth": { "logout": "" } }
```
GOOD: All values contain actual translated text.

### I1006 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked in all `.ts`/`.tsx` files.

### I1007 — tests-pass
All tests pass via vitest or jest.

### I1008 — contract-i18n
Three contract rules:

| Rule | Requirement |
|---|---|
| `type-safe-keys` | `type TranslationKey`, `keyof typeof`, `T extends string`, or `satisfies Record` in TypeScript source |
| `use-translation-hook` | `export ...useTranslation` or `export const t =` |
| `rtl-support` | If locales include `ar`, `he`, `fa`, or `ur` — `dir: 'rtl'` or `dir.*rtl` must appear in source |

BAD (RTL locale without RTL support):
```json
// spec: locales: ["en", "he"]
```
```ts
// i18n.ts has no 'rtl' or dir handling — violation
```
GOOD:
```ts
const rtlLocales = ['he', 'ar'];
document.documentElement.dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr';
```

---

## What This Compiler Never Forgives

- `i18n-spec.json` missing (I1001 hard-fails)
- `defaultLocale` not in `locales` array (I1001)
- Any `{locale}.json` file missing from disk (I1001)
- Keys present in en.json but missing from another locale (I1003)
- Extra keys in a locale not in default (I1003)
- Interpolation variables missing or added in translations (I1004)
- Empty string translation values (I1005)
- RTL locale (`ar`/`he`/`fa`/`ur`) without `dir: rtl` handling (I1008)
- No `useTranslation` or `t` accessor exported (I1008)
- No type-safe key type (`TranslationKey`/`keyof typeof`) (I1008)
