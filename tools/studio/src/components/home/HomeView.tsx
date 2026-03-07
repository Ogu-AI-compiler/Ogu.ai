import { useState, useEffect, useCallback, useRef } from "react";
import { FeatureWizard } from "./FeatureWizard";
import { ArchetypeWizard } from "./ArchetypeWizard";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import type { WizardMode } from "@/data/archetypes";
import { Icon, icons } from "@/lib/icons";
import { IconBtn } from "@/components/shared/IconBtn";

// ── Hero title: slide suffix in → pause → flip out → flip back in → wizard ──
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

    setPhase("reveal");
    const t1 = setTimeout(() => setPhase("full"), 1000);
    const t2 = setTimeout(() => setPhase("flipOut"), 1150);
    const t3 = setTimeout(() => setPhase("flipIn"), 1150 + flipDur);
    const t4 = setTimeout(() => { setPhase("done"); onFlipDone(); }, 1150 + flipDur * 2 + 400);

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
        : "opacity 0s, filter 0s, transform 0s",
    filter: flipping ? "blur(4px)" : "blur(0px)",
    opacity: flipping ? 0 : 1,
    transform: flipping
      ? "translateY(-18px) rotateX(90deg)"
      : "translateY(0) rotateX(0deg)",
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

function ProjectsList({ onBack, onSelect, onResume }: { onBack: () => void; onSelect: (slug: string) => void; onResume: (slug: string, tasks: number) => void }) {
  const [projects, setProjects] = useState<Array<{ slug: string; phase: string; tasks: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const setActiveProjectSlug = useStore((s) => s.setActiveProjectSlug);
  const activeProjectSlug = useStore((s) => s.activeProjectSlug);

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
      // Clear active project from localStorage if this was it
      if (activeProjectSlug === deleteSlug) setActiveProjectSlug(null);
      setDeleteSlug(null);
    } catch { /* ignore */ }
    setDeleting(false);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 max-w-lg mx-auto w-full">
      <div className="w-full mb-8">
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(70,70,70,0.3)",
            boxShadow: "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset",
            color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer",
            transition: "box-shadow 0.15s, background 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.35) -8px -6px 4px -8px inset, rgba(255,255,255,0.3) 6px 6px 4px -5px inset"; e.currentTarget.style.background = "rgba(70,70,70,0.38)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset"; e.currentTarget.style.background = "rgba(70,70,70,0.3)"; }}
        >
          <Icon d={icons.arrowLeft} size={13} />
          Back
        </button>
      </div>
      <h2 className="text-xl font-semibold text-text mb-6 w-full" style={{ fontFamily: "var(--font-sans)" }}>Projects</h2>
      {loading && <span className="text-sm text-text-muted">Loading...</span>}
      {!loading && projects.length === 0 && <span className="text-sm text-text-muted">No projects yet.</span>}
      <div className="flex flex-col gap-2 w-full">
        {projects.map((p) => (
          <div
            key={p.slug}
            className="flex items-center justify-between w-full px-4 py-3 rounded-2xl cursor-pointer transition-all"
            style={{
              background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--color-text)",
              boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            onClick={() => onSelect(p.slug)}
          >
            <span className="text-[14px] font-medium capitalize">{p.slug.replace(/-/g, " ")}</span>
            <div className="flex items-center gap-2">
              {p.tasks > 0 && <span className="text-[11px] text-text-muted">{p.tasks} tasks</span>}
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
                {PHASE_LABELS[p.phase] || p.phase}
              </span>
              {p.phase !== "done" && p.phase !== "observing" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setResuming(p.slug); onResume(p.slug, p.tasks); }}
                  disabled={resuming === p.slug}
                  className="text-[11px] px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)",
                    border: "1px solid rgba(99,241,157,0.35)",
                    color: "var(--color-text)",
                    boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 12px rgba(99,241,157,0.1)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(99,241,157,0.12)"; e.currentTarget.style.borderColor = "rgba(99,241,157,0.55)"; e.currentTarget.style.boxShadow = "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 20px rgba(99,241,157,0.18)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "rgba(99,241,157,0.35)"; e.currentTarget.style.boxShadow = "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 12px rgba(99,241,157,0.1)"; }}
                >
                  {resuming === p.slug ? "Starting..." : p.tasks === 0 ? "Generate Plan" : "Resume Build"}
                </button>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); setDeleteSlug(p.slug); }}
                className="p-1 rounded transition-colors cursor-pointer"
                style={{ color: "var(--color-text-muted)" }}
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

      {deleteSlug && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setDeleteSlug(null); }}>
          <div className="w-[380px] rounded-2xl p-6 flex flex-col gap-4" style={{ background: "rgba(20,20,20,0.9)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            <h3 className="text-base font-semibold" style={{ color: "var(--color-error)" }}>Delete Project</h3>
            <p className="text-sm text-text-muted">Delete <strong className="text-text">{deleteSlug.replace(/-/g, " ")}</strong>?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteSlug(null)} className="px-4 py-2 text-[13px] rounded-md cursor-pointer" style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-[13px] rounded-md cursor-pointer text-white" style={{ backgroundColor: "var(--color-error)", border: "none", opacity: deleting ? 0.6 : 1 }}>{deleting ? "Deleting..." : "Delete"}</button>
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

  const handleSelect = useCallback((key: ProjectType) => { setSelected(key); }, []);
  const handleFlipDone = useCallback(() => { setConfirmed(true); }, []);

  useEffect(() => {
    api.getFeatures().then((fd) => { if (fd.features?.length > 0) setHasProjects(true); }).catch(() => {});
  }, []);

  const handleSelectProject = async (slug: string) => {
    try { await api.activateProject(slug); } catch {}
    setActiveProjectSlug(slug);
    setOsBooted(true);
    setRoute("/project");
  };

  const handleResumeProject = async (slug: string, tasks: number) => {
    try { await api.activateProject(slug); } catch {}
    setActiveProjectSlug(slug);
    setOsBooted(true);
    setLaunchSteps({ brief: "complete", setup: "complete", cto: "active" });
    setRoute("/project");
    api.resumeProject(slug).catch(console.error);
  };

  if (confirmed && selected === "feature") {
    return <FeatureWizard onBack={() => { setSelected(null); setConfirmed(false); }} />;
  }

  if (confirmed && (selected === "website" || selected === "application" || selected === "startup")) {
    const mode: WizardMode = selected === "startup" ? "venture" : selected;
    return <ArchetypeWizard mode={mode} onBack={() => { setSelected(null); setConfirmed(false); }} />;
  }

  if (showProjects) {
    return <ProjectsList onBack={() => setShowProjects(false)} onSelect={handleSelectProject} onResume={handleResumeProject} />;
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="mb-10">
        <HeroTitle suffix={selected ? TYPE_LABELS[selected] : null} onFlipDone={handleFlipDone} />
      </div>

      {/* Chips container — glass pill with gradient border */}
      <div
        className="chip-wrapper"
        style={{
          position: "relative",
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "10px 10px",
          background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 2.45%, rgba(255,255,255,0) 126.14%)",
          borderRadius: "9999px",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          opacity: selected ? 0.3 : 1,
          pointerEvents: selected ? "none" : "auto",
          transition: "opacity 0.4s ease",
        }}
      >
        {/* top-highlight line */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
          borderRadius: "1px",
          pointerEvents: "none",
        }} />
        {PROJECT_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => handleSelect(type.key)}
            className="home-chip flex items-center gap-2 px-4 py-2 rounded-full transition-all cursor-pointer"
            style={{
              border: selected === type.key ? "1px solid rgba(99,241,157,0.35)" : "1px solid rgba(255,255,255,0.1)",
              background: selected === type.key
                ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                : "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
              color: selected === type.key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
              boxShadow: selected === type.key
                ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 16px rgba(99,241,157,0.1)"
                : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
            }}
          >
            <span className="text-[13px] font-medium">{type.label}</span>
          </button>
        ))}
      </div>

      {hasProjects && (
        <button
          onClick={() => setShowProjects(true)}
          className="mt-8 text-[13px] cursor-pointer transition-colors"
          style={{ background: "none", border: "none", padding: 0, color: "var(--color-text-muted)", borderBottom: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.borderBottomColor = "var(--color-text-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderBottomColor = "transparent"; }}
        >
          Existing projects
        </button>
      )}
    </div>
  );
}
