import { useEffect, useState } from "react";
import { PlanCard } from "@/components/billing/PlanCard";
import { UsageMeter } from "@/components/billing/UsageMeter";
import { CreditBalance } from "@/components/billing/CreditBalance";
import { api } from "@/lib/api";

export function Billing() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PLANS: any[] = [
    { id: "free",       name: "Free",       priceUsd: 0,   compilationsPerMonth: 3,  storageGb: 1,   agentsMax: 5,  features: ["3 compilations/month", "1 GB storage", "Up to 5 agents"] },
    { id: "pro",        name: "Pro",        priceUsd: 49,  compilationsPerMonth: 50, storageGb: 10,  agentsMax: 50, features: ["50 compilations/month", "10 GB storage", "Up to 50 agents"] },
    { id: "enterprise", name: "Enterprise", priceUsd: 199, compilationsPerMonth: -1, storageGb: 100, agentsMax: -1, features: ["Unlimited compilations", "100 GB storage", "Unlimited agents", "SSO"] },
  ];

  useEffect(() => {
    api.getBillingSubscription()
      .then(setData)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planId: string) {
    try {
      const { url } = await api.createCheckoutSession(planId);
      window.location.href = url;
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (loading) return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading billing…</div>;

  const currentPlanId = data?.plan?.id || "free";
  const balance = data?.balance ?? 0;
  const usage = data?.usage || {};

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Billing & Plans</h2>

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", border: "1px solid #ef4444", borderRadius: 6, color: "#ef4444", fontSize: 13 }}>{error}</div>}

      {/* Credit Balance */}
      <CreditBalance balance={balance} />

      {/* Usage Meters */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Usage this month</h3>
        <UsageMeter label="Compilations" used={usage.compilations || 0} limit={data?.plan?.compilationsPerMonth ?? 3} />
        <UsageMeter label="Storage" used={0} limit={data?.plan?.storageGb ?? 1} unit=" GB" />
        <UsageMeter label="Agents" used={usage.agentHires || 0} limit={data?.plan?.agentsMax ?? 5} />
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            current={plan.id === currentPlanId}
            onUpgrade={handleUpgrade}
          />
        ))}
      </div>
    </div>
  );
}
