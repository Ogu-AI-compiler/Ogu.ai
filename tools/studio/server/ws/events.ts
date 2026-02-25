/** WebSocket event type definitions */

export type ServerEvent =
  | { type: "state:changed"; file: string; data: any }
  | { type: "command:output"; jobId: string; stream: "stdout" | "stderr"; data: string }
  | { type: "command:complete"; jobId: string; exitCode: number }
  | { type: "gate:progress"; feature: string; gate: number; name: string; status: string }
  | { type: "theme:changed"; themeData: any }
  | { type: "files:changed" };

export type ClientEvent =
  | { type: "ping" };
