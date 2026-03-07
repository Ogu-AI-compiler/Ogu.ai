import { useStore } from "@/lib/store";
import { DashboardView } from "@/components/dashboard/DashboardView";

export function Dashboard() {
  const uiState = useStore((s) => s.projectUIState);
  return <DashboardView uiState={uiState} />;
}
