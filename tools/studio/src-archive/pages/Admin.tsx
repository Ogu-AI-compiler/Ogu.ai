import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

export function Admin() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useStore((s) => s.currentUser);

  // Only show to admin users (in AOAS mode)
  const isAdmin = !currentUser || currentUser.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([api.getAdminStats(), api.getAdminUsers()])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u.users || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleBan(userId: string) {
    if (!confirm("Ban this user?")) return;
    try {
      await api.banUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (!isAdmin) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Access denied — admin only</div>;
  }

  if (loading) return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading admin dashboard…</div>;
  if (error) return <div style={{ padding: 24, color: "var(--danger, #ef4444)" }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Admin Dashboard</h2>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Users", value: stats.users },
            { label: "Organizations", value: stats.orgs },
            { label: "Compilations (mo)", value: stats.compilationsThisMonth },
            { label: "Credits in Circulation", value: stats.totalCreditsInCirculation },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{value ?? "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Users ({users.length})</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              {["Name", "Email", "Plan", "Credits", "Compilations", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text)" }}>{u.name}</td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-muted)" }}>{u.email}</td>
                <td style={{ padding: "10px 16px", fontSize: 13 }}>
                  <span style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{u.plan}</span>
                </td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text)" }}>{u.credits}</td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text)" }}>{u.usage?.compilations || 0}</td>
                <td style={{ padding: "10px 16px" }}>
                  <button onClick={() => handleBan(u.id)} style={{ fontSize: 12, color: "var(--danger, #ef4444)", background: "transparent", border: "1px solid", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>
                    Ban
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
