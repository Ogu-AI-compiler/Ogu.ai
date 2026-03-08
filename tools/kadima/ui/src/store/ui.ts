import type { StateCreator } from "zustand";

export interface UISlice {
  currentRoute: string;
  sidebarExpanded: boolean;
  cmdkOpen: boolean;
  osBooted: boolean;
  pendingChatMessage: string | null;

  setRoute: (route: string) => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setCmdkOpen: (open: boolean) => void;
  setOsBooted: (booted: boolean) => void;
  setPendingChatMessage: (msg: string | null) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  currentRoute: (() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname === "/" ? "/" : window.location.pathname;
  })(),
  sidebarExpanded: false,
  cmdkOpen: false,
  osBooted: typeof localStorage !== "undefined" && localStorage.getItem("ogu-os-booted") === "true",
  pendingChatMessage: null,

  setRoute: (currentRoute) => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", currentRoute === "/" ? "/" : currentRoute);
    }
    set({ currentRoute });
  },
  setSidebarExpanded: (sidebarExpanded) => set({ sidebarExpanded }),
  setCmdkOpen: (cmdkOpen) => set({ cmdkOpen }),
  setOsBooted: (osBooted) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("ogu-os-booted", String(osBooted));
    set({ osBooted });
  },
  setPendingChatMessage: (pendingChatMessage) => set({ pendingChatMessage }),
});
