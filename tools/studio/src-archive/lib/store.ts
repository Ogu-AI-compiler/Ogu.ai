import { create } from "zustand";

export interface Feature {
  slug: string;
  phase: string;
  tasks: number;
}

export interface ActiveTerminal {
  taskId: string;
  roleId: string;
  featureSlug: string;
}

export interface Allocation {
  taskId: string;
  taskName: string;
  roleId: string;
  status: "queued" | "in_progress" | "done" | "blocked";
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
}

export interface PendingApproval {
  id: string;
  taskName: string;
  policyViolated: string;
  requestedBy: string;
  timestamp: string;
  featureSlug?: string;
  riskTier?: string;
}

export interface AgentStatus {
  roleId: string;
  roleName: string;
  currentTask: string | null;
  status: "idle" | "executing" | "blocked";
  startedAt?: string;
  tasksCompleted: string[];
  tasksPending: string[];
}


export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  org_id?: string;
}

interface StudioState {
  // Auth state (AoaS)
  currentUser: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;

  // Project data
  projectName: string;
  platform: string;
  activeFeature: string | null;
  features: Feature[];
  gateState: any;
  themeData: any;

  // Project validity
  projectValid: boolean | null;
  projectRoot: string;

  // UI state
  currentRoute: string;
  selectedTheme: string;
  sidebarExpanded: boolean;

  // Project state
  activeProjectSlug: string | null;
  projectUIState: any | null;
  launchSteps: Record<string, string> | null;

  // Manifest proposals
  manifestProposal: any | null;

  // Team review (CTO pipeline)
  teamData: any | null;
  lifecycleProjectId: string | null;
  teamApproved: boolean;

  // Pipeline continuation
  pipelineRunning: boolean;
  gateResults: Array<{ gate: string; passed: boolean }>;
  pipelineError: string | null;

  // Persistent activity log (survives across phases)
  activityLines: Array<{ text: string; type: "think" | "agent" | "dispatch" | "task" | "pipeline" | "error"; ts: number }>;

  // Kadima OS state
  pendingChatMessage: string | null;
  activeTerminals: ActiveTerminal[];
  bootComplete: boolean;
  cmdkOpen: boolean;
  osBooted: boolean;

  // Allocation Kanban
  allocations: Allocation[];

  // Governance Approvals
  pendingApprovals: PendingApproval[];

  // Agent Execution Monitor
  agentStatuses: Record<string, AgentStatus>;
  agentLogs: Record<string, string[]>;

  // Actions
  setProjectData: (data: { projectName: string; platform: string; themeData: any }) => void;
  setFeatures: (features: Feature[], active: string | null) => void;
  setGateState: (gates: any) => void;
  setThemeData: (theme: any) => void;
  setProjectValid: (valid: boolean, root: string) => void;
  setRoute: (route: string) => void;
  setSelectedTheme: (theme: string) => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setActiveProjectSlug: (slug: string | null) => void;
  setProjectUIState: (state: any | null) => void;
  setLaunchSteps: (steps: Record<string, string> | null) => void;
  updateLaunchStep: (step: string, status: string) => void;
  setManifestProposal: (proposal: any | null) => void;
  setTeamData: (team: any | null) => void;
  setLifecycleProjectId: (id: string | null) => void;
  setTeamApproved: (v: boolean) => void;
  setPipelineRunning: (running: boolean) => void;
  addGateResult: (gate: string, passed: boolean) => void;
  clearGateResults: () => void;
  setPipelineError: (error: string | null) => void;
  addActivityLine: (text: string, type?: "think" | "agent" | "dispatch" | "task" | "pipeline" | "error") => void;
  clearActivityLines: () => void;
  setPendingChatMessage: (msg: string | null) => void;
  addTerminal: (terminal: ActiveTerminal) => void;
  removeTerminal: (taskId: string) => void;
  setBootComplete: (done: boolean) => void;
  setCmdkOpen: (open: boolean) => void;
  setOsBooted: (booted: boolean) => void;

  // Allocation Kanban actions
  setAllocations: (allocations: Allocation[]) => void;
  updateAllocation: (taskId: string, update: Partial<Allocation>) => void;

