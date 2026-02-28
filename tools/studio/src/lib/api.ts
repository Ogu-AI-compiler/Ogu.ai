const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
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
