# Event Publisher Module Compiler

## Purpose
Compiles a typed event publisher. Publishers are pure dispatch — they build an envelope and send it. No business logic, no DB calls, no HTTP.

## Invariants

1. **Typed envelope** — Every event includes: `{ eventType, aggregateId, timestamp, version, payload }`.
2. **Channel from constants** — Never `publish('my-channel', ...)`. Import from `CHANNELS` or `TOPICS`.
3. **Pure dispatch** — No DB, no HTTP inside publisher functions.
4. **Await publish** — `await eventBus.publish(...)`.

## Standard Pattern

```typescript
import { CHANNELS } from './channels';
import type { OrderCreatedPayload } from './order-created.types';

interface OrderCreatedEvent {
  eventType: 'ORDER_CREATED';
  aggregateId: string;
  aggregateType: 'Order';
  timestamp: string;
  version: 1;
  payload: OrderCreatedPayload;
}

export async function publishOrderCreated(orderId: string, payload: OrderCreatedPayload): Promise<void> {
  const event: OrderCreatedEvent = {
    eventType: 'ORDER_CREATED',
    aggregateId: orderId,
    aggregateType: 'Order',
    timestamp: new Date().toISOString(),
    version: 1,
    payload,
  };
  await eventBus.publish(CHANNELS.ORDERS, event);
}
```

## spec format (`event-publisher-spec.json`)
```json
{
  "eventType": "ORDER_CREATED",
  "aggregateType": "Order",
  "channel": "orders",
  "payloadType": "OrderCreatedPayload",
  "version": 1
}
```

## Error codes

| Code  | Meaning                                          |
|-------|--------------------------------------------------|
| EP001 | event-publisher-spec.json missing or invalid     |
| EP002 | Missing envelope fields (eventType/aggregateId)  |
| EP003 | Channel hardcoded as string literal              |
| EP004 | Business logic (DB/HTTP) in publisher            |
| EP005 | Publish not awaited                              |
| EP006 | TODO/FIXME/HACK comment                          |
| EP007 | Tests failed                                     |
| EP008 | Event publisher contract violation               |
