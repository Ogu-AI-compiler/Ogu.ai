import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Avatar from "react-nice-avatar";

// Deterministic hue from name string
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Types ──

interface Task {
  id: string;
  title: string;
  group: string;
  dependsOn?: string[];
  done?: boolean;
  agent?: { name: string; emoji?: string; avatar?: Record<string, string> };
}

interface LayoutNode {
  id: string;
  title: string;
  group: string;
  done: boolean;
  agent: { id: string; name: string; role?: string; specialty?: string; tier?: number; avatar?: Record<string, string> };
  x: number;
  y: number;
}

interface Edge {
  fromId: string;
  toId: string;
  done: boolean;
  active: boolean;
}

interface SnapGuide {
  axis: "x" | "y";
  value: number;
  from: number;
  to: number;
}

interface GroupMeta {
  group: string;
  x: number;
  labelY: number;
  height: number;
  color: string;
  agent: { id: string; name: string; role?: string; specialty?: string; tier?: number; avatar?: Record<string, string> };
}

// ── Constants ──

const NODE_W = 80;
const NODE_H = 100;
const CTO_W = 96;
const CTO_H = 120;
const COL_SPACING = 140;
const ROW_SPACING = 115;
const CTO_Y = -100;
const GROUP_START_Y = 100;
const SNAP_THRESHOLD = 10;

// ── Animation timeline (seconds) ──
const CTO_ENTER_DUR = 0.5;        // CTO fade-in duration
const NODE_BASE_DELAY = 0.5;      // nodes start after CTO
const NODE_STAGGER = 0.08;        // stagger between each node
const DOT_EXTRA_DELAY = 0.25;     // dots start after last node
const EDGE_EXTRA_DELAY = 0.15;    // edges start after dots

const GROUP_ORDER = ["setup", "core", "ui", "integration", "polish"];

const DEFAULT_AGENTS: Record<string, { id: string; name: string; role?: string; specialty?: string; tier?: number }> = {
  setup: { id: "OGU-7A2F", name: "Ops", role: "DevOps" },
  core: { id: "OGU-3B8E", name: "Dev", role: "Engineer" },
  ui: { id: "OGU-5C1D", name: "Design", role: "Frontend Engineer" },
  integration: { id: "OGU-9E4A", name: "Integration", role: "Integration Engineer" },
  polish: { id: "OGU-2D6C", name: "QA", role: "Quality Assurance" },
};

const GROUP_COLORS: Record<string, string> = {
  setup: "#4ade80",
  core: "#818cf8",
  ui: "#f472b6",
  integration: "#fb923c",
  polish: "#a78bfa",
};

// Cycle of colors for agents that don't map to a named group
const AGENT_COLOR_CYCLE = ["#818cf8", "#f472b6", "#4ade80", "#fb923c", "#a78bfa", "#60a5fa", "#fbbf24", "#f87171"];

// ── Document Card Shape (from user SVG — corner fold style) ──
// Original viewBox: 0 0 298.24 368.24 — scaled to fit NODE_W x NODE_H

function cardPathD(width: number, height: number): string {
  const sx = width / 298.24;
  const sy = height / 368.24;
  return `M${225.68 * sx},${1 * sy}`
    + ` c${7.71 * sx},0 ${15.24 * sx},${3.15 * sy} ${20.65 * sx},${8.64 * sy}`
    + ` l${42.55 * sx},${43.16 * sy}`
    + ` c${5.38 * sx},${5.46 * sy} ${8.35 * sx},${12.69 * sy} ${8.35 * sx},${20.36 * sy}`
    + ` v${275.08 * sy}`
    + ` c0,${10.48 * sy} ${-8.52 * sx},${19 * sy} ${-19 * sx},${19 * sy}`
    + ` H${20 * sx}`
    + ` c${-10.48 * sx},0 ${-19 * sx},${-8.52 * sy} ${-19 * sx},${-19 * sy}`
    + ` V${20 * sy}`
    + ` C${1 * sx},${9.52 * sy} ${9.52 * sx},${1 * sy} ${20 * sx},${1 * sy}`
    + ` h${205.68 * sx}Z`;
}

function CardShape({ width, height, strokeColor, fillColor }: { width: number; height: number; strokeColor: string; fillColor: string }) {
  return (
    <path
      d={cardPathD(width, height)}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={1.5}
    />
  );
}



// ── Group-based layout ──

