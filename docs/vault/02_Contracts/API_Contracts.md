# API Contracts

## Overview

Base URL: `http://localhost:4200` (Kadima daemon; configurable via `.ogu/kadima.config.json`).
Authentication: none (local daemon).
Content types:
- JSON for requests/responses
- `text/event-stream` for SSE endpoints

Conventions:
- All timestamps are ISO 8601 strings in UTC.
- CORS: `*` with `GET, POST, DELETE, OPTIONS`.
- `OPTIONS` preflight returns `204`.

## Error Model

Errors return JSON with an `error` string:
```json
{ "error": "Human-readable message" }
```

Common status codes:
| Status | Meaning | Typical payload |
|---|---|---|
| 200 | OK | JSON object |
| 201 | Created | JSON object |
| 202 | Accepted (async) | `{ "accepted": true, ... }` |
| 204 | No Content (preflight) | empty |
| 400 | Bad request | `{ "error": "Missing required field: ..." }` |
| 404 | Not found | `{ "error": "Not found" }` |
| 409 | Conflict | `{ "error": "Pipeline already running" }` |
| 500 | Server error | `{ "error": "..." }` |
| 501 | Not wired | `{ "error": "Health probe not wired" }` |
| 503 | Service blocked | `{ "error": "...", "blocked": true }` |

## SSE Streams

`GET /api/events`
- Stream format: `data: { "type": "...", "timestamp": "...", "payload": { ... } }`
- Optional query: `feature=<slug>` to filter.
- First event on connect: `{ "type": "connected", "timestamp": "...", "clientCount": <number> }`.

`POST /api/wizard/research`
- Stream format: `event: research:progress|research:complete|research:error` with JSON `data`.
- Payloads:
  - `research:progress`: `{ step, step_id, step_index, total_steps: 5, done }`
  - `research:complete`: `{ report }`
  - `research:error`: `{ error }`

`POST /api/brief/launch`
- Stream format: `event: brief:generating|brief:complete|launch:complete|launch:error` with JSON `data`.
- Payloads:
  - `brief:generating`: `{ status }`
  - `brief:complete`: `{ slug, summary, root }`
  - `launch:complete`: `{ slug, summary, taskCount }`
  - `launch:error`: `{ error }`

## Shared Shapes

`CommandResult`
```json
{ "exitCode": 0, "stdout": "..." }
```

`JobRef`
```json
{ "jobId": "job-123" }
```

`TaskDef`
```json
{
  "taskId": "T1",
  "featureSlug": "feature-slug",
  "priority": 50,
  "estimatedCost": 0,
  "resourceType": "model_call",
  "blockedBy": ["T0"],
  "teamId": null,
  "taskSpec": null
}
```

`TaskEntry` (scheduler queue)
```json
{
  "taskId": "T1",
  "featureSlug": "feature-slug",
  "status": "pending|dispatched|completed|cancelled",
  "priority": 50,
  "estimatedCost": 0,
  "resourceType": "model_call",
  "blockedBy": [],
  "enqueuedAt": "2026-03-08T12:00:00.000Z",
  "promotions": 0,
  "teamId": null,
  "taskSpec": null
}
```

## Health & System

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status, uptime, pid, loops[], runners, memory, circuitBreakers, freeze, orgHealth, consistency }` |
| GET | `/api/health/probe` | — | `{ healthy: boolean, ... }` or `501` |
| GET | `/api/health/dashboard` | — | `{ ... }` or `501` |
| GET | `/api/health/aggregated` | — | `{ overall, results[] }` or `501` |

## Dashboards & Metrics

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/dashboard` | — | `{ health, features, scheduler, budget, circuitBreakers, freeze, orgHealth, recentEvents[] }` |
| GET | `/api/dashboard/snapshot` | — | `{ org, budget, audit, governance, agents, timestamp }` |
| GET | `/api/metrics` | — | `{ features, budget, scheduler }` |
| GET | `/api/budget` | — | `{ dailySpent, monthlySpent, byModel, byFeature }` |
| GET | `/api/budget/summary` | — | `{ dailySpent, monthlySpent, dailyLimit, monthlyLimit, dailyPercent, monthlyPercent, alertLevel, lastReset }` |
| GET | `/api/budget/data` | — | `{ daily, monthly }` |
| GET | `/api/org/data` | — | `{ company, roles[], providers[], budget, governance }` |

