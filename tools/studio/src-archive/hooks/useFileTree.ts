import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "./useSocket";

export interface TreeNode {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: TreeNode[];
}

export function useFileTree() {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const { on } = useSocket();
  const mountedRef = useRef(true);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/files?depth=4");
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current) {
        setTree(data);
        setLoading(false);
      }
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchTree();
    return () => { mountedRef.current = false; };
  }, [fetchTree]);

  // Re-fetch on file changes via WebSocket
  useEffect(() => {
    return on("files:changed", () => {
      fetchTree();
    });
  }, [on, fetchTree]);

  // Poll every 5s as fallback (watcher may not cover new project dirs)
  useEffect(() => {
    const interval = setInterval(fetchTree, 5000);
    return () => clearInterval(interval);
  }, [fetchTree]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return { tree, loading, refresh: fetchTree, expanded, toggle };
}
