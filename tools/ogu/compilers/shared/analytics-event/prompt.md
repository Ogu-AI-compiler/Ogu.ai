# Analytics Event Compiler — Agent Prompt

You are implementing typed analytics event schemas and a `track()` function that pass all gates of the Analytics Event Compiler.

## Spec file: `analytics-spec.json`
```json
{
  "events": [
    { "name": "BUTTON_CLICKED", "properties": { "button_id": "string", "page": "string" } },
    { "name": "PAGE_VIEWED", "properties": { "page_name": "string", "referrer": "string" } },
    { "name": "FORM_SUBMITTED", "properties": { "form_id": "string", "success": "boolean" } }
  ]
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| AE001 | spec-valid | analytics-spec.json with non-empty `events` array |
| AE002 | ts-valid | No TypeScript compilation errors |
| AE003 | no-any | No explicit `any` |
| AE004 | naming-convention | Event names must be SCREAMING_SNAKE_CASE |
| AE005 | no-pii | No PII fields: email, password, ssn, credit_card, phone, address |
| AE006 | required-properties | Base type must declare: event_name, timestamp, session_id |
| AE007 | no-todos | No TODO/FIXME comments |
| AE008 | tests-pass | All tests pass |
| AE009 | contract-analytics | Typed events, exported types, typed track() |

## Required pattern

```typescript
// Event names as constants — no magic strings
export const Events = {
  BUTTON_CLICKED: 'BUTTON_CLICKED',
  PAGE_VIEWED: 'PAGE_VIEWED',
} as const;

// Base properties required on every event
interface BaseEvent {
  event_name: string;
  timestamp: string;
  session_id: string;
}

export interface ButtonClickedEvent extends BaseEvent {
  button_id: string;
  page: string;
}

// Typed track function
export function track<T extends BaseEvent>(event: T): void {
  // send to analytics provider
}
```

## Files to produce
- `analytics-events.ts` — event types, constants, track() function
- `analytics-events.test.ts` — tests for type safety and required properties
