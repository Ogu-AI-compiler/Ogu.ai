/**
 * agent-store.mjs — Slice 370 + Slice 389 (V2 methods)
 * Storage for marketplace agent profiles.
 * Layout:
 *   .ogu/marketplace/agents/{agent_id}.json  ← canonical
 *   .ogu/marketplace/index.json              ← fast lookup index
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { migrateProfile, isV2Profile } from "./agent-profile-migrate.mjs";
import { getMarketplaceDir } from "./runtime-paths.mjs";

// ─── Avatar generation (react-nice-avatar compatible config) ───
const AVATAR_FACE_COLORS = ["#F9C9B6","#AC6651","#FFDBB4","#EDB98A","#D08B5B","#AE5D29","#694D3D"];
const AVATAR_HAIR_COLORS = ["#000","#77311D","#FC909F","#D2EFF3","#506AF4","#F48150","#B9B9B9","#6BD9E9","#E0D52D","#abb8c3","#fff"];
const AVATAR_HAT_COLORS  = ["#000","#FC909F","#77311D","#506AF4","#F48150","#B9B9B9","#D2EFF3"];
const AVATAR_SHIRT_COLORS= ["#9287FF","#6BD9E9","#FC909F","#F4D150","#77311D","#000","#fff"];
const AVATAR_BG_COLORS   = ["#9287FF","#6BD9E9","#FC909F","#F4D150","#E0DDFF","#D4F0FF","#FFEDEF","#FFEBA4","#B9E2FF"];

function _avatarHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function _avatarPick(arr, seed, idx) {
  // Use different multipliers per index to avoid correlated picks
  const s = (seed * (idx + 1) * 2654435761) >>> 0;
  return arr[s % arr.length];
}

export function genAvatarConfig(name) {
  const h = _avatarHash(name || "agent");
  const pick = (arr, i) => _avatarPick(arr, h, i);
  const sex = h % 2 === 0 ? "man" : "woman";
  const isWoman = sex === "woman";
  const hairStyles = isWoman
    ? ["normal","thick","womanLong","womanShort"]
    : ["normal","thick","mohawk","normal","thick"];
  return {
    sex,
    faceColor:   pick(AVATAR_FACE_COLORS, 0),
    earSize:     h % 3 === 0 ? "small" : "big",
    eyeStyle:    pick(["circle","oval","smile"], 1),
    noseStyle:   pick(["short","long","round"], 2),
    mouthStyle:  pick(["laugh","smile","peace"], 3),
    shirtStyle:  pick(["hoody","short","polo"], 4),
    glassesStyle:pick(["none","none","none","round","square"], 5),
    hairColor:   pick(AVATAR_HAIR_COLORS, 6),
    hairStyle:   pick(hairStyles, 7),
    hatStyle:    pick(["none","none","none","beanie","turban"], 8),
    hatColor:    pick(AVATAR_HAT_COLORS, 9),
    eyeBrowStyle:isWoman ? "upWoman" : "up",
    shirtColor:  pick(AVATAR_SHIRT_COLORS, 10),
    bgColor:     pick(AVATAR_BG_COLORS, 11),
  };
}

function agentsDir(root) {
  return join(getMarketplaceDir(root), "agents");
}

function indexPath(root) {
  return join(getMarketplaceDir(root), "index.json");
}

function ensureDirs(root) {
  mkdirSync(agentsDir(root), { recursive: true });
}

function readIndex(root) {
  const p = indexPath(root);
  if (!existsSync(p)) return { agents: [], nextId: 1 };
  try { return JSON.parse(readFileSync(p, "utf-8")); }
  catch { return { agents: [], nextId: 1 }; }
}

function writeIndex(root, idx) {
  mkdirSync(getMarketplaceDir(root), { recursive: true });
  writeFileSync(indexPath(root), JSON.stringify(idx, null, 2) + "\n", "utf-8");
}

/**
 * generateAgentId(root) → "agent_0001"
 * Sequential, reads index for next id.
 */
export function generateAgentId(root) {
  ensureDirs(root);
  const idx = readIndex(root);
  const id = `agent_${String(idx.nextId).padStart(4, "0")}`;
  return id;
}

/**
 * saveAgent(root, profile) → profile with agent_id assigned
 */
export function saveAgent(root, profile) {
  ensureDirs(root);
  const idx = readIndex(root);

  // Assign id if not set
  if (!profile.agent_id) {
    profile = { ...profile, agent_id: `agent_${String(idx.nextId).padStart(4, "0")}` };
    idx.nextId = (idx.nextId || 1) + 1;
  }

  // Assign permanent avatar if not set
  if (!profile.avatar) {
    profile = { ...profile, avatar: genAvatarConfig(profile.name || profile.agent_id) };
  }

  // Write canonical file
  const filePath = join(agentsDir(root), `${profile.agent_id}.json`);
  writeFileSync(filePath, JSON.stringify(profile, null, 2) + "\n", "utf-8");

  // Update index — replace if exists
  const entry = {
    agent_id: profile.agent_id,
    name: profile.name,
    role: profile.role,
    specialty: profile.specialty,
    tier: profile.tier,
    status: profile.status,
    capacity_units: profile.capacity_units,
    base_price: profile.base_price,
  };
  idx.agents = idx.agents.filter(a => a.agent_id !== profile.agent_id);
  idx.agents.push(entry);

  writeIndex(root, idx);
  return profile;
}

