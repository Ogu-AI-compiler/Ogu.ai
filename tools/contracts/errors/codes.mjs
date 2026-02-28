/**
 * @ogu/contracts — Centralized Error Codes
 *
 * All OGU error codes in one place. Every service imports from here.
 * Format: OGU{NNNN} where NNNN is a 4-digit code.
 *
 * Ranges:
 *   0001-1499  Existing Ogu (14 gates)
 *   2001-2699  Core Phases (0-6)
 *   2701-3299  Structural Fixes (1-8)
 *   3301-3599  Stones (1-6)
 *   3601-4099  Closures 1-4 + Enhancement 1
 *   4101-4299  Closures 5-8 + Enhancements 4-6
 *   4301-4699  Closures 9-12
 *   5001-5699  Physical Architecture (Iteration 7)
 */

// ── Phase 0: OrgSpec & Agent Registry ──
export const OGU2001 = { code: 'OGU2001', name: 'ORGSPEC_MISSING', severity: 'critical' };
export const OGU2002 = { code: 'OGU2002', name: 'ORGSPEC_INVALID', severity: 'critical' };
export const OGU2003 = { code: 'OGU2003', name: 'AGENT_NOT_FOUND', severity: 'error' };
export const OGU2004 = { code: 'OGU2004', name: 'AGENT_ROLE_INVALID', severity: 'error' };
export const OGU2005 = { code: 'OGU2005', name: 'AGENT_DUPLICATE_ROLE', severity: 'warn' };

// ── Phase 1: Model Router ──
export const OGU2101 = { code: 'OGU2101', name: 'ROUTER_NO_PROVIDER', severity: 'critical' };
export const OGU2102 = { code: 'OGU2102', name: 'ROUTER_CAPABILITY_MISMATCH', severity: 'error' };
export const OGU2103 = { code: 'OGU2103', name: 'ROUTER_ESCALATION_EXHAUSTED', severity: 'error' };
export const OGU2104 = { code: 'OGU2104', name: 'ROUTER_PROVIDER_TIMEOUT', severity: 'error' };

// ── Phase 2: Budget System ──
export const OGU2201 = { code: 'OGU2201', name: 'BUDGET_EXCEEDED', severity: 'error' };
export const OGU2202 = { code: 'OGU2202', name: 'BUDGET_DAILY_LIMIT', severity: 'warn' };
export const OGU2203 = { code: 'OGU2203', name: 'BUDGET_FEATURE_LIMIT', severity: 'warn' };
export const OGU2204 = { code: 'OGU2204', name: 'BUDGET_LEDGER_CORRUPT', severity: 'critical' };

// ── Phase 3: Audit Trail ──
export const OGU2301 = { code: 'OGU2301', name: 'AUDIT_WRITE_FAILED', severity: 'critical' };
export const OGU2302 = { code: 'OGU2302', name: 'AUDIT_REPLAY_MISMATCH', severity: 'error' };

// ── Phase 4: Governance Engine ──
export const OGU2401 = { code: 'OGU2401', name: 'GOVERNANCE_POLICY_BLOCKED', severity: 'error' };
export const OGU2402 = { code: 'OGU2402', name: 'GOVERNANCE_APPROVAL_REQUIRED', severity: 'warn' };
export const OGU2403 = { code: 'OGU2403', name: 'GOVERNANCE_APPROVAL_DENIED', severity: 'error' };

// ── Phase 5: Kadima ──
export const OGU2501 = { code: 'OGU2501', name: 'KADIMA_ALLOCATION_FAILED', severity: 'error' };
export const OGU2502 = { code: 'OGU2502', name: 'KADIMA_TASK_CONFLICT', severity: 'warn' };

// ── Phase 6: Agent Runtime ──
export const OGU2601 = { code: 'OGU2601', name: 'RUNTIME_AGENT_FAILED', severity: 'error' };
export const OGU2602 = { code: 'OGU2602', name: 'RUNTIME_ENVELOPE_INVALID', severity: 'critical' };
export const OGU2603 = { code: 'OGU2603', name: 'RUNTIME_WORKTREE_ERROR', severity: 'error' };

// ── Fix 2: Feature State Machine ──
export const OGU2801 = { code: 'OGU2801', name: 'STATE_INVALID_TRANSITION', severity: 'error' };
export const OGU2802 = { code: 'OGU2802', name: 'STATE_GUARD_FAILED', severity: 'error' };
export const OGU2803 = { code: 'OGU2803', name: 'STATE_FILE_CORRUPT', severity: 'critical' };