function computeGroupLayout(tasks: Task[], teamAgents?: Record<string, { id: string; name: string; role?: string; specialty?: string; tier?: number; avatar?: Record<string, string> }> | null): {
  nodes: LayoutNode[];
  edges: Edge[];
  bbox: { x: number; y: number; w: number; h: number };
  groupMeta: GroupMeta[];
} {
  if (tasks.length === 0 && !teamAgents)
    return { nodes: [], edges: [], bbox: { x: 0, y: 0, w: 0, h: 0 }, groupMeta: [] };

  // ── Build agent list: prefer teamAgents (all members), fallback to task-group defaults ──
  const agentEntries: Array<{ key: string; agent: { id: string; name: string; role?: string; specialty?: string; tier?: number } }> = [];

  if (teamAgents && Object.keys(teamAgents).length > 0) {
    for (const [key, agent] of Object.entries(teamAgents)) {
      agentEntries.push({ key, agent });
    }
  } else {
    // Derive from task groups as fallback
    const groups = new Map<string, Task[]>();
    for (const t of tasks) {
      const g = t.group || "core";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(t);
    }
    const orderedGroups = [...groups.keys()].sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a);
      const bi = GROUP_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const g of orderedGroups) {
      agentEntries.push({ key: g, agent: DEFAULT_AGENTS[g] || DEFAULT_AGENTS.core });
    }
  }

  const numAgents = agentEntries.length;
  const totalWidth = (numAgents - 1) * COL_SPACING;

  const nodes: LayoutNode[] = [];
  const groupMeta: GroupMeta[] = [];

  // Map task → agent key by matching task.agent.name
  const taskToAgentKey = new Map<string, string>();
  for (const t of tasks) {
    const name = t.agent?.name;
    if (name) {
      const entry = agentEntries.find((e) => e.agent.name === name);
      if (entry) taskToAgentKey.set(t.id, entry.key);
    }
    // Also map by group as fallback
    if (!taskToAgentKey.has(t.id)) {
      taskToAgentKey.set(t.id, t.group || "core");
    }
  }

  // One node per agent
  agentEntries.forEach(({ key, agent }, gi) => {
    const colX = -totalWidth / 2 + gi * COL_SPACING;
    const agentTasks = tasks.filter((t) => taskToAgentKey.get(t.id) === key);
    const allDone = agentTasks.length > 0 && agentTasks.every((t) => !!t.done);
    const group = agentTasks[0]?.group || GROUP_ORDER[gi % GROUP_ORDER.length];
    const color = GROUP_COLORS[group] || AGENT_COLOR_CYCLE[gi % AGENT_COLOR_CYCLE.length];

    groupMeta.push({ group, x: colX, labelY: GROUP_START_Y - 28, height: NODE_H, color, agent });

    nodes.push({
      id: key,
      title: `${agentTasks.length} task${agentTasks.length !== 1 ? "s" : ""}`,
      group,
      done: allDone,
      agent,
      x: colX,
      y: GROUP_START_Y,
    });
  });

  // Agent-level edges: task A (agent X) dependsOn task B (agent Y) → edge X→Y
  const seenEdges = new Set<string>();
  const edges: Edge[] = [];
  for (const t of tasks) {
    const toKey = taskToAgentKey.get(t.id);
    if (!toKey) continue;
    for (const dep of t.dependsOn || []) {
      const fromKey = taskToAgentKey.get(dep);
      if (!fromKey || fromKey === toKey) continue;
      const edgeKey = `${fromKey}→${toKey}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      const fromNode = nodes.find((n) => n.id === fromKey);
      const toNode = nodes.find((n) => n.id === toKey);
      const done = !!(fromNode?.done && toNode?.done);
      const active = !done && (fromNode?.done || false);
      edges.push({ fromId: fromKey, toId: toKey, done, active });
    }
  }

  const allX = nodes.map((n) => n.x);
  const allY = nodes.map((n) => n.y);
  const minX = Math.min(...allX) - NODE_W / 2 - 60;
  const maxX = Math.max(...allX) + NODE_W / 2 + 60;
  const minY = Math.min(CTO_Y - CTO_H / 2, ...allY) - NODE_H / 2 - 60;
  const maxY = Math.max(...allY) + NODE_H / 2 + 40;

  return { nodes, edges, bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, groupMeta };
}

// ── PM Hub Node (document card shape) ──

function CTONode({ ctoActive, taskCount, animated, pmAgent }: { // eslint-disable-line
  ctoActive: boolean;
  taskCount: number;
  animated?: boolean;
  pmAgent?: { name: string; role?: string; avatar?: Record<string, string> } | null;
}) {
  const hw = CTO_W / 2;
  const hh = CTO_H / 2;
  const ctoPath = cardPathD(CTO_W, CTO_H);
  const avatarX = 8, avatarY = 7, avatarSize = 32;
  const nameX = avatarX;
  const nameY = avatarY + avatarSize + 7;

  return (
    <g
      transform={`translate(${-hw}, ${-hh})`}
      style={animated ? {
        animation: `ctoAppear ${CTO_ENTER_DUR}s ease-out both`,
        transformOrigin: `${hw}px ${hh}px`,
        willChange: "transform",
      } : { willChange: "transform" }}
    >
      <defs>
        <linearGradient id="cto-shimmer" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="white" stopOpacity={ctoActive ? 0.13 : 0.07} />
          <stop offset="45%"  stopColor="white" stopOpacity="0.02" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cto-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--color-accent, var(--accent))" stopOpacity={ctoActive ? 0.95 : 0.75} />
          <stop offset="22%"  stopColor="var(--color-accent, var(--accent))" stopOpacity={ctoActive ? 0.45 : 0.30} />
          <stop offset="78%"  stopColor="var(--color-accent, var(--accent))" stopOpacity={ctoActive ? 0.45 : 0.30} />
          <stop offset="100%" stopColor="var(--color-accent, var(--accent))" stopOpacity={ctoActive ? 0.90 : 0.70} />
        </linearGradient>
        <clipPath id="cto-clip"><path d={ctoPath} /></clipPath>
      </defs>

      {/* Pulse ring when distributing */}
      {ctoActive && (
        <g style={{ animation: "pulseRing 2s ease-in-out infinite", transformOrigin: `${CTO_W / 2}px ${CTO_H / 2}px` }}>
          <path d={ctoPath} fill="none" stroke="var(--color-accent, var(--accent))" strokeWidth={1.5} opacity={0.5} />
        </g>
      )}

      {/* Glass card */}
      <path d={ctoPath} fill="rgba(14,14,14,0.95)" stroke="url(#cto-border)" strokeWidth={1.5} />
      <rect x={0} y={0} width={CTO_W} height={CTO_H} fill="url(#cto-shimmer)" clipPath="url(#cto-clip)" style={{ pointerEvents: "none" }} />

      {/* PM Avatar */}
      {(() => {
        const pmName = pmAgent?.name ?? "PM";
        const r = avatarSize / 2;
        const cx = avatarX + r, cy = avatarY + r;
        if (pmAgent?.avatar) {
          return (
            <foreignObject x={avatarX} y={avatarY} width={avatarSize} height={avatarSize} style={{ overflow: "visible" }}>
              <Avatar style={{ width: avatarSize, height: avatarSize, borderRadius: "50%" }} {...pmAgent.avatar as any} />
            </foreignObject>
          );
        }
        const hue = nameHue(pmName);
        return (
          <>
            <circle cx={cx} cy={cy} r={r} fill={`hsl(${hue},55%,22%)`} stroke={`hsl(${hue},60%,40%)`} strokeWidth={1.2} />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fill={`hsl(${hue},80%,85%)`} fontSize={11} fontWeight={700} fontFamily="var(--font-sans)">
              {nameInitials(pmName)}
            </text>
          </>
        );
      })()}

      {/* PM Name */}
      <foreignObject x={nameX} y={nameY} width={CTO_W - nameX - 4} height={16}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text, #fff)", fontFamily: "var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pmAgent?.name ?? "PM"}
        </div>
      </foreignObject>

      {/* Job title — always shown */}
      <foreignObject x={nameX} y={nameY + 14} width={CTO_W - nameX - 4} height={14}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pmAgent?.role ?? "Product Manager"}
        </div>
      </foreignObject>

      {/* Status / task count */}
      <foreignObject x={nameX} y={nameY + 26} width={CTO_W - nameX - 4} height={14}>
        {ctoActive ? (
          <div style={{ fontSize: 8, fontWeight: 600, fontFamily: "var(--font-sans)" }} className="letter-shimmer">Distributing...</div>
        ) : taskCount > 0 ? (
          <div style={{ fontSize: 8, color: "var(--color-accent, #63f19d)", fontFamily: "var(--font-sans)", fontWeight: 500 }}>
            {taskCount} tasks
          </div>
        ) : null}
      </foreignObject>
    </g>
  );
}

// ── CTO → Node Beam Edge (3 states: not dispatched / dispatched / done) ──

function CTONodeEdge({ node, dispatched, done, paused }: {
  node: LayoutNode;
  dispatched: boolean;
  done: boolean;
  paused?: boolean;
}) {
  const tx = node.x;
  const ty = node.y;
  const midX = tx * 0.5;
  const midY = CTO_Y + (ty - CTO_Y) * 0.35;
  const pathD = `M 0 ${CTO_Y} Q ${midX} ${midY}, ${tx} ${ty}`;

  const beamColor = GROUP_COLORS[node.group] || "#818cf8";
  const gradId = `beam-grad-node-${node.id}`;

  const strokeColor = done ? "#ffffff" : beamColor;
  const glowId = `beam-glow-${node.id}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={beamColor} stopOpacity="0" />
          <stop offset="30%" stopColor={beamColor} stopOpacity="1" />
          <stop offset="70%" stopColor={beamColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={beamColor} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
      </defs>
      {/* Base line — group color, solid */}
      <path
        d={pathD} fill="none" stroke={strokeColor}
        strokeWidth={1.5}
        opacity={done ? 1 : 0.7}
      />
      {/* Beam shoot — continuous loop while dispatched */}
      {dispatched && !done && (
        <path
          d={pathD} fill="none" stroke={`url(#${gradId})`}
          strokeWidth={3}
          strokeDasharray="80 400"
          style={{ animation: paused ? "none" : "beamShoot 2.5s ease-in-out infinite" }}
        />
      )}
    </g>
  );
}

// ── Port Distribution (evenly spaced per side, n8n-style) ──

type Side = "top" | "right" | "bottom" | "left";

interface PortInfo {
  x: number;
  y: number;
  side: Side;
}

function angleToSide(angle: number): Side {
  const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (a < Math.PI / 4 || a >= 7 * Math.PI / 4) return "right";
  if (a < 3 * Math.PI / 4) return "bottom";
  if (a < 5 * Math.PI / 4) return "left";
  return "top";
}

function computePortAssignments(
  edges: Edge[],
  nodeMap: Map<string, { x: number; y: number; done: boolean; group: string }>,
): Map<string, Map<string, PortInfo>> {
  type Conn = { connectedId: string; naturalAngle: number; side: Side };
  const nodeConns = new Map<string, Conn[]>();

  for (const e of edges) {
    const from = nodeMap.get(e.fromId);
    const to = nodeMap.get(e.toId);
    if (!from || !to) continue;

    const aFT = Math.atan2(to.y - from.y, to.x - from.x);
    const aTF = Math.atan2(from.y - to.y, from.x - to.x);

    if (!nodeConns.has(e.fromId)) nodeConns.set(e.fromId, []);
    if (!nodeConns.has(e.toId)) nodeConns.set(e.toId, []);

    nodeConns.get(e.fromId)!.push({ connectedId: e.toId, naturalAngle: aFT, side: angleToSide(aFT) });
    nodeConns.get(e.toId)!.push({ connectedId: e.fromId, naturalAngle: aTF, side: angleToSide(aTF) });
  }

  const hw = NODE_W / 2;
  const hh = NODE_H / 2;
  const result = new Map<string, Map<string, PortInfo>>();

  for (const [nodeId, conns] of nodeConns) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const sides: Record<Side, Conn[]> = { top: [], right: [], bottom: [], left: [] };
    for (const c of conns) sides[c.side].push(c);
    for (const s of Object.values(sides)) s.sort((a, b) => a.naturalAngle - b.naturalAngle);

    const portMap = new Map<string, PortInfo>();

    // Top: y = -hh, x distributed evenly across width
    for (let i = 0; i < sides.top.length; i++) {
      const x = -hw + (hw * 2) * (i + 1) / (sides.top.length + 1);
      portMap.set(sides.top[i].connectedId, { x: node.x + x, y: node.y - hh, side: "top" });
    }
    // Bottom
    for (let i = 0; i < sides.bottom.length; i++) {
      const x = -hw + (hw * 2) * (i + 1) / (sides.bottom.length + 1);
      portMap.set(sides.bottom[i].connectedId, { x: node.x + x, y: node.y + hh, side: "bottom" });
    }
    // Left: x = -hw, y distributed evenly across height
    for (let i = 0; i < sides.left.length; i++) {
      const y = -hh + (hh * 2) * (i + 1) / (sides.left.length + 1);
      portMap.set(sides.left[i].connectedId, { x: node.x - hw, y: node.y + y, side: "left" });
    }
    // Right
    for (let i = 0; i < sides.right.length; i++) {
      const y = -hh + (hh * 2) * (i + 1) / (sides.right.length + 1);
      portMap.set(sides.right[i].connectedId, { x: node.x + hw, y: node.y + y, side: "right" });
    }

    result.set(nodeId, portMap);
  }

  return result;
}

