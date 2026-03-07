import { useState, useEffect, useCallback, useRef } from "react";
import { FeatureWizard } from "./FeatureWizard";
import { ArchetypeWizard } from "./ArchetypeWizard";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { WizardMode } from "@/data/archetypes";

// ── Hero title: slide suffix in → pause → flip out → flip back in → wizard ──
// Phases: idle → reveal → full → flipOut → flipIn → done
function HeroTitle({ suffix, onFlipDone }: { suffix: string | null; onFlipDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "reveal" | "full" | "flipOut" | "flipIn" | "done">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [suffixWidth, setSuffixWidth] = useState(0);
  const base = "Kadima, Let's Build";
  const staggerMs = 24;
  const easeSmooth = "cubic-bezier(0.22, 1, 0.36, 1)";

  useEffect(() => {
    if (!suffix) { setPhase("idle"); setSuffixWidth(0); return; }

    requestAnimationFrame(() => {
      if (measureRef.current) setSuffixWidth(measureRef.current.offsetWidth);
    });

    const fullLen = (base + " " + suffix).length;
    const flipDur = fullLen * staggerMs + 550;

    // Timeline — deliberate pacing
    setPhase("reveal");
    const t1 = setTimeout(() => setPhase("full"), 1500);
    const t2 = setTimeout(() => setPhase("flipOut"), 2000);
    const t3 = setTimeout(() => setPhase("flipIn"), 2000 + flipDur);
    const t4 = setTimeout(() => { setPhase("done"); onFlipDone(); }, 2000 + flipDur * 2 + 400);

    timers.current = [t1, t2, t3, t4];
    return () => timers.current.forEach(clearTimeout);
  }, [suffix]);

  const baseChars = base.split("");
  const suffixChars = suffix ? (" " + suffix).split("") : [];
  const active = phase !== "idle";
  const flipping = phase === "flipOut";
  const flippingIn = phase === "flipIn" || phase === "done";

  const baseLetterStyle = (char: string, i: number): React.CSSProperties => ({
    display: "inline-block",
    transformStyle: "preserve-3d",
    backfaceVisibility: "hidden",
    transition: flipping
      ? `opacity 0.45s ease ${i * staggerMs}ms, filter 0.45s ease ${i * staggerMs}ms, transform 0.45s ease ${i * staggerMs}ms`
      : flippingIn
        ? `opacity 0.5s ease ${i * staggerMs}ms, filter 0.5s ease ${i * staggerMs}ms, transform 0.5s ease ${i * staggerMs}ms`
        : "none",
    filter: flipping ? "blur(4px)" : "blur(0px)",
    opacity: flipping ? 0 : 1,
    transform: flipping
      ? "translateY(-18px) rotateX(90deg)"
      : flippingIn
        ? "translateY(0) rotateX(0deg)"
        : "none",
    minWidth: char === " " ? "0.25em" : undefined,
    letterSpacing: "-0.05em",
  });

  const suffixLetterStyle = (char: string, i: number): React.CSSProperties => {
    const gi = baseChars.length + i;
    const revealed = active && !flipping;
    return {
      display: "inline-block",
      transformStyle: "preserve-3d",
      backfaceVisibility: "hidden",
      transition: flipping
        ? `opacity 0.45s ease ${gi * staggerMs}ms, filter 0.45s ease ${gi * staggerMs}ms, transform 0.45s ease ${gi * staggerMs}ms`
        : flippingIn
          ? `opacity 0.5s ease ${gi * staggerMs}ms, filter 0.5s ease ${gi * staggerMs}ms, transform 0.5s ease ${gi * staggerMs}ms`
          : `opacity 1s ${easeSmooth} ${i * 45}ms, filter 1s ${easeSmooth} ${i * 45}ms, transform 1s ${easeSmooth} ${i * 45}ms`,
      opacity: flipping ? 0 : revealed || flippingIn ? 1 : 0,
      filter: flipping ? "blur(4px)" : revealed || flippingIn ? "blur(0px)" : "blur(6px)",
      transform: flipping
        ? "translateY(-18px) rotateX(90deg)"
        : revealed || flippingIn
          ? "translateY(0) rotateX(0deg)"
          : "translateX(18px)",
      minWidth: char === " " ? "0.25em" : undefined,
      letterSpacing: "-0.05em",
    };
  };

  return (
    <>
      {suffix && (
        <span
          ref={measureRef}
          className="text-4xl font-semibold tracking-tight"
          style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}
        >
          {" "}{suffix}
        </span>
      )}

      <div style={{ display: "flex", justifyContent: "center", perspective: 10000, transformStyle: "preserve-3d" }}>
        <h2
          className="text-4xl font-semibold tracking-tight text-text"
          style={{ margin: 0, fontFamily: "var(--font-sans)", transformStyle: "preserve-3d", whiteSpace: "nowrap" }}
        >
          {baseChars.map((c, i) => (
            <span key={`b${i}`} style={baseLetterStyle(c, i)}>
              {c === " " ? "\u00A0" : c}
            </span>
          ))}
          <span
            style={{
              display: "inline-block",
              width: active ? suffixWidth : 0,
              overflow: "visible",
              transition: `width 1.2s ${easeSmooth}`,
              whiteSpace: "nowrap",
              verticalAlign: "baseline",
            }}
          >
            {suffixChars.map((c, i) => (
              <span key={`s${i}`} style={suffixLetterStyle(c, i)}>
                {c === " " ? "\u00A0" : c}
              </span>
            ))}
          </span>
        </h2>
      </div>
    </>
  );
}

