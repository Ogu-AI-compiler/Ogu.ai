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
