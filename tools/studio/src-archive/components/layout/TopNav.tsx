import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Icon, icons } from "@/lib/icons";
import { api } from "@/lib/api";

const routes = [
  { path: "/project", label: "Project", icon: icons.nodes },
  { path: "/dashboard", label: "Dashboard", icon: icons.dashboard },
  { path: "/features", label: "Features", icon: icons.features },
  { path: "/brand", label: "Brand", icon: icons.brand },
  { path: "/marketplace", label: "Marketplace", icon: icons.marketplace },
  { path: "/billing", label: "Billing", icon: icons.budget },
  { path: "/settings", label: "Settings", icon: icons.settings },
];

export function Sidebar() {
  const { currentRoute, setRoute, projectRoot, setProjectValid, setOsBooted, sidebarExpanded, setSidebarExpanded, selectedTheme, setSelectedTheme, activeProjectSlug } = useStore();

  function handleNewProject() {
    setRoute("/wizard");
  }

  function handleRouteClick(path: string) {
    if (path === "/project" && !activeProjectSlug) {
      // No active project — open wizard to select/create one
      setOsBooted(false);
      setRoute("/wizard");
    } else {
      setRoute(path);
    }
  }
  const isDark = selectedTheme === "dark";
  const projectName = projectRoot?.split("/").pop() || "Project";
  const [hasBrandScan, setHasBrandScan] = useState(false);

  useEffect(() => {
    const check = () => {
      api.getBrandScans().then((scans) => {
        setHasBrandScan(Array.isArray(scans) && scans.length > 0);
      }).catch(() => {});
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        width: sidebarExpanded ? 200 : 56,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        transition: "width 0.2s ease",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: sidebarExpanded ? "0 16px" : "0",
          justifyContent: sidebarExpanded ? "flex-start" : "center",
          gap: 10,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ flexShrink: 0, color: "var(--accent)" }}>
          <Icon d={icons.logo} size={20} stroke="var(--accent)" />
        </div>
        {sidebarExpanded && (
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: "-0.5px",
              whiteSpace: "nowrap",
            }}
          >
            Ogu Studio
          </span>
        )}
      </div>

      {/* Routes */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 0", gap: 2 }}>
        {routes.map((r) => {
          const active = currentRoute === r.path;
          return (
            <div
              key={r.path}
              onClick={() => handleRouteClick(r.path)}
              title={sidebarExpanded ? undefined : r.label}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: sidebarExpanded ? "8px 16px" : "8px 0",
                justifyContent: sidebarExpanded ? "flex-start" : "center",
                cursor: "pointer",
                backgroundColor: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--text)" : "var(--text-secondary)",
                margin: "0 6px",
                borderRadius: 6,
                transition: "background-color 0.15s, color 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
              }}
              onMouseOut={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div style={{ flexShrink: 0, width: 20, display: "flex", justifyContent: "center" }}>
                <Icon d={r.icon} size={18} />
              </div>
              {sidebarExpanded && (
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{r.label}</span>
              )}
              {r.path === "/brand" && hasBrandScan && (
                sidebarExpanded ? (
                  <span style={{
                    fontSize: 9, fontWeight: 600, fontFamily: "var(--font)",
                    color: "#00d4ff", backgroundColor: "rgba(0, 212, 255, 0.12)",
                    padding: "2px 6px", borderRadius: 10, letterSpacing: "0.5px",
                  }}>SCANNED</span>
                ) : (
                  <div style={{
                    position: "absolute", top: 6, right: 6,
                    width: 6, height: 6, borderRadius: "50%",
                    backgroundColor: "#00d4ff",
                  }} />
                )
              )}
            </div>
          );
        })}
      </div>

      {/* New Project button */}
      <div style={{ padding: "6px 6px 0" }}>
        <div
          onClick={handleNewProject}
          title="New Project"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: sidebarExpanded ? "8px 10px" : "8px 0",
            justifyContent: sidebarExpanded ? "flex-start" : "center",
            cursor: "pointer",
            backgroundColor: "rgba(99, 241, 157, 0.08)",
            border: "1px solid rgba(99, 241, 157, 0.25)",
            borderRadius: 6,
            color: "var(--accent)",
            transition: "background-color 0.15s, border-color 0.15s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "rgba(99, 241, 157, 0.15)"; e.currentTarget.style.borderColor = "rgba(99, 241, 157, 0.5)"; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "rgba(99, 241, 157, 0.08)"; e.currentTarget.style.borderColor = "rgba(99, 241, 157, 0.25)"; }}
        >
          <div style={{ flexShrink: 0, width: 20, display: "flex", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          {sidebarExpanded && (
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>New Project</span>
          )}
        </div>
      </div>

      {/* Project switcher (expanded only) */}
      {sidebarExpanded && (
        <div
          onClick={() => setProjectValid(false, "")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            cursor: "pointer",
            borderTop: "1px solid var(--border)",
            transition: "background-color 0.15s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-card-hover)"; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <div style={{ flexShrink: 0, color: "var(--accent)" }}>
            <Icon d={icons.folder} size={14} stroke="var(--accent)" />
          </div>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font)",
              fontWeight: 600,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {projectName}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Switch</span>
        </div>
      )}

      {/* Spacer before toggle */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 6px" }} />

      {/* Toggle */}
      <div
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: sidebarExpanded ? "flex-end" : "center",
          padding: sidebarExpanded ? "0 16px" : "0",
          cursor: "pointer",
          borderTop: sidebarExpanded ? "none" : "1px solid var(--border)",
          color: "var(--text-muted)",
          transition: "color 0.15s",
          flexShrink: 0,
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <Icon d={sidebarExpanded ? icons.chevronLeft : icons.chevronRight} size={16} />
      </div>
    </div>
  );
}
