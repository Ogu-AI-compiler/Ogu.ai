import { useEffect, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import { useThemeCSS } from "@/hooks/useThemeCSS";
import { useStore } from "@/store";
import { api } from "@/lib/api";

// Layouts
import { FullscreenLayout } from "@/layouts/FullscreenLayout";
import { WorkflowLayout } from "@/layouts/WorkflowLayout";

// Screens
import { AuthView } from "@/components/auth/AuthView";
import { HomeView } from "@/components/home/HomeView";
import { CTOWarRoom } from "@/components/cto/CTOWarRoom";
import { PlanningPhase } from "@/components/planning/PlanningPhase";
import { ExecutionWorkspace } from "@/components/execution/ExecutionWorkspace";
import { CompilationView } from "@/components/verification/CompilationView";
import { ProjectComplete } from "@/components/done/ProjectComplete";
import { KadimaView } from "@/components/kadima/KadimaView";
import { CmdKOverlay } from "@/components/kadima/CmdKOverlay";
import { KadimaInterrupts } from "@/components/kadima/KadimaInterrupts";
import { MarketplaceView } from "@/components/marketplace/MarketplaceView";
import { BudgetView } from "@/components/budget/BudgetView";
import { AuditView } from "@/components/audit/AuditView";
import { SettingsView } from "@/components/settings/SettingsView";

function WorkflowScreen() {
  const currentRoute = useStore((s) => s.currentRoute);
  const currentStage = useStore((s) => s.currentStage);

  // Secondary screens (reached via sidebar nav)
  if (currentRoute === "/budget") return <BudgetView />;
  if (currentRoute === "/audit") return <AuditView />;
  if (currentRoute === "/marketplace") return <MarketplaceView />;
  if (currentRoute === "/settings") return <SettingsView />;
  if (currentRoute === "/kadima") return <KadimaView />;

  // Main workflow — driven by pipeline stage
  switch (currentStage) {
    case "brief":
    case "cto":
    case "team":
      return <CTOWarRoom />;
    case "planning":
      return <PlanningPhase />;
    case "execution":
      return <ExecutionWorkspace />;
    case "verification":
      return <CompilationView />;
    case "done":
      return <ProjectComplete />;
    default:
      return <CTOWarRoom />;
  }
}

export function App() {
  useSocket();
  useThemeCSS();

  const accessToken = useStore((s) => s.accessToken);
  const projectValid = useStore((s) => s.projectValid);
  const setProjectValid = useStore((s) => s.setProjectValid);
  const setProjectData = useStore((s) => s.setProjectData);
  const cmdkOpen = useStore((s) => s.cmdkOpen);
  const setCmdkOpen = useStore((s) => s.setCmdkOpen);
  const currentRoute = useStore((s) => s.currentRoute);
  const activeProjectSlug = useStore((s) => s.activeProjectSlug);

  // Dismiss any lingering Sonner toasts from previous HMR cycles
  useEffect(() => { toast.dismiss(); }, []);

  // Initial data load + restore pipeline state
  useEffect(() => {
    api.getState().then((data: any) => {
      setProjectValid(!!data.valid, data.root);
      if (data.valid) {
        const name = data.root?.split("/").pop() || "Kadima OS";
        setProjectData({
          projectName: name,
          platform: data.profile?.platform || "web",
          themeData: data.theme,
        });
        api.getFeatures().then((fd: any) => {
          const store = useStore.getState();
          store.setFeatures(fd.features, fd.active);
          const activeSlug = store.activeProjectSlug;
          if (activeSlug && !fd.features?.some((f: any) => f.slug === activeSlug)) {
            store.setActiveProjectSlug(null);
            if (store.currentRoute === "/project") store.setRoute("/");
          }
        }).catch(() => {});
      }
    }).catch(() => {
      setProjectValid(false, "");
    });

    // Restore project state from server if we have an active project
    const slug = useStore.getState().activeProjectSlug;
    const currentRoute = useStore.getState().currentRoute;
    // If on /project with no active slug — go home
    if (!slug && currentRoute === "/project") {
      useStore.getState().setRoute("/");
    }
    if (slug) {
      api.getProjectState(slug).then((state: any) => {
        if (!state || state.error) {
          // Project no longer exists on server — reset to home screen
          const s = useStore.getState();
          s.setActiveProjectSlug(null);
          s.setOsBooted(false);
          s.setRoute("/");
          return;
        }
        const store = useStore.getState();
        store.setProjectUIState(state);
        if (state.team) store.setTeamData(state.team);
        if (state.pipelineActive) store.setPipelineRunning(true);

        // Map server phase → UI pipeline stage
        const PHASE_TO_STAGE: Record<string, string> = {
          discovery: "brief", feature: "brief",
          architect: "planning", design: "planning",
          preflight: "planning", lock: "planning",
          building: "execution",
          verifying: "verification", enforcing: "verification",
          previewing: "verification",
          done: "done", observing: "done",
        };

        // Determine stage — use task completion signals to override phase if needed
        const tasks = state.tasks || [];
        const doneTasks = tasks.filter((t: any) => t.done).length;
        const totalTasks = tasks.length;
        const allDone = totalTasks > 0 && doneTasks >= totalTasks;

        let stage = PHASE_TO_STAGE[state.phase] || null;

        console.warn(`[restore] phase=${state.phase} tasks=${totalTasks} done=${doneTasks} team=${!!state.team} → initial stage=${stage}`);

        // Override: if tasks exist and some are done, we're at least in execution
        if (totalTasks > 0 && doneTasks > 0 && (!stage || stage === "planning")) {
          stage = allDone ? "verification" : "execution";
        }
        // Override: if tasks exist but none done yet, and team is assembled, still execution
        if (totalTasks > 0 && doneTasks === 0 && state.team && (!stage || stage === "planning")) {
          stage = "execution";
        }
        // Override: if phase is done/verifying but came back as planning
        if (state.phase === "done") stage = "done";

        console.warn(`[restore] → final stage=${stage}`);
        if (stage) store.setCurrentStage(stage as any);

        // Restore dispatch progress from task data
        if (totalTasks > 0) {
          store.setDispatchProgress({
            totalTasks,
            completedTasks: doneTasks,
            failedTasks: 0,
            totalWaves: state.progress?.totalWaves || 0,
            currentWave: state.progress?.currentWave || 0,
          });
        }

        // Team approval is explicit (team.json approved flag)
        if (state.team && (state.team.approved || state.team.approved_at)) {
          store.setTeamApproved(true);
        } else if (state.team) {
          store.setTeamApproved(false);
        }
      }).catch(() => {});
    }
  }, []);

  // Global Cmd+K listener
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCmdkOpen(!cmdkOpen);
    }
    if (e.key === "Escape" && cmdkOpen) {
      setCmdkOpen(false);
    }
  }, [cmdkOpen, setCmdkOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auth gate (AOAS mode)
  const aoasMode = (import.meta as any).env?.VITE_AOAS_MODE === "true" || false;
  if (aoasMode && !accessToken) {
    return <AuthView />;
  }

  // Loading
  if (projectValid === null) {
    return <div className="h-screen w-screen bg-bg" />;
  }

  // Guard: /project without an active project → show home
  if (currentRoute === "/project" && !activeProjectSlug) {
    return (
      <FullscreenLayout>
        <HomeView />
        <KadimaInterrupts />
        {cmdkOpen && <CmdKOverlay />}
      </FullscreenLayout>
    );
  }

  // Home / wizard — fullscreen, no sidebar
  if (currentRoute === "/" || currentRoute === "/wizard") {
    return (
      <FullscreenLayout>
        <HomeView />
        <KadimaInterrupts />
        {cmdkOpen && <CmdKOverlay />}
      </FullscreenLayout>
    );
  }

  // Workflow interface with pipeline sidebar
  return (
    <>
      <WorkflowLayout>
        <WorkflowScreen />
      </WorkflowLayout>
      <KadimaInterrupts />
      {cmdkOpen && <CmdKOverlay />}
      <Toaster
        position="bottom-center"
        theme="dark"
        duration={4000}
        toastOptions={{
          style: {
            background: "rgba(12,12,12,0.92)",
            border: "1px solid rgba(99,241,157,0.25)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            backdropFilter: "blur(20px)",
            boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.5) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.5) inset, 0 8px 32px rgba(0,0,0,0.4)",
          },
        }}
      />
    </>
  );
}
