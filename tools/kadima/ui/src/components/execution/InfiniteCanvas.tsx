import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

// ── Constants ──

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.03;
const AUTO_FIT_MAX = 0.85;
const DOT_SPACING = 24;
const DOT_R = 0.8;

// ── Component ──

interface Props {
  children: ReactNode;
  nodesBBox?: { x: number; y: number; w: number; h: number } | null;
  onNodeDrag?: React.MutableRefObject<((id: string, startX: number, startY: number) => void) | null>;
  onNodeClick?: (nodeId: string, group: string) => void;
  rightInset?: number;
}

export function InfiniteCanvas({ children, nodesBBox, onNodeDrag, onNodeClick, rightInset = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const lastFitBBox = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const nodeClickRef = useRef<{ nodeId: string; group: string; startX: number; startY: number } | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Keep refs in sync so the wheel handler always reads fresh values
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Auto-fit when bbox becomes available or changes significantly — retry until container is sized
  useEffect(() => {
    if (!nodesBBox) return;

    // Skip if we already fit to this exact bbox
    const last = lastFitBBox.current;
    if (last && Math.abs(last.w - nodesBBox.w) < 1 && Math.abs(last.h - nodesBBox.h) < 1) return;

    const doFit = () => {
      if (!containerRef.current) return false;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return false; // DOM not ready yet

      lastFitBBox.current = nodesBBox;
      const availW = rect.width - rightInset;
      const padded = 40;
      const scaleX = (availW - padded * 2) / Math.max(nodesBBox.w, 1);
      const scaleY = (rect.height - padded * 2) / Math.max(nodesBBox.h, 1);
      const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), AUTO_FIT_MAX);
      const cx = nodesBBox.x + nodesBBox.w / 2;
      const cy = nodesBBox.y + nodesBBox.h / 2;
      setPan({ x: availW / 2 - cx * newZoom, y: rect.height * 0.45 - cy * newZoom });
      setZoom(newZoom);
      return true;
    };

    if (!doFit()) {
      // Retry after layout — rAF ensures DOM has been painted
      const id = requestAnimationFrame(() => {
        if (!doFit()) {
          // Second retry after 100ms for slow layouts
          const t = setTimeout(doFit, 100);
          return () => clearTimeout(t);
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [nodesBBox, rightInset]);

  // ── Wheel → zoom (non-passive to actually prevent browser zoom) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prev = zoomRef.current;
      const p = panRef.current;

      const direction = e.deltaY > 0 ? -1 : 1;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + direction * ZOOM_STEP));
      const scale = next / prev;

      // Zoom centered on cursor position
      const newPan = {
        x: mouseX - (mouseX - p.x) * scale,
        y: mouseY - (mouseY - p.y) * scale,
      };

      setZoom(next);
      setPan(newPan);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag → pan (native listeners so node stopPropagation works) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: globalThis.MouseEvent) => {
      if (e.button !== 0) return;

      // Walk up from click target to detect interactive elements
      let t = e.target as Element | null;
      while (t && t !== el) {
        // Interactive elements — let their native/React handlers fire, don't pan
        const tag = t.tagName;
        if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        // Info button — let React onClick handle it, don't pan or drag
        if (t.hasAttribute?.("data-info-btn")) return;
        // Draggable node — delegate to TaskGraph's drag handler + track for click
        const nodeId = t.getAttribute?.("data-node-id");
        if (nodeId) {
          const group = t.getAttribute?.("data-node-group");
          if (group) nodeClickRef.current = { nodeId, group, startX: e.clientX, startY: e.clientY };
          onNodeDrag?.current?.(nodeId, e.clientX, e.clientY);
          return;
        }
        t = t.parentElement;
      }

      // No node found — start canvas pan
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
      setDragging(true);
    };

    const onMove = (e: globalThis.MouseEvent) => {
      if (!dragRef.current) return;
      setPan({
        x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
      });
    };

    const onUp = (e: globalThis.MouseEvent) => {
      // Detect node click (mousedown+mouseup without movement)
      if (nodeClickRef.current) {
        const dx = e.clientX - nodeClickRef.current.startX;
        const dy = e.clientY - nodeClickRef.current.startY;
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
          onNodeClickRef.current?.(nodeClickRef.current.nodeId, nodeClickRef.current.group);
        }
        nodeClickRef.current = null;
      }
      dragRef.current = null;
      setDragging(false);
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Zoom controls (centered on visible canvas center) ──
  const zoomIn = useCallback(() => {
    if (!containerRef.current) { setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP * 2)); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (rect.width - rightInset) / 2;
    const cy = rect.height / 2;
    const prev = zoomRef.current;
    const p = panRef.current;
    const next = Math.min(MAX_ZOOM, prev + ZOOM_STEP * 2);
    const scale = next / prev;
    setPan({ x: cx - (cx - p.x) * scale, y: cy - (cy - p.y) * scale });
    setZoom(next);
  }, [rightInset]);

  const zoomOut = useCallback(() => {
    if (!containerRef.current) { setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP * 2)); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (rect.width - rightInset) / 2;
    const cy = rect.height / 2;
    const prev = zoomRef.current;
    const p = panRef.current;
    const next = Math.max(MIN_ZOOM, prev - ZOOM_STEP * 2);
    const scale = next / prev;
    setPan({ x: cx - (cx - p.x) * scale, y: cy - (cy - p.y) * scale });
    setZoom(next);
  }, [rightInset]);

  const fitAll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const availW = rect.width - rightInset;

    if (!nodesBBox) {
      setZoom(1);
      setPan({ x: availW / 2, y: rect.height / 2 });
      return;
    }

    const padded = 40;
    const scaleX = (availW - padded * 2) / Math.max(nodesBBox.w, 1);
    const scaleY = (rect.height - padded * 2) / Math.max(nodesBBox.h, 1);
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), AUTO_FIT_MAX);

    const cx = nodesBBox.x + nodesBBox.w / 2;
    const cy = nodesBBox.y + nodesBBox.h / 2;

    setPan({
      x: availW / 2 - cx * newZoom,
      y: rect.height * 0.45 - cy * newZoom,
    });
    setZoom(newZoom);
  }, [nodesBBox, rightInset]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        cursor: dragging ? "grabbing" : "grab",
        backgroundColor: "var(--color-bg, var(--bg))",
        touchAction: "none",
      }}
    >
      {/* Dot grid background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <pattern
            id="dot-grid"
            x={pan.x % (DOT_SPACING * zoom)}
            y={pan.y % (DOT_SPACING * zoom)}
            width={DOT_SPACING * zoom}
            height={DOT_SPACING * zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={DOT_SPACING * zoom / 2}
              cy={DOT_SPACING * zoom / 2}
              r={DOT_R}
              fill="var(--color-text-muted, var(--text-muted))"
              opacity={0.22}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* Transformed content */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          zIndex: 1,
        }}
      >
        {children}
      </div>

      {/* Zoom controls (top-left, below pills, horizontal) */}
      <div
        className="absolute flex items-center gap-1.5 z-10"
        style={{ top: 52, left: 16 }}
      >
        {[
          { onClick: fitAll, title: "Fit all", icon: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /> },
          { onClick: zoomIn, title: "Zoom in", icon: <path d="M12 5v14M5 12h14" /> },
          { onClick: zoomOut, title: "Zoom out", icon: <path d="M5 12h14" /> },
        ].map(({ onClick, title, icon }) => (
          <button
            key={title}
            onClick={onClick}
            title={title}
            style={{
              width: 28, height: 28, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(0,0,0,0.05)",
              boxShadow: "rgba(255,255,255,0.04) -8px -6px 4px -8px inset, rgba(255,255,255,0.06) 6px 6px 4px -5px inset",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer",
              transition: "box-shadow 0.15s, background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "rgba(255,255,255,0.4) -8px -6px 4px -8px inset, rgba(255,255,255,0.45) 6px 6px 4px -5px inset";
              e.currentTarget.style.background = "rgba(90,90,90,0.4)";
              e.currentTarget.style.color = "rgba(255,255,255,0.85)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "rgba(255,255,255,0.04) -8px -6px 4px -8px inset, rgba(255,255,255,0.06) 6px 6px 4px -5px inset";
              e.currentTarget.style.background = "rgba(0,0,0,0.05)";
              e.currentTarget.style.color = "rgba(255,255,255,0.35)";
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              {icon}
            </svg>
          </button>
        ))}
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500, marginLeft: 2 }}>
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
