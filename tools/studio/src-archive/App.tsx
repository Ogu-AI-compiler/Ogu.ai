import { useEffect, useCallback } from "react";
import { Auth } from "@/pages/Auth";
import { Sidebar } from "@/components/layout/TopNav";
import { MainArea } from "@/components/layout/MainArea";
import { HomeView } from "@/components/home/HomeView";
import { KadimaInterrupts } from "@/components/kadima/KadimaInterrupts";
import { CmdKOverlay } from "@/components/kadima/CmdKOverlay";
import { useSocket } from "@/hooks/useSocket";
import { useThemeCSS } from "@/hooks/useThemeCSS";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

export function App() {
  useSocket();
  useThemeCSS();

  const accessToken = useStore((s) => s.accessToken);
  const projectValid = useStore((s) => s.projectValid);
  const setProjectValid = useStore((s) => s.setProjectValid);
  const setProjectData = useStore((s) => s.setProjectData);
  const cmdkOpen = useStore((s) => s.cmdkOpen);
  const setCmdkOpen = useStore((s) => s.setCmdkOpen);
  const osBooted = useStore((s) => s.osBooted);
  const currentRoute = useStore((s) => s.currentRoute);

  useEffect(() => {
    api.getState().then((data: any) => {
      setProjectValid(!!data.valid, data.root);
      if (data.valid) {
        const name = data.root?.split("/").pop() || "Ogu Project";
        setProjectData({
          projectName: name,
          platform: data.profile?.platform || "web",
          themeData: data.theme,
        });
        api.getFeatures().then((fd: any) => {
          useStore.getState().setFeatures(fd.features, fd.active);
        }).catch(() => {});
      }
    }).catch(() => {
      setProjectValid(false, "");
    });
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

  // Auth gate — only when AOAS_MODE is enabled (env injected at build time or via meta tag)
  const aoasMode = (import.meta as any).env?.VITE_AOAS_MODE === "true" || false;
  if (aoasMode && !accessToken) {
    return <Auth />;
  }

  // Loading
  if (projectValid === null) {
    return <div className="h-screen w-screen bg-bg" />;
  }

  // Home / wizard — no sidebar, just HomeView
  if (currentRoute === "/" || currentRoute === "/wizard") {
    return (
      <div className="flex h-screen w-screen bg-bg items-center justify-center">
        <HomeView />
        <KadimaInterrupts />
        {cmdkOpen && <CmdKOverlay />}
      </div>
    );
  }

  // Full interface with sidebar (any route other than /)
  return (
    <div className="flex h-screen w-screen p-3 gap-3 bg-bg">
      <Sidebar />
      <MainArea />
      <KadimaInterrupts />
      {cmdkOpen && <CmdKOverlay />}
    </div>
  );
}
