# Ogu Studio UI Architecture

## Full Frontend + Event-Sourced Design

Generated: 2026-02-28T00:54:15.029653 UTC

------------------------------------------------------------------------

# 1. Vision

Ogu Studio UI is not a dashboard. It is a deterministic control room for
an agentic operating system.

The UI reflects only verified, ordered, replayable state. No optimistic
success. No hidden mutations. Everything is traceable.

------------------------------------------------------------------------

# 2. Core Principles

1.  Event-Sourced UI\
    The frontend is a projection layer over ordered server events.

2.  Deterministic Rendering\
    Every visible state maps to a snapshotHash, commitHash, or ordered
    event sequence.

3.  No Optimistic Success\
    Actions are pending until committed.

4.  Human Override Capability\
    Users may preempt locks and override execution.

5.  Time Travel Native\
    Snapshots + deltas enable deterministic historical reconstruction.

------------------------------------------------------------------------

# 3. UI Layout Structure

Top Bar: - Breadcrumbs - Global Search - Freeze - Halt - Connection
Status

Left Navigation: - Org - Features - Governance - System

Main Workspace: - DAG - Editor - Audit - Health

Right Panel: - Chatplex - GenUI Widgets

Bottom Ticker: - Active VMs - Locks - Budget - Alerts - Sync State

------------------------------------------------------------------------

# 4. Event Envelope Contract

Every server event must conform to this structure:

``` ts
interface StudioEventEnvelope<TType extends string = string, TPayload = unknown> {
  eventId: string;
  type: TType;
  schemaVersion: number;

  serverTime: string;
  source: 'kadima' | 'agent' | 'system' | 'human';

  streamKey: string;
  seq: number;

  correlationId: string;
  causationId: string | null;

  snapshotHash: string | null;
  commitHash: string | null;

  priority: 'critical' | 'high' | 'normal' | 'low';

  payload: TPayload;
}
```

Ordering is guaranteed per streamKey via seq.

------------------------------------------------------------------------

# 5. Frontend Architecture

Layered model:

1.  Zustand UI Store
2.  WebSocket Transport
3.  Event Processor
4.  Materialized Views
5.  IndexedDB Replica
6.  React Rendering

------------------------------------------------------------------------

# 6. Zustand UI Store

UI-only state:

``` ts
interface OguUIState {
  focusedFeature: string | null;
  focusedTask: string | null;
  focusedFile: string | null;

  activeView: 'DAG' | 'EDITOR' | 'AUDIT' | 'HEALTH';

  chatMode: 'kadima' | 'agent' | 'knowledge';
  chatTargetId: string | null;

  timeTravel: {
    active: boolean;
    featureSlug: string | null;
    timestamp: string | null;
    snapshotHash: string | null;
  };
}
```

No audit history stored here.

------------------------------------------------------------------------

# 7. IndexedDB Replica (Dexie)

Used for: - Audit Events - Snapshots - Stream cursors

``` ts
this.version(1).stores({
  auditEvents: 'id, featureSlug, timestamp, type, seq, streamKey',
  snapshots: 'id, featureSlug, capturedAt, snapshotHash, baseSeq',
  streamCursors: 'streamKey, lastSeq, updatedAt'
});
```

------------------------------------------------------------------------

# 8. Materialized Views

In-memory derived state:

-   locks
-   vms
-   dagByFeature
-   budgetByFeature
-   governanceQueue

Views update via reducer on each event.

------------------------------------------------------------------------

# 9. Event Processing Flow

1.  WebSocket receives event
2.  Validate schema
3.  Persist if needed
4.  Update materialized views
5.  Notify subscribers
6.  React re-renders

Critical events bypass batching.

------------------------------------------------------------------------

# 10. Backpressure Rules

VM_STDOUT: - Server batches 100ms - Client caps buffer size

BUDGET_TICK: - Coalesced 250ms

Critical events never sampled: - GOV_BLOCKED - INTENT_STATE committed -
SNAPSHOT_AVAILABLE

------------------------------------------------------------------------

# 11. Reconnect Strategy

Client sends:

``` json
{ "type": "RESUME", "resume": { streamKey: lastSeq } }
```

Server either: - Sends missed events - Or instructs client to reload
snapshot

------------------------------------------------------------------------

# 12. Time Travel Algorithm

1.  Load nearest snapshot
2.  Apply deltas up to timestamp
3.  Render derived state
4.  UI switches to read-only

------------------------------------------------------------------------

# 13. GenUI Contract

Widget rendering must follow:

-   Allowlist widgetType
-   Schema validation via zod
-   Version pinning
-   Sanitization

Fallback on invalid payload.

------------------------------------------------------------------------

# 14. Governance UI

Displays: - Policy blocks - Required approvals - Risk tier - Trace
resolution

No state mutation until committed event received.

------------------------------------------------------------------------

# 15. Human Override

If file locked:

Options: - View lock trace - Request preempt - Force override

Override generates committed audit event.

------------------------------------------------------------------------

# 16. Deterministic UI Contract

1.  Only committed or verified events affect visible state.
2.  No optimistic completion.
3.  Time travel renders from snapshot + deltas.
4.  Every critical UI element references eventId, snapshotHash, or
    commitHash.
5.  Widget rendering strictly validated.

------------------------------------------------------------------------

# 17. Summary

Ogu Studio UI is:

-   Event-sourced
-   Deterministic
-   Replayable
-   Auditable
-   Human-interruptible

It behaves as a control surface for an agentic OS, not as a conventional
SPA.
