import { useState } from "react";

interface Props {
  onSuccess: (user: any, accessToken: string) => void;
}

export function LoginForm({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onSuccess(data.user, data.accessToken);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          style={{
            width: "100%", padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text)", fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          style={{
            width: "100%", padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text)", fontSize: 14, boxSizing: "border-box",
          }}
        />
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
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