function sideControlOffset(side: Side, distance: number = 50): { dx: number; dy: number } {
  switch (side) {
    case "top": return { dx: 0, dy: -distance };
    case "bottom": return { dx: 0, dy: distance };
    case "left": return { dx: -distance, dy: 0 };
    case "right": return { dx: distance, dy: 0 };
  }
}

// ── Task-to-Task Edge (curved bezier using precomputed ports) ──

function TaskEdgeLine({ edge, ports, animated, nodeMap, edgeIndex = 0, nodeCount = 0 }: { edge: Edge; ports: Map<string, Map<string, PortInfo>>; animated?: boolean; nodeMap?: Map<string, { x: number; y: number; done: boolean; group: string }>; edgeIndex?: number; nodeCount?: number }) {
  const p1 = ports.get(edge.fromId)?.get(edge.toId);
  const p2 = ports.get(edge.toId)?.get(edge.fromId);
  if (!p1 || !p2) return null;

  const cp1 = sideControlOffset(p1.side);
  const cp2 = sideControlOffset(p2.side);
  const fromNode = nodeMap?.get(edge.fromId);
  const baseColor = GROUP_COLORS[fromNode?.group || "core"] || "#818cf8";
  const edgeColor = edge.done ? "#ffffff" : baseColor;
  const pathD = `M ${p1.x} ${p1.y} C ${p1.x + cp1.dx} ${p1.y + cp1.dy}, ${p2.x + cp2.dx} ${p2.y + cp2.dy}, ${p2.x} ${p2.y}`;

  // Edges appear after: CTO + nodes + dots
  const edgeDelay = animated
    ? NODE_BASE_DELAY + nodeCount * NODE_STAGGER + DOT_EXTRA_DELAY + EDGE_EXTRA_DELAY + edgeIndex * 0.06
    : 0;

  const baseStyle: React.CSSProperties = animated
    ? { strokeDasharray: 500, animation: `edgeDraw 0.5s ease-out ${edgeDelay}s both` }
    : {};

  const baseOpacity = edge.done ? 0.6 : edge.active ? 0.4 : 0.2;

  return (
    <g>
      {/* Base solid line in group color */}
      <path
        d={pathD}
        fill="none"
        stroke={edgeColor}
        strokeWidth={1.5}
        opacity={animated ? undefined : baseOpacity}
        style={animated ? { ...baseStyle, "--edge-opacity": baseOpacity } as React.CSSProperties : { opacity: baseOpacity }}
      />
      {/* Pulsing glow for active edges */}
      {edge.active && (
        <path
          d={pathD}
          fill="none"
          stroke={edgeColor}
          strokeWidth={3}
          style={{ animation: `beamGlowLoop 2.5s ease-in-out ${edgeDelay + 0.5}s infinite`, filter: "blur(3px)" }}
        />
      )}
    </g>
  );
}

