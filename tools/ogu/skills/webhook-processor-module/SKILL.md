---
name: webhook-processor-module
description: Compiler skill for the webhook-processor-module compiler. Activates when producing webhook-processor-artifact.json. Gates: WH001–WH008. No upstream dependency.
---

# webhook-processor-module — Compiler Skill

## What This Compiler Does

Compiles a secure, production-ready webhook handler for a single upstream provider. Enforces that the signature is verified (with timing-safe comparison), the raw request body is preserved before parsing, a fast 200/202 acknowledgment is sent immediately, and actual processing is handed off asynchronously to a queue or background worker. Every one of these rules is non-negotiable — a webhook handler that skips any step is a security hole or reliability failure.

**Upstream dependency:** none
**Output artifact:** `webhook-processor-artifact.json`
**IR identifier:** `WEBHOOK_PROCESSOR:{provider}`

---

## Spec Shape

```json
{
  "provider": "stripe",
  "signatureAlgorithm": "hmac-sha256",
  "signatureHeader": "stripe-signature",
  "secretConfigKey": "STRIPE_WEBHOOK_SECRET"
}
```

`provider` — string name of the upstream service (e.g. `stripe`, `github`, `slack`).

`signatureAlgorithm` — one of: `hmac-sha256` | `hmac-sha1` | `rsa-sha256` | `ed25519`

`signatureHeader` — the HTTP header name carrying the signature (e.g. `stripe-signature`, `x-hub-signature-256`).

`secretConfigKey` — the config/env key name where the webhook secret is stored. Never hardcode the secret in source.

---

## Output Files

| File | Purpose |
|---|---|
| `webhook.handler.ts` (or similar) | Main handler: verify → ack → enqueue |
| `webhook-processor-artifact.json` | Compiled artifact with attestation |

---

## Gates

### WH001 — spec-valid
Reads `webhook-processor-spec.json`. Fails if missing or invalid JSON.

Required fields: `provider` (string), `signatureAlgorithm` (hmac-sha256|hmac-sha1|rsa-sha256|ed25519), `signatureHeader` (string), `secretConfigKey` (string).

BAD: `"signatureAlgorithm": "sha256"` — not in enum. Missing `secretConfigKey`. Missing `signatureHeader`.
GOOD:
```json
{
  "provider": "stripe",
  "signatureAlgorithm": "hmac-sha256",
  "signatureHeader": "stripe-signature",
  "secretConfigKey": "STRIPE_WEBHOOK_SECRET"
}
```

### WH002 — signature-verified
Scans all non-test source files for evidence of cryptographic signature verification. At least one of the following patterns must be present:

- `timingSafeEqual` — Node.js crypto timing-safe comparison
- `verifySignature` / `validateSignature` / `verifyWebhook` — named verification functions
- `hmac.digest` / `createHmac.*digest` — HMAC computation pattern
- `stripe.webhooks.constructEvent` — Stripe SDK verification
- `svix.verify` / `svix.Webhook` — Svix (Clerk/Svix) webhook library
- `x-hub-signature` / `x-stripe-signature` / `x-slack-signature` — provider header name near `crypto` / `hmac` / `digest`

Also passes if the signature header name (from spec) appears in source alongside `crypto`, `hmac`, or `digest` within close proximity.

