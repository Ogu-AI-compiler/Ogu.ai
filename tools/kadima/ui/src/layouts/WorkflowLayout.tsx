import { PipelineSidebar } from "@/components/sidebar/PipelineSidebar";
import { SecondaryNav } from "@/components/sidebar/SecondaryNav";

interface WorkflowLayoutProps {
  children: React.ReactNode;
}

export function WorkflowLayout({ children }: WorkflowLayoutProps) {
  return (
    <div className="flex h-screen w-screen" style={{ background: "#080808", position: "relative", overflow: "hidden" }}>
      {/* Animated mesh gradient */}
      <div className="mesh-bg" />
      {/* Noise texture */}
      <div className="noise-overlay" />
      {/* Sidebar — glass panel matching right panel design */}
      <div
        className="w-[220px] shrink-0 flex flex-col"
        style={{
          position: "relative",
          zIndex: 2,
          background: "transparent",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.08) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.08) inset",
          borderRight: "1px solid transparent",
          borderImage: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.14) 100%) 1",
        }}
      >
        <PipelineSidebar />
        <SecondaryNav />
      </div>
      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
