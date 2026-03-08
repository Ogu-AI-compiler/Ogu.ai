# Webhook Processor Module Compiler

## Purpose
Compiles a webhook receiver with security-first semantics: verify before parse, ack fast, process async.

## Invariants

1. **Verify before parse** — HMAC/signature check before touching payload. Timing-safe comparison.
2. **Raw body preserved** — Use `express.raw()` so signature verification has the original bytes.
3. **Fast ack** — `res.sendStatus(200)` before any async work. Webhooks have ~5s timeout.
4. **Async handoff** — Enqueue to BullMQ or publish event. Never process synchronously in HTTP handler.

## Standard Pattern

```typescript
// routes/stripe-webhook.ts
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }), // raw body for sig verification
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }

    // Ack immediately — before any async work
    res.sendStatus(200);

    // Hand off to queue
    await queue.add('stripe-event', { eventType: event.type, data: event.data });
  }
);
```

## spec format
```json
{
  "provider": "stripe",
  "signatureAlgorithm": "hmac-sha256",
  "signatureHeader": "stripe-signature",
  "secretConfigKey": "stripe.webhookSecret"
}
```

## Error codes

| Code  | Meaning                                             |
|-------|-----------------------------------------------------|
| WH001 | webhook-processor-spec.json missing or invalid      |
| WH002 | No signature verification found                     |
| WH003 | Raw body not preserved (JSON-parsed before verify)  |
| WH004 | No fast ack (HTTP 200/202 before processing)        |
| WH005 | Business logic not async (no queue/event handoff)   |
| WH006 | TODO/FIXME/HACK comment                             |
| WH007 | Tests failed                                        |
| WH008 | Webhook processor contract violation                |
