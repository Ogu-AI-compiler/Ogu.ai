import { useState } from "react";
import { useFeatures } from "@/hooks/useFeatures";
import { Icon, icons } from "@/lib/icons";
import { FeatureCard } from "./FeatureCard";
import { FeatureDetail } from "./FeatureDetail";
import { CreateDialog } from "./CreateDialog";

export function FeaturesView() {
  const { features, activeFeature, create } = useFeatures();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (selected) {
    return (
      <div style={{ flex: 1, padding: 28, gap: 24, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <FeatureDetail slug={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 28, gap: 24, display: "flex", flexDirection: "column", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Features</span>
          <span style={{ fontSize: 16, color: "#b3b3b3" }}>{features.length} features</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            backgroundColor: "#d4d4d4",
            borderRadius: 8,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 12,
            paddingBottom: 12,
            cursor: "pointer",
            border: "none",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          + New Feature
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {features.map((f) => (
          <FeatureCard
            key={f.slug}
            slug={f.slug}
            phase={f.phase}
            tasks={f.tasks}
            isActive={f.slug === activeFeature}
            onPress={() => setSelected(f.slug)}
          />
        ))}
      </div>

      {features.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, paddingTop: 40, paddingBottom: 40 }}>
          <Icon d={icons.clipboard} size={32} stroke="var(--text-muted)" />
          <span style={{ fontSize: 20, fontWeight: 600 }}>No features yet</span>
          <span style={{ fontSize: 14, color: "#b3b3b3" }}>Create your first feature to get started</span>
        </div>
      )}

      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={create} />
    </div>
  );
}
