/** WebSocket event type definitions */

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
  | { type: "compile:completed"; featureSlug: string; passed: boolean; errors: number }
  // ── Model Routing ──
  | { type: "model:routed"; model: string; reason: string; phase: string };

export type ClientEvent =
  | { type: "ping" }
  | { type: "subscribe"; channels: string[] };
