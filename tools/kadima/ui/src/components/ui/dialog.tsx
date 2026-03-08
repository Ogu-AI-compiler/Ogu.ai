import * as React from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function Dialog({ open, onClose, children, className }: DialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn("bg-bg-card border border-border rounded-lg p-6 flex flex-col gap-4", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-1", className)}>{children}</div>;
}

function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-base font-semibold text-text", className)}>{children}</h2>;
}

function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-text-muted", className)}>{children}</p>;
}

function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex gap-3 justify-end", className)}>{children}</div>;
}

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
