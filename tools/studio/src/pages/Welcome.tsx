import { useState, useEffect } from "react";
import { YStack, XStack, Text } from "tamagui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon, icons } from "@/lib/icons";

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
      // Clean up cached sessions for this project from localStorage
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

  // Folder browser state
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
      // Remove dead project from recent list
      removeRecent(recentPath);
      setError(err.message || "Project not found");
    }
    setLoading(false);
  }

  const btnBase: React.CSSProperties = {
    padding: "14px 24px",
    fontFamily: "var(--font)",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    cursor: "pointer",
    border: "none",
    transition: "opacity 0.15s",
  };

  /* ── Create screen ── */
  if (mode === "create") {
    const defaultDir = "~/OguProjects";
    const displayPath = path.trim() ? `${defaultDir}/${path.trim()}` : "";

    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$8" gap="$5"
        style={{ backgroundColor: "var(--bg)" }}>
        <YStack alignItems="center" gap="$1">
          <Text fontSize={20} fontWeight="700" fontFamily="$body"
            style={{ color: "var(--text)" }}>Create New Project</Text>
          <Text fontSize={12} fontFamily="$body"
            style={{ color: "var(--text-muted)" }}>Choose a name for your project</Text>
        </YStack>

        <YStack width="100%" maxWidth={480} gap="$3">
          <input
            value={path}
            onChange={(e) => { setPath(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, "")); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="my-app"
            autoFocus
            style={{
              width: "100%", padding: "12px 16px",
              fontFamily: "var(--font)", fontSize: 14,
              backgroundColor: "var(--bg-input)", color: "var(--text)",
              border: "1px solid var(--border)", borderRadius: 8, outline: "none",
            }}
          />
          {displayPath && (
            <Text fontSize={11} fontFamily="$body" style={{ color: "var(--text-muted)" }}>
              {displayPath}
            </Text>
          )}
          <XStack gap="$3">
            <button onClick={handleCreate} disabled={loading || !path.trim()}
              style={{ ...btnBase, flex: 1, color: "var(--accent-text)", backgroundColor: "var(--accent)",
                opacity: loading || !path.trim() ? 0.5 : 1,
                cursor: loading || !path.trim() ? "not-allowed" : "pointer" }}>
              {loading ? "Creating..." : "Create"}
            </button>
            <button onClick={() => { setMode(null); setError(""); setPath(""); }}
              style={{ ...btnBase, color: "var(--text-muted)", backgroundColor: "transparent",
                border: "1px solid var(--border)", padding: "14px 20px" }}>
              Back
            </button>
          </XStack>
          {error && (
            <Text fontSize={12} fontFamily="$body" style={{ color: "var(--error)", textAlign: "center" }}>
              {error}
            </Text>
          )}
        </YStack>
      </YStack>
    );
  }

  /* ── Main screen ── */
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$8" gap="$6"
      style={{ backgroundColor: "var(--bg)" }}>

      <YStack alignItems="center" gap="$2">
        <Icon d={icons.logo} size={40} stroke="var(--accent)" />
        <Text fontSize={28} fontWeight="700" fontFamily="$body"
          style={{ color: "var(--text)", letterSpacing: "-1px" }}>
          Ogu Studio
        </Text>
        <Text fontSize={14} fontFamily="$body"
          style={{ color: "var(--text-muted)" }}>
          AI Compiler - Turn ideas into software
        </Text>
      </YStack>

      <XStack gap="$4" marginTop="$4">
        <button onClick={() => setMode("create")}
          style={{ ...btnBase, color: "var(--accent-text)", backgroundColor: "var(--accent)", minWidth: 180 }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}>
          Create Project
        </button>
        <button onClick={openBrowser}
          style={{ ...btnBase, color: "var(--text)", backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)", minWidth: 180 }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}>
          Open Project
        </button>
      </XStack>

      {/* Recent projects */}
      {recent.length > 0 && (
        <YStack gap="$2" marginTop="$4" width="100%" maxWidth={420}>
          <Text fontSize={11} fontFamily="$body" fontWeight="600"
            style={{ color: "var(--text-muted)", letterSpacing: "0.5px" }}>
            RECENT PROJECTS
          </Text>
          {recent.map((r) => (
            <div key={r.path} onClick={() => !loading && openRecent(r.path)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)", borderRadius: 8,
                cursor: loading ? "wait" : "pointer", fontFamily: "var(--font)",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
              <Icon d={icons.logo} size={16} stroke="var(--accent)" />
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.path}</div>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); setDeleteInput(""); setError(""); }}
                style={{
                  flexShrink: 0, padding: 4, borderRadius: 4,
                  color: "var(--text-muted)", cursor: "pointer",
                  transition: "all 0.15s", display: "inline-flex",
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.backgroundColor = "rgba(208,90,90,0.1)"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                title="Delete project"
              ><Icon d={icons.trash} size={12} /></span>
            </div>
          ))}
        </YStack>
      )}

      {error && (
        <Text fontSize={12} fontFamily="$body" marginTop="$2"
          style={{ color: "var(--error)", textAlign: "center" }}>{error}</Text>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }} onClick={(e) => { if (e.target === e.currentTarget) { setDeleteTarget(null); setDeleteInput(""); } }}>
          <div style={{
            width: 420,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
            display: "flex", flexDirection: "column", gap: 16,
            fontFamily: "var(--font)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--error)" }}>
              Delete Project
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
              This will permanently delete <strong>{deleteTarget.name}</strong> and all its files from disk.
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
              {deleteTarget.path}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Type <strong style={{ color: "var(--error)" }}>DELETE</strong> to confirm:
            </div>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
              autoFocus
              placeholder="DELETE"
              style={{
                width: "100%", padding: "10px 14px",
                fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600,
                letterSpacing: 2,
                backgroundColor: "var(--bg-input)", color: "var(--text)",
                border: "1px solid var(--border)", borderRadius: 8, outline: "none",
                textAlign: "center",
              }}
            />
            <XStack gap="$3">
              <button
                onClick={confirmDelete}
                disabled={deleting || deleteInput !== "DELETE"}
                style={{
                  ...btnBase, flex: 1, fontSize: 13,
                  color: "#fff",
                  backgroundColor: deleteInput === "DELETE" ? "var(--error)" : "var(--text-muted)",
                  opacity: deleting || deleteInput !== "DELETE" ? 0.5 : 1,
                  cursor: deleting || deleteInput !== "DELETE" ? "not-allowed" : "pointer",
                }}>
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteInput(""); }}
                style={{ ...btnBase, fontSize: 13, color: "var(--text-muted)", backgroundColor: "transparent",
                  border: "1px solid var(--border)", padding: "14px 20px" }}>
                Cancel
              </button>
            </XStack>
          </div>
        </div>
      )}

      {/* ── Folder browser modal ── */}
      {showBrowser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowBrowser(false); }}>
          <div style={{
            width: 520, maxHeight: "80vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Header with path */}
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
              color: "var(--text)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>Open Project</span>
              <span style={{ flex: 1 }} />
              <span onClick={() => setShowBrowser(false)}
                style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}
                onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                ×
              </span>
            </div>

            {/* Current path bar */}
            <div style={{
              padding: "8px 16px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font)", fontSize: 11,
              color: "var(--text-muted)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Icon d={icons.folder} size={14} stroke="var(--accent)" />
              <span style={{ color: "var(--text)", flex: 1, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {browserPath || "..."}
              </span>
              {browserHasOgu && (
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  backgroundColor: "var(--accent)", color: "var(--accent-text)", fontWeight: 600,
                }}>OGU</span>
              )}
            </div>

            {/* Directory list */}
            <div style={{ flex: 1, overflow: "auto", padding: "4px 0", minHeight: 200, maxHeight: 400 }}>
              {browserPath && (
                <div onClick={() => {
                  const parent = browserPath.split("/").slice(0, -1).join("/") || "/";
                  browseDir(parent);
                }}
                  style={{
                    padding: "8px 16px", fontFamily: "var(--font)", fontSize: 12,
                    color: "var(--text-muted)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-hover)")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <Icon d={icons.chevronUp} size={14} /><span>..</span>
                </div>
              )}

              {browserLoading ? (
                <div style={{ padding: "16px", fontFamily: "var(--font)", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  Loading...
                </div>
              ) : dirs.length === 0 ? (
                <div style={{ padding: "16px", fontFamily: "var(--font)", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  Empty folder
                </div>
              ) : (
                dirs.map((dir) => (
                  <div key={dir} onClick={() => browseDir(browserPath + "/" + dir)}
                    style={{
                      padding: "8px 16px", fontFamily: "var(--font)", fontSize: 12,
                      color: "var(--text)", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-hover)")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <Icon d={icons.folder} size={14} stroke="var(--accent)" />
                    <span>{dir}</span>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Open button */}
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex", gap: 10, justifyContent: "flex-end",
            }}>
              <button onClick={() => setShowBrowser(false)}
                style={{ ...btnBase, padding: "10px 20px", fontSize: 12,
                  color: "var(--text-muted)", backgroundColor: "transparent",
                  border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={handleOpenSelected}
                disabled={loading || !browserPath}
                style={{ ...btnBase, padding: "10px 20px", fontSize: 12,
                  color: "var(--accent-text)", backgroundColor: "var(--accent)",
                  opacity: loading || !browserPath ? 0.5 : 1,
                  cursor: loading || !browserPath ? "not-allowed" : "pointer" }}>
                {loading ? "Opening..." : browserHasOgu ? "Open" : "Open & Initialize"}
              </button>
            </div>
          </div>
        </div>
      )}
    </YStack>
  );
}
