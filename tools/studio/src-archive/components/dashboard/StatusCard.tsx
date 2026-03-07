interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function StatusCard({ label, value, sub, accent }: Props) {
  return (
    <div
      style={{
        backgroundColor: "rgba(22,22,22,0.6)",
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(255,255,255,0.08)",
        gap: 8,
        minWidth: 160,
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ fontSize: 13, color: "#b3b3b3", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: accent ? "#d4d4d4" : "inherit", letterSpacing: -0.3 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 13, color: "#7a7a7a" }}>{sub}</span>}
    </div>
  );
}
