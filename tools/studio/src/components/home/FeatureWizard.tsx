import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store";
import { Icon, icons } from "@/lib/icons";
import { IconBtn } from "@/components/shared/IconBtn";
import { RotatingWord } from "./ArchetypeWizard";
import { api } from "@/lib/api";

const FEATURE_ADJECTIVES = ["Smarter", "Sharper", "Stronger"];

type Step = "connect" | "scan" | "describe" | "impact";

// --- Data model ---

interface ProjectSource {
  id: string;
  type: "local" | "git" | "cloud";
  path: string;
  label: string;
  status: "pending" | "connected" | "error";
  error?: string;
}

type TopologyType = "monolith" | "monorepo" | "multi-repo" | "microservices";

interface DetectedService {
  name: string;
  path: string;
  port?: number;
  stack?: string[];
}

interface DetectedWorkspace {
  name: string;
  path: string;
}

interface WorkspaceTopology {
  type: TopologyType;
  services: DetectedService[];
  workspaces: DetectedWorkspace[];
}

interface ScanResult {
  platform: string;
  files: number;
  directories: string[];
  entrypoints: string[];
  stack: string[];
  raw: string;
  topology: WorkspaceTopology | null;
}

interface ImpactResult {
  files: string[];
  raw: string;
}

interface SavedWorkspace {
  id: string;
  sources: ProjectSource[];
  topology: WorkspaceTopology | null;
  name: string;
  lastUsed: string;
}

// --- Persistence helpers ---

const WORKSPACE_KEY = "ogu-workspaces";

function loadWorkspaces(): SavedWorkspace[] {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "[]");
  } catch { return []; }
}

function saveWorkspace(ws: SavedWorkspace) {
  const all = loadWorkspaces().filter((w) => w.id !== ws.id);
  all.unshift(ws);
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(all.slice(0, 20)));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- Constants ---

const SOURCE_TYPES = [
  { key: "git" as const, label: "Git repo", icon: icons.globe, placeholder: "https://github.com/user/repo" },
  { key: "local" as const, label: "Local path", icon: icons.folder, placeholder: "/path/to/your/project" },
  { key: "cloud" as const, label: "Cloud", icon: icons.rocket, placeholder: "workspace://your-project" },
];

const TOPOLOGY_INFO: Record<TopologyType, { label: string; color: string; description: string }> = {
  monolith: { label: "Monolith", color: "var(--color-accent)", description: "Single codebase, unified deployment" },
  monorepo: { label: "Monorepo", color: "#a78bfa", description: "Multiple packages in one repository" },
  "multi-repo": { label: "Multi-Repo", color: "#60a5fa", description: "Separate repositories, shared context" },
  microservices: { label: "Microservices", color: "#34d399", description: "Independent services with defined boundaries" },
};

const STEP_LABELS: Record<Step, string> = {
  connect: "Connect Context",
  scan: "Codebase Scan",
  describe: "Describe Feature",
  impact: "Impact Map",
};

const STEPS: Step[] = ["connect", "scan", "describe", "impact"];

