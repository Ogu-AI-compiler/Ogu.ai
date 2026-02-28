import { YStack } from "tamagui";
import { useStore } from "@/lib/store";
import { Chat } from "@/pages/Chat";
import { Dashboard } from "@/pages/Dashboard";
import { Features } from "@/pages/Features";
import { Brand } from "@/pages/Brand";
import { Agents } from "@/pages/Agents";
import { Budget } from "@/pages/Budget";
import { Audit } from "@/pages/Audit";
import { Governance } from "@/pages/Governance";
import { Kadima } from "@/pages/Kadima";
import { Pipeline } from "@/pages/Pipeline";
import { Theme } from "@/pages/Theme";
import { Terminal } from "@/pages/Terminal";

const PAGE_ROUTES = ["/dashboard", "/features", "/brand", "/agents", "/budget", "/audit", "/governance", "/kadima", "/pipeline", "/theme", "/terminal"];

function OtherPage({ route }: { route: string }) {
  switch (route) {
    case "/dashboard":  return <Dashboard />;
    case "/features":   return <Features />;
    case "/brand":      return <Brand />;
    case "/agents":     return <Agents />;
    case "/budget":     return <Budget />;
    case "/audit":      return <Audit />;
    case "/governance": return <Governance />;
    case "/kadima":     return <Kadima />;
    case "/pipeline":   return <Pipeline />;
    case "/theme":      return <Theme />;
    case "/terminal":   return <Terminal />;
    default:            return null;
  }
}

export function MainArea() {
  const currentRoute = useStore((s) => s.currentRoute);
  const isChat = currentRoute === "/" || !(PAGE_ROUTES.includes(currentRoute));

  return (
    <YStack flex={1} overflow="hidden">
      {/* Chat stays mounted always — hidden when not active */}
      <div style={{ display: isChat ? "contents" : "none" }}>
        <Chat />
      </div>
      {!isChat && <OtherPage route={currentRoute} />}
    </YStack>
  );
}
