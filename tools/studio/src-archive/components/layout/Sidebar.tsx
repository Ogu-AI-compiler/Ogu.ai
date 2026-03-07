import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

const phaseColors: Record<string, string> = {
  idea: "#ffb800",
  feature: "#00d4ff",
  architect: "#6c5ce7",
  ready: "#d4d4d4",
  done: "#7a7a7a",
};

const routes = [
  { path: "/", label: "Dashboard" },
  { path: "/pipeline", label: "Pipeline" },
  { path: "/features", label: "Features" },
  { path: "/agents", label: "Agents" },
  { path: "/budget", label: "Budget" },
  { path: "/audit", label: "Audit" },
  { path: "/governance", label: "Governance" },
  { path: "/kadima", label: "Kadima" },
  { path: "/theme", label: "Theme" },
  { path: "/brand", label: "Brand" },
  { path: "/terminal", label: "Terminal" },
];

export function Sidebar() {
  const {
    projectName,
    platform,
    features,
    activeFeature,
    currentRoute,
    setProjectData,
    setFeatures,
    setRoute,
  } = useStore();

  const [hasBrandScan, setHasBrandScan] = useState(false);

  const refresh = () => {
    api.getState().then((data) => {
      const name = data.root?.split("/").pop() || "Ogu Project";
      setProjectData({
        projectName: name,
        platform: data.profile?.platform || "web",
        themeData: data.theme,
      });
    });
    api.getFeatures().then((data) => {
      setFeatures(data.features, data.active);
    });
    api.getBrandScans().then((scans) => {
      setHasBrandScan(Array.isArray(scans) && scans.length > 0);
    }).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        width: 260,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRightWidth: 1,
        borderRightStyle: "solid",
        borderRightColor: "rgba(255,255,255,0.08)",
        padding: 12,
        gap: 8,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <span style={{ fontSize: 20, paddingTop: 8, paddingBottom: 8 }}>Ogu Studio</span>
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.2)",
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: 4,
          alignSelf: "flex-start",
        }}
      >
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{platform}</span>
      </div>

      <Separator style={{ marginTop: 8, marginBottom: 8 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {routes.map((r) => (
          <div
            key={r.path}
            onClick={() => setRoute(r.path)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              cursor: "pointer",
              backgroundColor: currentRoute === r.path ? "rgba(0,0,0,0.2)" : "transparent",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: currentRoute === r.path ? "#fff" : "rgba(255,255,255,0.5)", flex: 1 }}>
              {r.label}
            </span>
            {r.path === "/brand" && hasBrandScan && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 2,
                  paddingBottom: 2,
                  borderRadius: 10,
                  backgroundColor: "rgba(0, 212, 255, 0.15)",
                }}
              >
                <span style={{ fontSize: 9, color: "#00d4ff", fontWeight: 600 }}>SCANNED</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator style={{ marginTop: 8, marginBottom: 8 }} />

      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>FEATURES</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflow: "hidden" }}>
        {features.length === 0 ? (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>No features yet</span>
        ) : (
          features.slice(0, 12).map((f) => (
            <div
              key={f.slug}
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 4,
                gap: 4,
                display: "flex",
                alignItems: "center",
                backgroundColor: f.slug === activeFeature ? "rgba(0,0,0,0.2)" : "transparent",
              }}
            >
              <span style={{ fontSize: 10, color: phaseColors[f.phase] || "#666" }}>●</span>
              <span style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.slug}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginLeft: "auto" }}>{f.phase}</span>
            </div>
          ))
        )}
      </div>

      <Separator style={{ marginTop: 4, marginBottom: 4 }} />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{projectName}</span>
    </div>
  );
}
