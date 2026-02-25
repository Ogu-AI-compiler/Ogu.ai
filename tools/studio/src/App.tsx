import { useEffect } from "react";
import { XStack, YStack } from "tamagui";
import { Sidebar } from "@/components/layout/TopNav";
import { MainArea } from "@/components/layout/MainArea";
import { Welcome } from "@/pages/Welcome";
import { useSocket } from "@/hooks/useSocket";
import { useThemeCSS } from "@/hooks/useThemeCSS";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

export function App() {
  useSocket();
  useThemeCSS();

  const projectValid = useStore((s) => s.projectValid);
  const setProjectValid = useStore((s) => s.setProjectValid);
  const setProjectData = useStore((s) => s.setProjectData);

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
      }
    });
  }, []);

  if (projectValid === null) {
    return <YStack height="100vh" width="100vw" style={{ backgroundColor: "var(--bg)" }} />;
  }

  if (!projectValid) {
    return (
      <YStack height="100vh" width="100vw">
        <Welcome />
      </YStack>
    );
  }

  return (
    <XStack height="100vh" width="100vw" style={{ padding: 16, gap: 12, backgroundColor: "var(--bg)" }}>
      <Sidebar />
      <MainArea />
    </XStack>
  );
}
