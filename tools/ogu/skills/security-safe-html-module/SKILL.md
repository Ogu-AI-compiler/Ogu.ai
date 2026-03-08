---
name: security-safe-html-module
description: Compiler skill for the security-safe-html-module compiler. Activates when producing safe-html-artifact.json. Gates: SH001–SH009. No upstream dependency.
---

# security-safe-html-module — Compiler Skill

## What This Compiler Does

Compiles a React component that renders user-generated or external HTML content safely. Enforces: no raw `dangerouslySetInnerHTML` without sanitization, no `.innerHTML =` without sanitization, URL allowlist for href/src bindings, XSS attack vector tests present, and DOMPurify/sanitizeHtml imported and used.

**Upstream dependency:** none
**Output artifact:** `safe-html-artifact.json`
**IR identifier:** `SAFE_HTML:{component}`

---

## Spec Shape

```json
{
  "component": "SafeRichText",
  "allowed_tags": ["p", "b", "i", "em", "strong", "a", "ul", "ol", "li", "br"],
  "sanitizer": "dompurify"
}
```

Required fields:
- `component` — the component name
- `allowed_tags` — array of allowed HTML tags
- `sanitizer` — `"dompurify"`, `"sanitize-html"`, or custom sanitizer name

---

## Implementation Shape

```tsx
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br'];
const ALLOWED_ATTR = ['href', 'title', 'target'];

const ALLOWED_ORIGINS = [
  'https://trusted.example.com',
  'https://docs.example.com',
];

function isAllowedUrl(url: string): boolean {
  try {
    const { origin, protocol } = new URL(url);
    return ALLOWED_ORIGINS.includes(origin) && protocol !== 'javascript:';
  } catch {
    return false;
  }
}

export function SafeRichText({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <div
      className="rich-text"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```

---

## Gates

### SH001 — spec-valid
Reads `safe-html-spec.json`. Required: `component`, `allowed_tags` (array), `sanitizer`.

BAD: Missing fields, or `allowed_tags` is a string instead of array.
GOOD: `{ "component": "SafeRichText", "allowed_tags": ["p", "b"], "sanitizer": "dompurify" }`

### SH002 — no-any
No `: any` type annotations.

### SH003 — ts-valid
TypeScript files must compile.

### SH004 — no-raw-innerhtml
`dangerouslySetInnerHTML` must be followed by sanitization. Patterns blocked:
- `dangerouslySetInnerHTML={{ __html: unsanitizedValue }}` — no sanitize/DOMPurify call
- `.innerHTML = unsanitizedValue` — raw assignment

Allowed patterns (sanitized):
- `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}`
- `dangerouslySetInnerHTML={{ __html: sanitize(html) }}`
- `dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}`

BAD:
```tsx
<div dangerouslySetInnerHTML={{ __html: userContent }} />
// no sanitization — XSS vector!
element.innerHTML = data; // raw DOM manipulation
```
GOOD:
```tsx
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

### SH005 — url-allowlist
Skipped if no `href=` or `src=` bindings found.

When `href`/`src` is bound:
1. `javascript:` protocol in href is an immediate failure
2. An URL allowlist/validator must be present: `ALLOWED_URL`, `SAFE_ORIGINS`, `allowedDomains`, `isAllowedUrl`, `validateUrl`, or `allowlist`

BAD:
```tsx
<a href={userProvidedUrl}>Link</a>
// no allowlist validation — open redirect + XSS
<a href="javascript:alert(1)">Click</a>
// javascript: protocol — XSS
```
GOOD:
```tsx
{isAllowedUrl(url) && <a href={url}>Link</a>}
```

### SH006 — xss-tests
Test files must include XSS attack vector payloads to verify sanitization works. Required patterns in tests: `<script>`, `javascript:`, `onerror=`, `onload=`, `xss`, `XSS`, `alert(1)`, or `img src=x`.

BAD: No test file, or tests don't include XSS payloads.
GOOD:
```tsx
it('sanitizes script tags', () => {
  render(<SafeRichText html="<script>alert(1)</script>" />);
  expect(screen.queryByRole('script')).not.toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
});

it('strips javascript: protocols', () => {
  render(<SafeRichText html='<a href="javascript:alert(1)">click</a>' />);
  // link should be present but href stripped
});
```

### SH007 — tests-pass
All tests pass.

### SH008 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### SH009 — contract-safe-html
Three contract rules:

| Rule | Requirement |
|---|---|
| `sanitizer-imported` | `DOMPurify` or `sanitizeHtml` must be imported |
| `no-raw-html` | No `__html: value` without sanitize in the call chain |
| `exported-component` | Component must be exported |

BAD: DOMPurify not imported, or component not exported.
GOOD:
```tsx
import DOMPurify from 'dompurify';
export function SafeRichText(...) { ... }
```

---

## What This Compiler Never Forgives

- `safe-html-spec.json` missing (SH001 hard-fails)
- `allowed_tags` not an array (SH001)
- `sanitizer` field missing (SH001)
- `dangerouslySetInnerHTML` without sanitization (SH004)
- `.innerHTML =` without sanitization (SH004)
- `javascript:` protocol in `href` binding (SH005)
- `href`/`src` bindings without URL allowlist validation (SH005)
- No XSS attack payload tests (SH006)
- DOMPurify/sanitizeHtml not imported (SH009)
- Component not exported (SH009)
