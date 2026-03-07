import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { useStore } from "@/lib/store";

export function Auth() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const setAuth = useStore((s) => s.setAuth);

  function handleSuccess(user: any, accessToken: string) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("ogu-access-token", accessToken);
    }
    setAuth(user, accessToken);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 0", background: active ? "var(--bg-card)" : "transparent",
    border: "none", borderRadius: active ? 6 : 0, color: active ? "var(--text)" : "var(--text-muted)",
    fontWeight: active ? 600 : 400, fontSize: 14, cursor: "pointer", transition: "all 0.15s",
  });

  return (
    <div
      style={{
        minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: 380, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
          padding: "32px 28px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)", letterSpacing: "-1px" }}>Ogu</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>AI Organization as a Service</div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 4, marginBottom: 24, gap: 4 }}>
          <button style={tabStyle(tab === "login")} onClick={() => setTab("login")}>Sign in</button>
          <button style={tabStyle(tab === "signup")} onClick={() => setTab("signup")}>Register</button>
        </div>

        {tab === "login"
          ? <LoginForm onSuccess={handleSuccess} />
          : <SignupForm onSuccess={handleSuccess} />
        }
      </div>
    </div>
  );
}
