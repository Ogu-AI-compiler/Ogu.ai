import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/useSocket";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { ActionButton } from "@/components/shared/ActionButton";

// ── Constants ──

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const WAVE_GAP = 220;
const NODE_GAP = 20;
const PADDING = 40;

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  queued: "#94a3b8",
  dispatched: "#00d4ff",
  running: "#4ade80",
  active: "#4ade80",
  completed: "#6c5ce7",
  done: "#6c5ce7",
  failed: "#ef4444",
  error: "#ef4444",
  cancelled: "#64748b",
  halted: "#facc15",
};

// ── Types ──

interface TaskNode {
  id: string;
  title: string;
  wave: number;
  waveIndex: number;
  x: number;
  y: number;
  status: string;
  isCriticalPath: boolean;
  touches: string[];
  dependsOn: string[];
  resources: string[];
}

interface Edge {
  from: string;
  to: string;
  type: "dependency" | "conflict";
}

// ── Layout computation ──

function computeLayout(dag: any): { nodes: TaskNode[]; edges: Edge[]; width: number; height: number } {
  const waves = dag.waves || [];
  const taskDetails = dag.taskDetails || {};
  const taskStatuses = dag.taskStatuses || {};
  const criticalPath = new Set(dag.critical_path || []);
  const nodes: TaskNode[] = [];
  const edges: Edge[] = [];

  for (const wave of waves) {
    const waveIdx = wave.wave - 1;
    const tasks = wave.tasks || [];

    for (let i = 0; i < tasks.length; i++) {
      const taskId = tasks[i];
      const detail = taskDetails[taskId] || {};

      nodes.push({
        id: taskId,
        title: detail.title || taskId,
        wave: waveIdx,
        waveIndex: i,
        x: PADDING + waveIdx * WAVE_GAP,
        y: PADDING + i * (NODE_HEIGHT + NODE_GAP),
        status: taskStatuses[taskId] || "pending",
        isCriticalPath: criticalPath.has(taskId),
        touches: detail.touches || [],
        dependsOn: detail.depends_on || [],
        resources: detail.resources || [],
      });
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (nodeMap.has(dep)) {
        edges.push({ from: dep, to: node.id, type: "dependency" });
      }
    }
  }

  const maxWave = waves.length;
  const maxTasksInWave = Math.max(...waves.map((w: any) => (w.tasks || []).length), 1);
  const width = PADDING * 2 + maxWave * WAVE_GAP;
  const height = PADDING * 2 + maxTasksInWave * (NODE_HEIGHT + NODE_GAP);

  return { nodes, edges, width: Math.max(width, 600), height: Math.max(height, 300) };
}

// ── SVG Edge Component ──

function EdgePath({ edge, nodeMap }: { edge: Edge; nodeMap: Map<string, TaskNode> }) {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);
  if (!from || !to) return null;

  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;

  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  const isCritical = from.isCriticalPath && to.isCriticalPath;

  return (
    <path
      d={path}
      fill="none"
      stroke={edge.type === "conflict" ? "#ef4444" : isCritical ? "#a78bfa" : "rgba(255,255,255,0.15)"}
      strokeWidth={isCritical ? 2.5 : 1.5}
      strokeDasharray={edge.type === "conflict" ? "6,3" : "none"}
      markerEnd="url(#arrowhead)"
    />
  );
}

// ── SVG Task Node Component ──

function TaskNodeSVG({ node, isSelected, onSelect }: { node: TaskNode; isSelected: boolean; onSelect: () => void }) {
  const color = STATUS_COLORS[node.status] || "#94a3b8";

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onSelect}
      style={{ cursor: "pointer" }}
    >
      {node.isCriticalPath && (
        <rect
          x={-3} y={-3} width={NODE_WIDTH + 6} height={NODE_HEIGHT + 6} rx={10}
          fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.5}
        />
      )}
      <rect
        width={NODE_WIDTH} height={NODE_HEIGHT} rx={8}
        fill={`rgba(22,22,22,0.9)`}
        stroke={isSelected ? "#a78bfa" : color}
        strokeWidth={isSelected ? 2 : 1}
      />
      <circle cx={12} cy={NODE_HEIGHT / 2} r={4} fill={color} />
      <text x={24} y={NODE_HEIGHT / 2 - 6} fill="white" fontSize={11} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
        {node.title.length > 18 ? node.title.slice(0, 18) + "..." : node.title}
      </text>
      <text x={24} y={NODE_HEIGHT / 2 + 10} fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="'SF Mono', monospace">
        {node.id}
      </text>
      <text
        x={NODE_WIDTH - 8} y={NODE_HEIGHT / 2 + 2} fill={color} fontSize={8} fontWeight={600}
        textAnchor="end" style={{ textTransform: "uppercase" }}
      >
        {node.status}
      </text>
    </g>
  );
}

// ── Wave Label ──

function WaveLabel({ waveIndex, x, taskCount, parallel }: { waveIndex: number; x: number; taskCount: number; parallel: boolean }) {
  return (
    <text
      x={x + NODE_WIDTH / 2} y={16} fill="rgba(255,255,255,0.3)" fontSize={10}
      fontWeight={600} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif"
    >
      Wave {waveIndex + 1} ({taskCount} {parallel ? "parallel" : "sequential"})
    </text>
  );
}

// ── Main Component ──

