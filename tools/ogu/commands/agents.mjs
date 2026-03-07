/**
 * agents.mjs — Slice 376 + Slice 388 (V2 subcommands)
 * CLI command group for the marketplace agent system.
 *
 * V1 subcommands (unchanged):
 *   agents list [--role=X] [--tier=N] [--available]
 *   agents generate <role> <specialty> <tier>
 *   agents populate [--count=30]
 *   agents hire <agentId> <projectId> <units>
 *   agents show <agentId>
 *
 * V2 subcommands (Slice 388):
 *   agents roles [--category=X]
 *   agents generate-v2 <role-slug> <specialty-slug> <tier>
 *   agents populate-v2 [--count=30] [--category=X]
 *   agents playbook:list
 *   agents playbook:show <role-slug>
 *   agents playbook:generate <role-slug>
 *   agents playbook:generate-all [--dry-run]
 *   agents train [--agent=X] [--dry-run]
 *
 * Skill subcommands (Slice 395-397 — Claude Skills format):
 *   agents skills:list                        List all skills in the library
 *   agents skills:show <name>                 Show a skill's description and workflow
 *   agents skills:generate <name>             Generate SKILL.md for a slug (Slice 396)
 *   agents skills:generate-all [--from-playbooks] [--overwrite]  (Slice 396)
 *   agents skills:route <task> [--agent=X]    Route task to relevant skills (Slice 397)
 *
 * Project pipeline subcommands (Slices 416-429):
 *   agents project:plan <projectId> --brief="..."         CTO plan (complexity + team blueprint)
 *   agents project:team-build <projectId>                 Assemble team from CTO plan
 *   agents project:team-show <projectId>                  Show assembled team
 *   agents project:prd <projectId> --brief="..." [--simulate] [--md]  Generate PRD
 *   agents project:launch <projectId> --brief="..." [--simulate]      Full pipeline: CTO→Team→PRD→TaskGraph
 *   agents project:run <projectId> [--simulate]           Execute task graph (DAG-aware + gates)
 *   agents project:resume <projectId> [--simulate]        Resume partial/failed project
 *   agents project:status <projectId>                     Show execution state summary
 */

import { repoRoot } from "../util.mjs";
import { generateAgent, generateAgentV2, ROLE_CORE_SKILLS, SPECIALTY_SKILLS } from "./lib/agent-generator.mjs";
import { saveAgent, loadAgent, listAgents } from "./lib/agent-store.mjs";
import { hireAgent } from "./lib/marketplace-allocator.mjs";
import { computeFinalPrice } from "./lib/pricing-engine.mjs";
import { ROLE_TAXONOMY, CATEGORIES, getRolesByCategory, getAllSlugs } from "./lib/role-taxonomy.mjs";
import { listAvailablePlaybooks, loadPlaybookForRole } from "./lib/playbook-loader.mjs";
import { listSkills, loadSkill } from "./lib/skill-loader.mjs";
import { generateSkillContent, writeSkillFile, generateMissingSkills, scanPlaybooksForSkills, detectDomain } from "./lib/skill-generator.mjs";
import { routeTask } from "./lib/skill-router.mjs";
import { planProject, saveCTOPlan, loadCTOPlan } from "./lib/cto-planner.mjs";
import { assembleTeam, loadTeam, getTeamCapacity } from "./lib/team-assembler.mjs";
import { generatePRD, savePRD, loadPRD, validatePRD, prdToMarkdown } from "./lib/pm-engine.mjs";
import { runProject, launchProjectPipeline, readProjectData, getExecutionState } from "./lib/project-executor.mjs";
import { resumeProject, canResume, getResumePoint } from "./lib/project-resume.mjs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ALL_ROLES      = Object.keys(ROLE_CORE_SKILLS);
const ALL_SPECIALTIES = Object.keys(SPECIALTY_SKILLS);

function playbooksDir() {
  const thisFile = fileURLToPath(import.meta.url);
  return join(thisFile, "..", "..", "playbooks");
}

function skillsDir() {
  const thisFile = fileURLToPath(import.meta.url);
  return join(thisFile, "..", "..", "skills");
}

