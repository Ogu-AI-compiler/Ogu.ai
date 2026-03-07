import { useState } from "react";
import { BrandView } from "@/components/brand/BrandView";
import { ThemeView } from "@/components/theme-panel/ThemeView";
import { GovernanceView } from "@/components/governance/GovernanceView";
import { AuditView } from "@/components/audit/AuditView";
import { UsersView } from "@/components/users/UsersView";
import { ScreenLayout } from "@/components/shared/ScreenLayout";
import { Tabs } from "@/components/ui/tabs";

type MainTab = "design" | "governance" | "audit" | "users";
type DesignTab = "brand" | "theme";

export function Settings() {
  const [mainTab, setMainTab] = useState<MainTab>("design");
  const [designTab, setDesignTab] = useState<DesignTab>("brand");

  return (
    <ScreenLayout
      title="Settings"
      subtitle="Design, governance, audit, and user configuration"
      tabs={[
        { key: "design", label: "Design" },
        { key: "governance", label: "Governance" },
        { key: "audit", label: "Audit" },
        { key: "users", label: "Users" },
      ]}
      activeTab={mainTab}
      onTabChange={(key) => setMainTab(key as MainTab)}
    >
      <div className="flex flex-col flex-1 p-8 gap-6">
        {mainTab === "design" && (
          <div className="flex flex-col gap-6">
            <Tabs
              tabs={[
                { key: "brand", label: "Brand & Reference" },
                { key: "theme", label: "Theme" },
              ]}
              active={designTab}
              onChange={(key) => setDesignTab(key as DesignTab)}
            />
            <div className="flex-1">
              {designTab === "brand" && <BrandView />}
              {designTab === "theme" && <ThemeView />}
            </div>
          </div>
        )}

        {mainTab === "governance" && <GovernanceView />}
        {mainTab === "audit" && <AuditView />}
        {mainTab === "users" && <UsersView />}
      </div>
    </ScreenLayout>
  );
}