/**
 * loadAgent(root, agentId) → profile | null
 * Auto-migrates V1 profiles to V2 on first access (saves back).
 */
export function loadAgent(root, agentId) {
  const filePath = join(agentsDir(root), `${agentId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    let profile = JSON.parse(readFileSync(filePath, "utf-8"));
    // Auto-migrate V1 → V2
    if (profile && !isV2Profile(profile)) {
      profile = migrateProfile(profile);
      writeFileSync(filePath, JSON.stringify(profile, null, 2) + "\n", "utf-8");
    }
    return profile;
  }
  catch { return null; }
}

/**
 * listAgents(root, filters?) → array of index entries
 * filters: { role?, specialty?, tier?, available? }
 */
export function listAgents(root, filters = {}) {
  const idx = readIndex(root);
  let agents = idx.agents || [];

  if (filters.role)      agents = agents.filter(a => a.role === filters.role);
  if (filters.specialty) agents = agents.filter(a => a.specialty === filters.specialty);
  if (filters.tier != null) agents = agents.filter(a => a.tier === Number(filters.tier));
  if (filters.available) agents = agents.filter(a => a.status === "available");

  return agents;
}

/**
 * searchAgents(root, { role, specialty, tier, available }) → array of full profiles
 * Falls back to reading files directly if the index is stale.
 */
export function searchAgents(root, filters = {}) {
  const entries = listAgents(root, filters);
  let profiles = entries.map(e => loadAgent(root, e.agent_id)).filter(Boolean);

  // Index is stale — rebuild from files and retry
  if (profiles.length === 0 && entries.length > 0) {
    const dir = agentsDir(root);
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter(f => f.endsWith(".json"));
      const allProfiles = files.map(f => {
        try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); } catch { return null; }
      }).filter(Boolean);

      // Rebuild index in background
      const newEntries = allProfiles.map(p => ({
        agent_id: p.agent_id, name: p.name, role: p.role,
        specialty: p.specialty, tier: p.tier,
        status: p.status || "available",
        capacity_units: p.capacity_units || 6,
        base_price: p.price || p.base_price || 20,
      })).sort((a, b) => a.agent_id.localeCompare(b.agent_id));
      writeIndex(root, { agents: newEntries, nextId: newEntries.length + 1 });

      // Apply filters
      profiles = allProfiles.filter(p => {
        if (filters.role && p.role !== filters.role) return false;
        if (filters.specialty && p.specialty !== filters.specialty) return false;
        if (filters.tier != null && p.tier !== Number(filters.tier)) return false;
        if (filters.available && p.status !== "available") return false;
        return true;
      });
    }
  }

  return profiles;
}

/**
 * updateAgentStats(root, agentId, delta) → updated profile
 * delta: partial stats object to merge
 */
export function updateAgentStats(root, agentId, delta) {
  const profile = loadAgent(root, agentId);
  if (!profile) throw new Error(`Agent not found: ${agentId}`);
  profile.stats = { ...profile.stats, ...delta };
  return saveAgent(root, profile);
}

// ─── V2 Methods (Slice 389) ───

/**
 * appendRoleHistory(root, agentId, { role, tier }) → updated profile
 * Closes the previous role_history entry and appends a new one.
 */
export function appendRoleHistory(root, agentId, { role, tier }) {
  const profile = loadAgent(root, agentId);
  if (!profile) throw new Error(`Agent not found: ${agentId}`);

  const now = new Date().toISOString();
  const history = profile.role_history || [];

  // Close the current entry
  if (history.length > 0 && history[history.length - 1].to === null) {
    history[history.length - 1].to = now;
  }

  // Append new entry
  history.push({ role, tier, from: now, to: null });
  profile.role_history = history;

  return saveAgent(root, profile);
}

/**
 * updateExperience(root, agentId, { digest, sourcesCount, learningEventId }) → updated profile
 */
export function updateExperience(root, agentId, { digest, sourcesCount, learningEventId }) {
  const profile = loadAgent(root, agentId);
  if (!profile) throw new Error(`Agent not found: ${agentId}`);

  if (digest !== undefined) profile.experience_digest = digest;
  if (sourcesCount !== undefined) profile.experience_sources_count = sourcesCount;
  if (learningEventId !== undefined) profile.last_learning_event_id = learningEventId;

  return saveAgent(root, profile);
}

/**
 * bumpPromptVersion(root, agentId) → updated profile
 */
export function bumpPromptVersion(root, agentId) {
  const profile = loadAgent(root, agentId);
  if (!profile) throw new Error(`Agent not found: ${agentId}`);

  profile.prompt_version = (profile.prompt_version || 0) + 1;
  profile.last_prompt_update = new Date().toISOString();

  return saveAgent(root, profile);
}
