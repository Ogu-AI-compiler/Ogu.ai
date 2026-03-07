import { useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (slug: string) => void;
}

export function CreateDialog({ open, onClose, onCreate }: Props) {
  const [slug, setSlug] = useState("");

  if (!open) return null;

  const handleCreate = () => {
    const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (s) { onCreate(s); setSlug(""); onClose(); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#1a1a2e",
          borderRadius: 12,
          padding: 28,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.08)",
          gap: 20,
          width: 420,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700 }}>New Feature</span>
        <Input
          placeholder="feature-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
          style={{
            backgroundColor: "rgba(15,15,23,0.8)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              borderRadius: 8,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 12,
              paddingBottom: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "none",
              color: "#b3b3b3",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={{
              borderRadius: 8,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 12,
              paddingBottom: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              backgroundColor: "#d4d4d4",
              border: "none",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
