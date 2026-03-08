# Event Consumer Module Compiler

## Purpose
Compiles an event consumer with at-least-once delivery guarantees. Idempotency is mandatory.

## Invariants

1. **Validate on receipt** — Schema parse envelope before accessing payload.
2. **Idempotency first** — Persist processed event ID before doing work.
3. **Classify errors** — Dead-letter non-retryable. Retry transient.
4. **Channel scoped** — Only subscribe to declared channels.

## Standard Pattern

```typescript
eventBus.subscribe(CHANNELS.ORDERS, async (event) => {
  // 1. Validate
  const envelope = orderCreatedSchema.parse(event);

  // 2. Idempotency — before any processing
  const seen = await redis.set(`processed:${envelope.aggregateId}:${envelope.eventType}`, '1', { NX: true, EX: 86400 });
  if (!seen) return; // already processed

  // 3. Process
  try {
    await fulfillmentService.createFulfillment(envelope.payload);
  } catch (err) {
    if (err instanceof ValidationError) {
      await dlq.send(event); // non-retryable → dead letter
      return;
    }
    throw err; // retryable → let broker retry
  }
});
```

## Error codes

| Code  | Meaning                                               |
|-------|-------------------------------------------------------|
| EC001 | event-consumer-spec.json missing or invalid           |
| EC002 | Publisher artifact mismatch (eventType/channel)       |
| EC003 | Envelope not validated before payload access          |
| EC004 | No idempotency persistence found                      |
| EC005 | Errors not classified (no DLQ/dead-letter pattern)    |
| EC006 | Subscription to undeclared channel                    |
| EC007 | TODO/FIXME/HACK comment                               |
| EC008 | Tests failed                                          |
| EC009 | Event consumer contract violation                     |
