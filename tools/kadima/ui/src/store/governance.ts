import type { StateCreator } from "zustand";

export interface PendingApproval {
  id: string;
  taskName: string;
  policyViolated: string;
  requestedBy: string;
  timestamp: string;
  featureSlug?: string;
  riskTier?: string;
}

export interface GovernanceSlice {
  pendingApprovals: PendingApproval[];

  setPendingApprovals: (approvals: PendingApproval[]) => void;
  addApproval: (approval: PendingApproval) => void;
  resolveApproval: (id: string) => void;
}

export const createGovernanceSlice: StateCreator<GovernanceSlice, [], [], GovernanceSlice> = (set) => ({
  pendingApprovals: [],

  setPendingApprovals: (pendingApprovals) => set({ pendingApprovals }),
  addApproval: (approval) => set((s) => ({
    pendingApprovals: s.pendingApprovals.some((a) => a.id === approval.id)
      ? s.pendingApprovals
      : [...s.pendingApprovals, approval],
  })),
  resolveApproval: (id) => set((s) => ({
    pendingApprovals: s.pendingApprovals.filter((a) => a.id !== id),
  })),
});