  // Governance Approval actions
  setPendingApprovals: (approvals: PendingApproval[]) => void;
  addApproval: (approval: PendingApproval) => void;
  resolveApproval: (id: string) => void;

  // Agent Execution Monitor actions
  setAgentStatuses: (statuses: Record<string, AgentStatus>) => void;
  updateAgentStatus: (roleId: string, update: Partial<AgentStatus>) => void;
  appendAgentLog: (roleId: string, line: string) => void;
  clearAgentLogs: (roleId: string) => void;
}

const savedTheme = "dark";

const savedSidebar = false;

const VALID_ROUTES = ["/chat","/dashboard","/features","/agents","/pipeline","/budget","/settings","/project","/kadima","/audit","/governance"];

export const useStore = create<StudioState>((set) => ({
  // Auth
  currentUser: null,
  accessToken: (() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("ogu-access-token");
  })(),
  setAuth: (user, token) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("ogu-access-token", token);
    set({ currentUser: user, accessToken: token });
  },
  clearAuth: () => {
    if (typeof localStorage !== "undefined") localStorage.removeItem("ogu-access-token");
    set({ currentUser: null, accessToken: null });
  },

  projectName: "Ogu Project",
  platform: "web",
  activeFeature: null,
  features: [],
  gateState: {},
  themeData: null,

  projectValid: null,
  projectRoot: "",

  // Restore last route on refresh (e.g. /project stays /project)
  currentRoute: (typeof window !== "undefined" && VALID_ROUTES.includes(window.location.pathname))
    ? window.location.pathname
    : "/",
  selectedTheme: savedTheme,
  sidebarExpanded: savedSidebar,

  // Project state
  activeProjectSlug: typeof localStorage !== "undefined"
    ? localStorage.getItem("ogu-active-project")
    : null,
  projectUIState: (() => {
    if (typeof localStorage === "undefined") return null;
    const slug = localStorage.getItem("ogu-active-project");
    if (!slug) return null;
    try {
      const raw = localStorage.getItem(`ogu-project-state-${slug}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })(),
  launchSteps: (() => {
    if (typeof localStorage === "undefined") return null;
    const slug = localStorage.getItem("ogu-active-project");
    if (!slug) return null;
    try {
      const raw = localStorage.getItem(`ogu-launch-steps-${slug}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })(),

  // Manifest proposals
  manifestProposal: null,

  // Team review (CTO pipeline)
  teamData: null,
  lifecycleProjectId: null,
  teamApproved: false,

  // Pipeline continuation
  pipelineRunning: false,
  gateResults: [],
  pipelineError: null,

  // Activity log
  activityLines: [],

  // Kadima OS
  pendingChatMessage: null,
  activeTerminals: [],
  bootComplete: false,
  cmdkOpen: false,
  osBooted: typeof localStorage !== "undefined" && localStorage.getItem("ogu-os-booted") === "true",

  // Allocation Kanban
  allocations: [],

  // Governance Approvals
  pendingApprovals: [],

  // Agent Execution Monitor
  agentStatuses: {},
  agentLogs: {},

  setProjectData: (data) =>
    set({ projectName: data.projectName, platform: data.platform, themeData: data.themeData }),
  setProjectValid: (valid, root) => set({ projectValid: valid, projectRoot: root }),
  setFeatures: (features, active) => set({ features, activeFeature: active }),
  setGateState: (gateState) => set({ gateState }),
  setThemeData: (themeData) => set({ themeData }),
  setRoute: (currentRoute) => {
    if (typeof window !== "undefined") {
      const url = currentRoute === "/" ? "/" : currentRoute;
      window.history.pushState(null, "", url);
    }
    set({ currentRoute });
  },
  setSelectedTheme: (selectedTheme) => {
    localStorage.setItem("ogu-studio-theme", selectedTheme);
    set({ selectedTheme });
  },
  setSidebarExpanded: (sidebarExpanded) => {
    localStorage.setItem("ogu-studio-sidebar", String(sidebarExpanded));
    set({ sidebarExpanded });
  },
  setActiveProjectSlug: (activeProjectSlug) => {
    if (typeof localStorage !== "undefined") {
      if (activeProjectSlug) localStorage.setItem("ogu-active-project", activeProjectSlug);
      else localStorage.removeItem("ogu-active-project");
    }
    set({ activeProjectSlug });
  },
  setProjectUIState: (projectUIState) => {
    if (typeof localStorage !== "undefined" && projectUIState?.slug) {
      localStorage.setItem(`ogu-project-state-${projectUIState.slug}`, JSON.stringify(projectUIState));
    }
    set({ projectUIState });
  },
  setLaunchSteps: (launchSteps) => {
    if (typeof localStorage !== "undefined") {
      const slug = localStorage.getItem("ogu-active-project");
      if (slug) {
        if (launchSteps) localStorage.setItem(`ogu-launch-steps-${slug}`, JSON.stringify(launchSteps));
        else localStorage.removeItem(`ogu-launch-steps-${slug}`);
      }
    }
    set({ launchSteps });
  },
  updateLaunchStep: (step, status) => set((s) => {
    const next = { ...(s.launchSteps || {}), [step]: status };
    if (typeof localStorage !== "undefined") {
      const slug = localStorage.getItem("ogu-active-project");
      if (slug) localStorage.setItem(`ogu-launch-steps-${slug}`, JSON.stringify(next));
    }
    return { launchSteps: next };
  }),
  setManifestProposal: (manifestProposal) => set({ manifestProposal }),
  setTeamData: (teamData) => set({ teamData }),
  setLifecycleProjectId: (lifecycleProjectId) => set({ lifecycleProjectId }),
  setTeamApproved: (teamApproved) => set({ teamApproved }),
  setPipelineRunning: (pipelineRunning) => set({ pipelineRunning }),
  addGateResult: (gate, passed) => set((s) => ({
    gateResults: [...s.gateResults, { gate, passed }],
  })),
  clearGateResults: () => set({ gateResults: [], pipelineError: null }),
  setPipelineError: (pipelineError) => set({ pipelineError }),
  addActivityLine: (text, type = "think") => set((s) => ({
    activityLines: [...s.activityLines.slice(-99), { text, type, ts: Date.now() }],
  })),
  clearActivityLines: () => set({ activityLines: [] }),
  setPendingChatMessage: (pendingChatMessage) => set({ pendingChatMessage }),
  addTerminal: (terminal) => set((s) => ({
    activeTerminals: s.activeTerminals.some((t) => t.taskId === terminal.taskId)
      ? s.activeTerminals
      : [...s.activeTerminals, terminal],
  })),
  removeTerminal: (taskId) => set((s) => ({
    activeTerminals: s.activeTerminals.filter((t) => t.taskId !== taskId),
  })),
  setBootComplete: (bootComplete) => set({ bootComplete }),
  setCmdkOpen: (cmdkOpen) => set({ cmdkOpen }),
  setOsBooted: (osBooted) => {
    localStorage.setItem("ogu-os-booted", String(osBooted));
    set({ osBooted });
  },

  // Allocation Kanban
  setAllocations: (allocations) => set({ allocations }),
  updateAllocation: (taskId, update) => set((s) => ({
    allocations: s.allocations.map((a) =>
      a.taskId === taskId ? { ...a, ...update } : a
    ),
  })),

  // Governance Approvals
  setPendingApprovals: (pendingApprovals) => set({ pendingApprovals }),
  addApproval: (approval) => set((s) => ({
    pendingApprovals: s.pendingApprovals.some((a) => a.id === approval.id)
      ? s.pendingApprovals
      : [...s.pendingApprovals, approval],
  })),
  resolveApproval: (id) => set((s) => ({
    pendingApprovals: s.pendingApprovals.filter((a) => a.id !== id),
  })),

  // Agent Execution Monitor
  setAgentStatuses: (agentStatuses) => set({ agentStatuses }),
  updateAgentStatus: (roleId, update) => set((s) => ({
    agentStatuses: {
      ...s.agentStatuses,
      [roleId]: { ...(s.agentStatuses[roleId] || { roleId, roleName: roleId, currentTask: null, status: "idle", tasksCompleted: [], tasksPending: [] }), ...update },
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
}));
