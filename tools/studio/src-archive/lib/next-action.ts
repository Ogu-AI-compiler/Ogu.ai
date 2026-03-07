export interface NextAction {
  label: string;
  description: string;
  type: "navigate" | "command" | "create-feature";
  command?: string;
  route?: string;
}

const PHASE_ACTIONS: Record<string, NextAction> = {
  discovery: {
    label: "Create Feature",
    description: "Define a new feature with /feature",
    type: "command",
    command: "/feature",
  },
  idea: {
    label: "Create Feature",
    description: "Turn this idea into a feature spec",
    type: "command",
    command: "/feature",
  },
  feature: {
    label: "Run Architect",
    description: "Generate Spec, Plan, and IR",
    type: "command",
    command: "/architect",
  },
  architect: {
    label: "Run Preflight",
    description: "Check health before building",
    type: "command",
    command: "/preflight",
  },
  ready: {
    label: "Start Build",
    description: "Begin task-by-task implementation",
    type: "command",
    command: "/build",
  },
  preflight: {
    label: "Start Build",
    description: "Preflight passed — begin building",
    type: "command",
    command: "/build",
  },
  build: {
    label: "View Pipeline",
    description: "Monitor build progress and DAG",
    type: "navigate",
    route: "/pipeline",
  },
  gates: {
    label: "Run Compile",
    description: "Run all 14 completion gates",
    type: "command",
    command: "/done",
  },
  done: {
    label: "New Feature",
    description: "Feature complete — start the next one",
    type: "create-feature",
    command: "/feature",
  },
};

export function getNextAction(
  activeFeature: string | null,
  phase: string,
  _gateState: any,
  pendingApprovals: number,
): NextAction {
  if (pendingApprovals > 0) {
    return {
      label: `${pendingApprovals} Pending Approvals`,
      description: "Review and approve pending governance items",
      type: "navigate",
      route: "/settings",
    };
  }

  if (!activeFeature) {
    return {
      label: "Create Feature",
      description: "No active feature — create one to get started",
      type: "create-feature",
      command: "/feature",
    };
  }

  return PHASE_ACTIONS[phase] || PHASE_ACTIONS.discovery;
}
