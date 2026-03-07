interface Plan {
  id: string;
  name: string;
  priceUsd: number;
  compilationsPerMonth: number;
  storageGb: number;
  agentsMax: number;
  features: string[];
}

interface Props {
  plan: Plan;
  current?: boolean;
  onUpgrade?: (planId: string) => void;
}

export function PlanCard({ plan, current, onUpgrade }: Props) {
  const isEnterprise = plan.id === "enterprise";

  return (
    <div
      style={{
        background: current ? "var(--bg-card)" : "var(--bg)",
        border: current ? "2px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: 12, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16,
        position: "relative",
      }}
    >
      {current && (
        <div style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          background: "var(--accent)", color: "var(--color-accent-text)", fontSize: 11, fontWeight: 600,
          padding: "2px 10px", borderRadius: 10,
        }}>
          Current Plan
        </div>
      )}

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{plan.name}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
          {plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`}
          {plan.priceUsd > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>/mo</span>}
        </div>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {plan.features.map(f => (
          <li key={f} style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: "var(--accent)", flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {!current && !isEnterprise && onUpgrade && (
        <button
          onClick={() => onUpgrade(plan.id)}
          style={{
            padding: "10px 0", background: "var(--accent)", color: "var(--color-accent-text)", border: "none",
            borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Upgrade to {plan.name}
        </button>
      )}
      {isEnterprise && !current && (
        <a
          href="mailto:sales@ogu.ai"
          style={{
            padding: "10px 0", background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)",
            borderRadius: 6, fontSize: 14, fontWeight: 600, textAlign: "center", textDecoration: "none", display: "block",
          }}
        >
          Contact Sales
        </a>
      )}
    </div>
  );
}