function TaskEdgeDots({ edge, ports, nodeMap, animated, edgeIndex = 0, nodeCount = 0 }: {
  edge: Edge;
  ports: Map<string, Map<string, PortInfo>>;
  nodeMap: Map<string, { x: number; y: number; done: boolean; group: string }>;
  animated?: boolean;
  edgeIndex?: number;
  nodeCount?: number;
}) {
  const p1 = ports.get(edge.fromId)?.get(edge.toId);
  const p2 = ports.get(edge.toId)?.get(edge.fromId);
  if (!p1 || !p2) return null;

  const fromNode = nodeMap.get(edge.fromId);
  const toNode = nodeMap.get(edge.toId);
  const fromColor = GROUP_COLORS[fromNode?.group || "core"] || "#818cf8";
  const toColor = GROUP_COLORS[toNode?.group || "core"] || "#818cf8";

  // Dots appear after: CTO + all nodes
  const dotBase = animated
    ? NODE_BASE_DELAY + nodeCount * NODE_STAGGER + DOT_EXTRA_DELAY + edgeIndex * 0.04
    : 0;

  return (
    <g>
      <circle
        cx={p1.x} cy={p1.y} r={3}
        fill={fromColor}
        style={animated ? {
          animation: `dotPop 0.3s ease-out ${dotBase}s both`,
          transformOrigin: `${p1.x}px ${p1.y}px`,
        } : undefined}
      />
      <circle
        cx={p2.x} cy={p2.y} r={3}
        fill={toColor}
        style={animated ? {
          animation: `dotPop 0.3s ease-out ${dotBase + 0.1}s both`,
          transformOrigin: `${p2.x}px ${p2.y}px`,
        } : undefined}
      />
    </g>
  );
}

