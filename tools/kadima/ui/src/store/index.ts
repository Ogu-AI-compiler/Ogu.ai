import { create } from "zustand";
import { createAuthSlice, type AuthSlice } from "./auth";
import { createProjectSlice, type ProjectSlice } from "./project";
import { createPipelineSlice, type PipelineSlice } from "./pipeline";
import { createAgentsSlice, type AgentsSlice } from "./agents";
import { createGovernanceSlice, type GovernanceSlice } from "./governance";
import { createUISlice, type UISlice } from "./ui";

export type StoreState = AuthSlice & ProjectSlice & PipelineSlice & AgentsSlice & GovernanceSlice & UISlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createProjectSlice(...a),
  ...createPipelineSlice(...a),
  ...createAgentsSlice(...a),
  ...createGovernanceSlice(...a),
  ...createUISlice(...a),
}));

// Re-export types
export type { AuthUser } from "./auth";
export type { Feature } from "./project";
export type { PipelineStage, ActivityLine } from "./pipeline";
export type { AgentStatus, Allocation } from "./agents";
export type { PendingApproval } from "./governance";
