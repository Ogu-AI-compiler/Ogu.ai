import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/useSocket";
import { ActionButton } from "@/components/shared/ActionButton";
import { PhaseActionBar } from "@/components/shared/PhaseActionBar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { AgentsView } from "./AgentsView";

// -- Constants --
const NODE_W = 110;
const NODE_H = 44;
const DEPT_GAP = 150;
const NODE_GAP = 10;
const PAD = 36;

const STATUS_COLORS: Record<string, string> = {
  active: "#4ade80",
  running: "#4ade80",
  idle: "#facc15",
  stopped: "#facc15",
  failed: "#ef4444",
  error: "#ef4444",
  offline: "#64748b",
};

// -- Types --
interface AgentNode {
  id: string;
  name: string;
  roleId: string;
  department: string;
  deptIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  status: "active" | "idle" | "failed" | "offline";
  currentTask: string | null;
}

interface AgentEdge {
  from: string;
  to: string;
}

interface AgentLayout {
  nodes: AgentNode[];
  edges: AgentEdge[];
  departments: string[];
  width: number;
  height: number;
}

function getAgentStatus(agent: any): "active" | "idle" | "failed" | "offline" {
  if (agent.state?.currentTask) return "active";
  if (agent.state?.tasksFailed > 0 && agent.state?.tasksCompleted === 0) return "failed";
  if (!agent.enabled) return "offline";
  return "idle";
}

// -- Layout computation --
function computeAgentLayout(agents: any[]): AgentLayout {
  const deptMap: Record<string, any[]> = {};
  for (const agent of agents) {
    const dept = agent.department || "Unassigned";
    if (!deptMap[dept]) deptMap[dept] = [];
    deptMap[dept].push(agent);
  }

  const departments = Object.keys(deptMap).sort();
  const nodes: AgentNode[] = [];
  const edges: AgentEdge[] = [];

  departments.forEach((dept, deptIdx) => {
    const deptAgents = deptMap[dept];
    deptAgents.forEach((agent, nodeIdx) => {
      nodes.push({
        id: agent.roleId,
        name: agent.name,
        roleId: agent.roleId,
        department: dept,
        deptIndex: deptIdx,
        nodeIndex: nodeIdx,
        x: PAD + deptIdx * DEPT_GAP,
        y: PAD + 24 + nodeIdx * (NODE_H + NODE_GAP),
        status: getAgentStatus(agent),
        currentTask: agent.state?.currentTask || null,
      });
    });
  });

  // Edges: connect agents that share resources or have handoff relationships
  // For now, connect active agents to the next department's first agent (visual flow)
  for (let i = 0; i < departments.length - 1; i++) {
    const fromDept = deptMap[departments[i]];
    const toDept = deptMap[departments[i + 1]];
    if (fromDept.length > 0 && toDept.length > 0) {
      edges.push({ from: fromDept[0].roleId, to: toDept[0].roleId });
    }
  }

  const maxNodesInDept = Math.max(...Object.values(deptMap).map((d) => d.length), 1);
  const width = PAD * 2 + departments.length * DEPT_GAP;
  const height = PAD * 2 + 30 + maxNodesInDept * (NODE_H + NODE_GAP);

  return {
    nodes,
    edges,
    departments,
    width: Math.max(width, 600),
    height: Math.max(height, 300),
  };
}

