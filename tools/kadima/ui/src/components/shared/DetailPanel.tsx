import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DetailPanelProps {
  title: string;
  data: Record<string, any> | null;
  onClose: () => void;
  children?: React.ReactNode;
}

export function DetailPanel({ title, data, onClose, children }: DetailPanelProps) {
  if (!data) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        backgroundColor: "rgba(14,14,14,0.98)",
        borderLeftWidth: 1,
        borderLeftStyle: "solid",
        borderLeftColor: "rgba(255,255,255,0.1)",
        zIndex: 100,
        padding: 20,
        gap: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.06)",
            cursor: "pointer",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>

      {children}

      <ScrollArea style={{ flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#6c5ce7", textTransform: "uppercase" }}>{key}</span>
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  wordBreak: "break-all",
                }}
              >
                {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "—")}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