## State & Features

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/state` | — | `{ state, theme, profile, root, valid }` |
| GET | `/api/state/gates` | — | `{ ... }` |
| POST | `/api/state/involvement` | `{ level: "autopilot|guided|product-focused|hands-on" }` | `{ ok: true, level }` |
| GET | `/api/features` | — | `{ features: [{ slug, currentState, transitions, createdAt, updatedAt }] }` |
| GET | `/api/features/:slug` | — | `{ slug, phase, prd, spec, plan, metrics, qa }` |
| GET | `/api/features/:slug/timeline` | — | `{ slug, events: [{ type, timestamp, from?, to?, payload? }] }` |
| POST | `/api/features/:slug/activate` | — | `{ ok: true, root }` |
| DELETE | `/api/features/:slug` | — | `{ ok: true, deleted: "<slug>" }` |

## Compile & Artifacts

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/compile/:slug/report` | — | Compile report JSON |
| POST | `/api/ogu/compile` | `{ slug, fix?, gate?, verbose? }` | `CommandResult` |
| GET | `/api/ogu/artifacts/:slug` | — | `{ artifacts, count, index }` |
| GET | `/api/ogu/dag/:slug` | — | `{ ...dag, taskDetails, taskStatuses }` |
| POST | `/api/ogu/orchestrate/:slug` | `{ validate?: boolean }` | `CommandResult` |
| GET | `/api/ogu/worktrees` | — | `{ worktrees: string[], count }` |

## Scheduler & Tasks

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/enqueue` | `{ ...TaskDef }` or `{ tasks: TaskDef[] }` | `{ accepted, rejected, results: [{ taskId, enqueued, position?, reason?, error? }] }` |
| GET | `/api/task/:taskId` | — | `{ ...TaskEntry, runner: { pid, startedAt } | null }` |
| POST | `/api/task/:taskId/cancel` | — | `{ cancelled: true, taskId }` |
| GET | `/api/scheduler/status` | — | `{ total, pending, dispatched, completed, cancelled, updatedAt }` |
| POST | `/api/scheduler/force-tick` | — | `{ triggered: true, tickCount }` |
| GET | `/api/runners` | — | Runner pool status object |
| POST | `/api/allocate` | `{ tasks: [{ id, phase, ... }], featureSlug?, persist?, worktree? }` | `{ allocated, results }` |
| GET | `/api/standup` | Query: `eventLimit?`, `worktrees?` | Standup report JSON |

## Dispatch & Project Lifecycle

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/project/:slug/dispatch` | — | `202 { accepted: true, slug, message }` |
| POST | `/api/project/:slug/abort` | — | `{ ok: true, aborted: slug }` |
| POST | `/api/project/:slug/pause` | — | `{ ok: true, paused: slug }` |
| POST | `/api/project/:slug/resume` | — | `{ ok: true, resumed: slug }` |
| GET | `/api/project/:slug/dispatch-state` | — | `{ slug, state, pipelineActive }` |
| POST | `/api/brief/project/:slug/approve-team` | — | `{ ok: true }` |
| POST | `/api/brief/project/:slug/resume` | — | `{ ok: true, started: true, mode: "dispatch_resume|plan_regen" }` |
| POST | `/api/project/open` | `{ path }` | `{ ok: true, root }` |
| POST | `/api/project/init` | `{ path }` | `{ ok: true, valid: true, root }` |
| POST | `/api/project/delete` | `{ path }` | `{ ok: true, deleted: "<path>" }` |
| GET | `/api/project/active` | — | `{ project: { slug, root } | null }` |

