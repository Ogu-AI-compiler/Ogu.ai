import { useStore } from "@/store";
import { RoleCard } from "./RoleCard";
import { ComplexityBadge } from "./ComplexityBadge";
import { Icon, icons } from "@/lib/icons";

interface TeamMember {
  roleId: string;
  title: string;
  tier?: string;
  specialties?: string[];
  agentId?: string;
  agentName?: string;
  agent_tier?: number;
  status?: string;
  role_display?: string;
  avatar?: Record<string, string>;
}

interface TeamProposalProps {
  team: {
    roles?: TeamMember[];
    members?: TeamMember[];
    complexity?: string;
    complexity_tier?: string;
    workFramework?: { approach?: string; phases?: string[] };
    taskCount?: number;
  };
  onApprove: () => void;
  onModify?: () => void;
  approving: boolean;
}

export function TeamProposal({ team, onApprove, approving }: TeamProposalProps) {
  const setRoute = useStore((s) => s.setRoute);
  // Support both team.roles (CTO format) and team.members (team-assembler format)
  const roles: TeamMember[] = (team.members || team.roles || []).map((m: any) => ({
    roleId: m.role_id || m.roleId || "",
    title: m.role_display || m.title || m.role_id || m.roleId || "",
    tier: m.tier || m.agent_tier,
    specialties: m.specialties || (m.agent_specialty ? [m.agent_specialty] : []),
    agentId: m.agent_id || m.agentId,
    agentName: m.agent_name || m.agentName,
    agent_tier: m.agent_tier,
    status: m.status,
    avatar: m.avatar || undefined,
  }));

  const complexity = team.complexity_tier || team.complexity || "medium";
  const assigned = roles.filter((r) => r.agentName && r.status !== "unassigned").length;

  return (
    <div className="flex flex-col gap-5 stage-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-text">Team Proposal</h3>
          <ComplexityBadge tier={complexity} />
        </div>
        <span className="text-xs text-text-muted">
          {assigned}/{roles.length} assigned
        </span>
      </div>

      {/* Work framework */}
      {team.workFramework && (
        <div className="px-4 py-3 rounded-xl border border-border bg-bg-card">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Work Framework</span>
          {team.workFramework.approach && (
            <p className="text-sm text-text mt-1">{team.workFramework.approach}</p>
          )}
          {team.workFramework.phases && team.workFramework.phases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {team.workFramework.phases.map((phase, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                >
                  <span style={{ color: "var(--color-accent)" }}>{i + 1}</span>
                  {phase}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {roles.map((role, i) => (
          <RoleCard
            key={role.roleId + i}
            role={role}
            onSwap={() => setRoute("/marketplace")}
            onRemove={roles.length > 1 ? () => {} : undefined}
          />
        ))}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => setRoute("/marketplace")}
          className="group flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
          style={{
            background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--color-text-muted)",
            boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "var(--color-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          <span className="transition-transform duration-200 group-hover:rotate-90"><Icon d={icons.plus} size={13} /></span>
          Add Role
        </button>
        <button
          onClick={onApprove}
          disabled={approving}
          className="group flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(99,241,157,0.12)"; e.currentTarget.style.borderColor = "rgba(99,241,157,0.55)"; e.currentTarget.style.boxShadow = "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 20px rgba(99,241,157,0.18)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "rgba(99,241,157,0.35)"; e.currentTarget.style.boxShadow = "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 12px rgba(99,241,157,0.1)"; }}
          style={{
            background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)",
            border: "1px solid rgba(99,241,157,0.35)",
            color: "var(--color-text)",
            boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 12px rgba(99,241,157,0.1)",
          }}
        >
          {approving ? (
            <>
              <Icon d={icons.loader} size={14} style={{ animation: "spin 1s linear infinite" }} />
              Starting build...
            </>
          ) : (
            <>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5"><Icon d={icons.play} size={14} /></span>
              Approve Team & Start Build
            </>
          )}
        </button>
      </div>
    </div>
  );
}
