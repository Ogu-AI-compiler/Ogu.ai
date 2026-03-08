import { Icon, icons } from "@/lib/icons";

export function SettingsView() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--color-accent-soft)" }}
        >
          <Icon d={icons.settings} size={16} stroke="var(--color-accent)" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text">Settings</h2>
          <p className="text-xs text-text-muted">Configuration and preferences</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-muted">Settings panel coming soon.</p>
      </div>
    </div>
  );
}
