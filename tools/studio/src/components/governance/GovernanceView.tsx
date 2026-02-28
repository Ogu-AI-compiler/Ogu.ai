import { useEffect, useState, useCallback } from "react";
import { styled, Text, YStack, XStack, Separator, Input, TextArea } from "tamagui";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { ActionButton } from "@/components/shared/ActionButton";
import { DetailPanel } from "@/components/shared/DetailPanel";

const Page = styled(YStack, { flex: 1, padding: "$7", gap: "$6", overflow: "scroll", position: "relative" as any });
const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$3",
});
const Badge = styled(XStack, {
  borderRadius: "$1",
  paddingHorizontal: "$2",
  paddingVertical: 2,
  alignItems: "center",
});
const TabBtn = styled(XStack, {
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderRadius: "$2",
  cursor: "pointer",
  variants: {
    active: {
      true: { backgroundColor: "rgba(108,92,231,0.2)" },
      false: { backgroundColor: "rgba(255,255,255,0.04)", hoverStyle: { backgroundColor: "rgba(255,255,255,0.08)" } },
    },
  } as const,
});

const RISK_COLORS: Record<string, string> = {
  low: "#4ade80", medium: "#facc15", high: "#f87171", critical: "#ef4444",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#facc15", approved: "#4ade80", denied: "#ef4444",
};

type Tab = "pending" | "history" | "policies";