// Lazy import to avoid circular dependency issues at load time
async function loadTrainer() {
  try {
    return await import("./lib/agent-trainer.mjs");
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k] = v !== undefined ? v : true;
    } else {
      pos.push(a);
    }
  }
  return { flags, pos };
}

function printAgentCard(agent, price) {
  const bar = (used, cap) => {
    const fill = cap > 0 ? Math.round((used / cap) * 10) : 0;
    return `[${"█".repeat(fill)}${"░".repeat(10 - fill)}] ${used}/${cap}`;
  };
  console.log(`\n  ┌─ ${agent.name} [${agent.agent_id}]`);
  console.log(`  │  Role: ${agent.role} · Specialty: ${agent.specialty} · Tier ${agent.tier}`);
  console.log(`  │  Skills: ${(agent.skills || []).slice(0, 4).join(", ")}`);
  console.log(`  │  DNA: ${agent.dna?.work_style} / ${agent.dna?.communication_style} / ${agent.dna?.risk_appetite}`);
  console.log(`  │  Capacity: ${bar(agent.stats?.utilization_units || 0, agent.capacity_units)}`);
  console.log(`  │  Price: $${price} · Status: ${agent.status}`);
  console.log(`  └──`);
}

export async function agents() {
  const argv = process.argv.slice(3); // ogu agents <sub> ...
  const sub = argv[0];
  const rest = argv.slice(1);
  const root = repoRoot();

  if (!sub || sub === "help") {
    console.log("Usage: ogu agents <subcommand> [options]");
    console.log("\nV1 Commands:");
    console.log("  list [--role=X] [--tier=N] [--available]");
    console.log("  generate <role> <specialty> <tier>");
    console.log("  populate [--count=30]");
    console.log("  hire <agentId> <projectId> <units>");
    console.log("  show <agentId>");
    console.log("\nV2 Commands:");
    console.log("  roles [--category=X]           List all 64 roles");
    console.log("  generate-v2 <slug> <spec> <T>  Generate V2 agent");
    console.log("  populate-v2 [--count=30]       Populate V2 agents");
    console.log("  playbook:list                  List available playbooks");
    console.log("  playbook:show <role-slug>      Show playbook content");
    console.log("  train [--agent=X] [--dry-run]  Run Agent Trainer");
    console.log("\nSkill Commands (Claude Skills format):");
    console.log("  skills:list                    List all skills in the library");
    console.log("  skills:show <name>             Show a skill's description and workflow");
    console.log("  skills:generate <name>         Generate SKILL.md for a skill slug");
    console.log("  skills:generate-all [--from-playbooks] [--overwrite]");
    console.log("                                 Generate SKILL.md for all missing skills");
    console.log("  skills:route <task>            Route a task description to relevant skills");
    return;
  }

  // ── list ──
  if (sub === "list") {
    const { flags } = parseArgs(rest);
    const filters = {};
    if (flags.role)      filters.role = flags.role;
    if (flags.tier)      filters.tier = Number(flags.tier);
    if (flags.available) filters.available = true;

    const entries = listAgents(root, filters);
    if (entries.length === 0) {
      console.log("No agents found. Run: ogu agents populate");
      return;
    }
    console.log(`\nMarketplace Agents (${entries.length} found)\n${"─".repeat(50)}`);
    for (const e of entries) {
      const agent = loadAgent(root, e.agent_id);
      if (!agent) continue;
      const price = computeFinalPrice(root, agent);
      printAgentCard(agent, price);
    }
    return;
  }

  // ── generate ──
  if (sub === "generate") {
    const [role, specialty, tier] = rest;
    if (!role || !specialty || !tier) {
      console.error("Usage: ogu agents generate <role> <specialty> <tier>");
      process.exit(1);
    }
    const profile = generateAgent({ role, specialty, tier: Number(tier) });
    const saved = saveAgent(root, profile);
    const price = computeFinalPrice(root, saved);
    console.log(`Generated agent: ${saved.name} [${saved.agent_id}]`);
    printAgentCard(saved, price);
    return;
  }

  // ── populate ──
  if (sub === "populate") {
    const { flags } = parseArgs(rest);
    const count = Number(flags.count) || 30;
    const tiers = [1, 2, 3, 4];
    const created = [];

    for (let i = 0; i < count; i++) {
      const role      = ALL_ROLES[i % ALL_ROLES.length];
      const specialty = ALL_SPECIALTIES[i % ALL_SPECIALTIES.length];
      const tier      = tiers[i % tiers.length];
      const profile   = generateAgent({ role, specialty, tier, seed: i * 7919 + 42 });
      const saved     = saveAgent(root, profile);
      created.push(saved.agent_id);
    }

    console.log(`Populated ${created.length} agents in marketplace.`);
    console.log("  IDs:", created.slice(0, 5).join(", ") + (created.length > 5 ? " ..." : ""));
    return;
  }

  // ── hire ──
  if (sub === "hire") {
    const [agentId, projectId, units] = rest;
    if (!agentId || !projectId || !units) {
      console.error("Usage: ogu agents hire <agentId> <projectId> <units>");
      process.exit(1);
    }
    try {
      const alloc = hireAgent(root, {
        agentId,
        projectId,
        roleSlot:        "default",
        allocationUnits: Number(units),
        priorityLevel:   50,
      });
      console.log(`Agent hired: ${agentId} → project ${projectId}`);
      console.log(`  Allocation ID: ${alloc.allocation_id}`);
      console.log(`  Units: ${alloc.allocation_units}`);
    } catch (e) {
      console.error(`Hire failed: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // ── show ──
  if (sub === "show") {
    const agentId = rest[0];
    if (!agentId) {
      console.error("Usage: ogu agents show <agentId>");
      process.exit(1);
    }
    const agent = loadAgent(root, agentId);
    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      process.exit(1);
    }
    const price = computeFinalPrice(root, agent);
    printAgentCard(agent, price);
    console.log("\n  Full profile:");
    console.log(`  DNA: ${JSON.stringify(agent.dna, null, 4)}`);
    console.log(`\n  System Prompt (first 200 chars):\n  ${agent.system_prompt?.slice(0, 200)}...`);
    return;
  }

  // ── roles (V2) ──
  if (sub === "roles") {
    const { flags } = parseArgs(rest);
    const slugs = getAllSlugs();
    if (flags.category) {
      const roles = getRolesByCategory(flags.category);
      if (roles.length === 0) {
        console.log(`No roles in category: ${flags.category}`);
        console.log(`Available categories: ${CATEGORIES.join(", ")}`);
        return;
      }
      console.log(`\nRoles in category "${flags.category}" (${roles.length}):\n`);
      for (const r of roles) {
        console.log(`  ${r.slug.padEnd(25)} ${r.displayName.padEnd(30)} Tier ${r.minTier}+ (${r.capacityUnits} units)`);
      }
    } else {
      console.log(`\nAll Marketplace Roles (${slugs.length})\n${"─".repeat(50)}`);
      for (const cat of CATEGORIES) {
        const roles = getRolesByCategory(cat);
        console.log(`\n  ${cat.toUpperCase()} (${roles.length}):`);
        for (const r of roles) {
          console.log(`    ${r.slug.padEnd(25)} ${r.displayName.padEnd(30)} Tier ${r.minTier}+`);
        }
      }
    }
    return;
  }

  // ── generate-v2 (V2) ──
  if (sub === "generate-v2") {
    const [roleSlug, specialtySlug, tier] = rest;
    if (!roleSlug || !tier) {
      console.error("Usage: ogu agents generate-v2 <role-slug> <specialty-slug> <tier>");
      process.exit(1);
    }
    const profile = generateAgentV2({
      roleSlug,
      specialtySlug: specialtySlug === "none" ? null : specialtySlug,
      tier: Number(tier),
      playbooksDir: playbooksDir(),
    });
    const saved = saveAgent(root, profile);
    const price = computeFinalPrice(root, saved);
    console.log(`Generated V2 agent: ${saved.name} [${saved.agent_id}]`);
    console.log(`  Role: ${saved.role_display || saved.role} · Tier ${saved.tier} · Profile V${saved.profile_version}`);
    printAgentCard(saved, price);
    return;
  }

  // ── populate-v2 (V2) ──
  if (sub === "populate-v2") {
    const { flags } = parseArgs(rest);
    const count = Number(flags.count) || 30;
    const categoryFilter = flags.category || null;
    const legacy = flags.legacy === true;

    if (legacy) {
      // Force V1 generation
      const tiers = [1, 2, 3, 4];
      const created = [];
      for (let i = 0; i < count; i++) {
        const role      = ALL_ROLES[i % ALL_ROLES.length];
        const specialty = ALL_SPECIALTIES[i % ALL_SPECIALTIES.length];
        const tier      = tiers[i % tiers.length];
        const profile   = generateAgent({ role, specialty, tier, seed: i * 7919 + 42 });
        const saved     = saveAgent(root, profile);
        created.push(saved.agent_id);
      }
      console.log(`Populated ${created.length} V1 agents (legacy mode).`);
      return;
    }

    let slugs = getAllSlugs();
    if (categoryFilter) {
      const roles = getRolesByCategory(categoryFilter);
      slugs = roles.map(r => r.slug);
    }

    const specialties = [null, "react", "node", "kubernetes", "typescript"];
    const tiers = [1, 2, 3, 4];
    const created = [];

    for (let i = 0; i < count; i++) {
      const roleSlug = slugs[i % slugs.length];
      const spec = specialties[i % specialties.length];
      const tier = tiers[i % tiers.length];
      const profile = generateAgentV2({
        roleSlug,
        specialtySlug: spec,
        tier,
        seed: i * 7919 + 42,
        playbooksDir: playbooksDir(),
      });
      const saved = saveAgent(root, profile);
      created.push(saved.agent_id);
    }

    console.log(`Populated ${created.length} V2 agents in marketplace.`);
    console.log("  IDs:", created.slice(0, 5).join(", ") + (created.length > 5 ? " ..." : ""));
    return;
  }

  // ── playbook:list (V2) ──
  if (sub === "playbook:list") {
    const playbooks = listAvailablePlaybooks(playbooksDir());
    if (playbooks.length === 0) {
      console.log("No playbooks found in tools/ogu/playbooks/");
      return;
    }
    console.log(`\nAvailable Playbooks (${playbooks.length})\n${"─".repeat(50)}`);
    for (const pb of playbooks) {
      console.log(`  ${pb.roleSlug.padEnd(25)} [${pb.category}]`);
    }
    return;
  }

  // ── playbook:show (V2) ──
  if (sub === "playbook:show") {
    const roleSlug = rest[0];
    if (!roleSlug) {
      console.error("Usage: ogu agents playbook:show <role-slug>");
      process.exit(1);
    }
    const pb = loadPlaybookForRole(playbooksDir(), roleSlug);
    if (!pb) {
      console.error(`Playbook not found for role: ${roleSlug}`);
      process.exit(1);
    }
    console.log(`\n── Playbook: ${pb.frontmatter.role || roleSlug} ──\n`);
    console.log(`Category:  ${pb.frontmatter.category}`);
    console.log(`Min Tier:  ${pb.frontmatter.min_tier}`);
    console.log(`Skills:    ${pb.skills.join(", ")}`);
    console.log(`Sections:  ${Object.keys(pb.sections).join(", ")}`);
    console.log(`\n${pb.body.slice(0, 500)}...`);
    return;
  }

  // ── train (V2) ──
  if (sub === "train") {
    const { flags } = parseArgs(rest);
    const trainer = await loadTrainer();
    if (!trainer) {
      console.error("Agent Trainer not available. Ensure agent-trainer.mjs exists.");
      process.exit(1);
    }

    const dryRun = flags["dry-run"] === true;
    const agentFilter = flags.agent || null;

    if (agentFilter) {
      // Train specific agent
      const result = await trainer.trainAgent(root, agentFilter, { dryRun, playbooksDir: playbooksDir() });
      if (dryRun) {
        console.log(`[dry-run] Would train agent ${agentFilter}: ${result.summary}`);
      } else {
        console.log(`Trained agent ${agentFilter}: ${result.summary}`);
      }
    } else {
      // Train all agents with pending candidates
      const result = await trainer.trainAll(root, { dryRun, playbooksDir: playbooksDir() });
      if (dryRun) {
        console.log(`[dry-run] Would train ${result.trained} agent(s), skip ${result.skipped}`);
      } else {
        console.log(`Trained ${result.trained} agent(s), skipped ${result.skipped}`);
      }
    }
    return;
  }

  // ── skills:list (Slice 395) ──
  if (sub === "skills:list") {
    const skills = listSkills(skillsDir());
    if (skills.length === 0) {
      console.log("No skills found in tools/ogu/skills/");
      return;
    }
    console.log(`\nSkill Library (${skills.length} skills)\n${"─".repeat(60)}`);
    for (const s of skills) {
      console.log(`\n  ${s.name}`);
      console.log(`  ${s.description.slice(0, 120)}${s.description.length > 120 ? "..." : ""}`);
    }
    return;
  }

  // ── skills:show (Slice 395) ──
  if (sub === "skills:show") {
    const name = rest[0];
    if (!name) {
      console.error("Usage: ogu agents skills:show <skill-name>");
      process.exit(1);
    }
    const skill = loadSkill(skillsDir(), name);
    if (!skill) {
      console.error(`Skill not found in library: ${name}`);
      console.error("Tip: run 'ogu agents skills:list' to see all available skills");
      process.exit(1);
    }
    console.log(`\n── Skill: ${skill.name} ──\n`);
    console.log(`Description: ${skill.description}`);
    if (skill.body) {
      console.log(`\n${skill.body}`);
    }
    return;
  }

  // ── skills:generate (Slice 396) ──
  if (sub === "skills:generate") {
    const { flags: genFlags, pos: genPos } = parseArgs(rest);
    const name = genPos[0];
    if (!name) {
      console.error("Usage: ogu agents skills:generate <skill-slug>");
      process.exit(1);
    }
    const overwrite = genFlags.overwrite === true;
    const result = writeSkillFile(skillsDir(), name, { overwrite });
    if (result.wrote) {
      const { domain } = generateSkillContent(name);
      console.log(`Generated: ${name} (domain: ${domain})`);
      console.log(`  Path: ${result.path}`);
    } else {
      console.log(`Skipped (already exists): ${name}`);
      console.log(`  Path: ${result.path}`);
      console.log("  Use --overwrite to regenerate");
    }
    return;
  }

  // ── skills:generate-all (Slice 396) ──
  if (sub === "skills:generate-all") {
    const { flags: gaFlags } = parseArgs(rest);
    const overwrite = gaFlags.overwrite === true;
    const fromPlaybooks = gaFlags["from-playbooks"] === true;

    let slugs;
    if (fromPlaybooks) {
      console.log("Scanning playbooks for skill references...");
      const pbDir = playbooksDir();
      slugs = scanPlaybooksForSkills(pbDir);
      console.log(`Found ${slugs.length} unique skills in playbooks.`);
    } else {
      // Generate for all skills currently referenced by agents (role + specialty)
      const roleSkills = Object.values(ROLE_CORE_SKILLS).flat();
      const specSkills = Object.values(SPECIALTY_SKILLS).flat();
      slugs = [...new Set([...roleSkills, ...specSkills])].sort();
      console.log(`Processing ${slugs.length} core + specialty skills.`);
    }

    const { generated, skipped, errors } = generateMissingSkills(skillsDir(), slugs, { overwrite });

    console.log(`\nGenerated: ${generated.length}`);
    if (generated.length > 0 && gaFlags.verbose) {
      for (const s of generated) console.log(`  + ${s}`);
    }
    console.log(`Skipped (existing): ${skipped.length}`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`);
      for (const e of errors) console.log(`  ! ${e.slug}: ${e.error}`);
    }
    console.log(`\nSkills library: ${listSkills(skillsDir()).length} total skills`);
    return;
  }

  // ── skills:route (Slice 397) ──
  if (sub === "skills:route") {
    const { flags: routeFlags, pos: routePos } = parseArgs(rest);
    const task = routePos.join(" ");
    if (!task) {
      console.error("Usage: ogu agents skills:route <task description>");
      process.exit(1);
    }
    const agentId = routeFlags.agent;
    const root = repoRoot();
    let skillDefs = [];

    if (agentId) {
      try {
        const agent = loadAgent(root, agentId);
        skillDefs = agent?.skill_definitions || [];
      } catch {
        console.error(`Agent not found: ${agentId}`);
        process.exit(1);
      }
    } else {
      // Use all skills in library as the skill pool
      skillDefs = listSkills(skillsDir()).map(s => ({ name: s.name, description: s.description }));
    }

    const maxSkills = routeFlags.max ? Number(routeFlags.max) : 3;
    const { skills, totalMatched } = routeTask(task, skillDefs, skillsDir(), { maxSkills, loadBodies: false });

    console.log(`\nTask routing for: "${task}"\n`);
    console.log(`Matched ${totalMatched} skill(s), showing top ${skills.length}:\n`);
    for (const s of skills) {
      const score = s.score?.toFixed(1) ?? "?";
      console.log(`  [score: ${score}] ${s.name}`);
      console.log(`    ${(s.description || "").slice(0, 120)}`);
    }
    if (skills.length === 0) {
      console.log("  No skills matched. Consider adding more trigger phrases to SKILL.md files.");
    }
    return;
  }

  // ── project:plan (Slice 416) ──────────────────────────────────────────────
  if (sub === "project:plan") {
    const { flags: pFlags, pos: pPos } = parseArgs(rest);
    const projectId = pPos[0];
    if (!projectId) { console.error("Usage: ogu agents project:plan <projectId> --brief=\"...\""); process.exit(1); }
    const brief = pFlags.brief || pFlags.b || pPos.slice(1).join(" ") || "General software project";
    const plan = planProject(brief, { projectId });
    saveCTOPlan(root, projectId, plan);
    console.log(`\nCTO Plan for: ${projectId}`);
    console.log(`Complexity: ${plan.complexity.tier} (score: ${plan.complexity.score})`);
    console.log(`Product type: ${plan.complexity.product_type}`);
    console.log(`Architecture: ${plan.workFramework.architecture_type}`);
    console.log(`Timeline: ~${plan.workFramework.suggested_timeline_weeks} weeks`);
    console.log(`\nTeam Blueprint (${plan.teamBlueprint.total_headcount} people):`);
    for (const r of plan.teamBlueprint.roles) {
      const opt = r.optional ? " (optional)" : "";
      console.log(`  ${r.role_display} × ${r.count}${opt}`);
    }
    console.log(`\nSaved to .ogu/projects/${projectId}/cto-plan.json`);
    return;
  }

  // ── project:team-build (Slice 417) ───────────────────────────────────────
  if (sub === "project:team-build") {
    const { flags: tFlags, pos: tPos } = parseArgs(rest);
    const projectId = tPos[0];
    if (!projectId) { console.error("Usage: ogu agents project:team-build <projectId>"); process.exit(1); }
    const plan = loadCTOPlan(root, projectId);
    if (!plan) { console.error(`No CTO plan found for project: ${projectId}. Run 'agents project:plan' first.`); process.exit(1); }
    const team = assembleTeam(root, { projectId, teamBlueprint: plan.teamBlueprint });
    console.log(`\nTeam assembled for: ${projectId}`);
    console.log(`Total slots: ${team.total_slots} | Assigned: ${team.assigned_slots} | Unassigned: ${team.unassigned_slots}`);
    console.log(`\nMembers:`);
    for (const m of team.members) {
      const agent = m.status === 'active' ? `${m.agent_name} (${m.agent_id}, tier ${m.agent_tier})` : "UNASSIGNED";
      console.log(`  [${m.member_id}] ${m.role_display} → ${agent}`);
    }
    console.log(`\nSaved to .ogu/projects/${projectId}/team.json`);
    return;
  }

  // ── project:team-show (Slice 417) ─────────────────────────────────────────
  if (sub === "project:team-show") {
    const { pos: tsPos } = parseArgs(rest);
    const projectId = tsPos[0];
    if (!projectId) { console.error("Usage: ogu agents project:team-show <projectId>"); process.exit(1); }
    const team = loadTeam(root, projectId);
    if (!team) { console.error(`No team found for project: ${projectId}`); process.exit(1); }
    const cap = getTeamCapacity(root, projectId);
    console.log(`\nTeam: ${team.team_id} | Project: ${projectId}`);
    console.log(`Slots: ${team.total_slots} total, ${team.assigned_slots} assigned, ${team.unassigned_slots} unassigned`);
    console.log(`Capacity: ${cap.available}/${cap.total} units available\n`);
    for (const m of team.members) {
      const status = m.status === 'active' ? `✓ ${m.agent_name}` : '✗ unassigned';
      console.log(`  ${m.role_display.padEnd(22)} ${status}`);
    }
    return;
  }

  // ── project:prd (Slice 418) ───────────────────────────────────────────────
  if (sub === "project:prd") {
    const { flags: prdFlags, pos: prdPos } = parseArgs(rest);
    const projectId = prdPos[0];
    if (!projectId) { console.error("Usage: ogu agents project:prd <projectId> [--simulate] [--write-md]"); process.exit(1); }

    const plan = loadCTOPlan(root, projectId);
    if (!plan) { console.error(`No CTO plan for project: ${projectId}. Run 'agents project:plan' first.`); process.exit(1); }

    const brief = plan.brief_summary || '';
    const simulate = !!prdFlags.simulate;
    const writeMarkdown = !!prdFlags['write-md'];

    let prd;
    try {
      prd = await generatePRD(brief, plan, { simulate });
    } catch (e) {
      console.error(`PRD generation failed: ${e.message}`);
      process.exit(1);
    }

    const { valid, errors } = validatePRD(prd);
    if (!valid) {
      console.error(`PRD validation failed:\n${errors.map(e => '  ' + e).join('\n')}`);
      process.exit(1);
    }

    savePRD(root, projectId, prd, { writeMarkdown });
    console.log(`\nPRD generated for: ${projectId}`);
    console.log(`Product: ${prd.product.name} — ${prd.product.one_liner}`);
    console.log(`Features: ${prd.features.length} (${prd.features.filter(f => f.priority === 'must').length} must-have)`);
    console.log(`Data entities: ${prd.data_entities.length}`);
    if (writeMarkdown) console.log(`Saved: prd.json + prd.md`);
    else console.log(`Saved: .ogu/projects/${projectId}/prd.json`);
    return;
  }

  // ── project:launch (Slice 420/421) ───────────────────────────────────────
  if (sub === "project:launch") {
    const { flags: launchFlags, pos: launchPos } = parseArgs(rest);
    const projectId = launchPos[0];
    const brief = launchFlags.brief || launchFlags.b || "";
    if (!projectId || !brief) {
      console.error("Usage: ogu agents project:launch <projectId> --brief=\"Your project description\"");
      process.exit(1);
    }
    const simulate = launchFlags.simulate !== false;
    console.log(`\nLaunching project pipeline for: ${projectId}`);
    console.log(`Brief: ${brief}`);
    console.log(`Mode: ${simulate ? "simulate" : "LLM"}`);
    try {
      const result = await launchProjectPipeline(root, projectId, brief, { simulate });
      console.log(`\nPipeline complete:`);
      console.log(`  Complexity: ${result.tier}`);
      console.log(`  Team size:  ${result.teamSize}`);
      console.log(`  Features:   ${result.features}`);
      console.log(`  Tasks:      ${result.tasks}`);
    } catch (e) {
      console.error(`Launch failed: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // ── project:run (Slice 420) ───────────────────────────────────────────────
  if (sub === "project:run") {
    const { flags: runFlags, pos: runPos } = parseArgs(rest);
    const projectId = runPos[0];
    if (!projectId) {
      console.error("Usage: ogu agents project:run <projectId> [--simulate]");
      process.exit(1);
    }
    const simulate = !!runFlags.simulate;
    console.log(`\nRunning project: ${projectId}${simulate ? " (simulate)" : ""}`);
    const result = await runProject(root, projectId, {
      simulate,
      onEvent: (evt) => {
        if (evt.type === "task.started") console.log(`  → ${evt.taskId}`);
        if (evt.type === "task.completed") console.log(`  ✓ ${evt.taskId}`);
        if (evt.type === "task.failed") console.log(`  ✗ ${evt.taskId}: ${evt.error}`);
        if (evt.type === "project.completed") {
          console.log(`\nDone: ${evt.completed}/${evt.total} tasks (${evt.failed} failed)`);
        }
      },
    });
    process.exit(result.success ? 0 : 1);
  }

  // ── project:resume (Slice 429) ────────────────────────────────────────────
  if (sub === "project:resume") {
    const { flags: resumeFlags, pos: resumePos } = parseArgs(rest);
    const projectId = resumePos[0];
    if (!projectId) {
      console.error("Usage: ogu agents project:resume <projectId> [--simulate]");
      process.exit(1);
    }
    if (!canResume(root, projectId)) {
      const point = getResumePoint(root, projectId);
      if (!point) {
        console.error(`No execution state found for: ${projectId}`);
      } else {
        console.log(`Project ${projectId} is already complete (${point.completedCount} tasks).`);
      }
      process.exit(0);
    }
    const point = getResumePoint(root, projectId);
    const simulate = !!resumeFlags.simulate;
    console.log(`\nResuming project: ${projectId}${simulate ? " (simulate)" : ""}`);
    if (point) {
      console.log(`  Completed: ${point.completedCount}, Pending: ${point.pendingCount}, Failed: ${point.failedCount}`);
    }
    const result = await resumeProject(root, projectId, {
      simulate,
      onEvent: (evt) => {
        if (evt.type === "project.resumed") console.log(`  Resuming — ${evt.alreadyCompleted} tasks already done`);
        if (evt.type === "task.started") console.log(`  → ${evt.taskId}`);
        if (evt.type === "task.completed") console.log(`  ✓ ${evt.taskId}`);
        if (evt.type === "task.failed") console.log(`  ✗ ${evt.taskId}: ${evt.error}`);
        if (evt.type === "project.completed") {
          console.log(`\nDone: ${evt.completed}/${evt.total} tasks (${evt.failed} failed)`);
        }
      },
    });
    process.exit(result.success ? 0 : 1);
  }

  // ── project:status (Slice 420) ────────────────────────────────────────────
  if (sub === "project:status") {
    const { pos: statusPos } = parseArgs(rest);
    const projectId = statusPos[0];
    if (!projectId) { console.error("Usage: ogu agents project:status <projectId>"); process.exit(1); }
    const data = readProjectData(root, projectId);
    if (!data) { console.error(`No project found: ${projectId}`); process.exit(1); }
    const state = data.executionState;
    console.log(`\nProject: ${projectId}`);
    console.log(`  CTO Plan: ${data.ctoPlan ? `tier=${data.ctoPlan.tier}` : "not generated"}`);
    console.log(`  Team:     ${data.team ? `${data.team.members?.length || 0} members` : "not assembled"}`);
    console.log(`  PRD:      ${data.prd ? `${data.prd.features?.length || 0} features` : "not generated"}`);
    console.log(`  Tasks:    ${data.enrichedPlan ? `${data.enrichedPlan.tasks?.length || 0} enriched` : "not enriched"}`);
    if (state) {
      console.log(`  Status:   ${state.status}`);
      if (state.summary) {
        console.log(`  Progress: ${state.summary.completed}/${state.summary.total} (${state.summary.failed} failed)`);
      }
    } else {
      console.log(`  Status:   not started`);
    }
    return;
  }

  console.error(`Unknown subcommand: ${sub}`);
  process.exit(1);
}
