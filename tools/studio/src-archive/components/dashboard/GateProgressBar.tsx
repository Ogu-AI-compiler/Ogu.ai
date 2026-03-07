const gateNames = [
  "doctor", "ctx_lock", "plan", "no_todos", "ui",
  "smoke", "vision", "contracts", "preview", "memory",
];

const SEGMENT_STYLES: Record<string, React.CSSProperties> = {
  passed: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(34,197,94,0.3)" },
  failed: { backgroundColor: "rgba(239,68,68,0.2)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(239,68,68,0.3)" },
  pending: { backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.06)" },
};

interface Props {
  gates: Record<string, { status: string }>;
}

export function GateProgressBar({ gates }: Props) {
  const passed = Object.values(gates).filter((g) => g.status === "passed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#b3b3b3", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Completion Gates
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: passed > 0 ? "#3fa36b" : "inherit" }}>
          {passed}/10
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {gateNames.map((name, i) => {
          const gate = gates[String(i + 1)];
          const status = (gate?.status || "pending") as "passed" | "failed" | "pending";
          const textColor = status === "passed" ? "#3fa36b" : status === "failed" ? "#d05a5a" : "#7a7a7a";
          return (
            <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...SEGMENT_STYLES[status],
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{i + 1}</span>
              </div>
              <span style={{ fontSize: 9, color: "#7a7a7a" }}>{name.slice(0, 4)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
