import { useStore } from "@/lib/store";
import { HomeView } from "@/components/home/HomeView";
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
import { Marketplace } from "@/pages/Marketplace";
import { Billing } from "@/pages/Billing";
import { Admin } from "@/pages/Admin";
import { Settings } from "@/pages/Settings";
import { Project } from "@/pages/Project";
import { ExecutionMonitor } from "@/components/kadima/ExecutionMonitor";

const PAGE_ROUTES = ["/dashboard", "/project", "/features", "/brand", "/agents", "/budget", "/audit", "/governance", "/kadima", "/pipeline", "/theme", "/terminal", "/marketplace", "/billing", "/admin", "/settings", "/execution"];

function OtherPage({ route }: { route: string }) {
  switch (route) {
    case "/dashboard":   return <Dashboard />;
    case "/project":     return <Project />;
    case "/features":    return <Features />;
    case "/brand":       return <Brand />;
    case "/agents":      return <Agents />;
    case "/budget":      return <Budget />;
    case "/audit":       return <Audit />;
    case "/governance":  return <Governance />;
    case "/kadima":      return <Kadima />;
    case "/pipeline":    return <Pipeline />;
    case "/theme":       return <Theme />;
    case "/terminal":    return <Terminal />;
    case "/marketplace": return <Marketplace />;
    case "/billing":     return <Billing />;
    case "/admin":       return <Admin />;
    case "/settings":    return <Settings />;
    case "/execution":   return <ExecutionMonitor />;
    default:             return null;
  }
}

export function MainArea() {
  const currentRoute = useStore((s) => s.currentRoute);
  const isHome = currentRoute === "/";
  const isChat = currentRoute === "/chat";
  const isPage = PAGE_ROUTES.includes(currentRoute);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      {isHome ? <HomeView /> : isChat ? <Chat /> : isPage ? <OtherPage route={currentRoute} /> : <HomeView />}
    </div>
  );
}