export function GovernanceView() {
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [denyReason, setDenyReason] = useState("");
  const [denyTarget, setDenyTarget] = useState<string | null>(null);
  const { on } = useSocket();

  const fetchData = useCallback(() => {
    Promise.all([
      api.getGovernancePending().catch(() => ({ pending: [] })),
      api.getGovernanceHistory().catch(() => ({ history: [] })),
      api.getGovernancePolicies().catch(() => null),
    ]).then(([p, h, pol]) => {
      setPending(p.pending || []);
      setHistory(h.history || []);
      setPolicies(pol);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket real-time updates
  useEffect(() => {
    const unsub1 = on("governance:approved", () => fetchData());
    const unsub2 = on("governance:denied", () => fetchData());
    const unsub3 = on("governance:escalated", () => fetchData());
    const unsub4 = on("governance:approval_required", () => fetchData());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on, fetchData]);

  const handleApprove = async (taskId: string) => {
    try {
      await api.approveGovernance(taskId, "studio-user");
    } catch { /* refreshes below */ }
    fetchData();
  };

  const handleDeny = async (taskId: string) => {
    if (!denyReason.trim()) return;
    try {
      await api.denyGovernance(taskId, denyReason, "studio-user");
    } catch { /* refreshes below */ }
    setDenyTarget(null);
    setDenyReason("");
    fetchData();
  };

  if (loading) return <Page><Text color="$colorPress">Loading governance...</Text></Page>;

  const rules = policies?.rules || [];

  return (
    <Page>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5}>Governance</Text>
        <XStack gap="$2" alignItems="center">
          {pending.length > 0 && (
            <Badge backgroundColor="rgba(250,204,21,0.15)">
              <Text fontSize={11} color="#facc15" fontWeight="600">{pending.length} pending</Text>
            </Badge>
          )}
        </XStack>
      </XStack>

      {/* Tabs */}
      <XStack gap="$2">
        {(["pending", "history", "policies"] as Tab[]).map((t) => (
          <TabBtn key={t} active={tab === t} onPress={() => setTab(t)}>
            <Text fontSize="$2" fontWeight="600" color={tab === t ? "#a78bfa" : "$colorPress"}>
              {t === "pending" ? `Pending (${pending.length})` : t === "history" ? `History (${history.length})` : `Rules (${rules.length})`}
            </Text>
          </TabBtn>
        ))}
      </XStack>

      <Separator borderColor="rgba(255,255,255,0.08)" />

      {/* Pending Tab */}
      {tab === "pending" && (
        <>
          {pending.length === 0 ? (
            <Card><Text fontSize="$2" color="$colorPress">No pending approvals — all clear</Text></Card>
          ) : (
            <YStack gap="$3">
              {pending.map((item, i) => (
                <Card key={item.taskId || i}>
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack gap="$1" flex={1}>
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize="$3" fontWeight="700">{item.taskId || item.file}</Text>
                        {item.riskTier && (
                          <Badge backgroundColor={`${RISK_COLORS[item.riskTier] || "#888"}20`}>
                            <Text fontSize={10} fontWeight="600" color={RISK_COLORS[item.riskTier] || "#888"}>
                              {item.riskTier.toUpperCase()}
                            </Text>
                          </Badge>
                        )}
                      </XStack>
                      <Text fontSize="$1" color="$colorPress">
                        {item.reason || item.type || "Pending review"}
                      </Text>
                      {item.featureSlug && (
                        <Text fontSize={10} color="#6c5ce7" fontFamily="$mono">Feature: {item.featureSlug}</Text>
                      )}
                    </YStack>
                    <XStack gap="$2">
                      <ActionButton
                        label="Approve"
                        variant="success"
                        onAction={() => handleApprove(item.taskId || item.file)}
                      />
                      <ActionButton
                        label="Deny"
                        variant="danger"
                        onAction={() => setDenyTarget(item.taskId || item.file)}
                      />
                      <ActionButton
                        label="Detail"
                        variant="ghost"
                        onAction={() => setSelectedItem(item)}
                      />
                    </XStack>
                  </XStack>

                  {/* Deny reason input */}
                  {denyTarget === (item.taskId || item.file) && (
                    <YStack gap="$2" marginTop="$2">
                      <TextArea
                        placeholder="Reason for denial..."
                        value={denyReason}
                        onChangeText={setDenyReason}
                        backgroundColor="rgba(255,255,255,0.04)"
                        borderColor="rgba(239,68,68,0.3)"
                        color="white"
                        fontSize={12}
                        rows={2}
                      />
                      <XStack gap="$2">
                        <ActionButton
                          label="Confirm Deny"
                          variant="danger"
                          onAction={() => handleDeny(denyTarget!)}
                          disabled={!denyReason.trim()}
                        />
                        <ActionButton
                          label="Cancel"
                          variant="ghost"
                          onAction={() => { setDenyTarget(null); setDenyReason(""); }}
                        />
                      </XStack>
                    </YStack>
                  )}
                </Card>
              ))}
            </YStack>
          )}
        </>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <>
          {history.length === 0 ? (
            <Card><Text fontSize="$2" color="$colorPress">No approval history yet</Text></Card>
          ) : (
            <YStack gap="$1">
              {history.map((item, i) => {
                const status = item.status || "unknown";
                const color = STATUS_COLORS[status] || "#888";
                return (
                  <XStack
                    key={i}
                    backgroundColor="rgba(255,255,255,0.02)"
                    borderRadius="$2"
                    padding="$3"
                    justifyContent="space-between"
                    alignItems="center"
                    cursor="pointer"
                    hoverStyle={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    onPress={() => setSelectedItem(item)}
                  >
                    <XStack gap="$3" alignItems="center" flex={1}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 4, backgroundColor: color,
                      }} />
                      <Text fontSize="$2" fontWeight="600" flex={1}>{item.taskId || item.file}</Text>
                      {item.riskTier && (
                        <Text fontSize={10} color={RISK_COLORS[item.riskTier] || "#888"} fontFamily="$mono">
                          {item.riskTier}
                        </Text>
                      )}
                    </XStack>
                    <XStack gap="$3" alignItems="center">
                      <Text fontSize="$1" color="$colorPress">
                        {item.approvedAt?.slice(0, 10) || item.deniedAt?.slice(0, 10) || ""}
                      </Text>
                      <Badge backgroundColor={`${color}20`}>
                        <Text fontSize={10} fontWeight="600" color={color} textTransform="uppercase">
                          {status}
                        </Text>
                      </Badge>
                    </XStack>
                  </XStack>
                );
              })}
            </YStack>
          )}
        </>
      )}

      {/* Policies Tab */}
      {tab === "policies" && (
        <>
          {rules.length === 0 ? (
            <Card><Text fontSize="$2" color="$colorPress">No governance policies configured</Text></Card>
          ) : (
            <YStack gap="$2">
              {rules.map((rule: any, i: number) => (
                <Card key={i}>
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack flex={1} gap="$1">
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize={10} color="$colorPress" fontFamily="$mono">#{i + 1}</Text>
                        <Text fontSize="$2" fontWeight="600">{rule.name || rule.trigger || `Rule ${i + 1}`}</Text>
                        {rule.enabled === false && (
                          <Badge backgroundColor="rgba(148,163,184,0.15)">
                            <Text fontSize={10} color="#94a3b8">DISABLED</Text>
                          </Badge>
                        )}
                      </XStack>
                      {rule.condition && (
                        <Text fontSize="$1" color="$colorPress" fontFamily="$mono">
                          {typeof rule.condition === "string" ? rule.condition : JSON.stringify(rule.condition)}
                        </Text>
                      )}
                      {rule.when && (
                        <Text fontSize="$1" color="$colorPress" fontFamily="$mono">
                          When: {JSON.stringify(rule.when)}
                        </Text>
                      )}
                    </YStack>
                    <YStack alignItems="flex-end" gap="$1">
                      {rule.action && (
                        <Text fontSize="$1" color="#6c5ce7">Action: {rule.action}</Text>
                      )}
                      {Array.isArray(rule.then) && (
                        <Text fontSize="$1" color="#6c5ce7">
                          Effect: {rule.then.map((t: any) => t?.effect || "—").join(", ")}
                        </Text>
                      )}
                      {rule.priority != null && (
                        <Text fontSize={10} color="$colorPress">Priority: {rule.priority}</Text>
                      )}
                    </YStack>
                  </XStack>
                </Card>
              ))}
            </YStack>
          )}
        </>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <DetailPanel
          title={selectedItem.taskId || selectedItem.file || "Details"}
          data={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </Page>
  );
}