// ── Task Node Card (document card shape, home-button glass style) ──

function TaskNodeCard({ node, index, infoOpen, onInfoToggle, active = false, onSelect }: {
  node: LayoutNode;
  index: number;
  infoOpen: boolean;
  onInfoToggle: (id: string) => void;
  active?: boolean;
  onSelect?: (nodeId: string, group: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hw = NODE_W / 2;
  const hh = NODE_H / 2;
  const groupColor = GROUP_COLORS[node.group] || "#818cf8";
  const doneColor = "#ffffff";
  const activeColor = node.done ? doneColor : groupColor;

  // Glass style — matches home buttons
  const isHighlighted = active || node.done;
  const shimmerColor = isHighlighted ? activeColor : "white";
  // Semi-transparent fill — lets background show through (glass effect)
  const cardFill = isHighlighted ? "rgba(14,14,14,0.97)" : "rgba(14,14,14,0.95)";

  // SVG def IDs — strip non-alnum chars from node.id for valid SVG ids
  const safeId = node.id.replace(/[^a-z0-9]/gi, "");
  const gradId     = `cg-${safeId}`;
  const clipId     = `cc-${safeId}`;
  const borderGrad = `cb-${safeId}`;
  const cPath      = cardPathD(NODE_W, NODE_H);

  // Initials avatar data
  const agentHue = nameHue(node.agent.name);
  const agentInitials = nameInitials(node.agent.name);

  // Name: split into max 2 lines, left-aligned
  const words = node.agent.name.trim().split(/\s+/);
  const singleLine = words.length === 1 || node.agent.name.length <= 10;
  const nameLine1 = words[0] || "";
  const nameLine2 = words.slice(1).join(" ");
  const nameY  = 39;                       // same gap from avatar for both layouts
  const subtitleY = singleLine ? 47 : 54; // role/specialty line

  // Subtitle: specialty preferred over role
  const rawSub = node.agent.specialty || node.agent.role || "";
  const subtitle = rawSub.replace(/_/g, " ");

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      data-node-id={node.id}
      data-node-group={node.group}
    >
      <g
        style={{
          animation: `nodeAppear 0.4s ease-out ${NODE_BASE_DELAY + index * NODE_STAGGER}s both`,
          transformOrigin: "0 0",
          cursor: "grab",
          willChange: "transform",
          ...(active ? { filter: `drop-shadow(0 0 8px ${activeColor}55)`, transform: "scale(1.04)" } : {}),
        } as React.CSSProperties}
        className="task-node"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <g transform={`translate(${-hw}, ${-hh})`}>
          <defs>
            {/* Home-button shimmer gradient */}
            {/* Body shimmer — top-to-bottom white wash */}
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor={shimmerColor} stopOpacity={isHighlighted ? 0.12 : 0.07} />
              <stop offset="45%"  stopColor={shimmerColor} stopOpacity="0.02" />
              <stop offset="100%" stopColor={shimmerColor} stopOpacity="0" />
            </linearGradient>

            {/*
              Border gradient — replicates home-button inset box-shadow:
                1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset  ← top-left bright
               -1px  -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset  ← bottom-right bright
              Direction: top-left → bottom-right (0%→100%)
              Both corners bright, middle dims — exact bevel/glass edge look.
            */}
            <linearGradient id={borderGrad} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={groupColor} stopOpacity={isHighlighted ? 0.95 : 0.75} />
              <stop offset="22%"  stopColor={groupColor} stopOpacity={isHighlighted ? 0.45 : 0.30} />
              <stop offset="78%"  stopColor={groupColor} stopOpacity={isHighlighted ? 0.45 : 0.30} />
              <stop offset="100%" stopColor={groupColor} stopOpacity={isHighlighted ? 0.90 : 0.70} />
            </linearGradient>

            <clipPath id={clipId}><path d={cPath} /></clipPath>
          </defs>

          {/* Glass card: semi-transparent fill + gradient border (= inset box-shadow) */}
          <path d={cPath} fill={cardFill} stroke={`url(#${borderGrad})`} strokeWidth={1.5} />

          {/* Body shimmer overlay */}
          <rect x={0} y={0} width={NODE_W} height={NODE_H}
            fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} style={{ pointerEvents: "none" }} />

          {/* Avatar */}
          {node.agent.avatar ? (
            <foreignObject x={8} y={7} width={22} height={22} style={{ overflow: "visible" }}>
              <Avatar style={{ width: 22, height: 22, borderRadius: "50%" }} {...node.agent.avatar as any} />
            </foreignObject>
          ) : (
            <>
              <circle cx={19} cy={18} r={11}
                fill={`hsl(${agentHue},55%,22%)`} stroke={`hsl(${agentHue},60%,40%)`} strokeWidth={1} />
              <text x={19} y={18} textAnchor="middle" dominantBaseline="central"
                fill={`hsl(${agentHue},80%,85%)`} fontSize={6.5} fontWeight={700} fontFamily="var(--font-sans)">
                {agentInitials}
              </text>
            </>
          )}

          {/* Agent name — left-aligned, below avatar */}
          {singleLine ? (
            <text x={9} y={nameY} textAnchor="start" dominantBaseline="central"
              fill="var(--color-text, var(--text))" fontSize={7.5} fontWeight={700}
              fontFamily="var(--font-sans, var(--font))"
            >{node.agent.name}</text>
          ) : (
            <text textAnchor="start" fill="var(--color-text, var(--text))"
              fontSize={7.5} fontWeight={700} fontFamily="var(--font-sans, var(--font))">
              <tspan x={9} y={nameY}>{nameLine1}</tspan>
              <tspan x={9} dy={7}>{nameLine2}</tspan>
            </text>
          )}

          {/* Role / Specialty subtitle */}
          {subtitle ? (
            <text x={9} y={subtitleY} textAnchor="start" dominantBaseline="central"
              fill="rgba(255,255,255,0.58)" fontSize={6}
              fontFamily="var(--font-sans, var(--font))"
            >{subtitle.length > 18 ? subtitle.slice(0, 17) + "…" : subtitle}</text>
          ) : null}

          {/* Info button — small, bottom-right */}
          <g data-info-btn="true"
            onClick={(e) => { e.stopPropagation(); onInfoToggle(node.id); }}
            style={{ cursor: "pointer" }}
          >
            <circle cx={NODE_W - 13} cy={NODE_H - 13} r={5}
              fill={infoOpen ? `${groupColor}20` : "rgba(255,255,255,0.04)"}
              stroke={infoOpen ? `${groupColor}55` : "rgba(255,255,255,0.1)"}
              strokeWidth={0.5}
            />
            <svg x={NODE_W - 13 - 2} y={NODE_H - 13 - 3.5} width={4} height={7} viewBox="0 0 499.26 1378.62">
              <path
                d="M464.33,1152.61c-129.44,156.15-275.31,226-359.55,226-67.8,0-104.78-61.64-71.91-205.46,39.04-164.37,86.29-341.06,117.11-478.71,14.38-59.58,12.33-78.07-6.16-78.07-20.55,0-67.8,28.76-113,67.8L0,618.43c137.66-133.55,283.53-201.35,359.55-201.35,69.86,0,86.29,63.69,41.09,254.77-30.82,127.38-76.02,304.08-106.84,431.46-14.38,51.36-14.38,80.13,2.05,80.13s67.8-28.76,133.55-96.56l34.93,65.75ZM499.26,125.33c0,82.18-61.64,160.26-152.04,160.26-73.96,0-125.33-47.26-125.33-127.38C221.89,88.35,277.37,0,382.15,0c80.13,0,117.11,57.53,117.11,125.33Z"
                fill={infoOpen ? groupColor : "rgba(255,255,255,0.28)"}
              />
            </svg>
          </g>
        </g>
      </g>
    </g>
  );
}

