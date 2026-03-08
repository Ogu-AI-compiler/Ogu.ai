import { useState } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";

export function AuthView() {
  const setAuth = useStore((s) => s.setAuth);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const res = await api.login({ email, password });
        setAuth(res.user, res.accessToken);
      } else {
        const res = await api.register({ email, password, name });
        setAuth(res.user, res.accessToken);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-bg items-center justify-center">
      <div className="w-[380px] p-8 rounded-2xl border border-border bg-bg-card">
        <h2 className="text-xl font-semibold text-text mb-6 text-center">
          {mode === "login" ? "Sign In" : "Create Account"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="px-3 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text placeholder:text-text-muted outline-none focus:border-accent"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="px-3 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text placeholder:text-text-muted outline-none focus:border-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="px-3 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text placeholder:text-text-muted outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 text-xs text-text-muted hover:text-text cursor-pointer w-full text-center"
          style={{ background: "none", border: "none" }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
