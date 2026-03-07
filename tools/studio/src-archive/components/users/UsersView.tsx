import { useState, useEffect } from "react";

type Role = "admin" | "member" | "viewer";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const STORAGE_KEY = "ogu_studio_users";

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

const ROLE_COLORS: Record<Role, string> = {
  admin: "text-red-400 bg-red-400/10",
  member: "text-blue-400 bg-blue-400/10",
  viewer: "text-text-muted bg-bg-card",
};

export function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState("");

  useEffect(() => {
    setUsers(loadUsers());
  }, []);

  function addUser() {
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (users.some((u) => u.email === email.trim())) {
      setError("A user with this email already exists.");
      return;
    }
    const next = [
      ...users,
      { id: crypto.randomUUID(), name: name.trim(), email: email.trim(), role },
    ];
    setUsers(next);
    saveUsers(next);
    setName("");
    setEmail("");
    setRole("member");
  }

  function removeUser(id: string) {
    const next = users.filter((u) => u.id !== id);
    setUsers(next);
    saveUsers(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-text mb-1">Users</h2>
        <p className="text-sm text-text-muted">Manage team members and their roles. Stored locally.</p>
      </div>

      {/* Add user form */}
      <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">Add User</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            className="flex-1 min-w-[140px] bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="flex-1 min-w-[200px] bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={addUser}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            Add
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* User list */}
      <div className="flex flex-col gap-2">
        {users.length === 0 && (
          <p className="text-sm text-text-muted">No users yet. Add one above.</p>
        )}
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-bg-card px-4 py-3"
          >
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-text flex-shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{u.name}</p>
              <p className="text-xs text-text-muted truncate">{u.email}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
              {u.role}
            </span>
            <button
              onClick={() => removeUser(u.id)}
              className="text-xs text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