// -- SVG Agent Node --
function AgentNodeSVG({ node, isSelected, onSelect }: { node: AgentNode; isSelected: boolean; onSelect: () => void }) {
  const color = STATUS_COLORS[node.status] || "#64748b";
  const displayName = node.name.length > 14 ? node.name.slice(0, 14) + ".." : node.name;

  return (
    <g transform={`translate(${node.x}, ${node.y})`} onClick={onSelect} style={{ cursor: "pointer" }}>
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill="var(--color-bg-card)"
        stroke={isSelected ? "var(--color-text)" : "var(--color-border)"}
        strokeWidth={isSelected ? 1.5 : 0.5}
      />

      {/* Status dot */}
      <circle cx={12} cy={NODE_H / 2} r={3.5} fill={color} />
      {node.status === "active" && (
        <circle cx={12} cy={NODE_H / 2} r={6} fill="none" stroke={color} strokeWidth={0.8} opacity={0.4}>
          <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Name */}
      <text x={24} y={18} fontSize={9} fontWeight={600} fill="var(--color-text)" fontFamily="var(--font-sans)">
        {displayName}
      </text>

      {/* Role ID */}
      <text x={24} y={32} fontSize={7.5} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
        {node.roleId.length > 16 ? node.roleId.slice(0, 16) + ".." : node.roleId}
      </text>
    </g>
  );
}

// -- SVG Edge Path (adapted from DAGView) --
function EdgePath({ edge, nodeMap }: { edge: AgentEdge; nodeMap: Map<string, AgentNode> }) {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);
  if (!from || !to) return null;

  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--color-border)"
      strokeWidth={1.5}
      markerEnd="url(#agent-arrowhead)"
      opacity={0.6}
    />
  );
}

// -- Department Label --
function DepartmentLabel({ name, x }: { name: string; x: number }) {
  return (
    <text
      x={x + NODE_W / 2}
      y={PAD - 4}
      fill="var(--color-text-muted)"
      fontSize={9}
      fontWeight={600}
      textAnchor="middle"
      fontFamily="var(--font-sans)"
      style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
    >
      {name}
    </text>
  );
}

// -- Agent Detail Panel --
function AgentDetailPanel({ agent, agentData, output, onStop, onEscalate }: {
  agent: AgentNode;
  agentData: any;
  output: string[];
  onStop: () => void;
  onEscalate: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output.length]);

  const color = STATUS_COLORS[agent.status] || "#64748b";
  const st = agentData?.state || {};
  const caps = agentData?.capabilities || [];
  const totalTasks = (st.tasksCompleted || 0) + (st.tasksFailed || 0);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-bold text-text">{agent.name}</span>
          <span className="text-xs text-text-muted font-mono">{agent.roleId}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>{agent.status}</span>
        </div>
        <div className="flex gap-2">
          {agent.status === "active" && (
            <>
              <ActionButton label="Stop" variant="danger" onAction={onStop} confirm={`Stop ${agent.name}?`} />
              <ActionButton label="Escalate" variant="primary" onAction={onEscalate} />
            </>
          )}
        </div>
      </div>

      {/* Agent stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">Department</span>
          <span className="text-xs text-text-secondary">{agent.department}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">Tasks</span>
          <span className="text-xs text-text-secondary">{st.tasksCompleted || 0} done, {st.tasksFailed || 0} failed</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">Tokens</span>
          <span className="text-xs text-text-secondary font-mono">{(st.tokensUsed || 0).toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">Cost</span>
          <span className="text-xs text-text-secondary font-mono">${(st.costUsed || 0).toFixed(2)}</span>
        </div>
        {agentData?.riskTier && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">Risk</span>
            <span className="text-xs text-text-secondary">{agentData.riskTier}</span>
          </div>
        )}
      </div>

      {/* Capabilities */}
      {caps.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {caps.map((cap: string) => (
            <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-bg font-mono text-text-muted border border-border">{cap}</span>
          ))}
        </div>
      )}

      {/* Live output or current task */}
      {(output.length > 0 || agent.currentTask) && (
        <div className="max-h-[200px] overflow-auto rounded-lg border border-border bg-bg p-3 flex flex-col">
          {output.length > 0 ? (
            <>
              {output.slice(-50).map((line, i) => (
                <span key={i} className="font-mono text-[11px] text-text-muted">{line}</span>
              ))}
              <div ref={endRef} />
            </>
          ) : (
            <span className="text-xs text-text-muted">Running: {agent.currentTask}</span>
          )}
        </div>
      )}

      {/* No activity message */}
      {output.length === 0 && !agent.currentTask && totalTasks === 0 && (
        <span className="text-xs text-text-muted">
          Idle. Use "Dispatch All" to assign tasks from the plan, or run a task manually from the Table view.
        </span>
      )}
    </Card>
  );
}

// -- Main Component --
type ViewMode = "graph" | "table";

