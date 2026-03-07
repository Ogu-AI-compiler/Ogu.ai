/**
 * WebSocket event type definitions.
 *
 * Phase 3B: Studio WebSocket infrastructure modules are wired here.
 * All factory functions are re-exported so server.ts can import them from
 * a single location without needing to resolve .mjs paths directly.
 */

// ── Phase 3B: Studio Event Envelope ──
export {
  createEventEnvelope,
  coalesceEvents,
  serializeForSSE,
  resetSeq,
  EVENT_PRIORITIES,
} from "../../../ogu/commands/lib/studio-event-envelope.mjs";

// ── Phase 3B: Studio Event Typed ──
export {
  createStudioEvent,
  isCriticalEvent,
  STUDIO_EVENT_TYPES,
  CRITICAL_EVENTS,
} from "../../../ogu/commands/lib/studio-event-typed.mjs";

// ── Phase 3B: Studio Event Stream ──
export { createEventStream } from "../../../ogu/commands/lib/studio-event-stream.mjs";

// ── Phase 3B: Event Batcher ──
export { createEventBatcher } from "../../../ogu/commands/lib/event-batcher.mjs";

// ── Phase 3B: Event Replay ──
export { createEventReplayBuffer } from "../../../ogu/commands/lib/event-replay.mjs";

// ── Phase 3B: Stream Cursor ──
export {
  createCursorStore,
  getMissedEvents,
} from "../../../ogu/commands/lib/stream-cursor.mjs";

// ── Phase 3B: Stream Cursor Manager ──
export { createStreamCursorManager } from "../../../ogu/commands/lib/stream-cursor-manager.mjs";

export type ServerEvent =
  // ── Core ──
  | { type: "state:changed"; file: string; data: any }
  | { type: "command:output"; jobId: string; stream: "stdout" | "stderr"; data: string }
  | { type: "command:complete"; jobId: string; exitCode: number }
  | { type: "gate:progress"; feature: string; gate: number; name: string; status: string }
  | { type: "theme:changed"; themeData: any }
  | { type: "files:changed" }
  // ── Org & Agents ──
  | { type: "org:changed"; data: any }
  | { type: "agent:updated"; roleId: string; state: any }
  | { type: "agent:started"; roleId: string; taskId: string; featureSlug: string }
  | { type: "agent:progress"; roleId: string; taskId: string; progress: any }
  | { type: "agent:completed"; roleId: string; taskId: string; result: any }
  | { type: "agent:failed"; roleId: string; taskId: string; error: string }
  | { type: "agent:escalated"; roleId: string; taskId: string; fromTier: string; toTier: string }
  // ── Budget ──
  | { type: "budget:updated"; data: any }
  | { type: "budget:alert"; level: "warning" | "exhausted"; percentage: number }
  | { type: "budget:exhausted"; dailyLimit: number; spent: number }
  // ── Audit ──
  | { type: "audit:event"; event: any }
  | { type: "audit:gate"; gate: string; feature: string; passed: boolean }
  // ── Governance ──
  | { type: "governance:approval_required"; taskId: string; reason: string; riskTier: string }
  | { type: "governance:approved"; taskId: string; approvedBy: string }
  | { type: "governance:denied"; taskId: string; deniedBy: string; reason: string }
  | { type: "governance:escalated"; taskId: string; escalatedTo: string }
  // ── Kadima / Scheduling ──
  | { type: "kadima:status"; data: any }
  | { type: "task:dispatched"; taskId: string; roleId: string; model: string }
  | { type: "task:completed"; taskId: string; roleId: string; result: string }
  | { type: "task:failed"; taskId: string; roleId: string; error: string }
  | { type: "wave:started"; waveIndex: number; taskCount: number }
  | { type: "wave:completed"; waveIndex: number; results: any }
  // ── Artifacts ──
  | { type: "artifact:stored"; identifier: string; taskId: string; featureSlug: string }
  | { type: "artifact:verified"; identifier: string; passed: boolean }
  // ── Compile ──
  | { type: "compile:started"; featureSlug: string }
  | { type: "compile:gate"; gate: string; featureSlug: string; passed: boolean }
  | { type: "compile:completed"; featureSlug: string; passed: boolean; errors: number; errorMessage?: string }
  | { type: "agent:fixing"; slug: string; agentNames: string[]; taskTitles: string[] }
  // ── Model Routing ──
  | { type: "model:routed"; model: string; reason: string; phase: string }
  // ── Project State ──
  | { type: "project:state_changed"; slug: string; state: any }
  | { type: "project:launch_progress"; slug: string; step: string; status: string }
  // ── CTO Progressive Reveal ──
  | { type: "cto:thinking_line"; slug: string; text: string }
  | { type: "cto:agent_found"; slug: string; group: string; agentName: string }
  | { type: "cto:task_dispatched"; slug: string; taskId: string; title: string; group: string }
  // ── Allocation Kanban ──
  | { type: "allocation:updated"; taskId: string; status: string; roleId: string }
  | { type: "allocation:completed"; taskId: string; roleId: string }
  // ── Governance Inline ──
  | { type: "governance:pending"; approval: any }
  | { type: "governance:resolved"; id: string; decision: string }
  // ── Agent Execution Monitor ──
  | { type: "agent:status"; roleId: string; status: string; currentTask: string | null }
  | { type: "agent:log"; roleId: string; line: string }
  | { type: "agent:task_complete"; roleId: string; taskId: string }
  // ── Dispatch Engine ──
  | { type: "dispatch:started"; slug: string; totalTasks: number; totalWaves: number }
  | { type: "dispatch:completed"; slug: string; completedCount: number; failedCount: number }
  // ── Manifest Evolution ──
  | { type: "manifest:proposal"; slug: string; proposal: any }
  | { type: "manifest:applied"; slug: string; revision: number }
  | { type: "manifest:dismissed"; slug: string; proposalId: string }
  // ── Execution Feed (Slice 435) ──
  | { type: "execution:task.started"; taskId: string; roleId?: string; featureSlug?: string }
  | { type: "execution:task.completed"; taskId: string; durationMs?: number; cost?: number }
  | { type: "execution:task.failed"; taskId: string; error: string; attempt?: number }
  | { type: "execution:gate.checking"; taskId: string; gate: string }
  | { type: "execution:gate.passed"; taskId: string; gate: string }
  | { type: "execution:gate.failed"; taskId: string; gate: string; structured?: any }
  | { type: "execution:retry.started"; taskId: string; attempt: number }
  | { type: "execution:retry.exhausted"; taskId: string; attempts: number }
  | { type: "execution:compile.started"; featureSlug: string }
  | { type: "execution:compile.gate"; featureSlug: string; gate: string; passed: boolean }
  | { type: "execution:compile.finished"; featureSlug: string; passed: boolean; errors?: number }
  | { type: "execution:escalation.triggered"; taskId: string; fromTier: string; toTier: string }
  | { type: "execution:feedback.created"; taskId: string; recordId: string }
  | { type: "execution:learning.candidate"; taskId: string; eventId: string; trigger: string };

export type ClientEvent =
  | { type: "ping" }
  | { type: "subscribe"; channels: string[] };
