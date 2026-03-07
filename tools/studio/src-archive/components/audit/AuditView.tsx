import { useEffect, useState, useCallback, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { DetailPanel } from "@/components/shared/DetailPanel";

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

  const features = useMemo(() => {
    const featureSet = new Set<string>();
    for (const e of events) {
      if (e.payload?.featureSlug) featureSet.add(e.payload.featureSlug);
    }
    return [...featureSet].sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) => {
      const typeMatch = (e.type || "").toLowerCase().includes(q);
      const payloadMatch = JSON.stringify(e.payload || {}).toLowerCase().includes(q);
      return typeMatch || payloadMatch;
    });
  }, [events, searchQuery]);

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

  const prefixes = useMemo(() => (
    [...new Set(types.map((t) => t.split(".")[0]))].sort()
  ), [types]);

  if (loading && events.length === 0) {
    return (
      <div style={{ flex: 1, padding: 28 }}>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading audit log...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 24, overflow: "auto", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Audit Log</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{total} total events</span>
      </div>

      {/* Search + Feature Filter */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Input
          style={{ flex: 1 }}
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {features.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => handleFeatureFilter("")}
              style={{
                padding: "4px 8px", borderRadius: 4, cursor: "pointer", border: "none",
                backgroundColor: !featureFilter ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>All</span>
            </button>
            {features.slice(0, 5).map((f) => (
              <button
                key={f}
                onClick={() => handleFeatureFilter(f)}
                style={{
                  padding: "4px 8px", borderRadius: 4, cursor: "pointer", border: "none",
                  backgroundColor: featureFilter === f ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{f}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Type filter chips */}
      {prefixes.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {prefixes.map((prefix) => (
            <button
              key={prefix}
              onClick={() => handleTypeFilter(prefix)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                border: typeFilter === prefix ? `1px solid #6c5ce7` : "none",
                backgroundColor: typeFilter === prefix ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)",
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: TYPE_COLORS[prefix] || "#888",
              }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{prefix}</span>
            </button>
          ))}
        </div>
      )}

      {/* Type distribution bar chart */}
      {typeCounts.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 40 }}>
          {typeCounts.map(([type, count]) => (
            <div key={type} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
              <div style={{
                width: "100%", maxWidth: 40,
                height: Math.max((count / maxCount) * 30, 3),
                borderRadius: 2,
                backgroundColor: TYPE_COLORS[type] || "#888",
              }} />
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>{type}</span>
            </div>
          ))}
        </div>
      )}

      <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {/* Event List */}
      {filteredEvents.length === 0 ? (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>No audit events {searchQuery ? "matching search" : "recorded"}</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[...filteredEvents].reverse().map((event, i) => {
            const severityColor = getSeverityColor(event);
            return (
              <div
                key={event.id || i}
                onClick={() => setSelectedEvent(event)}
                style={{
                  backgroundColor: severityColor ? `${severityColor}08` : "rgba(255,255,255,0.02)",
                  borderRadius: 4,
                  padding: 8,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  cursor: "pointer",
                  borderLeftWidth: severityColor ? 2 : 0,
                  borderLeftStyle: "solid",
                  borderColor: severityColor || "transparent",
                }}
              >
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", width: 80, flexShrink: 0 }}>
                  {event.timestamp?.slice(11, 19) || ""}
                </span>
                <div style={{
                  backgroundColor: `${getTypeColor(event.type)}20`,
                  borderRadius: 4,
                  padding: "1px 4px",
                  width: 140,
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, color: getTypeColor(event.type), fontFamily: "monospace" }}>
                    {event.type}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {event.payload?.featureSlug && `[${event.payload.featureSlug}] `}
                  {event.payload?.gate || event.payload?.summary || event.payload?.taskId || event.payload?.reason || JSON.stringify(event.payload || {}).slice(0, 100)}
                </span>
              </div>
            );
          })}
        </div>
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
            <div style={{ backgroundColor: "rgba(108,92,231,0.1)", borderRadius: 4, padding: "4px 8px" }}>
              <span style={{ fontSize: 11, color: "#a78bfa" }}>Feature: {selectedEvent.payload.featureSlug}</span>
            </div>
          )}
        </DetailPanel>
      )}
    </div>
  );
}
