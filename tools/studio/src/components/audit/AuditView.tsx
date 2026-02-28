import { useEffect, useState, useCallback, useMemo } from "react";
import { styled, Text, YStack, XStack, Separator, Input } from "tamagui";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { DetailPanel } from "@/components/shared/DetailPanel";

const Page = styled(YStack, { flex: 1, padding: "$7", gap: "$6", overflow: "scroll", position: "relative" as any });
const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$2",
});
const FilterChip = styled(XStack, {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderRadius: "$2",
  paddingHorizontal: "$2",
  paddingVertical: "$1",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "rgba(255,255,255,0.12)" },
  variants: {
    active: {
      true: { backgroundColor: "rgba(108,92,231,0.3)", borderWidth: 1, borderColor: "#6c5ce7" },
    },
  } as const,
});

const TYPE_COLORS: Record<string, string> = {
  compile: "#6c5ce7",
  gate: "#00d4ff",
  agent: "#4ade80",
  budget: "#facc15",
  governance: "#f87171",
  scheduler: "#a78bfa",
  egress: "#fb923c",
  daemon: "#94a3b8",
  system: "#ef4444",
  task: "#38bdf8",
  model: "#c084fc",
};

const SEVERITY_PATTERNS: Record<string, string> = {
  error: "#ef4444",
  fail: "#ef4444",
  denied: "#f87171",
  alert: "#facc15",
  warning: "#facc15",
  exhausted: "#ef4444",
};

function getTypeColor(type: string): string {
  const prefix = type.split(".")[0];
  return TYPE_COLORS[prefix] || "#888";
}

function getSeverityColor(event: any): string | null {
  const type = (event.type || "").toLowerCase();
  for (const [pattern, color] of Object.entries(SEVERITY_PATTERNS)) {
    if (type.includes(pattern)) return color;
  }
  return null;
}