// ── Task Node Tooltip (pointer-events: none, toggle via info button) ──

function TaskNodeTooltip({ node, visible }: { node: LayoutNode; visible: boolean }) {
  const hh = NODE_H / 2;
  const groupColor = GROUP_COLORS[node.group] || "#818cf8";

  return (
    <g transform={`translate(${node.x}, ${node.y})`} style={{ pointerEvents: "none" }}>
      <foreignObject x={-110} y={hh + 8} width={220} height={180} style={{ opacity: visible ? 1 : 0, pointerEvents: "none", overflow: "visible", transition: "opacity 0.15s ease" }}>
        <div style={{
          background: "rgba(8,8,8,0.95)",
          border: `1px solid ${groupColor}33`,
          borderRadius: 12,
          padding: "12px 14px",
          fontFamily: "var(--font-sans, var(--font))",
          backdropFilter: "blur(12px)",
          width: 220,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", lineHeight: 1.35, wordBreak: "break-word", marginBottom: 2 }}>{node.title}</div>
          <div style={{ fontSize: 9, color: groupColor, fontWeight: 600, marginBottom: 2 }}>{node.agent.name}</div>
          {(node.agent.specialty || node.agent.role) && (
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
              {(node.agent.specialty || node.agent.role || "").replace(/_/g, " ")}
            </div>
          )}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 8px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {node.agent.tier && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>Tier</span>
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  {node.agent.tier === 1 ? "Junior" : node.agent.tier === 2 ? "Mid-Level" : node.agent.tier === 3 ? "Senior" : "Principal"}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>Agent ID</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500, fontFamily: "var(--font-mono, var(--font-mono))", fontSize: 8 }}>{node.agent.id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>Group</span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{node.group}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>Status</span>
              <span style={{ color: node.done ? "#4ade80" : "#fbbf24", fontWeight: 500 }}>{node.done ? "Done" : "Pending"}</span>
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

// ── Main Export ──

export function TaskGraph({
  tasks,
  ctoActive = false,
  revealedNodeIds = null,
  dispatchedTaskIds = null,
  onBBox,
  onNodeDrag,
  activeNodeId = null,
  onNodeSelect,
  teamAgents = null,
  isPaused = false,
}: {
  tasks: Task[];
  ctoActive?: boolean;
  revealedNodeIds?: Set<string> | null;   // null = show all
  dispatchedTaskIds?: Set<string> | null;  // null = all dispatched
  onBBox?: (bbox: { x: number; y: number; w: number; h: number }) => void;
  onNodeDrag?: React.MutableRefObject<((id: string, startX: number, startY: number) => void) | null>;
  activeNodeId?: string | null;
  onNodeSelect?: (nodeId: string, group: string) => void;
  teamAgents?: Record<string, { id: string; name: string; role?: string; specialty?: string; tier?: number; avatar?: Record<string, string> }> | null;
  isPaused?: boolean;
}) {
  const initialLayout = useMemo(() => computeGroupLayout(tasks, teamAgents ?? null), [tasks, teamAgents]);

  // Find the PM agent from teamAgents
  const pmAgent = useMemo(() => {
    if (!teamAgents) return null;
    return Object.values(teamAgents).find((a) => {
      const r = (a.role || "").toLowerCase();
      return r === "pm" || r === "product manager" || r === "product_manager";
    }) || null;
  }, [teamAgents]);

  // Whether we're in animated reveal mode (progressive) or show-all mode
  const isAnimating = revealedNodeIds !== null;

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const [infoId, setInfoId] = useState<string | null>(null);
  const toggleInfo = useCallback((id: string) => {
    setInfoId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => { setPositions({}); }, [tasks]);
  useEffect(() => { onBBox?.(initialLayout.bbox); }, [initialLayout.bbox, onBBox]);

  const currentNodes = useMemo(() => {
    return initialLayout.nodes.map((n) => {
      const pos = positions[n.id];
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    });
  }, [initialLayout.nodes, positions]);

  // Filter to only revealed nodes
  const visibleNodes = useMemo(() => {
    if (!revealedNodeIds) return currentNodes;
    return currentNodes.filter((n) => revealedNodeIds.has(n.id));
  }, [currentNodes, revealedNodeIds]);

  // Filter edges: both endpoints must be revealed
  const visibleEdges = useMemo(() => {
    if (!revealedNodeIds) return initialLayout.edges;
    return initialLayout.edges.filter(
      (e) => revealedNodeIds.has(e.fromId) && revealedNodeIds.has(e.toId),
    );
  }, [initialLayout.edges, revealedNodeIds]);

  const currentNodesRef = useRef(currentNodes);
  useEffect(() => { currentNodesRef.current = currentNodes; }, [currentNodes]);

  const nodeMap = useMemo(
    () => new Map(currentNodes.map((n) => [n.id, n])),
    [currentNodes],
  );

  const ports = useMemo(
    () => computePortAssignments(visibleEdges, nodeMap),
    [visibleEdges, nodeMap],
  );

  // ── Drag handler with snap-to-align ──
  const handleNodeDrag = useCallback((id: string, startX: number, startY: number) => {
    const nodes = currentNodesRef.current;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const snapTargets = nodes.filter((n) => n.id !== id).map((n) => ({ x: n.x, y: n.y }));
    snapTargets.push({ x: 0, y: 0 });

    dragRef.current = { id, startX, startY, origX: node.x, origY: node.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      ev.preventDefault();
      const { id: dragId, startX: sx, startY: sy, origX, origY } = dragRef.current;

      const svg = (ev.target as Element)?.closest?.("svg");
      const container = svg?.parentElement;
      const zoom = container ? parseFloat(container.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || "1") : 1;

      let nx = origX + (ev.clientX - sx) / zoom;
      let ny = origY + (ev.clientY - sy) / zoom;

      const guides: SnapGuide[] = [];
      for (const target of snapTargets) {
        if (Math.abs(nx - target.x) < SNAP_THRESHOLD) {
          nx = target.x;
          guides.push({ axis: "x", value: target.x, from: Math.min(ny, target.y) - 20, to: Math.max(ny, target.y) + 20 });
        }
        if (Math.abs(ny - target.y) < SNAP_THRESHOLD) {
          ny = target.y;
          guides.push({ axis: "y", value: target.y, from: Math.min(nx, target.x) - 20, to: Math.max(nx, target.x) + 20 });
        }
      }

      setPositions((prev) => ({ ...prev, [dragId]: { x: nx, y: ny } }));
      setSnapGuides(guides);
    };

    const onUp = () => {
      dragRef.current = null;
      setSnapGuides([]);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    if (onNodeDrag) onNodeDrag.current = handleNodeDrag;
    return () => { if (onNodeDrag) onNodeDrag.current = null; };
  }, [handleNodeDrag, onNodeDrag]);

  if (tasks.length === 0 && !ctoActive) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-text-muted">No tasks yet.</span>
      </div>
    );
  }

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible", userSelect: "none" }}>
      <defs>
        <filter id="beam-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Layer 1: Lines + beams + dots (painted first = behind nodes) ── */}
      <g>
        {visibleNodes.map((n) => {
          const isDispatched = dispatchedTaskIds === null || dispatchedTaskIds.has(n.id);
          return (
            <CTONodeEdge
              key={`cto-${n.id}`}
              node={n}
              dispatched={isDispatched}
              done={n.done}
              paused={isPaused}
            />
          );
        })}

        {visibleEdges.map((e, i) => (
          <TaskEdgeLine key={`edge-${i}`} edge={e} ports={ports} animated={isAnimating} nodeMap={nodeMap} edgeIndex={i} nodeCount={visibleNodes.length} />
        ))}

        {visibleEdges.map((e, i) => (
          <TaskEdgeDots key={`dots-${i}`} edge={e} ports={ports} nodeMap={nodeMap} animated={isAnimating} edgeIndex={i} nodeCount={visibleNodes.length} />
        ))}
      </g>

      {/* ── Layer 2: CTO + nodes + tooltips (painted last = on top) ── */}
      <g>
        <g transform={`translate(0, ${CTO_Y})`}>
          <CTONode ctoActive={ctoActive} taskCount={tasks.length} animated={isAnimating} pmAgent={pmAgent} />
        </g>

        {visibleNodes.map((n, i) => (
          <TaskNodeCard key={n.id} node={n} index={i} infoOpen={infoId === n.id} onInfoToggle={toggleInfo} active={activeNodeId === n.id} onSelect={onNodeSelect} />
        ))}

        {snapGuides.map((g, i) =>
          g.axis === "x" ? (
            <line key={`guide-${i}`} x1={g.value} y1={g.from} x2={g.value} y2={g.to} stroke="#4ade80" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.6} />
          ) : (
            <line key={`guide-${i}`} x1={g.from} y1={g.value} x2={g.to} y2={g.value} stroke="#4ade80" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.6} />
          ),
        )}

        {visibleNodes.map((n) => (
          <TaskNodeTooltip key={`tip-${n.id}`} node={n} visible={infoId === n.id} />
        ))}
      </g>
    </svg>
  );
}
