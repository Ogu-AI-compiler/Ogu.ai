# MicroVM Matrix Contract

> Formal contract for sandboxed task execution — isolation levels, resource limits, lifecycle management, and side-effect prevention.

## Version

1.0

## Purpose

The MicroVM Matrix provides execution isolation for agent tasks. Each task can opt-in to sandboxed execution with configurable isolation level and resource limits. The system guarantees no side effects escape the sandbox and resource enforcement is strict.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/vms/{vmId}.json` | Individual VM spec and status |
| `.ogu/vms/matrix.json` | Current execution matrix (all active VMs) |

## Components

| Component | Path |
|-----------|------|
| MicroVM matrix engine | `tools/ogu/commands/lib/microvm-matrix.mjs` |
| Sandbox policy | `tools/ogu/commands/lib/sandbox-policy.mjs` |
| Isolation manager | `tools/ogu/commands/lib/isolation-manager.mjs` |

## Isolation Levels

| Level | Name | Description | Overhead | Security |
|-------|------|-------------|----------|----------|
| L0 | `none` | No isolation — runs in same process | 0 MB | Low |
| L1 | `process` | Separate OS process with resource limits | 50 MB | Medium |
| L2 | `worktree` | Git worktree isolation + separate process | 100 MB | Medium |
| L3 | `container` | Full container isolation (Docker/Podman) | 200 MB | High |

## Resource Limits

| Resource | Field | Default (L1) | Default (L3) |
|----------|-------|--------------|--------------|
| Memory | `maxMemoryMB` | 512 MB | 1024 MB |
| CPU | `maxCpuPercent` | 50% | 100% |
| Timeout | `timeoutMs` | 120,000 ms | 300,000 ms |
| Disk | `maxDiskMB` | (not limited) | 2048 MB |
| Network | Per sandbox policy | Per role policy | Per role policy |

## Lifecycle

| Phase | Description | Actions |
|-------|-------------|---------|
| 1. Allocate | Create VM spec, validate resource quota | `createVMSpec()`, `validateResourceQuota()` |
| 2. Execute | Run task inside sandbox | Process spawn / container run |
| 3. Collect | Gather outputs, artifacts, logs | Copy results from sandbox to main workspace |
| 4. Destroy | Release resources, remove sandbox | Kill process / remove container / delete worktree |

## Activation

Opt-in per task in `Plan.json`:

```json
{
  "id": "T3",
  "sandbox": true,
  "isolation": "process",
  "resources": { "maxMemoryMB": 256, "maxCpuPercent": 25 }
}
```

Or via CLI: `ogu microvm:create --task <taskId> --isolation process`

## Execution Matrix

When running parallel builds (`build-parallel`), the matrix planner:

1. Reads all tasks from Plan.json that have `sandbox: true`.
2. Calls `createExecutionMatrix({ tasks })` to allocate VMs.
3. Validates total resource demand against system limits via `validateResourceQuota()`.
4. If demand exceeds limits, reduces concurrency or queues tasks.

## Invariants

1. No side effects escape the sandbox: file writes, network calls, and process spawning are contained.
2. Resource limits are enforced by the OS (process limits) or container runtime (cgroup limits).
3. A VM that exceeds its timeout is force-killed and its outputs quarantined.
4. A VM that exceeds its memory limit is OOM-killed and the task marked as failed.
5. Sandbox policy from the Sandbox Contract is applied inside the VM (blocked paths, network policy).
6. Every VM allocation and destruction is audited.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `ogu microvm:create --task <id> --isolation <level>` | Create a MicroVM sandbox for a task |
| `ogu microvm:allocate --task <id>` | Allocate resources for a MicroVM |
| `ogu microvm:destroy --vm <vmId>` | Destroy a MicroVM sandbox and release resources |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU-VM-001 | Resource quota exceeded — not enough memory or CPU available |
| OGU-VM-002 | VM timeout — task exceeded maximum execution time |
| OGU-VM-003 | VM OOM — task exceeded maximum memory |
| OGU-VM-004 | Sandbox escape detected — side effect outside allowed scope |
| OGU-VM-005 | VM destroy failed — orphaned resources need manual cleanup |
