import { cn } from "@/lib/cn";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-bg p-1 border border-border w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
            active === tab.key
              ? "bg-bg-card text-text shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
