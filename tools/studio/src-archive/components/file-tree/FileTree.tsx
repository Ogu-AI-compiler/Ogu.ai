import { useFileTree, type TreeNode } from "@/hooks/useFileTree";
import { Icon, icons } from "@/lib/icons";

/* ── File tree panel (right side of split pane) ── */

export function FileTreePanel() {
  const { tree, loading, refresh, expanded, toggle } = useFileTree();

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      backgroundColor: "var(--bg-card)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <span style={{
          color: "var(--text-muted)", fontFamily: "var(--font)",
          fontSize: 12, fontWeight: 600,
        }}>
          PROJECT FILES
        </span>
        <button
          onClick={refresh}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontFamily: "var(--font)", fontSize: 12,
            padding: "2px 6px", borderRadius: 4,
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
          onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Tree */}
      <div style={{
        flex: 1, overflow: "auto", padding: "8px 0",
      }}>
        {loading ? (
          <div style={{
            color: "var(--text-muted)", fontFamily: "var(--font)",
            fontSize: 12, padding: "8px 12px",
          }}>
            Loading...
          </div>
        ) : tree?.children ? (
          tree.children.map((node) => (
            <TreeNodeRow
              key={node.name}
              node={node}
              path={node.name}
              depth={0}
              expanded={expanded}
              toggle={toggle}
            />
          ))
        ) : (
          <div style={{
            color: "var(--text-muted)", fontFamily: "var(--font)",
            fontSize: 12, padding: "8px 12px",
          }}>
            No files
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Recursive tree node ── */

function TreeNodeRow({
  node, path, depth, expanded, toggle,
}: {
  node: TreeNode;
  path: string;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
}) {
  const isDir = node.type === "dir";
  const isOpen = expanded.has(path);

  return (
    <>
      <div
        onClick={() => isDir && toggle(path)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "2px 12px 2px " + (12 + depth * 16) + "px",
          cursor: isDir ? "pointer" : "default",
          fontFamily: "var(--font)",
          fontSize: 12,
          lineHeight: "22px",
          color: isDir ? "var(--text)" : "var(--text-secondary)",
          userSelect: "none",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-hover)")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        {isDir ? (
          <span style={{ width: 14, color: "var(--text-muted)", fontSize: 10, display: "flex", alignItems: "center", flexShrink: 0 }}>
            {isOpen ? "▾" : "▸"}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={{ color: isDir ? "var(--accent)" : "var(--text-secondary)", display: "flex", alignItems: "center", flexShrink: 0 }}>
          {fileIcon(node.name, isDir)}
        </span>
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {node.name}
        </span>
      </div>

      {isDir && isOpen && node.children?.map((child) => (
        <TreeNodeRow
          key={child.name}
          node={child}
          path={path + "/" + child.name}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
        />
      ))}
    </>
  );
}

/* ── Simple file icons ── */

function fileIcon(name: string, isDir: boolean): React.ReactNode {
  if (isDir) return <Icon d={icons.folder} size={14} />;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    ts: icons.fileCode, tsx: icons.fileCode, js: icons.fileCode, jsx: icons.fileCode, mjs: icons.fileCode,
    json: icons.json, md: icons.fileText, html: icons.globe, css: icons.palette,
    png: icons.image, jpg: icons.image, svg: icons.image,
    sh: icons.settings,
  };
  return <Icon d={iconMap[ext] || icons.file} size={14} />;
}
