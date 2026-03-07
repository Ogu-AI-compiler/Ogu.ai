import { useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon, icons } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const RECENT_KEY = "ogu-recent-projects";

function getRecent(): { path: string; name: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch { return []; }
}

function addRecent(projectPath: string) {
  const name = projectPath.split("/").pop() || projectPath;
  const list = getRecent().filter((p) => p.path !== projectPath);
  list.unshift({ path: projectPath, name });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}

export function Welcome() {
  const [mode, setMode] = useState<null | "create">(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setProjectValid = useStore((s) => s.setProjectValid);
  const [recent, setRecent] = useState(getRecent);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  function removeRecent(projectPath: string) {
    const updated = getRecent().filter((p) => p.path !== projectPath);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    setRecent(updated);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      await api.deleteProject(deleteTarget.path);
      try {
        localStorage.removeItem(`ogu-sessions:${deleteTarget.path}`);
        localStorage.removeItem(`ogu-active:${deleteTarget.path}`);
      } catch { /* best-effort */ }
      removeRecent(deleteTarget.path);
      setDeleteTarget(null);
      setDeleteInput("");
    } catch (err: any) {
      setError(err.message || "Failed to delete project");
    }
    setDeleting(false);
  }

  const [browserPath, setBrowserPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [browserHasOgu, setBrowserHasOgu] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);

  async function browseDir(dir: string) {
    setBrowserLoading(true);
    try {
      const res = await fetch(`/api/dirs?path=${encodeURIComponent(dir)}`);
      if (!res.ok) throw new Error("Cannot read directory");
      const data = await res.json();
      setBrowserPath(data.path);
      setDirs(data.dirs);
      setBrowserHasOgu(data.hasOgu);
    } catch { /* ignore */ }
    setBrowserLoading(false);
  }

  function openBrowser() {
    setShowBrowser(true);
    setError("");
    browseDir("");
  }

  async function handleCreate() {
    if (!path.trim()) return;
    setError("");
    setLoading(true);
    try {
      const fullPath = `OguProjects/${path.trim()}`;
      const res = await api.initProject(fullPath);
      if (res.valid) {
        addRecent(res.root);
        setProjectValid(true, res.root);
      } else {
        setError("Failed to initialize project");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    }
    setLoading(false);
  }

  async function handleOpenSelected() {
    if (!browserPath) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.openProject(browserPath);
      addRecent(res.root);
      setProjectValid(true, res.root);
    } catch (err: any) {
      setError(err.message || "Not an Ogu project");
    }
    setLoading(false);
  }

  async function openRecent(recentPath: string) {
    setError("");
    setLoading(true);
    try {
      const res = await api.openProject(recentPath);
      addRecent(res.root);
      setProjectValid(true, res.root);
    } catch (err: any) {
      removeRecent(recentPath);
      setError(err.message || "Project not found");
    }
    setLoading(false);
  }

  /* -- Create screen -- */
  if (mode === "create") {
    const defaultDir = "~/OguProjects";
    const displayPath = path.trim() ? `${defaultDir}/${path.trim()}` : "";

    return (
      <div className="flex flex-1 flex-col items-center justify-center p-10 gap-6 bg-bg">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-semibold text-text">Create New Project</h1>
          <p className="text-sm text-text-muted">Choose a name for your project</p>
        </div>

        <div className="flex flex-col w-full max-w-[480px] gap-4">
          <Input
            value={path}
            onChange={(e) => { setPath(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, "")); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="my-app"
            autoFocus
          />
          {displayPath && (
            <span className="text-xs text-text-muted">{displayPath}</span>
          )}
          <div className="flex gap-3">
            <Button className="flex-1" size="lg" onClick={handleCreate} disabled={loading || !path.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
            <Button variant="outline" size="lg" onClick={() => { setMode(null); setError(""); setPath(""); }}>
              Back
            </Button>
          </div>
          {error && (
            <span className="text-xs text-error text-center">{error}</span>
          )}
        </div>
      </div>
    );
  }

  /* -- Main screen -- */
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-10 gap-8 bg-bg">
      <div className="flex flex-col items-center gap-3">
        <Icon d={icons.logo} size={36} stroke="var(--color-text)" />
        <h1 className="text-3xl font-semibold text-text tracking-tight">AI Compiler</h1>
        <p className="text-sm text-text-muted">Kadima + Ogu — Turn ideas into software</p>
      </div>

      <div className="flex gap-3 mt-2">
        <Button size="lg" onClick={() => setMode("create")}>Create Project</Button>
        <Button variant="outline" size="lg" onClick={openBrowser}>Open Project</Button>
      </div>

      {/* Recent projects */}
      {recent.length > 0 && (
        <div className="flex flex-col gap-2 mt-2 w-full max-w-[420px]">
          <span className="text-[10px] font-medium text-text-muted">Recent Projects</span>
          {recent.map((r) => (
            <Card
              key={r.path}
              onClick={() => !loading && openRecent(r.path)}
              className="flex-row items-center gap-3 px-4 py-3 hover:border-border-hover hover:bg-bg-card-hover cursor-pointer transition-colors"
            >
              <Icon d={icons.logo} size={14} stroke="var(--color-text-muted)" />
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium text-text">{r.name}</span>
                <span className="text-[11px] text-text-muted truncate">{r.path}</span>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); setDeleteInput(""); setError(""); }}
                className="shrink-0 p-1 rounded text-text-muted hover:text-error hover:bg-error-soft cursor-pointer transition-colors"
                title="Delete project"
              >
                <Icon d={icons.trash} size={12} />
              </span>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <span className="text-xs text-error text-center">{error}</span>
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeleteInput(""); }} className="w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-error">Delete Project</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{deleteTarget?.name}</strong> and all its files from disk.
          </DialogDescription>
        </DialogHeader>
        <span className="text-xs text-text-muted font-mono break-all">{deleteTarget?.path}</span>
        <p className="text-xs text-text-muted">
          Type <strong className="text-error">DELETE</strong> to confirm:
        </p>
        <Input
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
          autoFocus
          placeholder="DELETE"
          className="font-mono font-semibold tracking-widest text-center"
        />
        <DialogFooter>
          <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={deleting || deleteInput !== "DELETE"}>
            {deleting ? "Deleting..." : "Delete permanently"}
          </Button>
          <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteInput(""); }}>
            Cancel
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Folder browser modal */}
      {showBrowser && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBrowser(false); }}
        >
          <div className="w-[520px] max-h-[80vh] bg-bg-card border border-border rounded-lg flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-text">Open Project</span>
              <span className="flex-1" />
              <span
                onClick={() => setShowBrowser(false)}
                className="text-text-muted hover:text-text cursor-pointer text-lg leading-none transition-colors"
              >
                &times;
              </span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Icon d={icons.folder} size={14} stroke="var(--color-text-muted)" />
              <span className="text-xs text-text flex-1 truncate">
                {browserPath || "..."}
              </span>
              {browserHasOgu && (
                <Badge>OGU</Badge>
              )}
            </div>

            <div className="flex-1 overflow-auto min-h-[200px] max-h-[400px]">
              {browserPath && (
                <div
                  onClick={() => {
                    const parent = browserPath.split("/").slice(0, -1).join("/") || "/";
                    browseDir(parent);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-text-muted cursor-pointer hover:bg-bg-card-hover transition-colors"
                >
                  <Icon d={icons.chevronUp} size={14} /><span>..</span>
                </div>
              )}

              {browserLoading ? (
                <div className="p-4 text-xs text-text-muted text-center">Loading...</div>
              ) : dirs.length === 0 ? (
                <div className="p-4 text-xs text-text-muted text-center">Empty folder</div>
              ) : (
                dirs.map((dir) => (
                  <div
                    key={dir}
                    onClick={() => browseDir(browserPath + "/" + dir)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-text cursor-pointer hover:bg-bg-card-hover transition-colors"
                  >
                    <Icon d={icons.folder} size={14} stroke="var(--color-text-muted)" />
                    <span>{dir}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3 justify-end px-4 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowBrowser(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleOpenSelected} disabled={loading || !browserPath}>
                {loading ? "Opening..." : browserHasOgu ? "Open" : "Open & Initialize"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
