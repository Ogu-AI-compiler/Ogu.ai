import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function RecentActivity() {
  const [logs, setLogs] = useState<{ name: string; content: string }[]>([]);

  useEffect(() => {
    api.getLogs().then(setLogs);
  }, []);

  const lines = logs
    .flatMap((log) =>
      log.content
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .slice(0, 5)
        .map((l) => ({ date: log.name, text: l.replace(/^- /, "") }))
    )
    .slice(0, 8);

  return (
    <div
      style={{
        backgroundColor: "rgba(22,22,22,0.6)",
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(255,255,255,0.06)",
        gap: 12,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ fontSize: 13, color: "#b3b3b3", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Recent Activity
      </span>
      {lines.length === 0 ? (
        <span style={{ fontSize: 13, color: "#7a7a7a" }}>No recent activity</span>
      ) : (
        lines.map((l, i) => (
          <span key={i} style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: "#7a7a7a" }}>{l.date}</span>  {l.text}
          </span>
        ))
      )}
    </div>
  );
}