export function DAGView() {
  const [dag, setDag] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TaskNode | null>(null);
  const [generating, setGenerating] = useState(false);
  const activeFeature = useStore((s) => s.activeFeature);
  const svgRef = useRef<SVGSVGElement>(null);
  const { on } = useSocket();

  const fetchDAG = useCallback(() => {
    if (!activeFeature) {
      setLoading(false);
      setError("No active feature. Select a feature first.");
      return;
    }

    api.getDAG(activeFeature)
      .then((data) => {
        setDag(data);
        setError(null);
      })
      .catch((err) => {
        setDag(null);
        setError(err.message || "Failed to load DAG");
      })
      .finally(() => setLoading(false));
  }, [activeFeature]);

  useEffect(() => {
    fetchDAG();
  }, [fetchDAG]);

  useEffect(() => {
    const unsub1 = on("task:dispatched", () => fetchDAG());
    const unsub2 = on("task:completed", () => fetchDAG());
    const unsub3 = on("task:failed", () => fetchDAG());
    const unsub4 = on("wave:started", () => fetchDAG());
    const unsub5 = on("wave:completed", () => fetchDAG());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [on, fetchDAG]);

  const handleGenerate = async () => {
    if (!activeFeature) return;
    setGenerating(true);
    try {
      await api.runOrchestrate(activeFeature, true);
      fetchDAG();
    } catch (err: any) {
      setError(err?.message || "Failed to generate DAG");
    } finally {
      setGenerating(false);
    }
  };

  const layout = useMemo(() => {
    if (!dag) return null;
    return computeLayout(dag);
  }, [dag]);

  const nodeMap = useMemo(() => {
    if (!layout) return new Map<string, TaskNode>();
    return new Map(layout.nodes.map((n) => [n.id, n]));
  }, [layout]);

  if (loading) return (
    <div style={{ flex: 1, position: "relative" }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading DAG...</span>
    </div>
  );

  if (error || !dag) {
    return (
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", gap: 12, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Task Dependency Graph</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{error || "No DAG data available."}</span>
          {activeFeature && (
            <ActionButton
              label={generating ? "Generating..." : "Generate DAG"}
              variant="primary"
              onAction={handleGenerate}
              disabled={generating}
              size="md"
            />
          )}
        </div>
      </div>
    );
  }

  const waves = dag.waves || [];
  const conflicts = [...(dag.scope_conflicts || []), ...(dag.resource_conflicts || [])];

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Task DAG — {activeFeature}</span>
        <ActionButton label="Regenerate" variant="ghost" onAction={handleGenerate} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Tasks", value: dag.total_tasks, color: undefined },
          { label: "Waves", value: waves.length, color: undefined },
          { label: "Max Parallel", value: dag.max_parallelism, color: undefined },
          { label: "Conflicts", value: conflicts.length, color: conflicts.length > 0 ? "#facc15" : "#4ade80" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 100, gap: 4, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
        {dag.critical_path?.length > 0 && (
          <div style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 100, gap: 4, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Critical Path</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>{dag.critical_path.length} tasks</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {Object.entries(STATUS_COLORS).filter(([k]) => ["pending", "running", "completed", "failed"].includes(k)).map(([status, color]) => (
          <div key={status} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{status}</span>
          </div>
        ))}
        <Separator style={{ alignSelf: "stretch", width: 1 }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 16, height: 2, backgroundColor: "#a78bfa", borderRadius: 1 }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>critical path</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 16, height: 2, backgroundColor: "#ef4444", borderRadius: 1 }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>conflict</span>
        </div>
      </div>

      {/* SVG DAG */}
      {layout && (
        <div style={{
          backgroundColor: "rgba(10,10,15,0.5)", borderRadius: 12,
          borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.06)",
          overflow: "scroll",
        }}>
          <svg
            ref={svgRef}
            width={layout.width}
            height={layout.height + 30}
            viewBox={`0 0 ${layout.width} ${layout.height + 30}`}
            style={{ minWidth: layout.width }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.3)" />
              </marker>
            </defs>
            {waves.map((wave: any, i: number) => (
              <WaveLabel key={i} waveIndex={i} x={PADDING + i * WAVE_GAP} taskCount={(wave.tasks || []).length} parallel={wave.parallel !== false} />
            ))}
            {waves.map((_: any, i: number) => (
              <rect
                key={`bg-${i}`}
                x={PADDING + i * WAVE_GAP - 10} y={24}
                width={NODE_WIDTH + 20} height={layout.height - 10}
                rx={8}
                fill={i % 2 === 0 ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)"}
              />
            ))}
            {layout.edges.map((edge, i) => (
              <EdgePath key={i} edge={edge} nodeMap={nodeMap} />
            ))}
            {layout.nodes.map((node) => (
              <TaskNodeSVG
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                onSelect={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Conflicts section */}
      {conflicts.length > 0 && (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", gap: 8, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#facc15" }}>Conflicts ({conflicts.length})</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conflicts.map((c: any, i: number) => (
              <div key={i} style={{ backgroundColor: "rgba(250,204,21,0.05)", borderRadius: 4, padding: 8, gap: 8, display: "flex" }}>
                <span style={{ fontSize: 10, color: "#facc15", fontWeight: 600 }}>
                  {c.resource ? "RESOURCE" : "SCOPE"}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", flex: 1 }}>
                  Tasks: {(c.tasks || []).join(", ")} | Wave: {c.wave}
                  {c.overlap && ` | Overlap: ${c.overlap.join(", ")}`}
                  {c.resource && ` | Resource: ${c.resource}`}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{c.resolution || "sequential"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedNode && (
        <DetailPanel
          title={selectedNode.title}
          data={{
            id: selectedNode.id,
            status: selectedNode.status,
            wave: selectedNode.wave + 1,
            criticalPath: selectedNode.isCriticalPath,
            dependsOn: selectedNode.dependsOn.length > 0 ? selectedNode.dependsOn : "none",
            touches: selectedNode.touches.length > 0 ? selectedNode.touches : "none",
            resources: selectedNode.resources.length > 0 ? selectedNode.resources : "none",
          }}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