## Command Execution (Kadima + Exec)

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/command` | `{ command, args?, requestId? }` | `202 { accepted: true, requestId, command, pid, message }` |
| POST | `/api/exec/command/sync` | `{ command, args? }` | `CommandResult` |
| POST | `/api/exec/gates/run` | `{ slug, force?, gate? }` | `JobRef` |
| POST | `/api/exec/gates/reset` | `{ slug }` | `JobRef` |
| POST | `/api/exec/features` | `{ slug }` | `JobRef` |
| POST | `/api/exec/features/:slug/switch` | — | `JobRef` |
| POST | `/api/exec/shell` | `{ cmd }` | `{ exitCode, stdout, stderr }` |
| POST | `/api/exec/theme/set` | `{ mood }` | `CommandResult` |
| POST | `/api/exec/upload` | `{ name, base64? | content? }` | `{ path, name }` |

## Ogu Domain

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/ogu/org` | — | `{ orgId, roles, teams, providers, escalation, defaults }` |
| POST | `/api/ogu/org/init` | `{ orgId? }` | `CommandResult` |
| GET | `/api/ogu/agents` | — | `{ agents: [...], count }` |
| GET | `/api/ogu/agents/stats` | — | `{ totalAgents, totalCompleted, totalFailed, totalTokens, totalCost, successRate, avgCostPerTask, escalations, byDepartment }` |
| POST | `/api/ogu/agents` | `{ roleId, name?, department?, capabilities?, risk?, model?, phases? }` | `CommandResult` |
| GET | `/api/ogu/agents/:roleId` | — | `{ ...role, state }` |
| POST | `/api/ogu/agents/:roleId/run` | `{ taskId, featureSlug }` | `CommandResult` |
| POST | `/api/ogu/agents/:roleId/stop` | `{ force? }` | `CommandResult` |
| POST | `/api/ogu/agents/:roleId/escalate` | `{ targetTier? }` | `CommandResult` |
| GET | `/api/ogu/budget` | — | `{ status, dailyLimit, todaySpent, remaining, daily, lastUpdated }` |
| GET | `/api/ogu/budget/history` | Query: `days?` | `{ transactions, byDay, byModel, byRole, byFeature, days }` |
| GET | `/api/ogu/audit` | Query: `limit?`, `type?`, `feature?` | `{ events, count, showing }` |
| GET | `/api/ogu/audit/types` | — | `{ types }` |
| GET | `/api/ogu/governance/pending` | — | `{ pending, count }` |
| GET | `/api/ogu/governance/history` | Query: `limit?` | `{ history, count }` |
| GET | `/api/ogu/governance/policies` | — | Policies JSON |
| POST | `/api/ogu/governance/approve` | `{ taskId, actor? }` | `CommandResult` |
| POST | `/api/ogu/governance/deny` | `{ taskId, reason?, actor? }` | `CommandResult` |
| GET | `/api/ogu/model/status` | — | `{ decisions, byModel, escalations, recent }` |
| GET | `/api/ogu/determinism` | — | `{ violations, byType, entries }` |
| POST | `/api/ogu/kadima/allocate` | `{ slug, enqueue?, dryRun? }` | `CommandResult` |
| POST | `/api/ogu/kadima/standup` | — | `CommandResult` |

