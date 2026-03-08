import Avatar from "react-nice-avatar";
import { Icon, icons } from "@/lib/icons";
import { IconBtn } from "@/components/shared/IconBtn";

function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}

interface RoleCardProps {
  role: {
    roleId: string;
    title: string;
    tier?: string;
    specialties?: string[];
    agentId?: string;
    agentName?: string;
    agent_tier?: number;
    status?: string;
    avatar?: Record<string, string>;
  };
  onSwap?: () => void;
  onRemove?: () => void;
}

const TIER_COLORS: Record<number, string> = {
  1: "#4ade80",
  2: "#60a5fa",
  3: "#a78bfa",
  4: "#f472b6",
};

export function RoleCard({ role, onSwap, onRemove }: RoleCardProps) {
  const isUnassigned = !role.agentName || role.status === "unassigned";
  const tierNum = role.agent_tier || parseInt(role.tier || "0", 10) || 0;
  const tierColor = TIER_COLORS[tierNum] || "var(--color-text-muted)";
  const name = role.agentName || role.roleId || "?";
  const hue = nameHue(name);
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex flex-col gap-2 px-3 py-2.5 rounded-xl border transition-all group"
      style={{
        background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
      }}
    >
      {/* Row 1: Avatar + Full Name + actions */}
      <div className="flex items-center gap-3">
        {isUnassigned ? (
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold select-none"
            style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)", border: "1.5px dashed var(--color-border)" }}
          >
            ?
          </div>
        ) : role.avatar ? (
          <Avatar style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} {...role.avatar as any} />
        ) : (
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold select-none"
            style={{
              background: `hsl(${hue},55%,22%)`,
              border: `1.5px solid hsl(${hue},60%,38%)`,
              color: `hsl(${hue},80%,85%)`,
              fontSize: 13,
              letterSpacing: "0.02em",
            }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {role.agentName ? (
            <span className="text-sm font-semibold text-text block leading-tight">{role.agentName}</span>
          ) : (
            <span className="text-sm font-semibold block leading-tight text-text-muted">Pending</span>
          )}
        </div>
        {/* Hover actions */}
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onSwap && (
            <IconBtn onClick={onSwap} size={24} title="Swap agent" style={{ color: "rgba(255,255,255,0.5)", borderRadius: 8 }}>
              <Icon d={icons.refresh} size={10} />
            </IconBtn>
          )}
          {onRemove && (
            <IconBtn onClick={onRemove} size={24} title="Remove role" style={{ color: "rgba(255,255,255,0.5)", borderRadius: 8 }}>
              <Icon d={icons.x} size={10} />
            </IconBtn>
          )}
        </div>
      </div>

      {/* Row 2: Role title + tier */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted">{role.title}</span>
        {tierNum > 0 && (
          <span
            className="text-[9px] px-1.5 py-px rounded-full font-semibold shrink-0"
            style={{ backgroundColor: `${tierColor}18`, color: tierColor }}
          >
            T{tierNum}
          </span>
        )}
      </div>

      {/* Row 3: Specialties */}
      {role.specialties && role.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {role.specialties.slice(0, 3).map((s) => (
            <span
              key={s}
              className="px-1.5 py-0.5 rounded text-[9px] font-medium"
              style={{ backgroundColor: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
