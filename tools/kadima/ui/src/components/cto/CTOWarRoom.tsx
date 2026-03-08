import { useState, useRef, useMemo } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { TeamProposal } from "./TeamProposal";
import { toast } from "sonner";

// ── Inline CTO Node — exact same design as TaskGraph ──
// Natural path viewBox: 298.24 × 368.24. Rendered at CTO_W × CTO_H via SVG viewBox scaling.
const CTO_W = 96, CTO_H = 120;
const CARD_VW = 298.24, CARD_VH = 368.24;
// Original path (unscaled — SVG viewBox handles uniform scaling)
const CARD_PATH = `M225.68,1 c7.71,0 15.24,3.15 20.65,8.64 l42.55,43.16 c5.38,5.46 8.35,12.69 8.35,20.36 v275.08 c0,10.48 -8.52,19 -19,19 H20 c-10.48,0 -19,-8.52 -19,-19 V20 C1,9.52 9.52,1 20,1 h205.68Z`;

function CTONodeSVG({ active }: { active: boolean }) {
  // All coordinates in natural 298.24 × 368.24 space
  const cx = CARD_VW / 2;           // 149.12
  const cy = CARD_VH * 0.42;        // 154.66
  const cr = 50;                     // circle radius in natural coords (~16px rendered)
  const iconSize = 62;               // 20px rendered
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2;

  return (
    <svg
      width={CTO_W} height={CTO_H}
      viewBox={`0 0 ${CARD_VW} ${CARD_VH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="warroom-cto-fill" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"    stopColor="#63f19d" stopOpacity="0" />
          <stop offset="2.45%" stopColor="#63f19d" stopOpacity="0.08" />
          <stop offset="100%"  stopColor="#63f19d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="warroom-cto-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--color-accent)" stopOpacity={active ? 0.95 : 0.75} />
          <stop offset="22%"  stopColor="var(--color-accent)" stopOpacity={active ? 0.45 : 0.30} />
          <stop offset="78%"  stopColor="var(--color-accent)" stopOpacity={active ? 0.45 : 0.30} />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={active ? 0.90 : 0.70} />
        </linearGradient>
        <clipPath id="warroom-cto-clip"><path d={CARD_PATH} /></clipPath>
      </defs>

      {/* Dark base */}
      <path d={CARD_PATH} fill="rgba(8,8,8,0.60)" stroke="url(#warroom-cto-border)" strokeWidth={4} />
      {/* Green gradient overlay */}
      <rect x={0} y={0} width={CARD_VW} height={CARD_VH} fill="url(#warroom-cto-fill)" clipPath="url(#warroom-cto-clip)" style={{ pointerEvents: "none" }} />

      {/* Icon in circle */}
      <circle cx={cx} cy={cy} r={cr} fill="rgba(99,241,157,0.1)" />
      <svg x={iconX} y={iconY} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        {/* Edges — flowing dash animation */}
        <path d="M13.5 5L17.5 10M14.5 15.5L10.5 18.5M8 17.5L5 9.5M6.31298 6.65431L10.5 4.5M12.5 11.5L16.505 11.8443" stroke="var(--color-accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" style={{ animation: "net-line-flow 1.6s linear infinite" }}/>
        <path d="M12 5.5L11 10" stroke="var(--color-accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" style={{ animation: "net-line-flow 1.6s linear infinite 0.2s" }}/>
        {/* Nodes — staggered pulse */}
        <path d="M21.5 12C21.5 13.3807 20.3807 14.5 19 14.5C17.6193 14.5 16.5 13.3807 16.5 12C16.5 10.6193 17.6193 9.5 19 9.5C20.3807 9.5 21.5 10.6193 21.5 12Z" stroke="var(--color-accent)" strokeWidth="1" style={{ animation: "net-node-pulse 2s ease-in-out infinite 0s" }}/>
        <path d="M13.5 4C13.5 4.82843 12.8284 5.5 12 5.5C11.1716 5.5 10.5 4.82843 10.5 4C10.5 3.17157 11.1716 2.5 12 2.5C12.8284 2.5 13.5 3.17157 13.5 4Z" stroke="var(--color-accent)" strokeWidth="1" style={{ animation: "net-node-pulse 2s ease-in-out infinite 0.4s" }}/>
        <path d="M12.5 11.5C12.5 12.3284 11.8284 13 11 13C10.1716 13 9.5 12.3284 9.5 11.5C9.5 10.6716 10.1716 10 11 10C11.8284 10 12.5 10.6716 12.5 11.5Z" stroke="var(--color-accent)" strokeWidth="1" style={{ animation: "net-node-pulse 2s ease-in-out infinite 0.8s" }}/>
        <path d="M6.5 7.5C6.5 8.60457 5.60457 9.5 4.5 9.5C3.39543 9.5 2.5 8.60457 2.5 7.5C2.5 6.39543 3.39543 5.5 4.5 5.5C5.60457 5.5 6.5 6.39543 6.5 7.5Z" stroke="var(--color-accent)" strokeWidth="1" style={{ animation: "net-node-pulse 2s ease-in-out infinite 1.2s" }}/>
        <path d="M10.5 19.5C10.5 20.6046 9.60457 21.5 8.5 21.5C7.39543 21.5 6.5 20.6046 6.5 19.5C6.5 18.3954 7.39543 17.5 8.5 17.5C9.60457 17.5 10.5 18.3954 10.5 19.5Z" stroke="var(--color-accent)" strokeWidth="1" style={{ animation: "net-node-pulse 2s ease-in-out infinite 1.6s" }}/>
      </svg>

      {/* Label */}
      {!active && (
        <text x={cx} y={CARD_VH * 0.82} textAnchor="middle" dominantBaseline="central"
          fill="var(--color-text)" fontSize={28} fontWeight={600} fontFamily="var(--font-sans)">CTO</text>
      )}
      {active && (
        <foreignObject x={12} y={CARD_VH * 0.76} width={CARD_VW - 24} height={50}>
          <div style={{ textAlign: "center", fontSize: 25, fontWeight: 600, fontFamily: "var(--font-sans)" }} className="letter-shimmer">Analyzing...</div>
        </foreignObject>
      )}
    </svg>
  );
}

// ── CTO Beam Shot (horizontal: node → text) ──
function CTOBeam({ active, text }: { active: boolean; text: string }) {
  const BEAM_W = 480, BEAM_H = CTO_H;
  const nodeRightX = CTO_W;
  const textX = CTO_W + 32;
  const midY = BEAM_H / 2;
  const pathD = `M ${nodeRightX} ${midY} L ${BEAM_W - 20} ${midY}`;
  const gradId = "cto-beam-grad";

  return (
    <div className="wizard-card rounded-[20px] mb-6 overflow-hidden" style={{ position: "relative" }}>
      <div className="flex items-center" style={{ padding: "16px 20px", gap: 0 }}>
        {/* SVG layer: node + beam + text area */}
        <svg width={BEAM_W} height={BEAM_H} style={{ position: "absolute", left: 20, top: 0, pointerEvents: "none", overflow: "visible" }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
              <stop offset="30%" stopColor="var(--color-accent)" stopOpacity="0.9" />
              <stop offset="70%" stopColor="var(--color-accent)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="beam-glow" x="-10%" y="-400%" width="120%" height="900%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Base beam line */}
          <path d={pathD} fill="none" stroke="rgba(99,241,157,0.15)" strokeWidth={1} />
          {/* Animated beam shot + glow */}
          {active && (
            <>
              {/* Glow layer */}
              <path
                d={pathD} fill="none" stroke={`url(#${gradId})`}
                strokeWidth={6} strokeOpacity={0.4}
                strokeDasharray="60 360"
                style={{ animation: "beamShoot 2s ease-in-out infinite" }}
                filter="url(#beam-glow)"
              />
              {/* Sharp core */}
              <path
                d={pathD} fill="none" stroke={`url(#${gradId})`}
                strokeWidth={2.5}
                strokeDasharray="60 360"
                style={{ animation: "beamShoot 2s ease-in-out infinite" }}
              />
            </>
          )}
        </svg>

        {/* CTO Node */}
        <div style={{ zIndex: 1, flexShrink: 0 }}>
          <CTONodeSVG active={active} />
        </div>

        {/* Thinking text — offset to clear the node */}
        <div style={{ marginLeft: 48, zIndex: 1, flexShrink: 1, minWidth: 0 }}>
          <span className="text-sweep text-sm font-medium block">
            {text}
          </span>
          <p className="text-xs text-text-muted mt-0.5">This usually takes 30–60 seconds</p>
        </div>
      </div>
    </div>
  );
}

