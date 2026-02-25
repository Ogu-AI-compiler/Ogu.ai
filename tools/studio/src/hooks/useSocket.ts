import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";

type Handler = (event: any) => void;

export function useSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const setGateState = useStore((s) => s.setGateState);
  const setThemeData = useStore((s) => s.setThemeData);

  useEffect(() => {
    function connect() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);

      ws.onopen = () => { wsRef.current = ws; };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          // Built-in handlers
          if (event.type === "state:changed" && event.file === "GATE_STATE.json") {
            setGateState(event.data);
          }
          if (event.type === "theme:changed") {
            setThemeData(event.themeData);
          }
          // Custom handlers
          const handlers = handlersRef.current.get(event.type);
          if (handlers) handlers.forEach((h) => h(event));
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setTimeout(connect, 2000); // auto-reconnect
      };

      return ws;
    }

    const ws = connect();
    return () => { ws.close(); };
  }, []);

  const on = useCallback((type: string, handler: Handler) => {
    if (!handlersRef.current.has(type)) handlersRef.current.set(type, new Set());
    handlersRef.current.get(type)!.add(handler);
    return () => { handlersRef.current.get(type)?.delete(handler); };
  }, []);

  return { on };
}
