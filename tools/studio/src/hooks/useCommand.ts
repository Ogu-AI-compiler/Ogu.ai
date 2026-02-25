import { useState, useCallback } from "react";

interface CommandResult {
  loading: boolean;
  output: string[];
  exitCode: number | null;
  jobId: string | null;
}

export function useCommand() {
  const [state, setState] = useState<CommandResult>({
    loading: false,
    output: [],
    exitCode: null,
    jobId: null,
  });

  const runSync = useCallback(async (command: string, args: string[] = []) => {
    setState({ loading: true, output: [], exitCode: null, jobId: null });
    try {
      const res = await fetch("/api/command/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, args }),
      });
      const data = await res.json();
      const lines = data.stdout ? data.stdout.split("\n") : [];
      setState({ loading: false, output: lines, exitCode: data.exitCode, jobId: null });
      return data;
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, exitCode: 1, output: [err.message] }));
      return { exitCode: 1, stdout: err.message };
    }
  }, []);

  const runAsync = useCallback(async (command: string, args: string[] = []) => {
    setState({ loading: true, output: [], exitCode: null, jobId: null });
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, args }),
      });
      const data = await res.json();
      setState((s) => ({ ...s, jobId: data.jobId }));
      return data.jobId;
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, exitCode: 1 }));
      return null;
    }
  }, []);

  const appendOutput = useCallback((line: string) => {
    setState((s) => ({ ...s, output: [...s.output, line] }));
  }, []);

  const setComplete = useCallback((exitCode: number) => {
    setState((s) => ({ ...s, loading: false, exitCode }));
  }, []);

  return { ...state, runSync, runAsync, appendOutput, setComplete };
}