const PROJECT_TYPES = [
  { key: "startup", label: "Startup", icon: "\u{1F680}" },
  { key: "application", label: "Application", icon: "\u{1F4F1}" },
  { key: "website", label: "Website", icon: "\u{1F310}" },
  { key: "feature", label: "Feature", icon: "\u{1F527}" },
] as const;

type ProjectType = typeof PROJECT_TYPES[number]["key"];

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery", feature: "Feature", architect: "Architect",
  design: "Design", preflight: "Preflight", lock: "Lock",
  building: "Building", verifying: "Verifying", enforcing: "Enforcing",
  previewing: "Preview", done: "Done", observing: "Observing", ready: "Ready",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Night";
}

// ── Projects List Screen ──

function ProjectsList({ onBack, onSelect, onResume }: { onBack: () => void; onSelect: (slug: string) => void; onResume: (slug: string, tasks: number) => void }) {
  const [projects, setProjects] = useState<Array<{ slug: string; phase: string; tasks: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);

  useEffect(() => {
    api.getFeatures()
      .then((fd) => setProjects(fd.features || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!deleteSlug) return;
    setDeleting(true);
    try {
      await api.deleteFeature(deleteSlug);
      setProjects((prev) => prev.filter((p) => p.slug !== deleteSlug));
      setDeleteSlug(null);
    } catch { /* ignore */ }
    setDeleting(false);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 max-w-lg mx-auto w-full">
      <div className="w-full mb-8">
        <button
          onClick={onBack}
          className="text-[13px] cursor-pointer transition-colors"
          style={{ background: "none", border: "none", color: "var(--color-text-muted)" }}
        >
          &larr; Back
        </button>
      </div>

      <h2 className="text-xl font-semibold text-text mb-6 w-full" style={{ fontFamily: "var(--font-sans)" }}>
        Projects
      </h2>

      {loading && (
        <span className="text-sm text-text-muted">Loading...</span>
      )}

      {!loading && projects.length === 0 && (
        <span className="text-sm text-text-muted">No projects yet.</span>
      )}

      <div className="flex flex-col gap-2 w-full">
        {projects.map((p) => (
          <div
            key={p.slug}
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg cursor-pointer transition-all"
            style={{
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg-card)";
              e.currentTarget.style.borderColor = "var(--color-border-hover, var(--color-text-muted))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
            onClick={() => onSelect(p.slug)}
          >
            <span className="text-[14px] font-medium" style={{ textTransform: "capitalize" }}>
              {p.slug.replace(/-/g, " ")}
            </span>
            <div className="flex items-center gap-2">
              {p.tasks > 0 && (
                <span className="text-[11px] text-text-muted">
                  {p.tasks} tasks
                </span>
              )}
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "var(--color-text-muted)",
                }}
              >
                {PHASE_LABELS[p.phase] || p.phase}
              </span>
              {/* Resume button — only for projects that aren't done */}
              {p.phase !== "done" && p.phase !== "observing" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setResuming(p.slug);
                    onResume(p.slug, p.tasks);
                  }}
                  disabled={resuming === p.slug}
                  className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer"
                  style={{
                    background: "var(--color-accent-soft)",
                    color: "var(--color-accent)",
                    border: "1px solid rgba(99, 241, 157, 0.3)",
                    opacity: resuming === p.slug ? 0.6 : 1,
                  }}
                >
                  {resuming === p.slug ? "Starting..." : p.tasks === 0 ? "Generate Plan" : "Resume Build"}
                </button>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); setDeleteSlug(p.slug); }}
                className="p-1 rounded transition-colors"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-error, #ef4444)";
                  e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--color-text-muted)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                title="Delete project"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {deleteSlug && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteSlug(null); }}
        >
          <div className="w-[380px] bg-bg-card border border-border rounded-lg p-6 flex flex-col gap-4">
            <h3 className="text-base font-semibold" style={{ color: "var(--color-error, #ef4444)" }}>
              Delete Project
            </h3>
            <p className="text-sm text-text-muted">
              Delete <strong className="text-text">{deleteSlug.replace(/-/g, " ")}</strong>? This removes the feature directory and all its files.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteSlug(null)}
                className="px-4 py-2 text-[13px] rounded-md cursor-pointer transition-colors"
                style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-[13px] rounded-md cursor-pointer transition-colors text-white"
                style={{ backgroundColor: "var(--color-error, #ef4444)", border: "none", opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main HomeView ──

const TYPE_LABELS: Record<ProjectType, string> = {
  startup: "a Startup",
  application: "an App",
  website: "a Website",
  feature: "a Feature",
};

export function HomeView() {
  const [selected, setSelected] = useState<ProjectType | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);
  const setOsBooted = useStore((s) => s.setOsBooted);
  const setActiveProjectSlug = useStore((s) => s.setActiveProjectSlug);
  const setRoute = useStore((s) => s.setRoute);
  const setLaunchSteps = useStore((s) => s.setLaunchSteps);

  const handleSelect = useCallback((key: ProjectType) => {
    setSelected(key);
  }, []);

  const handleFlipDone = useCallback(() => {
    setConfirmed(true);
  }, []);

  // Check if any projects exist
  useEffect(() => {
    api.getFeatures()
      .then((fd) => {
        if (fd.features?.length > 0) setHasProjects(true);
      })
      .catch(() => {});
  }, []);

  const handleSelectProject = async (slug: string) => {
    // Switch OGU_ROOT on server to this project's root (needed for ~/Projects/* projects)
    try { await api.activateProject(slug); } catch { /* best effort */ }
    setActiveProjectSlug(slug);
    setOsBooted(true);
    setRoute("/project");
  };

  const handleResumeProject = async (slug: string, tasks: number) => {
    try { await api.activateProject(slug); } catch { /* best effort */ }
    setActiveProjectSlug(slug);
    setOsBooted(true);
    // Show the CTO animation while resume runs in background
    setLaunchSteps({ brief: "complete", setup: "complete", cto: "active" });
    setRoute("/project");
    // Fire resume (plan re-gen if tasks=0, dispatch resume if tasks>0)
    api.resumeProject(slug).catch(console.error);
  };

  // Feature mode — separate wizard (unchanged)
  if (confirmed && selected === "feature") {
    return <FeatureWizard onBack={() => { setSelected(null); setConfirmed(false); }} />;
  }

  // Website, Application, Startup — all go through ArchetypeWizard
  if (confirmed && (selected === "website" || selected === "application" || selected === "startup")) {
    const mode: WizardMode = selected === "startup" ? "venture" : selected;
    return <ArchetypeWizard mode={mode} onBack={() => { setSelected(null); setConfirmed(false); }} />;
  }

  // Projects list
  if (showProjects) {
    return <ProjectsList onBack={() => setShowProjects(false)} onSelect={handleSelectProject} onResume={handleResumeProject} />;
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      {/* Title — "Kadima, Let's Build" + suffix slides in → flip → wizard */}
      <div className="mb-10">
        <HeroTitle
          suffix={selected ? TYPE_LABELS[selected] : null}
          onFlipDone={handleFlipDone}
        />
      </div>

      {/* Project type chips */}
      <div className="flex gap-2 flex-wrap justify-center" style={{ opacity: selected ? 0.3 : 1, pointerEvents: selected ? "none" : "auto", transition: "opacity 0.4s ease" }}>
        {PROJECT_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => handleSelect(type.key)}
            className="home-chip flex items-center gap-2 px-4 py-2 rounded-full border transition-all cursor-pointer"
            style={{
              borderColor: selected === type.key ? "var(--color-accent)" : "var(--color-border)",
              backgroundColor: selected === type.key ? "var(--color-accent-soft)" : "transparent",
              color: selected === type.key ? "var(--color-text)" : "var(--color-text-muted)",
            }}
          >
            <span className="text-sm">{type.icon}</span>
            <span className="text-[13px] font-medium">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Existing projects link */}
      {hasProjects && (
        <button
          onClick={() => setShowProjects(true)}
          className="mt-8 text-[13px] cursor-pointer transition-colors"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--color-text-muted)",
            textDecoration: "none",
            borderBottom: "1px solid transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = "var(--color-text-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
        >
          Existing projects
        </button>
      )}
    </div>
  );
}
