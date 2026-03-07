import { useState } from "react";

interface Props {
  onSuccess: (user: any, accessToken: string) => void;
}

export function SignupForm({ onSuccess }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, orgName: orgName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      onSuccess(data.user, data.accessToken);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--text)", fontSize: 14, boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Full Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Smith" style={inputStyle} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Organization name <span style={{ opacity: 0.5 }}>(optional)</span></label>
        <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="ACME Corp" style={inputStyle} />
      </div>
      {error && <p style={{ color: "var(--danger, #ef4444)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "10px 0", background: "var(--accent)", color: "var(--color-accent-text)", border: "none",
          borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