// ── Iteration 7: Physical Architecture ──

// Runner Execution (Topology 1)
export const OGU5001 = { code: 'OGU5001', name: 'RUNNER_GENERIC_ERROR', severity: 'error' };
export const OGU5002 = { code: 'OGU5002', name: 'RUNNER_TIMEOUT', severity: 'error' };
export const OGU5003 = { code: 'OGU5003', name: 'RUNNER_SANDBOX_VIOLATION', severity: 'critical' };
export const OGU5004 = { code: 'OGU5004', name: 'RUNNER_LLM_CALL_FAILED', severity: 'error' };
export const OGU5005 = { code: 'OGU5005', name: 'RUNNER_ARTIFACT_INVALID', severity: 'error' };

// File Locks (Topology 2)
export const OGU5101 = { code: 'OGU5101', name: 'LOCK_TIMEOUT', severity: 'error' };
export const OGU5102 = { code: 'OGU5102', name: 'LOCK_STALE_DETECTED', severity: 'warn' };
export const OGU5103 = { code: 'OGU5103', name: 'LOCK_DEADLOCK', severity: 'critical' };

// Runner Pool (Topology 3)
export const OGU5201 = { code: 'OGU5201', name: 'POOL_NO_SLOTS', severity: 'warn' };
export const OGU5202 = { code: 'OGU5202', name: 'POOL_RUNNER_CRASHED', severity: 'error' };
export const OGU5203 = { code: 'OGU5203', name: 'POOL_DRAIN_TIMEOUT', severity: 'warn' };

// Kadima Daemon (Topology 4)
export const OGU5301 = { code: 'OGU5301', name: 'DAEMON_ALREADY_RUNNING', severity: 'warn' };
export const OGU5302 = { code: 'OGU5302', name: 'DAEMON_START_FAILED', severity: 'critical' };
export const OGU5303 = { code: 'OGU5303', name: 'DAEMON_LOOP_ERROR', severity: 'error' };
export const OGU5304 = { code: 'OGU5304', name: 'DAEMON_SHUTDOWN_TIMEOUT', severity: 'warn' };
export const OGU5305 = { code: 'OGU5305', name: 'DAEMON_CONFIG_INVALID', severity: 'critical' };

// IPC Protocol (Topology 3)
export const OGU5401 = { code: 'OGU5401', name: 'IPC_CONNECTION_FAILED', severity: 'error' };
export const OGU5402 = { code: 'OGU5402', name: 'IPC_COMMAND_REJECTED', severity: 'error' };
export const OGU5403 = { code: 'OGU5403', name: 'IPC_TIMEOUT', severity: 'error' };

// Task Queue (Topology 5)
export const OGU5501 = { code: 'OGU5501', name: 'QUEUE_FULL', severity: 'warn' };
export const OGU5502 = { code: 'OGU5502', name: 'QUEUE_PERSISTENCE_FAILED', severity: 'critical' };

// Remote Runners (Milestone 3)
export const OGU5601 = { code: 'OGU5601', name: 'REMOTE_RUNNER_UNREACHABLE', severity: 'error' };
export const OGU5602 = { code: 'OGU5602', name: 'REMOTE_RUNNER_AUTH_FAILED', severity: 'critical' };
export const OGU5603 = { code: 'OGU5603', name: 'REMOTE_RUNNER_CAPACITY_EXCEEDED', severity: 'warn' };

/**
 * Lookup error by code string.
 * @param {string} code - e.g. 'OGU2001'
 * @returns {{ code: string, name: string, severity: string } | undefined}
 */
export function lookupError(code) {
  return ALL_ERRORS.find(e => e.code === code);
}

/** All error codes as a flat array */
export const ALL_ERRORS = [
  OGU2001, OGU2002, OGU2003, OGU2004, OGU2005,
  OGU2101, OGU2102, OGU2103, OGU2104,
  OGU2201, OGU2202, OGU2203, OGU2204,
  OGU2301, OGU2302,
  OGU2401, OGU2402, OGU2403,
  OGU2501, OGU2502,
  OGU2601, OGU2602, OGU2603,
  OGU2801, OGU2802, OGU2803,
  OGU5001, OGU5002, OGU5003, OGU5004, OGU5005,
  OGU5101, OGU5102, OGU5103,
  OGU5201, OGU5202, OGU5203,
  OGU5301, OGU5302, OGU5303, OGU5304, OGU5305,
  OGU5401, OGU5402, OGU5403,
  OGU5501, OGU5502,
  OGU5601, OGU5602, OGU5603,
];
