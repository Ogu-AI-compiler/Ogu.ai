---
name: analytics-event
description: Compiler skill for the analytics-event compiler. Activates when producing analytics-artifact.json. Gates: AE001–AE009. No upstream dependency.
---

# analytics-event — Compiler Skill

## What This Compiler Does

Compiles an analytics event module — typed event definitions, a `track()` function, and tests. Enforces: events defined in spec with `name` + `properties`, event names in SCREAMING_SNAKE_CASE, no PII in event properties or `track()` calls, required base properties (`event_name`, `timestamp`, `session_id`) declared in types, TypeScript event interfaces exported, and event names as constants (not magic strings).

**Upstream dependency:** none
**Output artifact:** `analytics-artifact.json`
**IR identifier:** `ANALYTICS_EVENT:{module}`

---

## Spec Shape

```json
{
  "events": [
    {
      "name": "BUTTON_CLICKED",
      "properties": {
        "button_id": "string",
        "page": "string",
        "variant": "string"
      }
    },
    {
      "name": "PAGE_VIEWED",
      "properties": {
        "page_name": "string",
        "referrer": "string"
      }
    },
    {
      "name": "FORM_SUBMITTED",
      "properties": {
        "form_id": "string",
        "field_count": "number"
      }
    }
  ]
}
```

Required fields:
- `events` — non-empty array, each with `name` (string) and `properties` (object)

---

## Implementation Shape

```tsx
// analytics.ts

// Base event shape — required on every event
interface BaseAnalyticsEvent {
  event_name: string;
  timestamp: number;
  session_id: string;
}

// Event-specific types
export interface ButtonClickedEvent extends BaseAnalyticsEvent {
  event_name: 'BUTTON_CLICKED';
  button_id: string;
  page: string;
  variant: string;
}

export interface PageViewedEvent extends BaseAnalyticsEvent {
  event_name: 'PAGE_VIEWED';
  page_name: string;
  referrer: string;
}

export interface FormSubmittedEvent extends BaseAnalyticsEvent {
  event_name: 'FORM_SUBMITTED';
  form_id: string;
  field_count: number;
}

export type AnalyticsEvent = ButtonClickedEvent | PageViewedEvent | FormSubmittedEvent;

// Event name constants — no inline magic strings
export const EVENTS = {
  BUTTON_CLICKED: 'BUTTON_CLICKED',
  PAGE_VIEWED: 'PAGE_VIEWED',
  FORM_SUBMITTED: 'FORM_SUBMITTED',
} as const;

// Typed track function
export function track<T extends AnalyticsEvent>(event: T): void {
  const payload = {
    ...event,
    timestamp: Date.now(),
    session_id: getSessionId(),
  };
  // Send to analytics provider
  window.analytics?.track(payload.event_name, payload);
}

function getSessionId(): string {
  return sessionStorage.getItem('session_id') ?? crypto.randomUUID();
}
```

---

## Gates

### AE001 — spec-valid
Reads `analytics-spec.json`. Required: `events` (non-empty array). Each event must have `name` and `properties`.

BAD: `{ "events": [] }` — empty array.
BAD: `{ "events": [{ "name": "click" }] }` — missing `properties`.
GOOD: `{ "events": [{ "name": "BUTTON_CLICKED", "properties": { "button_id": "string" } }] }`

### AE002 — ts-valid
TypeScript files must compile without errors.

### AE003 — no-any
No `: any` type annotations in source files (not in test files).

### AE004 — naming-convention
All event `name` values in spec must be **SCREAMING_SNAKE_CASE**: uppercase letters, digits, underscores only — no lowercase, no spaces, no hyphens.

BAD:
```
"name": "button_clicked"   // lowercase
"name": "ButtonClicked"    // PascalCase
"name": "button-clicked"   // kebab
```
GOOD:
```
"name": "BUTTON_CLICKED"
"name": "PAGE_VIEWED"
"name": "FORM_SUBMITTED"
```

### AE005 — no-pii
PII field names are blocked in:
1. Event `properties` keys in spec
2. Arguments passed to `track()` calls in source files

Blocked fields: `email`, `password`, `ssn`, `social_security`, `credit_card`, `card_number`, `cvv`, `date_of_birth`, `dob`, `phone`, `phone_number`, `address`, `street`, `ip_address`, `full_name`, `first_name`, `last_name`, `passport`, `driver_license`.

BAD:
```ts
// In spec properties:
{ "email": "string", "phone": "string" }

// In source:
track('USER_IDENTIFIED', { email: user.email }); // PII in track call
```
GOOD:
```ts
// Use anonymized identifiers
{ "user_id": "string", "tier": "string" }
track('USER_IDENTIFIED', { user_id: user.id, tier: user.plan });
```

### AE006 — required-properties
The base analytics type/interface must declare these three properties: `event_name`, `timestamp`, `session_id`.

BAD:
```ts
interface BaseEvent {
  name: string; // wrong field name
}
```
GOOD:
```ts
interface BaseAnalyticsEvent {
  event_name: string;
  timestamp: number;
  session_id: string;
}
```

### AE007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked in all `.ts`/`.tsx` files.

### AE008 — tests-pass
All tests pass via vitest or jest.

### AE009 — contract-analytics
Four contract rules:

| Rule | Requirement |
|---|---|
| `typed-events` | `interface ...Event` or `type ...Event =` defined |
| `track-typed` | `track<EventType>()` or `function track(...: SomeEvent)` — typed call |
| `exported-events` | `export interface/type/const ...Event` |
| `no-magic-strings` | No `track('EVENT_NAME', ...)` inline — constants used instead |

BAD:
```ts
// Untyped track, magic string
track('BUTTON_CLICKED', { button_id: 'btn-1' });
```
GOOD:
```ts
export interface ButtonClickedEvent extends BaseAnalyticsEvent { ... }
export const EVENTS = { BUTTON_CLICKED: 'BUTTON_CLICKED' } as const;
track<ButtonClickedEvent>({ event_name: EVENTS.BUTTON_CLICKED, button_id: 'btn-1', ... });
```

---

## What This Compiler Never Forgives

- `analytics-spec.json` missing (AE001 hard-fails)
- `events` array empty or missing (AE001)
- Any event missing `name` or `properties` (AE001)
- Event names not SCREAMING_SNAKE_CASE (AE004)
- PII field names in event properties or `track()` calls (AE005)
- `event_name`, `timestamp`, or `session_id` not in base type (AE006)
- Event types not exported (AE009)
- `track()` called with inline magic string event name (AE009)
- No `interface ...Event` or `type ...Event` defined (AE009)
