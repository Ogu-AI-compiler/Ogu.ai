import { create } from "zustand";

export interface Feature {
  slug: string;
  phase: string;
  tasks: number;
}

interface StudioState {
  // Project data
  projectName: string;
  platform: string;
  activeFeature: string | null;
  features: Feature[];
  gateState: any;
  themeData: any;

  // Project validity
  projectValid: boolean | null;
  projectRoot: string;

  // UI state
  currentRoute: string;
  selectedTheme: string;
  sidebarExpanded: boolean;

  // Actions
  setProjectData: (data: { projectName: string; platform: string; themeData: any }) => void;
  setFeatures: (features: Feature[], active: string | null) => void;
  setGateState: (gates: any) => void;
  setThemeData: (theme: any) => void;
  setProjectValid: (valid: boolean, root: string) => void;
  setRoute: (route: string) => void;
  setSelectedTheme: (theme: string) => void;
  setSidebarExpanded: (expanded: boolean) => void;
}

const savedTheme = "dark";

const savedSidebar = typeof localStorage !== "undefined"
  ? localStorage.getItem("ogu-studio-sidebar") === "true"
  : false;

export const useStore = create<StudioState>((set) => ({
  projectName: "Ogu Project",
  platform: "web",
  activeFeature: null,
  features: [],
  gateState: {},
  themeData: null,

  projectValid: null,
  projectRoot: "",

  currentRoute: "/",
  selectedTheme: savedTheme,
  sidebarExpanded: savedSidebar,

  setProjectData: (data) =>
    set({ projectName: data.projectName, platform: data.platform, themeData: data.themeData }),
  setProjectValid: (valid, root) => set({ projectValid: valid, projectRoot: root }),
  setFeatures: (features, active) => set({ features, activeFeature: active }),
  setGateState: (gateState) => set({ gateState }),
  setThemeData: (themeData) => set({ themeData }),
  setRoute: (currentRoute) => set({ currentRoute }),
  setSelectedTheme: (selectedTheme) => {
    localStorage.setItem("ogu-studio-theme", selectedTheme);
    set({ selectedTheme });
  },
  setSidebarExpanded: (sidebarExpanded) => {
    localStorage.setItem("ogu-studio-sidebar", String(sidebarExpanded));
    set({ sidebarExpanded });
  },
}));
