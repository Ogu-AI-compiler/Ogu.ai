import { useCommand } from "@/hooks/useCommand";
import { ActionButton } from "./ActionButton";

interface PhaseAction {
  label: string;
  command: string;
  args?: string[];
}

interface PhaseActionBarProps {
  actions: PhaseAction[];
}

export function PhaseActionBar({ actions }: PhaseActionBarProps) {
  const cmd = useCommand();

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actions.map((action) => (
        <ActionButton
          key={action.command + (action.args?.join(",") || "")}
          label={cmd.loading ? "..." : action.label}
          variant="ghost"
          size="sm"
          onAction={() => cmd.runSync(action.command, action.args || [])}
        />
      ))}
      {cmd.exitCode !== null && cmd.exitCode !== 0 && (
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--color-error)" }}
        >
          failed
        </span>
      )}
    </div>
  );
}