export function AgentCanvas() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>("graph");
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [agentOutput, setAgentOutput] = useState<Record<string, string[]>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const { on } = useSocket();
  const activeFeature = useStore((s) => s.activeFeature);

  const fetchData = useCallback(() => {
    api.getAgents()
      .then((data) => setAgents(data.agents || []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const unsubs = [
      on("agent:started", () => fetchData()),
      on("agent:completed", () => fetchData()),
      on("agent:failed", () => fetchData()),
      on("agent:escalated", () => fetchData()),
      on("agent:progress", (data: any) => {
        if (data.roleId && data.progress?.output) {
          setAgentOutput((prev) => ({
            ...prev,
            [data.roleId]: [...(prev[data.roleId] || []), data.progress.output],
          }));
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, fetchData]);

  const layout = useMemo(() => computeAgentLayout(agents), [agents]);
  const nodeMap = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  if (loading) {
    return (
      <div className="relative flex flex-1 flex-col gap-8 overflow-auto p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col gap-4 overflow-auto p-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-text">Agent Canvas</h1>
          <PhaseActionBar
            actions={[
              ...(activeFeature ? [{ label: "Dispatch All", command: "orchestrate", args: [activeFeature] }] : []),
              { label: "Standup", command: "status" },
            ]}
          />
        </div>
        <Tabs
          tabs={[
            { key: "graph", label: "Graph" },
            { key: "table", label: "Table" },
          ]}
          active={mode}
          onChange={(key) => setMode(key as ViewMode)}
        />
      </div>

      {mode === "graph" ? (
        <>
          {/* Stats + Legend row */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">{agents.length} agents</span>
            <span className="text-xs text-success">{agents.filter((a) => a.state?.currentTask).length} active</span>
            <span className="text-xs text-text-muted">{layout.departments.length} depts</span>
            <span className="text-text-muted/30">|</span>
            {[
              { label: "active", color: "#4ade80" },
              { label: "idle", color: "#facc15" },
              { label: "failed", color: "#ef4444" },
              { label: "offline", color: "#64748b" },
            ].map(({ label, color }) => (
              <div key={label} className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-text-muted">{label}</span>
              </div>
            ))}
          </div>

          {/* SVG Graph */}
          {agents.length > 0 ? (
            <div className="rounded-lg border border-border bg-bg overflow-auto">
              <svg
                ref={svgRef}
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                style={{ minWidth: layout.width }}
              >
                <defs>
                  <marker id="agent-arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-muted)" />
                  </marker>
                </defs>

                {/* Department background rects */}
                {layout.departments.map((dept, i) => {
                  const deptNodes = layout.nodes.filter((n) => n.department === dept);
                  const maxY = Math.max(...deptNodes.map((n) => n.y + NODE_H));
                  return (
                    <rect
                      key={`bg-${dept}`}
                      x={PAD + i * DEPT_GAP - 10}
                      y={PAD - 14}
                      width={NODE_W + 20}
                      height={maxY - PAD + 24}
                      rx={8}
                      fill={i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)"}
                    />
                  );
                })}

                {/* Department labels */}
                {layout.departments.map((dept, i) => (
                  <DepartmentLabel key={dept} name={dept} x={PAD + i * DEPT_GAP} />
                ))}

                {/* Edges */}
                {layout.edges.map((edge, i) => (
                  <EdgePath key={i} edge={edge} nodeMap={nodeMap} />
                ))}

                {/* Nodes */}
                {layout.nodes.map((node) => (
                  <AgentNodeSVG
                    key={node.id}
                    node={node}
                    isSelected={selectedNode?.id === node.id}
                    onSelect={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  />
                ))}
              </svg>
            </div>
          ) : (
            <Card className="flex flex-col gap-3">
              <span className="text-text-muted">No agents configured. Run: ogu org:init</span>
            </Card>
          )}

          {/* Detail panel for selected agent */}
          {selectedNode && (
            <AgentDetailPanel
              agent={selectedNode}
              agentData={agents.find((a) => a.roleId === selectedNode.roleId)}
              output={agentOutput[selectedNode.roleId] || []}
              onStop={() => api.stopAgent(selectedNode.roleId)}
              onEscalate={() => api.escalateAgent(selectedNode.roleId)}
            />
          )}
        </>
      ) : (
        <AgentsView />
      )}
    </div>
  );
}
