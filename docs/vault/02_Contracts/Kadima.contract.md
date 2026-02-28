# Kadima Contract

> Formal contract for the Kadima daemon — the organization OS orchestrator.

## Version

1.0

## Purpose

Kadima is the background daemon that orchestrates agent execution: scheduling tasks, managing runner pools, enforcing state machine transitions, and broadcasting events.

## Architecture

```
kadima:start → daemon.mjs (port 4200)
  ├─ Scheduler Loop — polls queue, dispatches tasks to runners
  ├─ State Machine Loop — auto-transitions features through pipeline
  ├─ Runner Pool — concurrent agent execution with isolation
  └─ SSE Event Stream — real-time updates to Studio
```

## Configuration

`.ogu/kadima.config.json`:
```json
{
  "port": 4200,
  "maxRunners": 3,
  "schedulerIntervalMs": 5000,
  "stateMachineIntervalMs": 10000,
  "shutdownTimeoutMs": 30000
}
```

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with uptime, memory, runner count |
| `GET` | `/api/features` | List all features with states |
| `GET` | `/api/features/:slug/timeline` | Feature event timeline |
| `GET` | `/api/compile/:slug/report` | Compilation report |
| `GET` | `/api/metrics` | System metrics (features, budget, scheduler) |
| `GET` | `/api/budget` | Budget summary |
| `GET` | `/api/events` | SSE event stream |
| `POST` | `/api/features/:slug/enqueue` | Enqueue task for feature |

## SSE Events

| Event | When |
|-------|------|
| `feature:transition` | Feature state changes |
| `task:started` | Runner begins task |
| `task:completed` | Runner finishes task |
| `task:failed` | Runner reports failure |
| `budget:alert` | Budget threshold crossed |
| `runner:spawned` | New runner started |
| `runner:exited` | Runner process ended |

## Scheduler Invariants

1. Tasks are dispatched FIFO within priority bands.
2. A task with unmet dependencies is NEVER dispatched.
3. A runner slot is NEVER double-allocated.
4. Feature state MUST be `building` or later for task dispatch.
5. Budget check occurs BEFORE runner spawn.

## Runner Pool Invariants

1. `maxRunners` limits concurrent executions.
2. Each runner operates in an isolated context (worktree when available).
3. Runner timeout kills the process after configured duration.
4. Graceful shutdown drains all active runners before exit.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `kadima:start` | Start daemon (detached) |
| `kadima:stop` | Stop daemon (graceful) |
| `kadima:status` | Show daemon health |
| `kadima:enqueue` | Add task to scheduler queue |
| `kadima:standup` | Generate daily standup from audit trail |
| `task:allocate` | Allocate roles to Plan.json tasks |

## Process Lifecycle

```
start → running → [SIGTERM] → draining → stopped
                → [SIGKILL] → killed
```

PID file: `.ogu/kadima.pid`

## Error Codes

| Code | Meaning |
|------|---------|
| OGU6001 | Daemon already running |
| OGU6002 | Daemon not running |
| OGU6003 | Runner pool exhausted |
| OGU6004 | Task dependency cycle |
| OGU6005 | Feature not in valid state for dispatch |
