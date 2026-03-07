import type { StateCreator } from "zustand";

export interface Feature {
  slug: string;
  phase: string;
  tasks: number;
}

export interface ProjectSlice {
  projectName: string;
  platform: string;
  activeFeature: string | null;
  features: Feature[];
  projectValid: boolean | null;
  projectRoot: string;
  activeProjectSlug: string | null;
  projectUIState: any | null;
  launchSteps: Record<string, string> | null;
  teamData: any | null;
  lifecycleProjectId: string | null;
  teamApproved: boolean;
  manifestProposal: any | null;

  setProjectData: (data: { projectName: string; platform: string; themeData: any }) => void;
  setProjectValid: (valid: boolean, root: string) => void;
  setFeatures: (features: Feature[], active: string | null) => void;
  setActiveProjectSlug: (slug: string | null) => void;
  setProjectUIState: (state: any | null) => void;
  setLaunchSteps: (steps: Record<string, string> | null) => void;
  updateLaunchStep: (step: string, status: string) => void;
  setTeamData: (team: any | null) => void;
  setLifecycleProjectId: (id: string | null) => void;
  setTeamApproved: (v: boolean) => void;
  setManifestProposal: (proposal: any | null) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  projectName: "Kadima OS",
  platform: "web",
  activeFeature: null,
  features: [],
  projectValid: null,
  projectRoot: "",
  activeProjectSlug: typeof localStorage !== "undefined"
    ? localStorage.getItem("ogu-active-project")
    : null,
  projectUIState: null,
  launchSteps: null,
  teamData: null,
  lifecycleProjectId: null,
  teamApproved: false,
  manifestProposal: null,

  setProjectData: (data) =>
    set({ projectName: data.projectName, platform: data.platform }),
  setProjectValid: (valid, root) => set({ projectValid: valid, projectRoot: root }),
  setFeatures: (features, active) => set({ features, activeFeature: active }),
  setActiveProjectSlug: (slug) => {
    if (typeof localStorage !== "undefined") {
      if (slug) localStorage.setItem("ogu-active-project", slug);
      else localStorage.removeItem("ogu-active-project");
    }
    set({ activeProjectSlug: slug });
  },
  setProjectUIState: (projectUIState) => set({ projectUIState }),
  setLaunchSteps: (launchSteps) => set({ launchSteps }),
  updateLaunchStep: (step, status) => set((s) => ({
    launchSteps: { ...(s.launchSteps || {}), [step]: status },
  })),
  setTeamData: (teamData) => set({ teamData }),
  setLifecycleProjectId: (lifecycleProjectId) => set({ lifecycleProjectId }),
  setTeamApproved: (teamApproved) => set({ teamApproved }),
  setManifestProposal: (manifestProposal) => set({ manifestProposal }),
});
