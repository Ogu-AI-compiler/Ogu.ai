import type { StateCreator } from "zustand";

export type PipelineStage = "brief" | "cto" | "team" | "planning" | "execution" | "verification" | "done";

export interface ActivityLine {
  text: string;
  type: "think" | "agent" | "dispatch" | "task" | "pipeline" | "error";
  ts: number;
}

export interface DispatchProgress {
  totalWaves: number;
  currentWave: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export type ExecutionStatus = "idle" | "running" | "paused" | "aborted";

export interface PipelineSlice {
  currentStage: PipelineStage;
  pipelineRunning: boolean;
  gateResults: Array<{ gate: string; passed: boolean }>;
  pipelineError: string | null;
  activityLines: ActivityLine[];
  gateState: any;
  themeData: any;
  dispatchProgress: DispatchProgress;
  executionStatus: ExecutionStatus;
  fixingAgentNames: string[];
  fixingTaskTitles: string[];

  setCurrentStage: (stage: PipelineStage) => void;
  setPipelineRunning: (running: boolean) => void;
  addGateResult: (gate: string, passed: boolean) => void;
  clearGateResults: () => void;
  setPipelineError: (error: string | null) => void;
  addActivityLine: (text: string, type?: ActivityLine["type"]) => void;
  clearActivityLines: () => void;
  setGateState: (gates: any) => void;
  setThemeData: (theme: any) => void;
  setDispatchProgress: (update: Partial<DispatchProgress>) => void;
  resetDispatchProgress: () => void;
  setExecutionStatus: (status: ExecutionStatus) => void;
  setFixingAgents: (names: string[], taskTitles: string[]) => void;
  clearFixingAgents: () => void;
}

const EMPTY_DISPATCH: DispatchProgress = { totalWaves: 0, currentWave: 0, totalTasks: 0, completedTasks: 0, failedTasks: 0 };

function loadPersistedLines(): ActivityLine[] {
  try {
    const raw = sessionStorage.getItem("ogu:activityLines");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function loadPersistedStatus(): ExecutionStatus {
  try {
    const raw = sessionStorage.getItem("ogu:executionStatus");
    if (raw === "running" || raw === "paused" || raw === "aborted") return raw;
  } catch {}
  return "idle";
}

export const createPipelineSlice: StateCreator<PipelineSlice, [], [], PipelineSlice> = (set) => ({
  currentStage: "brief",
  pipelineRunning: false,
  gateResults: [],
  pipelineError: null,
  activityLines: loadPersistedLines(),
  gateState: {},
  themeData: null,
  dispatchProgress: { ...EMPTY_DISPATCH },
  executionStatus: loadPersistedStatus(),
  fixingAgentNames: [],
  fixingTaskTitles: [],

  setCurrentStage: (currentStage) => set({ currentStage }),
  setPipelineRunning: (pipelineRunning) => set({ pipelineRunning }),
  addGateResult: (gate, passed) => set((s) => {
    // Dedup: skip if this gate already has a result
    if (s.gateResults.some((g) => g.gate === gate)) return s;
    return { gateResults: [...s.gateResults, { gate, passed }] };
  }),
  clearGateResults: () => set({ gateResults: [], pipelineError: null }),
  setPipelineError: (pipelineError) => set({ pipelineError }),
  addActivityLine: (text, type = "think") => set((s) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return s;
    // Dedup: check last 10 lines (not just last) to catch interleaved duplicates
    const recent = s.activityLines.slice(-10);
    const now = Date.now();
    if (recent.some((l) => l.text === trimmed && l.type === type && now - l.ts < 2000)) return s;
    const next = [...s.activityLines.slice(-199), { text: trimmed, type, ts: now }];
    try { sessionStorage.setItem("ogu:activityLines", JSON.stringify(next.slice(-200))); } catch {}
    return { activityLines: next };
  }),
  clearActivityLines: () => {
    try { sessionStorage.removeItem("ogu:activityLines"); } catch {}
    return set({ activityLines: [] });
  },
  setGateState: (gateState) => set({ gateState }),
  setThemeData: (themeData) => set({ themeData }),
  setDispatchProgress: (update) => set((s) => ({
    dispatchProgress: { ...s.dispatchProgress, ...update },
  })),
  resetDispatchProgress: () => set({ dispatchProgress: { ...EMPTY_DISPATCH } }),
  setExecutionStatus: (executionStatus) => {
    try { sessionStorage.setItem("ogu:executionStatus", executionStatus); } catch {}
    return set({ executionStatus });
  },
  setFixingAgents: (fixingAgentNames, fixingTaskTitles) => set({ fixingAgentNames, fixingTaskTitles }),
  clearFixingAgents: () => set({ fixingAgentNames: [], fixingTaskTitles: [] }),
});
