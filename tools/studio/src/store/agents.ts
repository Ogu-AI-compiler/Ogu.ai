import type { StateCreator } from "zustand";

export interface AgentStatus {
  roleId: string;
  roleName: string;
  currentTask: string | null;
  status: "idle" | "executing" | "blocked";
  startedAt?: string;
  tasksCompleted: string[];
  tasksPending: string[];
}

export interface Allocation {
  taskId: string;
  taskName: string;
  roleId: string;
  status: "queued" | "pending" | "running" | "in_progress" | "done" | "failed" | "blocked";
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
}

export interface AgentsSlice {
  agentStatuses: Record<string, AgentStatus>;
  agentLogs: Record<string, string[]>;
  allocations: Record<string, Allocation>;

  setAgentStatuses: (statuses: Record<string, AgentStatus>) => void;
  updateAgentStatus: (roleId: string, update: Partial<AgentStatus>) => void;
  appendAgentLog: (roleId: string, line: string) => void;
  clearAgentLogs: (roleId: string) => void;
  setAllocations: (allocations: Record<string, Allocation>) => void;
  updateAllocation: (taskId: string, update: Partial<Allocation>) => void;
}

export const createAgentsSlice: StateCreator<AgentsSlice, [], [], AgentsSlice> = (set) => ({
  agentStatuses: {},
  agentLogs: {},
  allocations: {},

  setAgentStatuses: (agentStatuses) => set({ agentStatuses }),
  updateAgentStatus: (roleId, update) => set((s) => ({
    agentStatuses: {
      ...s.agentStatuses,
      [roleId]: {
        ...(s.agentStatuses[roleId] || { roleId, roleName: roleId, currentTask: null, status: "idle", tasksCompleted: [], tasksPending: [] }),
        ...update,
      },
    },
  })),
  appendAgentLog: (roleId, line) => set((s) => ({
    agentLogs: {
      ...s.agentLogs,
      [roleId]: [...(s.agentLogs[roleId] || []).slice(-199), line],
    },
  })),
  clearAgentLogs: (roleId) => set((s) => ({
    agentLogs: { ...s.agentLogs, [roleId]: [] },
  })),
  setAllocations: (allocations) => set({ allocations }),
  updateAllocation: (taskId, update) => set((s) => ({
    allocations: {
      ...s.allocations,
      [taskId]: {
        ...(s.allocations[taskId] || { taskId, taskName: taskId, roleId: "", status: "queued" as const }),
        ...update,
      },
    },
  })),
});
