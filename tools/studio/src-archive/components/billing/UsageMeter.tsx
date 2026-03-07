interface Props {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

export function UsageMeter({ label, used, limit, unit = "" }: Props) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const color = pct >= 90 ? "var(--danger, #ef4444)" : pct >= 70 ? "var(--warning, #f59e0b)" : "var(--accent)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, color: "var(--text)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {used}{unit} / {isUnlimited ? "∞" : `${limit}${unit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
        </div>
      )}
      {isUnlimited && (
        <div style={{ fontSize: 11, color: "var(--accent)" }}>Unlimited</div>
      )}
    </div>
  );
}