// --- Step indicator ---

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors"
            style={{
              backgroundColor: i === idx ? "var(--color-accent-soft)" : i < idx ? "var(--color-success-soft)" : "transparent",
              color: i === idx ? "var(--color-text)" : i < idx ? "var(--color-success)" : "var(--color-text-muted)",
              border: i > idx ? "1px solid var(--color-border)" : "1px solid transparent",
            }}
          >
            {i < idx ? "\u2713" : i + 1}
            <span className="ml-1">{STEP_LABELS[step]}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="w-6 h-px"
              style={{ backgroundColor: i < idx ? "var(--color-success)" : "var(--color-border)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Source card ---

function SourceCard({ source, onRemove }: { source: ProjectSource; onRemove: () => void }) {
  const typeInfo = SOURCE_TYPES.find((s) => s.key === source.type);
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
      style={{
        borderColor: source.status === "error" ? "var(--color-error)" : source.status === "connected" ? "var(--color-success)" : "var(--color-border)",
        backgroundColor: "var(--color-bg-card)",
      }}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
        <Icon d={typeInfo?.icon || icons.folder} size={14} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs font-semibold text-text truncate">{source.label}</span>
        <span className="text-[10px] font-mono text-text-muted truncate">{source.path}</span>
      </div>
      {source.status === "connected" && (
        <div className="w-2 h-2 rounded-full bg-success shrink-0" />
      )}
      {source.status === "error" && (
        <span className="text-[10px] text-error shrink-0">Error</span>
      )}
      <IconBtn onClick={onRemove} size={24} style={{ color: "rgba(255,255,255,0.45)", borderRadius: 8 }}>
        <Icon d={icons.x} size={10} />
      </IconBtn>
    </div>
  );
}

// --- Topology badge ---

function TopologyBadge({ topology }: { topology: WorkspaceTopology }) {
  const info = TOPOLOGY_INFO[topology.type];
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{ borderColor: info.color + "40", backgroundColor: info.color + "10" }}
    >
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: info.color }}>{info.label}</span>
          {topology.services.length > 0 && (
            <span className="text-[10px] text-text-muted">{topology.services.length} services</span>
          )}
          {topology.workspaces.length > 0 && (
            <span className="text-[10px] text-text-muted">{topology.workspaces.length} packages</span>
          )}
        </div>
        <span className="text-[10px] text-text-muted">{info.description}</span>
      </div>
    </div>
  );
}

// --- Folder browser ---

function FolderBrowser({ onSelect, onCancel }: { onSelect: (path: string) => void; onCancel: () => void }) {
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOgu, setHasOgu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchDirs = async (path: string) => {
    setLoading(true);
    try {
      const data = await api.listDirs(path || undefined);
      setCurrentPath(data.path || path);
      setDirs(data.dirs || []);
      setHasOgu(!!data.hasOgu);
    } catch {
      setDirs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDirs(""); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentPath]);

  const goUp = () => {
    const parent = currentPath.replace(/\/[^/]+\/?$/, "") || "/";
    fetchDirs(parent);
  };

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-card overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1 overflow-x-auto">
        <button
          onClick={() => fetchDirs("/")}
          className="shrink-0 text-[10px] font-mono text-text-muted hover:text-text cursor-pointer"
        >/</button>
        {breadcrumbs.map((seg, i) => {
          const path = "/" + breadcrumbs.slice(0, i + 1).join("/");
          const isLast = i === breadcrumbs.length - 1;
          return (
            <div key={path} className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-text-muted">/</span>
              <button
                onClick={() => !isLast && fetchDirs(path)}
                className={`text-[10px] font-mono truncate max-w-[100px] ${isLast ? "text-text font-semibold" : "text-text-muted hover:text-text cursor-pointer"}`}
              >
                {seg}
              </button>
            </div>
          );
        })}
      </div>

      {/* Directory list */}
      <div ref={scrollRef} className="flex flex-col max-h-[240px] overflow-y-auto px-1 pb-1">
        {/* Go up */}
        {currentPath !== "/" && (
          <button
            onClick={goUp}
            className="flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
            style={{
              borderRadius: 12, border: "none",
              background: "rgba(0,0,0,0.1)",
              boxShadow: "rgba(0,0,0,0.25) 2.346px 4.691px 4.691px -1.173px inset, rgba(255,255,255,0.65) 0px -1.173px 2.332px 0px inset",
              color: "rgba(255,255,255,0.55)", transition: "box-shadow 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "rgba(0,0,0,0.3) 2.346px 4.691px 4.691px -1.173px inset, rgba(255,255,255,0.75) 0px -1.173px 2.332px 0px inset"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "rgba(0,0,0,0.25) 2.346px 4.691px 4.691px -1.173px inset, rgba(255,255,255,0.65) 0px -1.173px 2.332px 0px inset"; }}
          >
            <Icon d={icons.arrowLeft} size={12} />
            <span className="text-xs">..</span>
          </button>
        )}

        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-text-muted">Loading...</span>
          </div>
        ) : dirs.length === 0 ? (
          <div className="px-3 py-4 text-xs text-text-muted text-center">Empty directory</div>
        ) : (
          dirs.map((dir) => (
            <button
              key={dir}
              onClick={() => fetchDirs(currentPath === "/" ? `/${dir}` : `${currentPath}/${dir}`)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-text-muted hover:bg-bg-elevated hover:text-text transition-colors cursor-pointer text-left group"
            >
              <Icon d={icons.folder} size={13} />
              <span className="text-xs flex-1 truncate">{dir}</span>
            </button>
          ))
        )}
      </div>

      {/* Select / cancel */}
      <div className="flex items-center gap-2 px-3 pb-3 border-t border-border pt-2">
        {hasOgu && (
          <span className="text-[10px] font-semibold text-success mr-1">Ogu project</span>
        )}
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => onSelect(currentPath)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
        >
          Select this folder
        </button>
      </div>
    </div>
  );
}

