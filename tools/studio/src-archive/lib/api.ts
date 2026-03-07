const BASE = "/api";

function getAuthHeaders(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const token = localStorage.getItem("ogu-access-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    ...opts,
  });
  if (!res.ok) {
    let msg = `API ${res.status}: ${path}`;
    try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  getState: () => request<any>("/state"),
  getGates: () => request<any>("/state/gates"),
  getFeatures: () => request<{ features: any[]; active: string | null }>("/features"),
  getFeature: (slug: string) => request<any>(`/features/${slug}`),
  deleteFeature: (slug: string) =>
    request<{ ok: boolean; deleted: string }>(`/features/${slug}`, { method: "DELETE" }),
  activateProject: (slug: string) =>
    request<{ ok: boolean; root: string }>(`/features/${slug}/activate`, { method: "POST" }),
  getLogs: () => request<any[]>("/logs/recent"),
  getPresets: () => request<any>("/theme/presets"),
  openProject: (path: string) =>
    request<{ ok: boolean; root: string }>("/project/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  initProject: (path: string) =>
    request<{ exitCode: number; stdout: string; valid: boolean; root: string }>("/project/init", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  deleteProject: (path: string) =>
    request<{ ok: boolean; deleted: string }>("/project/delete", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  getBrandScans: () => request<any[]>("/brand/scans"),
  getReference: () => request<any>("/brand/reference"),
  getReferenceImages: () => request<any[]>("/brand/reference/images"),
  scanBrand: (url: string) =>
    request<{ jobId: string }>("/brand/scan", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  scanReference: (urls: string[]) =>
    request<{ jobId: string }>("/brand/reference/scan", {
      method: "POST",
      body: JSON.stringify({ urls }),
    }),
  clearReference: () =>
    request<{ jobId: string }>("/brand/reference/clear", { method: "POST" }),
  getBrandInput: () =>
    request<{ urls: string[]; images: { name: string; path: string }[] }>("/brand/input"),
  saveBrandInput: (data: { urls: string[]; images: { name: string; path: string }[] }) =>
    request<{ ok: boolean }>("/brand/input", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // ── Ogu Domain APIs ──
  getOrg: () => request<any>("/ogu/org"),
  getAgents: () => request<{ agents: any[]; count: number }>("/ogu/agents"),
  getAgentStats: () => request<any>("/ogu/agents/stats"),
  getAgent: (roleId: string) => request<any>(`/ogu/agents/${roleId}`),
  runAgent: (roleId: string, taskId: string, featureSlug: string) =>
    request<any>(`/ogu/agents/${roleId}/run`, {
      method: "POST",
      body: JSON.stringify({ taskId, featureSlug }),
    }),
  stopAgent: (roleId: string, force?: boolean) =>
    request<any>(`/ogu/agents/${roleId}/stop`, {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
  escalateAgent: (roleId: string, targetTier?: string) =>
    request<any>(`/ogu/agents/${roleId}/escalate`, {
      method: "POST",
      body: JSON.stringify({ targetTier }),
    }),
  getBudget: () => request<any>("/ogu/budget"),
  getBudgetHistory: (days?: number) => request<any>(`/ogu/budget/history?days=${days || 7}`),
  getAudit: (opts?: { limit?: number; type?: string; feature?: string }) => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.type) params.set("type", opts.type);
    if (opts?.feature) params.set("feature", opts.feature);
    return request<any>(`/ogu/audit?${params}`);
  },
  getAuditTypes: () => request<{ types: string[] }>("/ogu/audit/types"),
  getGovernancePending: () => request<{ pending: any[]; count: number }>("/ogu/governance/pending"),
  getGovernanceHistory: (limit?: number) => request<{ history: any[]; count: number }>(`/ogu/governance/history?limit=${limit || 50}`),
  getGovernancePolicies: () => request<any>("/ogu/governance/policies"),
  approveGovernance: (taskId: string, actor?: string) =>
    request<any>("/ogu/governance/approve", {
      method: "POST",
      body: JSON.stringify({ taskId, actor }),
    }),
  denyGovernance: (taskId: string, reason: string, actor?: string) =>
    request<any>("/ogu/governance/deny", {
      method: "POST",
      body: JSON.stringify({ taskId, reason, actor }),
    }),
  getModelStatus: () => request<any>("/ogu/model/status"),
  getDeterminism: () => request<any>("/ogu/determinism"),
  getDAG: (slug: string) => request<any>(`/ogu/dag/${slug}`),
  runOrchestrate: (slug: string, validate?: boolean) =>
    request<any>(`/ogu/orchestrate/${slug}`, {
      method: "POST",
      body: JSON.stringify({ validate }),
    }),
  getArtifacts: (slug: string) => request<any>(`/ogu/artifacts/${slug}`),
  getWorktrees: () => request<any>("/ogu/worktrees"),

  // ── Kadima Proxy ──
  getKadimaHealth: () => request<any>("/kadima/health"),
  getKadimaDashboard: () => request<any>("/kadima/dashboard"),
  getKadimaScheduler: () => request<any>("/kadima/scheduler"),
  getKadimaRunners: () => request<any>("/kadima/runners"),
  getKadimaStandup: () => request<any>("/ogu/kadima/standup", { method: "POST" }),

  // ── Kadima Server API ──
  getKadimaStatus: () => request<any>("/kadima/status"),
  startKadima: () => request<any>("/kadima/start", { method: "POST" }),
  stopKadima: () => request<any>("/kadima/stop", { method: "POST" }),
  getKadimaStandups: () => request<any>("/kadima/standups"),
  getKadimaAllocations: () => request<any>("/kadima/allocations"),

  // ── Execution Feed (Slice 437) ──
  getExecutionFeed: (filters?: { type?: string; taskId?: string; feature?: string; since?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.taskId) params.set("taskId", filters.taskId);
    if (filters?.feature) params.set("feature", filters.feature);
    if (filters?.since) params.set("since", filters.since);
    if (filters?.limit) params.set("limit", String(filters.limit));
    return request<{ events: any[]; total: number }>(`/execution/feed?${params}`);
  },
  getExecutionStats: () => request<{ total: number; byType: Record<string, number> }>("/execution/stats"),
  getExecutionEventTypes: () => request<{ events: Record<string, string> }>("/execution/events"),

  // ── Audit Events API ──
  getAuditEvents: (filters?: { type?: string; from?: string; to?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    return request<any>(`/audit/events?${params}`);
  },

  // ── Wizard (Archetype) ──
  classifyArchetype: (mode: string, description: string) =>
    request<{ archetypes: any[]; suggested_mode: string | null; disambiguation: any; detail_level: string; model: string; cost: number }>("/wizard/classify", {
      method: "POST",
      body: JSON.stringify({ mode, description }),
    }),
  personalizeStep: (data: { archetypeId: string; stepId: string; step: any; userDescription: string; previousAnswers: Record<string, any>; detailLevel?: string }) =>
    request<{ questions: any[]; model: string; cost: number; fallback?: boolean }>("/wizard/personalize", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Allocation Kanban ──
  getAllocations: (slug: string) => request<any>(`/project/${slug}/allocations`),

  // ── Governance Approvals (inline panel) ──
  getApprovals: (slug: string) => request<any>(`/project/${slug}/approvals`),
  resolveApproval: (slug: string, id: string, decision: "approve" | "deny", reason?: string) =>
    request<any>(`/project/${slug}/approvals/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),

  // ── Agent Execution Monitor ──
  getAgentStatuses: (slug: string) => request<any>(`/project/${slug}/agents/status`),

  // ── Project Resume ──
  resumeProject: (slug: string) => request<{ ok: boolean; started: boolean; mode: string }>(`/brief/project/${slug}/resume`, { method: "POST" }),

  // ── Project State ──
  getActiveProject: () => request<{ project: { slug: string; root: string } | null }>("/project/active"),
  getProjectState: (slug: string) => request<any>(`/project/${slug}/state`),
  transitionProject: (slug: string, targetPhase: string, reason?: string) =>
    request<any>(`/project/${slug}/transition`, {
      method: "POST",
      body: JSON.stringify({ targetPhase, reason }),
    }),
  continueProject: (slug: string) =>
    request<any>(`/project/${slug}/continue`, { method: "POST" }),

  // ── Manifest Evolution ──
  applyManifest: (slug: string, proposalId: string) =>
    request<{ ok: boolean; revision: number }>(`/project/${slug}/manifest/apply`, {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    }),
  dismissManifest: (slug: string, proposalId: string) =>
    request<{ ok: boolean }>(`/project/${slug}/manifest/dismiss`, {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    }),

  // ── Auth ──
  register: (data: { email: string; password: string; name: string; orgName?: string }) =>
    request<{ user: any; accessToken: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ user: any; accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  refreshToken: (refreshToken?: string) =>
    request<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  getMe: () => request<{ user: any; org: any; subscription: any }>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // ── Billing ──
  getBillingSubscription: () => request<any>("/billing/subscription"),
  createCheckoutSession: (plan: string) =>
    request<{ url: string; sessionId: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  createPortalSession: () => request<{ url: string }>("/billing/portal", { method: "POST" }),
  getCreditBalance: () => request<{ balance: number; transactions: any[] }>("/billing/credits"),
  deductCredits: (amount: number, reason?: string) =>
    request<{ success: boolean; remaining: number }>("/billing/credits/deduct", {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  // ── Admin ──
  getAdminStats: () => request<any>("/admin/stats"),
  getAdminUsers: () => request<any>("/admin/users"),
  banUser: (userId: string) => request<any>(`/admin/users/${userId}/ban`, { method: "POST" }),

  // ── Orgs ──
  inviteMember: (email: string, role?: string) =>
    request<{ token: string }>("/orgs/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  getOrgMembers: () => request<{ members: any[] }>("/orgs/members"),
  removeOrgMember: (userId: string) =>
    request<{ ok: boolean }>(`/orgs/members/${userId}`, { method: "DELETE" }),

  // ── Brief (post-wizard launch) ──
  launchBrief: (data: { mode: string; archetypeId: string; archetypeTitle: string; description: string; answers: Record<string, any> }) =>
    fetch(`${BASE}/brief/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getBrandLogos: (domain: string) =>
    request<{ name: string; url: string }[]>(`/brand/logos/${domain}`),
  uploadBrandImage: async (file: File): Promise<{ name: string; path: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/brand/input/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
};
