/**
 * Workspace Isolator — create isolated workspaces with separate contexts.
 */

let nextId = 1;

export function createWorkspaceIsolator() {
  const workspaces = new Map();

  function create({ name, basePath }) {
    const id = `ws-${nextId++}`;
    const ws = {
      id,
      name,
      basePath,
      status: "active",
      createdAt: Date.now(),
    };
    workspaces.set(id, ws);
    return { ...ws };
  }

  function destroy(id) {
    const ws = workspaces.get(id);
    if (!ws) throw new Error(`Unknown workspace: ${id}`);
    ws.status = "destroyed";
    ws.destroyedAt = Date.now();
  }

  function getWorkspace(id) {
    const ws = workspaces.get(id);
    if (!ws) throw new Error(`Unknown workspace: ${id}`);
    return { ...ws };
  }

  function listWorkspaces() {
    return [...workspaces.values()].map(w => ({ ...w }));
  }

  return { create, destroy, getWorkspace, listWorkspaces };
}
