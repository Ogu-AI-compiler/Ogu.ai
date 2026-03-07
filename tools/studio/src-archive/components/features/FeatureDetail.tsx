import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";

const tabs = ["PRD", "Spec", "Plan", "QA", "Metrics"];

interface Props {
  slug: string;
  onBack: () => void;
}

export function FeatureDetail({ slug, onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("PRD");

  useEffect(() => {
    api.getFeature(slug).then(setData);
  }, [slug]);

  if (!data) return <span style={{ color: "#b3b3b3" }}>Loading...</span>;

  const content: Record<string, string> = {
    PRD: data.prd || "No PRD yet",
    Spec: data.spec || "No Spec yet",
    Plan: data.plan ? JSON.stringify(data.plan, null, 2) : "No Plan yet",
    QA: data.qa || "No QA yet",
    Metrics: data.metrics ? JSON.stringify(data.metrics, null, 2) : "No Metrics yet",
  };

  const phaseColor: Record<string, string> = {
    idea: "#c89b3c", feature: "#b3b3b3", architect: "#d4d4d4", ready: "#3fa36b", done: "#b3b3b3",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{ fontSize: 14, color: "#b3b3b3", cursor: "pointer" }}
          onClick={onBack}
        >
          <Icon d={icons.arrowLeft} size={16} /> Back
        </span>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{slug}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: phaseColor[data.phase] || "#b3b3b3" }}>
          {data.phase}
        </span>
      </div>

      <div style={{
        display: "flex",
        gap: 4,
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "rgba(255,255,255,0.06)",
        paddingBottom: 8,
      }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              fontSize: 14,
              fontWeight: 500,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              cursor: "pointer",
              border: "none",
              backgroundColor: activeTab === t ? "rgba(212,212,212,0.12)" : "transparent",
              color: activeTab === t ? "#d4d4d4" : "#b3b3b3",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{
            backgroundColor: "rgba(15,15,23,0.8)",
            borderRadius: 8,
            padding: 20,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {content[activeTab]}
          </span>
        </div>
      </ScrollArea>
    </div>
  );
}