## Marketplace

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/marketplace/agents` | Query: `role?`, `tier?`, `available?` | `{ agents: [{ ...profile, price }] }` |
| GET | `/api/marketplace/agents/:id` | — | `{ ...profile, price, allocations }` |
| POST | `/api/marketplace/agents/generate` | `{ role, specialty, tier, seed? }` | `201 { agent: { ...profile, base_price } }` |
| POST | `/api/marketplace/agents/populate` | `{ count? }` | `{ created, ids }` |
| POST | `/api/marketplace/hire` | `{ projectId, agentId, roleSlot?, allocationUnits, priorityLevel? }` | `201 { allocation }` |
| DELETE | `/api/marketplace/allocations/:id` | — | `{ ok: true, released: "<id>" }` |
| GET | `/api/marketplace/allocations` | Query: `projectId?`, `agentId?` | `{ allocations }` |
| GET | `/api/marketplace/patterns` | — | `{ patterns }` |

## Wizard

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/wizard/classify` | `{ mode, description }` | `{ archetypes[], suggested_mode?, disambiguation?, detail_level, model, cost }` |
| POST | `/api/wizard/classifyRetry` | `{ mode, description }` | Same as `/classify` |
| POST | `/api/wizard/expand` | `{ description, mode? }` | `{ expanded, brief, cost }` |
| POST | `/api/wizard/clarify` | `{ description, archetypeId, detailLevel?, previousAnswers? }` | `{ questions[], model, cost }` |
| POST | `/api/wizard/palette` | `{ description, archetypeId?, detailLevel?, previousAnswers? }` | `{ palettes[], model, cost }` |
| POST | `/api/wizard/personalize` | `{ archetypeId, stepId, step, userDescription, previousAnswers?, detailLevel? }` | `{ questions[], model, cost }` |
| POST | `/api/wizard/research` | `{ description, mode, slug? }` | SSE stream (see above) |

## Brief

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/brief/launch` | `{ mode, archetypeId?, archetypeTitle?, description, answers? }` | SSE stream (see above) |
| POST | `/api/brief/project/:slug/approve-team` | — | `{ ok: true }` |
| POST | `/api/brief/project/:slug/resume` | — | `{ ok: true, started: true, mode }` |

## Sessions, Search, Analytics

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/sessions` | — | `{ sessions }` |
| POST | `/api/sessions` | `{ ... }` | `{ ok: true }` |
| GET | `/api/search` | Query: `q`, `types?`, `limit?` | `{ results }` |
| GET | `/api/audit/search` | Query: `feature?`, `type?`, `severity?`, `since?`, `limit?` | `{ results }` |
| GET | `/api/audit/data` | Query: `limit?` | `{ events, total }` |
| GET | `/api/governance/data` | — | `{ pendingApprovals, policies }` |
| GET | `/api/agents/data` | — | `{ sessions, roles }` |
| GET | `/api/execution/feed` | Query: `type?`, `taskId?`, `feature?`, `since?`, `limit?` | `{ events, total }` |
| GET | `/api/execution/stats` | — | `{ total, byType }` |
| GET | `/api/execution/events` | — | `{ events }` |
| POST | `/api/execution/emit` | `{ type, payload? }` | `{ event }` |

## Widgets & UI Utilities

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/widgets/types` | — | `{ types }` |
| POST | `/api/widgets/create` | `{ type, title?, data?, style? }` | `{ widget }` |
| POST | `/api/widgets/layout` | `{ widgets, columns? }` | `{ layout, serialized }` |
| GET | `/api/pipeline/progress` | — | `{ progress, eta }` |
| POST | `/api/pipeline/progress` | `{ ... }` | `{ ok: true, progress }` |

## Files, Logs, Theme, Billing

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/files` | Query: `depth?` | `{ name, type, children }` |
| GET | `/api/dirs` | Query: `path?` | `{ path, dirs, hasOgu }` |
| GET | `/api/logs/recent` | — | `[{ name, content }]` |
| GET | `/api/theme/presets` | — | Preset list |
| GET | `/api/billing/subscription` | — | `{ plan, balance, usage }` |
| POST | `/api/billing/checkout` | — | `400 { error: "Billing not configured — enable AOAS mode for payments" }` |
| POST | `/api/billing/portal` | — | `400 { error: "Billing not configured — enable AOAS mode for payments" }` |
| GET | `/api/billing/credits` | — | `{ balance, transactions }` |