export function AuditView() {
  const [events, setEvents] = useState<any[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [featureFilter, setFeatureFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { on } = useSocket();

  const fetchEvents = useCallback((type?: string, feature?: string) => {
    api.getAudit({ limit: 200, type: type || undefined, feature: feature || undefined })
      .then((data) => {
        setEvents(data.events || []);
        setTotal(data.count || 0);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEvents();
    api.getAuditTypes().then((data) => setTypes(data?.types || [])).catch(() => {});
  }, [fetchEvents]);

  // WebSocket real-time: prepend new events
  useEffect(() => {
    const unsub = on("audit:event", (wsEvent: any) => {
      if (wsEvent.event) {
        setEvents((prev) => [...prev, wsEvent.event].slice(-200));
        setTotal((t) => t + 1);
      }
    });
    return unsub;
  }, [on]);

  const handleTypeFilter = (type: string) => {
    const newFilter = typeFilter === type ? "" : type;
    setTypeFilter(newFilter);
    setLoading(true);
    fetchEvents(newFilter, featureFilter);
  };

  const handleFeatureFilter = (feature: string) => {
    setFeatureFilter(feature);
    setLoading(true);
    fetchEvents(typeFilter, feature);
  };

  // Extract unique features from events
  const features = useMemo(() => {
    const featureSet = new Set<string>();
    for (const e of events) {
      if (e.payload?.featureSlug) featureSet.add(e.payload.featureSlug);
    }
    return [...featureSet].sort();
  }, [events]);

  // Local search filter
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) => {
      const typeMatch = (e.type || "").toLowerCase().includes(q);
      const payloadMatch = JSON.stringify(e.payload || {}).toLowerCase().includes(q);
      return typeMatch || payloadMatch;
    });
  }, [events, searchQuery]);

  // Type distribution for mini bar chart
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const prefix = (e.type || "").split(".")[0];
      counts[prefix] = (counts[prefix] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [events]);

  const maxCount = typeCounts.length > 0 ? Math.max(...typeCounts.map(([, c]) => c)) : 1;

  // Group type prefixes for filter chips
  const prefixes = useMemo(() => (
    [...new Set(types.map((t) => t.split(".")[0]))].sort()
  ), [types]);

  if (loading && events.length === 0) {
    return <Page><Text color="$colorPress">Loading audit log...</Text></Page>;
  }

  return (
    <Page>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5}>Audit Log</Text>
        <Text fontSize="$1" color="$colorPress">{total} total events</Text>
      </XStack>

      {/* Search + Feature Filter */}
      <XStack gap="$3" alignItems="center">
        <Input
          flex={1}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          backgroundColor="rgba(255,255,255,0.04)"
          borderColor="rgba(255,255,255,0.1)"
          color="white"
          fontSize={12}
          paddingVertical="$1"
        />
        {features.length > 0 && (
          <XStack gap="$1">
            <FilterChip
              active={!featureFilter}
              onPress={() => handleFeatureFilter("")}
            >
              <Text fontSize={11} color="$colorPress">All</Text>
            </FilterChip>
            {features.slice(0, 5).map((f) => (
              <FilterChip
                key={f}
                active={featureFilter === f}
                onPress={() => handleFeatureFilter(f)}
              >
                <Text fontSize={11} color="$colorPress">{f}</Text>
              </FilterChip>
            ))}
          </XStack>
        )}
      </XStack>

      {/* Type filter chips */}
      {prefixes.length > 0 && (
        <XStack gap="$1" flexWrap="wrap">
          {prefixes.map((prefix) => (
            <FilterChip
              key={prefix}
              active={typeFilter === prefix}
              onPress={() => handleTypeFilter(prefix)}
            >
              <div style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: TYPE_COLORS[prefix] || "#888",
                marginRight: 4,
                marginTop: 2,
              }} />
              <Text fontSize={11} color="$colorPress">{prefix}</Text>
            </FilterChip>
          ))}
        </XStack>
      )}

      {/* Type distribution bar chart */}
      {typeCounts.length > 0 && (
        <XStack gap="$2" alignItems="flex-end" height={40}>
          {typeCounts.map(([type, count]) => (
            <YStack key={type} alignItems="center" gap={2} flex={1}>
              <div style={{
                width: "100%", maxWidth: 40,
                height: Math.max((count / maxCount) * 30, 3),
                borderRadius: 2,
                backgroundColor: TYPE_COLORS[type] || "#888",
              }} />
              <Text fontSize={8} color="$colorPress">{type}</Text>
            </YStack>
          ))}
        </XStack>
      )}

      <Separator borderColor="rgba(255,255,255,0.08)" />

      {/* Event List */}
      {filteredEvents.length === 0 ? (
        <Card><Text color="$colorPress">No audit events {searchQuery ? "matching search" : "recorded"}</Text></Card>
      ) : (
        <YStack gap="$1">
          {[...filteredEvents].reverse().map((event, i) => {
            const severityColor = getSeverityColor(event);
            return (
              <XStack
                key={event.id || i}
                backgroundColor={severityColor ? `${severityColor}08` : "rgba(255,255,255,0.02)"}
                borderRadius="$1"
                padding="$2"
                gap="$3"
                alignItems="flex-start"
                cursor="pointer"
                hoverStyle={{ backgroundColor: severityColor ? `${severityColor}12` : "rgba(255,255,255,0.05)" }}
                onPress={() => setSelectedEvent(event)}
                borderLeftWidth={severityColor ? 2 : 0}
                borderColor={severityColor || "transparent"}
              >
                <Text fontSize={10} color="$colorPress" fontFamily="$mono" width={80} flexShrink={0}>
                  {event.timestamp?.slice(11, 19) || ""}
                </Text>
                <XStack
                  backgroundColor={`${getTypeColor(event.type)}20`}
                  borderRadius="$1"
                  paddingHorizontal="$1"
                  width={140}
                  flexShrink={0}
                >
                  <Text fontSize={11} color={getTypeColor(event.type)} fontFamily="$mono">
                    {event.type}
                  </Text>
                </XStack>
                <Text fontSize={11} color="$colorPress" flex={1} numberOfLines={1}>
                  {event.payload?.featureSlug && `[${event.payload.featureSlug}] `}
                  {event.payload?.gate || event.payload?.summary || event.payload?.taskId || event.payload?.reason || JSON.stringify(event.payload || {}).slice(0, 100)}
                </Text>
              </XStack>
            );
          })}
        </YStack>
      )}

      {/* Detail Panel */}
      {selectedEvent && (
        <DetailPanel
          title={selectedEvent.type || "Event Details"}
          data={{
            type: selectedEvent.type,
            timestamp: selectedEvent.timestamp,
            id: selectedEvent.id,
            ...selectedEvent.payload,
          }}
          onClose={() => setSelectedEvent(null)}
        >
          {selectedEvent.payload?.featureSlug && (
            <XStack backgroundColor="rgba(108,92,231,0.1)" borderRadius="$1" paddingHorizontal="$2" paddingVertical="$1">
              <Text fontSize={11} color="#a78bfa">Feature: {selectedEvent.payload.featureSlug}</Text>
            </XStack>
          )}
        </DetailPanel>
      )}
    </Page>
  );
}