export function CTOWarRoom() {
  const currentStage = useStore((s) => s.currentStage);
  const activityLines = useStore((s) => s.activityLines);
  const teamData = useStore((s) => s.teamData);
  const teamApproved = useStore((s) => s.teamApproved);
  const setTeamApproved = useStore((s) => s.setTeamApproved);
  const activeProjectSlug = useStore((s) => s.activeProjectSlug);
  const addActivityLine = useStore((s) => s.addActivityLine);
  const projectUIState = useStore((s) => s.projectUIState);
  const [approving, setApproving] = useState(false);
  const mountedAtRef = useRef<number>(Date.now());

  const setCurrentStage = useStore((s) => s.setCurrentStage);
  const setActiveProjectSlug = useStore((s) => s.setActiveProjectSlug);
  const clearActivityLines = useStore((s) => s.clearActivityLines);
  const resetDispatchProgress = useStore((s) => s.resetDispatchProgress);
  const setExecutionStatus = useStore((s) => s.setExecutionStatus);

  // Only show activity lines that arrived after this component mounted
  const visibleLines = activityLines.filter((l) => l.ts >= mountedAtRef.current);
  const latestLine = visibleLines[visibleLines.length - 1] ?? null;

  const handleAbort = async () => {
    if (activeProjectSlug) {
      await api.abortProject(activeProjectSlug).catch(() => {});
    }
    toast.dismiss("cto-activity");
    clearActivityLines();
    resetDispatchProgress();
    setExecutionStatus("idle");
    setActiveProjectSlug(null);
    setCurrentStage("brief");
  };

  const handleApprove = async () => {
    if (!activeProjectSlug) return;
    setApproving(true);
    // Optimistic: move away from team view immediately
    setTeamApproved(true);
    addActivityLine("Team approved — starting build", "dispatch");
    try {
      await api.approveTeam(activeProjectSlug);
    } catch (err: any) {
      setTeamApproved(false);
      addActivityLine(`Team approval failed: ${err.message}`, "error");
    }
    setApproving(false);
  };

  const showTeam = currentStage === "team" && teamData && !teamApproved;
  // Also show "thinking" after team approval while waiting for dispatch:started
  const thinking = currentStage === "brief" || currentStage === "cto" || (currentStage === "team" && !teamData) || (currentStage === "team" && teamApproved);

  const tasks = useMemo(() => projectUIState?.tasks || [], [projectUIState?.tasks]);

  // Real progress: stage milestones + activity line count
  const STAGE_BASE: Record<string, number> = { brief: 8, cto: 40, team: 78 };
  const stageBase = STAGE_BASE[currentStage] ?? 0;
  const lineBonus = Math.min(22, visibleLines.length * 2.5);
  const realProgress = Math.min(96, stageBase + lineBonus);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header — matches Marketplace/Budget header style */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(99,241,157,0.1)", border: "1px solid rgba(99,241,157,0.18)" }}
          >
            <Icon d={icons.lightbulb} size={14} stroke="var(--color-accent)" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text leading-tight">
              {showTeam ? "Team Assembly" : thinking ? "CTO Analysis" : "Project Plan"}
            </h1>
            <p className="text-xs text-text-muted leading-tight mt-0.5">
              {showTeam
                ? "Review your team and approve to start building"
                : thinking
                  ? "Analyzing brief and assembling team..."
                  : `${tasks.length} tasks planned`}
            </p>
          </div>
        </div>

        {thinking && !showTeam && (
          <button
            onClick={handleAbort}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer"
            style={{
              border: "1px solid rgba(248,113,113,0.3)",
              background: "rgba(248,113,113,0.06)",
              color: "#f87171",
            }}
          >
            <Icon d={icons.x} size={10} stroke="#f87171" />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Abort</span>
          </button>
        )}
      </div>

      {/* Main content — centered, scrollable */}
      <div className={`flex-1 overflow-auto ${(showTeam || thinking) ? "flex items-center justify-center" : ""}`}>
        <div className="max-w-2xl w-full mx-auto px-4 py-6 stage-enter">

          {/* Thinking state — CTO node + beam + activity log */}
          {thinking && !showTeam && (
            <div>
              {/* Row: processing card + beam + CTO node */}
              <div className="flex items-center gap-0 mb-5">
                {/* Processing card */}
                <div
                  className="flex items-center gap-4 px-5 py-4 rounded-[16px] flex-1"
                  style={{
                    background: "linear-gradient(180deg, rgba(99,241,157,0.05) 0%, rgba(99,241,157,0) 100%)",
                    border: "1px solid rgba(99,241,157,0.3)",
                    boxShadow: "0 0 0 1px rgba(99,241,157,0.04) inset, 0 1px 0 rgba(99,241,157,0.12) inset",
                  }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(99,241,157,0.1)" }}>
                    <Icon d={icons.loader} size={16} style={{ animation: "spin 1.5s linear infinite", color: "var(--color-accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {latestLine ? (
                      <span key={latestLine.ts} className="text-sweep text-xs font-medium block activity-line-reveal truncate">
                        {latestLine.text}
                      </span>
                    ) : (
                      <span className="text-sweep text-xs font-medium block">
                        {currentStage === "brief" ? "Processing brief..." : "Analyzing project complexity..."}
                      </span>
                    )}
                    <p className="text-text-muted mt-0.5" style={{ fontSize: 10 }}>Usually 1–3 minutes</p>
                    {/* Progress bar */}
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${realProgress}%`,
                            background: "linear-gradient(90deg, rgba(99,241,157,0.6), rgba(99,241,157,1))",
                            boxShadow: "0 0 6px rgba(99,241,157,0.35)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                        <span>{currentStage === "brief" ? "Parsing brief" : currentStage === "cto" ? "CTO planning" : "Assembling team"}</span>
                        <span>{Math.round(realProgress)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Beam connector */}
                <svg width={80} height={CTO_H} style={{ flexShrink: 0, overflow: "visible" }}>
                  <path d={`M 0 ${CTO_H / 2} L 80 ${CTO_H / 2}`} fill="none" stroke="rgba(99,241,157,0.18)" strokeWidth={2} />
                  <path
                    d={`M 0 ${CTO_H / 2} L 80 ${CTO_H / 2}`}
                    fill="none"
                    stroke="rgba(99,241,157,0.95)"
                    strokeWidth={2}
                    strokeDasharray="160 320"
                    pathLength={480}
                    style={{ animation: "beamShoot 2.4s ease-in-out infinite" }}
                  />
                </svg>

                {/* CTO Node */}
                <div style={{ flexShrink: 0, zIndex: 1 }}>
                  <CTONodeSVG active={true} />
                </div>
              </div>

              {/* Activity log — last 2 previous messages */}
              {visibleLines.length > 1 && (
                <div className="space-y-1.5">
                  {visibleLines.slice(-3, -1).map((line) => (
                    <div
                      key={line.ts}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: "rgba(99,241,157,0.5)" }} />
                      <span className="text-text-muted truncate" style={{ fontSize: 11 }}>{line.text}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* Team Proposal */}
          {showTeam && (
            <TeamProposal
              team={teamData}
              onApprove={handleApprove}
              approving={approving}
            />
          )}

        </div>
      </div>
    </div>
  );
}
