---
name: event-publisher-module
description: Compiler skill for the event-publisher-module compiler. Activates when producing event-publisher-artifact.json. Gates: EP001–EP008. No upstream dependency. Downstream: event-consumer-module (cross-publisher gate).
---

# event-publisher-module — Compiler Skill

## What This Compiler Does

Compiles a typed event publisher. Enforces that events are wrapped in a typed envelope (eventType, aggregateId, payload, timestamp, version), the channel/topic name comes from a constants file (not hardcoded inline), all publish calls are awaited, and the publisher contains no business logic (no DB calls, no HTTP calls).

**Upstream dependency:** none
**Output artifact:** `event-publisher-artifact.json` (consumed by `event-consumer-module` cross-publisher gate)
**IR identifier:** `EVENT_PUBLISHER:{eventType}`

---

## Spec Shape

```json
{
  "eventType": "user.created",
  "aggregateType": "User",
  "channel": "user-events",
  "payloadType": "UserCreatedPayload",
  "version": 1
}
```

`version` is optional (defaults to 1).

---

## Gates

### EP001 — spec-valid
Reads `event-publisher-spec.json`. Fails if missing or invalid JSON.

Required fields: `eventType` (string), `aggregateType` (string), `channel` (string), `payloadType` (string).

BAD: Missing `payloadType` — the payload type name is required. Missing `channel`.
GOOD: All four required fields present.

### EP002 — envelope-typed
Scans all non-test `.ts`/`.mjs`/`.js` files.

The event must be wrapped in a typed envelope. All five fields must appear somewhere in the source: `eventType`, `aggregateId`, `timestamp`, `version`, `payload`. Passes if at most 2 are missing (tolerates alternative field names). Fails if 3 or more are absent.

Also checks for an envelope interface/type definition matching pattern `interface *Event*` or `type *Event*`.

BAD:
```ts
await this.client.publish(channel, { userId, email }); // raw payload, no envelope
```
GOOD:
```ts
interface UserCreatedEvent {
  eventType: string;
  aggregateId: string;
  timestamp: string;
  version: number;
  payload: UserCreatedPayload;
}

const envelope: UserCreatedEvent = {
  eventType: 'user.created',
  aggregateId: user.id,
  timestamp: new Date().toISOString(),
  version: 1,
  payload: { email: user.email, name: user.name },
};
await this.client.publish(CHANNELS.USER_EVENTS, envelope);
```

### EP003 — channel-from-spec
The channel string declared in `spec.channel` must not appear as a bare string literal in non-constant source files.

**Allowed locations:** files whose names contain `channel`, `topic`, `events`, or `const` — these are treated as constant definition files where the literal string is expected.

**Blocked:** any other file that uses `'user-events'` (or whatever `spec.channel` is) as a string literal.

BAD: `await this.client.publish('user-events', envelope)` in `user.publisher.ts`.
GOOD:
```ts
// channels.ts (constant file — allowed)
export const CHANNELS = { USER_EVENTS: 'user-events' };

// user.publisher.ts (imports the constant — no literal)
import { CHANNELS } from './channels';
await this.client.publish(CHANNELS.USER_EVENTS, envelope);
```

### EP004 — no-business-logic
Checks publisher files (files with `publisher`, `emit`, or `dispatch` in the name; falls back to all source files if none found).

Blocked patterns:
- `prisma.*.(` / `db.*.(` / `repository.*.(` / `repo.*.(` — DB calls
- `fetch(` / `axios.(` / `got(` / `ky.(` — HTTP calls

The publisher's only job is to build an envelope and dispatch it. All DB reads and business decisions must happen in the service layer before calling the publisher.

BAD:
```ts
async publish(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } }); // DB in publisher
  await this.client.publish(CHANNELS.USER_EVENTS, { ...envelope, payload: user });
}
```
GOOD:
```ts
// Service layer fetches user, builds payload, then calls:
async publish(payload: UserCreatedPayload) {
  const envelope = this.buildEnvelope(payload);
  await this.client.publish(CHANNELS.USER_EVENTS, envelope);
}
```

### EP005 — publish-awaited
Every `.publish(`, `.emit(`, `.send(`, or `.dispatch(` call must have `await` on the same line.

BAD: `this.client.publish(CHANNELS.USER_EVENTS, envelope);` — fire-and-forget loses events silently on failure.
GOOD: `await this.client.publish(CHANNELS.USER_EVENTS, envelope);`

### EP006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### EP007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

### EP008 — contract-event-publisher
Reads `event-publisher-artifact.json` (compiler-generated). Required fields: `ir_id`, `eventType`, `channel`, `attestation`.

- `ir_id` must start with `EVENT_PUBLISHER:`
- `attestation.hash` must be present

---

## What This Compiler Never Forgives

- `event-publisher-spec.json` missing (EP001 hard-fails)
- Envelope missing 3+ of the required fields: `eventType`, `aggregateId`, `timestamp`, `version`, `payload` (EP002)
- Channel string hardcoded inline in non-constant files (EP003)
- DB calls (`prisma.*`, `db.*`) or HTTP calls (`fetch`, `axios`) inside publisher files (EP004)
- Publish/emit/send/dispatch call without `await` (EP005)
- No test files (EP007 hard-fails)
