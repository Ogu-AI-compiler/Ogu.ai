# Sandbox Policy Contract

> Formal contract for the sandbox isolation system — filesystem, network, process, and tool restrictions per role.

## Version

1.0

## Purpose

Enforce isolation boundaries per agent role. Prevent unauthorized file access, network calls, tool usage, and resource consumption.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/sandbox-policy.json` | Policy definitions per role |

## Policy Tiers

| Tier | Description | Roles |
|------|-------------|-------|
| `minimal` | Read-only, no writes, no network, no secrets | qa |
| `standard` | Read/write within ownership scope, limited network | backend-dev, frontend-dev, designer |
| `privileged` | Full access with verbose auditing | devops, security, tech-lead, cto |

## Filesystem Policy

| Field | Type | Description |
|-------|------|-------------|
| `readScope` | string[] | Glob patterns for readable paths |
| `writeScope` | string[] | Glob patterns for writable paths |
| `blockedPaths` | string[] | Always-blocked patterns (.env*, *.pem, *.key) |

## Network Policy

| Level | Description |
|-------|-------------|
| `deny` | No outbound network |
| `allowlist` | Only listed hosts/ports |
| `allow` | Full network access |

## Tool Policy

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | string[] | Tools the role can use (`*` = all) |
| `blocked` | string[] | Explicitly blocked tools |

## Process Limits

| Field | Description |
|-------|-------------|
| `maxMemoryMb` | Max memory in MB |
| `maxCpuPercent` | Max CPU usage |
| `timeoutMs` | Max execution time |
| `maxChildProcesses` | Max child processes |

## CLI Commands

Integration via `resolveSandboxPolicy()` — no dedicated CLI.

## Invariants

1. Blocked paths ALWAYS override allowed scope.
2. Unknown roles get deny-all policy.
3. Security role can READ everything but WRITE nothing.
4. Sandbox policy is checked BEFORE every file/tool/network access.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3201 | Path blocked by sandbox policy |
| OGU3202 | Role has no read/write permissions |
| OGU3203 | Path outside scope |
| OGU3204 | Tool blocked for role |
| OGU3205 | Tool not in allowlist |
| OGU3206 | Network access denied |
| OGU3207 | Host/port not in network allowlist |

## Implementation

| Component | Path |
|-----------|------|
| Sandbox policy engine | `tools/ogu/commands/lib/sandbox-policy.mjs` |