// --- Saved workspace pill ---

function SavedWorkspacePill({ ws, onSelect }: { ws: SavedWorkspace; onSelect: () => void }) {
  const topoInfo = ws.topology ? TOPOLOGY_INFO[ws.topology.type] : null;
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-card hover:border-accent transition-colors cursor-pointer text-left"
    >
      <span className="text-sm">{ws.sources.length > 1 ? "\u{1F4C2}" : "\u{1F4C1}"}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-text truncate">{ws.name}</span>
        <span className="text-[10px] text-text-muted">
          {ws.sources.length} source{ws.sources.length !== 1 ? "s" : ""}
          {topoInfo ? ` \u00B7 ${topoInfo.label}` : ""}
        </span>
      </div>
    </button>
  );
}

// --- Main wizard ---

export function FeatureWizard({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("connect");
  const [sources, setSources] = useState<ProjectSource[]>([]);
  const [addingSource, setAddingSource] = useState(false);
  const [addType, setAddType] = useState<"local" | "git" | "cloud">("git");
  const [pathInput, setPathInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [savedWorkspaces] = useState(() => loadWorkspaces());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setRoute = useStore((s) => s.setRoute);
  const setPendingChatMessage = useStore((s) => s.setPendingChatMessage);
  const setOsBooted = useStore((s) => s.setOsBooted);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [description]);

  // -- Add source --

  const addSource = (type: "local" | "git" | "cloud", path: string) => {
    const label = path.split("/").filter(Boolean).pop() || path;
    const newSource: ProjectSource = {
      id: genId(),
      type,
      path: path.trim(),
      label,
      status: "connected",
    };
    setSources((prev) => [...prev, newSource]);
    setPathInput("");
    setAddingSource(false);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const loadSavedWorkspace = (ws: SavedWorkspace) => {
    setSources(ws.sources.map((s) => ({ ...s, status: "connected" })));
  };

  // -- Proceed to scan --

  const handleProceedToScan = () => {
    if (sources.length === 0) return;
    setStep("scan");
    runScan();
  };

  // -- Step 2: Scan --

  const detectTopology = async (repoRaw: string, profileStdout: string): Promise<WorkspaceTopology> => {
    const combined = repoRaw + " " + profileStdout;
    const services: DetectedService[] = [];
    const workspaces: DetectedWorkspace[] = [];

    // Detect monorepo markers
    const isMonorepo =
      combined.includes("workspaces") ||
      combined.includes("pnpm-workspace") ||
      combined.includes("lerna.json") ||
      combined.includes("nx.json") ||
      combined.includes("turbo.json") ||
      combined.includes("packages/");

    // Detect microservices markers
    const isMicroservices =
      combined.includes("docker-compose") ||
      combined.includes("Dockerfile") ||
      combined.includes("kubernetes") ||
      combined.includes("k8s") ||
      combined.includes("services/");

    // Extract workspace packages from repo-map
    const pkgMatches = repoRaw.match(/###\s+`(packages\/[^`]+|apps\/[^`]+|services\/[^`]+)`/g) || [];
    for (const m of pkgMatches) {
      const name = m.replace(/###\s+`/, "").replace(/`/, "");
      workspaces.push({ name: name.split("/").pop() || name, path: name });
    }

    // Extract services from docker-compose or services/ patterns
    const svcMatches = repoRaw.match(/###\s+`services\/([^`]+)`/g) || [];
    for (const m of svcMatches) {
      const name = m.replace(/###\s+`services\//, "").replace(/`/, "");
      services.push({ name, path: `services/${name}` });
    }

    // Port detection from common patterns
    const portMatches = combined.matchAll(/(?:port|PORT)[:\s=]+(\d{4,5})/g);
    const ports = [...portMatches].map((m) => parseInt(m[1]));
    if (ports.length > 1 && services.length === 0) {
      // Multiple ports suggest multiple services
      ports.forEach((port, i) => {
        services.push({ name: `service-${i + 1}`, path: "", port });
      });
    }

    // Determine topology type
    let type: TopologyType = "monolith";
    if (sources.length > 1) {
      type = "multi-repo";
    } else if (isMicroservices && services.length > 0) {
      type = "microservices";
    } else if (isMonorepo || workspaces.length > 0) {
      type = "monorepo";
    }

    return { type, services, workspaces };
  };

  const runScan = async () => {
    setScanning(true);
    setScanError(null);

    try {
      // For each source, try to open the project
      for (const source of sources) {
        if (source.path !== "(current project)") {
          try { await api.openProject(source.path); } catch { /* continue */ }
        }
      }

      // Run profile + repo-map
      const [profileRes, repoMapRes] = await Promise.all([
        api.runCommandSync("profile").catch(() => ({ stdout: "", stderr: "", exitCode: 1 })),
        api.runCommandSync("repo-map").catch(() => ({ stdout: "", stderr: "", exitCode: 1 })),
      ]);

      // Fetch state
      const stateRes = await api.getState().catch(() => ({}));
      const profile = stateRes?.profile || {};

      // Parse repo-map output
      const repoRaw = repoMapRes.stdout || "";
      const fileMatch = repoRaw.match(/(\d+)\s*files?/i);
      const files = fileMatch ? parseInt(fileMatch[1]) : 0;

      // Extract stack info
      const stack: string[] = [];
      if (profile.platform) stack.push(profile.platform);

      const techPatterns = [
        "React", "Next.js", "Vue", "Angular", "Svelte",
        "Node.js", "Express", "Hono", "Fastify",
        "TypeScript", "JavaScript", "Python", "Go", "Rust",
        "Prisma", "PostgreSQL", "MongoDB", "SQLite", "Redis",
        "Tailwind", "Vite", "Webpack", "Docker", "Kubernetes",
      ];
      const combined = (profileRes.stdout || "") + " " + repoRaw;
      for (const tech of techPatterns) {
        if (combined.toLowerCase().includes(tech.toLowerCase()) && !stack.includes(tech)) {
          stack.push(tech);
        }
      }

      // Extract directories
      const dirMatches = repoRaw.match(/###\s+`([^`]+)`/g) || [];
      const directories = dirMatches.map((m: string) => m.replace(/###\s+`/, "").replace(/`/, "")).slice(0, 10);

      // Extract entrypoints
      const entryMatches = repoRaw.match(/\|\s+`([^`]+)`\s+\|/g) || [];
      const entrypoints = entryMatches.map((m: string) => m.replace(/\|\s+`/, "").replace(/`\s+\|/, "")).slice(0, 5);

      // Detect topology
      const topology = await detectTopology(repoRaw, profileRes.stdout || "");

      setScanResult({
        platform: profile.platform || "detected",
        files: files || 0,
        directories,
        entrypoints,
        stack: stack.length > 0 ? stack : ["Unknown"],
        raw: repoRaw.slice(0, 500),
        topology,
      });

      // Save workspace for cross-project persistence
      const wsName = sources.length === 1
        ? sources[0].label
        : `${sources[0].label} + ${sources.length - 1} more`;

      saveWorkspace({
        id: genId(),
        sources,
        topology,
        name: wsName,
        lastUsed: new Date().toISOString(),
      });
    } catch (err: any) {
      setScanError(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  // -- Step 3: Describe --

  const handleDescribe = () => {
    if (!description.trim()) return;
    setStep("impact");
    runImpact();
  };

  // -- Step 4: Impact --

  const runImpact = async () => {
    setAnalyzing(true);
    try {
      const data = await api.runCommandSync("impact", [description.trim()]);
      const raw = data.stdout || "";
      const fileLines = raw.split("\n").filter((l: string) => l.includes("/") || l.includes("."));
      setImpactResult({
        files: fileLines.slice(0, 20),
        raw,
      });
    } catch {
      setImpactResult({ files: [], raw: "Impact analysis pending." });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLaunch = () => {
    const trimmed = description.trim();
    const stackInfo = scanResult ? `\nStack: ${scanResult.stack.join(", ")}\nFiles: ${scanResult.files}` : "";
    const topoInfo = scanResult?.topology
      ? `\nTopology: ${scanResult.topology.type}` +
        (scanResult.topology.services.length > 0
          ? `\nServices: ${scanResult.topology.services.map((s) => s.name).join(", ")}`
          : "") +
        (scanResult.topology.workspaces.length > 0
          ? `\nWorkspaces: ${scanResult.topology.workspaces.map((w) => w.name).join(", ")}`
          : "")
      : "";
    const sourcesInfo = sources.length > 1
      ? `\nSources: ${sources.map((s) => s.path).join(", ")}`
      : "";
    const prompt = `/feature\nType: Feature (existing system)${stackInfo}${topoInfo}${sourcesInfo}\n\n${trimmed}`;

    setPendingChatMessage(prompt);
    setOsBooted(true);
    setRoute("/chat");
  };

  // -- Render --

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <StepIndicator current={step} />

      <div key={step} className="w-full max-w-[640px] stage-enter">

        {/* Step 1: Connect Context */}
        {step === "connect" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-text mb-2" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.03em" }}>
                Kadima, Build{" "}
                <RotatingWord words={FEATURE_ADJECTIVES} interval={3500} />{" "}
                Features
              </h2>
              <p className="text-sm text-text-muted">Add one or more repositories. Kadima maps the full infrastructure.</p>
            </div>

            {/* Saved workspaces */}
            {savedWorkspaces.length > 0 && sources.length === 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-medium text-text-muted">RECENT WORKSPACES</span>
                <div className="flex flex-wrap gap-2">
                  {savedWorkspaces.slice(0, 4).map((ws) => (
                    <SavedWorkspacePill key={ws.id} ws={ws} onSelect={() => loadSavedWorkspace(ws)} />
                  ))}
                </div>
              </div>
            )}

            {/* Connected sources */}
            {sources.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-medium text-text-muted">
                  CONNECTED ({sources.length})
                </span>
                {sources.map((s) => (
                  <SourceCard key={s.id} source={s} onRemove={() => removeSource(s.id)} />
                ))}
              </div>
            )}

            {/* Add source form */}
            {addingSource ? (
              <div className="flex flex-col gap-3">
                {/* Type selector */}
                <div className="flex gap-2">
                  {SOURCE_TYPES.map((st) => (
                    <button
                      key={st.key}
                      onClick={() => setAddType(st.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                      style={{
                        backgroundColor: addType === st.key ? "var(--color-accent-soft)" : "transparent",
                        color: addType === st.key ? "var(--color-text)" : "var(--color-text-muted)",
                        border: `1px solid ${addType === st.key ? "var(--color-accent)" : "var(--color-border)"}`,
                      }}
                    >
                      <Icon d={st.icon} size={12} />
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Local → folder browser */}
                {addType === "local" ? (
                  <FolderBrowser
                    onSelect={(path) => {
                      addSource("local", path);
                    }}
                    onCancel={() => { setAddingSource(false); setPathInput(""); }}
                  />
                ) : (
                  <>
                    {/* Git / Cloud → text input */}
                    <input
                      type="text"
                      value={pathInput}
                      onChange={(e) => setPathInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && pathInput.trim()) {
                          addSource(addType, pathInput);
                        }
                      }}
                      placeholder={SOURCE_TYPES.find((s) => s.key === addType)?.placeholder || ""}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg-card text-sm text-text font-mono placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { if (pathInput.trim()) addSource(addType, pathInput); }}
                        disabled={!pathInput.trim()}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30"
                        style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingSource(false); setPathInput(""); }}
                        className="px-4 py-2 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAddingSource(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-sm font-medium text-text-muted hover:text-text hover:border-accent transition-colors cursor-pointer"
              >
                <Icon d={icons.plus} size={14} />
                Add source
              </button>
            )}

            {/* Proceed button */}
            {sources.length > 0 && !addingSource && (
              <button
                onClick={handleProceedToScan}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
              >
                Scan {sources.length === 1 ? "Project" : `${sources.length} Projects`}
              </button>
            )}

            {/* Back */}
            <button
              onClick={onBack}
              className="self-center text-xs text-text-muted hover:text-text transition-colors cursor-pointer mt-2"
            >
              &larr; Back
            </button>
          </div>
        )}

        {/* Step 2: Codebase Scan */}
        {step === "scan" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-text mb-2">
                {scanning ? "Scanning infrastructure..." : "Infrastructure detected"}
              </h2>
              {scanning && (
                <p className="text-sm text-text-muted">
                  Mapping {sources.length > 1 ? `${sources.length} repositories` : "codebase"}, detecting topology
                </p>
              )}
            </div>

            {scanning ? (
              <div className="flex flex-col gap-3 p-6 rounded-xl border border-border bg-bg-card">
                {[
                  "Mapping directories",
                  "Detecting language & stack",
                  "Identifying topology",
                  sources.length > 1 ? "Mapping cross-repo dependencies" : "Finding entry points",
                  "Building dependency graph",
                ].map((label, i) => (
                  <div key={label} className="flex items-center gap-3" style={{ animationDelay: `${i * 0.3}s` }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm text-text-muted">{label}</span>
                  </div>
                ))}
              </div>
            ) : scanResult ? (
              <div className="flex flex-col gap-4">
                {/* Topology badge */}
                {scanResult.topology && (
                  <TopologyBadge topology={scanResult.topology} />
                )}

                {/* Stack + stats card */}
                <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-bg-card">
                  {/* Stack */}
                  <div className="flex flex-wrap gap-2">
                    {scanResult.stack.map((tech) => (
                      <span
                        key={tech}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold"
                        style={{ backgroundColor: "var(--color-accent-soft)", color: "var(--color-accent)" }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-sm">
                    {scanResult.files > 0 && (
                      <span className="text-text">{scanResult.files} <span className="text-text-muted">files</span></span>
                    )}
                    {scanResult.directories.length > 0 && (
                      <span className="text-text">{scanResult.directories.length} <span className="text-text-muted">directories</span></span>
                    )}
                    {scanResult.entrypoints.length > 0 && (
                      <span className="text-text">{scanResult.entrypoints.length} <span className="text-text-muted">entrypoints</span></span>
                    )}
                    {sources.length > 1 && (
                      <span className="text-text">{sources.length} <span className="text-text-muted">repos</span></span>
                    )}
                  </div>

                  {/* Directories */}
                  {scanResult.directories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {scanResult.directories.map((dir) => (
                        <span key={dir} className="px-2 py-0.5 rounded text-[11px] font-mono text-text-muted" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                          {dir}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Services (microservices topology) */}
                  {scanResult.topology && scanResult.topology.services.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-text-muted font-medium">SERVICES</span>
                      <div className="flex flex-wrap gap-2">
                        {scanResult.topology.services.map((svc) => (
                          <div
                            key={svc.name}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border"
                            style={{ backgroundColor: "var(--color-bg-elevated)" }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TOPOLOGY_INFO.microservices.color }} />
                            <span className="text-xs font-mono text-text">{svc.name}</span>
                            {svc.port && <span className="text-[10px] text-text-muted">:{svc.port}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Workspaces (monorepo topology) */}
                  {scanResult.topology && scanResult.topology.workspaces.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-text-muted font-medium">PACKAGES</span>
                      <div className="flex flex-wrap gap-2">
                        {scanResult.topology.workspaces.map((ws) => (
                          <div
                            key={ws.name}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border"
                            style={{ backgroundColor: "var(--color-bg-elevated)" }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TOPOLOGY_INFO.monorepo.color }} />
                            <span className="text-xs font-mono text-text">{ws.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Entrypoints */}
                  {scanResult.entrypoints.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-muted font-medium">ENTRYPOINTS</span>
                      {scanResult.entrypoints.map((ep) => (
                        <span key={ep} className="text-xs font-mono text-text-secondary">{ep}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : scanError ? (
              <div className="p-6 rounded-xl border border-error/30 bg-error-soft text-sm text-error">{scanError}</div>
            ) : null}

            {!scanning && scanResult && (
              <button
                onClick={() => setStep("describe")}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
              >
                Continue
              </button>
            )}
          </div>
        )}

        {/* Step 3: Describe Feature */}
        {step === "describe" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-text mb-2">Describe the feature</h2>
              <p className="text-sm text-text-muted">
                {scanResult?.topology
                  ? `${TOPOLOGY_INFO[scanResult.topology.type].label} \u00B7 ${scanResult.stack.slice(0, 3).join(" + ")}`
                  : scanResult?.stack.length
                    ? `Building on ${scanResult.stack.slice(0, 3).join(" + ")}`
                    : "What do you want to add to this system?"}
              </p>
            </div>

            <div className="wizard-card rounded-[28px] p-5 flex flex-col gap-3">
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleDescribe(); } }}
                placeholder="What do you want to add to this system?"
                rows={3}
                className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-text placeholder:text-text-muted leading-relaxed"
                style={{ minHeight: 60, maxHeight: 160, fontFamily: "var(--font-sans)" }}
                autoFocus
              />
              <div className="flex justify-end">
                <button
                  onClick={handleDescribe}
                  disabled={!description.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-30"
                  style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
                >
                  Analyze Impact
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Impact Map */}
        {step === "impact" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-text mb-2">
                {analyzing ? "Analyzing impact..." : "Impact Analysis"}
              </h2>
              {!analyzing && (
                <p className="text-sm text-text-muted">
                  {scanResult?.topology?.type === "multi-repo"
                    ? "Cross-repository blast radius"
                    : scanResult?.topology?.type === "microservices"
                      ? "Cross-service impact analysis"
                      : "Review the blast radius before proceeding"}
                </p>
              )}
            </div>

            {analyzing ? (
              <div className="flex flex-col gap-3 p-6 rounded-xl border border-border bg-bg-card">
                {[
                  "Mapping affected files",
                  sources.length > 1 ? "Checking cross-repo dependencies" : "Checking database tables",
                  scanResult?.topology?.type === "microservices" ? "Mapping service boundaries" : "Identifying tests to update",
                  "Calculating risk surface",
                ].map((label, i) => (
                  <div key={label} className="flex items-center gap-3" style={{ animationDelay: `${i * 0.3}s` }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm text-text-muted">{label}</span>
                  </div>
                ))}
              </div>
            ) : impactResult ? (
              <div className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-bg-card">
                {/* Topology context */}
                {scanResult?.topology && scanResult.topology.type !== "monolith" && (
                  <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: TOPOLOGY_INFO[scanResult.topology.type].color + "20", color: TOPOLOGY_INFO[scanResult.topology.type].color }}
                    >
                      {TOPOLOGY_INFO[scanResult.topology.type].label}
                    </span>
                    {sources.length > 1 && (
                      <span className="text-[10px] text-text-muted">{sources.length} repos analyzed</span>
                    )}
                  </div>
                )}

                {/* Feature summary */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-text-muted font-medium">FEATURE</span>
                  <span className="text-sm text-text">{description}</span>
                </div>

                {/* Affected files */}
                {impactResult.files.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted font-medium">AFFECTED FILES</span>
                    <div className="flex flex-col gap-0.5">
                      {impactResult.files.map((f, i) => (
                        <span key={i} className="text-xs font-mono text-text-secondary">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw output */}
                {impactResult.raw && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted font-medium">ANALYSIS</span>
                    <pre className="text-xs font-mono text-text-muted whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-auto">
                      {impactResult.raw.slice(0, 1000)}
                    </pre>
                  </div>
                )}

                {/* Phase indicator */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <span className="text-[10px] text-text-muted">Phase:</span>
                  <span className="text-xs font-semibold text-accent">Impact Analysis</span>
                  <span className="text-[10px] text-text-muted ml-auto">Next: Approve architecture draft</span>
                </div>
              </div>
            ) : null}

            {!analyzing && (
              <button
                onClick={handleLaunch}
                className="btn-shimmer w-full py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
              >
                Build
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