BAD:
```ts
// No signature check at all — any request is accepted
export async function handleWebhook(req: Request, res: Response) {
  const event = req.body;
  await processEvent(event);
  res.sendStatus(200);
}
```
GOOD:
```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function handleWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // ... fast ack + async handoff
}
```
ALSO GOOD (manual HMAC):
```ts
import { createHmac, timingSafeEqual } from 'crypto';

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### WH003 — raw-body-preserved
Signature verification requires the **raw, unparsed body bytes**. Once Express/body-parser parses the body as JSON, the original bytes are gone and HMAC will not match.

The gate scans all source files for evidence of raw body preservation:
- `req.rawBody` — stored raw body property
- `express.raw(` — Express raw body parser
- `bodyParser.raw(` — body-parser raw middleware
- `rawBody:` — option key
- `Buffer.from(req.body` — manual buffer construction
- `getRawBody(` — raw-body npm package
- `rawBodySaver` — custom middleware pattern
- `raw-body` — import of the raw-body package
- `req.body instanceof Buffer` — Buffer type check

BAD:
```ts
// JSON-parsed body — signature will NEVER match
app.use(express.json());
app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  // req.body is already parsed object — HMAC mismatch guaranteed
  stripe.webhooks.constructEvent(req.body, sig, secret);
});
```
GOOD:
```ts
// Raw body middleware BEFORE JSON parsing for webhook routes
app.post('/webhook/stripe',
  express.raw({ type: 'application/json' }), // preserves raw Buffer
  (req, res) => {
    const sig = req.headers['stripe-signature']!;
    const event = stripe.webhooks.constructEvent(req.body, sig, secret); // req.body is Buffer
    // ...
  }
);
```
ALSO GOOD (rawBodySaver middleware):
```ts
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    (req as any).rawBody = buf; // save raw bytes before parsing
  }
}));
```

### WH004 — fast-ack
Webhook providers retry on timeout. If your handler does slow processing before responding, the provider sees a timeout and sends the webhook again — causing duplicate processing.

The gate requires at least one of these response patterns in source files:
- `res.sendStatus(200)` — Express sendStatus
- `res.status(200)` — Express status setter
- `res.status(202)` — Accepted status

BAD:
```ts
export async function handleWebhook(req: Request, res: Response) {
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  await processPayment(event.data.object); // slow — provider times out
  await sendConfirmationEmail(event.data.object.customer); // even slower
  res.sendStatus(200); // too late — provider already retried
}
```
GOOD:
```ts
export async function handleWebhook(req: Request, res: Response) {
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  await queue.add('process-webhook', { event }); // fast queue enqueue
  res.sendStatus(200); // respond immediately after enqueue
}
```

### WH005 — async-handoff
Acknowledging quickly is only half the requirement. The event must be handed off to an actual async processor — not just acknowledged and dropped. The gate requires at least one of these patterns in source files:

- `queue.add(` — BullMQ / Bull queue
- `setImmediate(` — Node.js immediate callback
- `setTimeout(` — deferred execution
- `eventBus.publish(` / `eventBus.emit(` — event bus publish
- `bull` / `bullmq` / `pg-boss` / `agenda` — queue library import/usage
- `producer.add(` / `producer.send(` / `producer.publish(` — generic producer
- `process.nextTick(` — next-tick deferral
- `worker.postMessage(` — Web Worker / Node worker_threads

BAD:
```ts
export async function handleWebhook(req: Request, res: Response) {
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  res.sendStatus(200); // fast ack — good
  // ... but then nothing happens. Event is dropped.
}
```
GOOD:
```ts
import { webhookQueue } from '../queues/webhook-queue';

export async function handleWebhook(req: Request, res: Response) {
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  await webhookQueue.add('stripe-event', {
    type: event.type,
    data: event.data,
    id: event.id,
  });
  res.sendStatus(200);
}
```
ALSO GOOD (event bus):
```ts
eventBus.publish('webhook.stripe', { event });
res.sendStatus(200);
```

### WH006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### WH007 — tests-pass
Hard-fails if no test files found. Tries vitest first, then jest. All tests must pass.

Tests should cover: valid signature accepted, tampered body rejected, missing header rejected, correct 200 response, queue/handoff called.

### WH008 — contract-webhook-processor
Reads the compiler-generated `webhook-processor-artifact.json`. Required fields: `ir_id`, `provider`, `signatureAlgorithm`, `attestation`.

- `ir_id` must start with `WEBHOOK_PROCESSOR:`
- `provider` must match `spec.provider`
- `signatureAlgorithm` must match `spec.signatureAlgorithm`
- `attestation.hash` must be present

---

## The Correct Webhook Handler Pattern

The four gates enforce a specific, non-negotiable execution order:

```
1. VERIFY signature (WH002) — reject bad requests early, before any processing
2. PRESERVE raw body (WH003) — must happen before JSON parsing, at middleware level
3. FAST ACK (WH004) — send 200/202 immediately after signature check passes
4. ASYNC HANDOFF (WH005) — enqueue event before responding, never after
```

```ts
// Middleware (app setup) — raw body BEFORE JSON parsing
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }), // WH003: raw Buffer preserved
  stripeWebhookHandler
);

// Handler
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  // WH002: verify signature first — reject forgeries with 400
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,          // Buffer — raw bytes (WH003)
      sig!,
      process.env[config.STRIPE_WEBHOOK_SECRET]!
    );
  } catch (err) {
    return res.status(400).send(`Signature verification failed: ${err.message}`);
  }

  // WH005: enqueue BEFORE responding
  await webhookQueue.add('stripe-event', {
    eventId: event.id,
    type: event.type,
    data: event.data.object,
  });

  // WH004: fast ack after enqueue
  res.sendStatus(200);
}
```

---

## What This Compiler Never Forgives

- `webhook-processor-spec.json` missing (WH001 hard-fails)
- `signatureAlgorithm` not in `hmac-sha256` | `hmac-sha1` | `rsa-sha256` | `ed25519` (WH001)
- No signature verification pattern found anywhere in source (WH002)
- No raw body preservation — using `express.json()` without raw body middleware or saver (WH003)
- No `res.sendStatus(200)` or `res.status(200/202)` in source (WH004)
- No async handoff — no queue, no `setImmediate`, no event bus publish (WH005)
- `TODO` / `FIXME` / `HACK` in any source file (WH006)
- No test files (WH007 hard-fails)
- `artifact.ir_id` not starting with `WEBHOOK_PROCESSOR:` (WH008)
- `attestation.hash` missing from artifact (WH008)
