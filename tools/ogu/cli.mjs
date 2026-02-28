#!/usr/bin/env node

import { init } from "./commands/init.mjs";
import { validate } from "./commands/validate.mjs";
import { log } from "./commands/log.mjs";
import { repoMap } from "./commands/repo-map.mjs";
import { context } from "./commands/context.mjs";
import { adr } from "./commands/adr.mjs";
import { remember } from "./commands/remember.mjs";
import { doctor } from "./commands/doctor.mjs";
import { featureCreate, featureValidate } from "./commands/feature.mjs";
import { contractsValidate } from "./commands/contracts-validate.mjs";
import { contextLock } from "./commands/context-lock.mjs";
import { preview } from "./commands/preview.mjs";
import { profile } from "./commands/profile.mjs";
import { contractVersion } from "./commands/contract-version.mjs";
import { contractDiff } from "./commands/contract-diff.mjs";
import { contractMigrate } from "./commands/contract-migrate.mjs";
import { graph } from "./commands/graph.mjs";
import { impact } from "./commands/impact.mjs";
import { vision } from "./commands/vision.mjs";
import { orchestrate } from "./commands/orchestrate.mjs";
import { learn } from "./commands/learn.mjs";
import { recall } from "./commands/recall.mjs";
import { observeSetup } from "./commands/observe-setup.mjs";
import { observe as observeCmd } from "./commands/observe.mjs";
import { gates } from "./commands/gates.mjs";
import { theme } from "./commands/theme.mjs";
import { trends } from "./commands/trends.mjs";
import { migrate } from "./commands/migrate.mjs";
import { clean } from "./commands/clean.mjs";
import { wip, switchFeature } from "./commands/wip.mjs";
import { status } from "./commands/status.mjs";
import { studio } from "./commands/studio.mjs";
import { brandScan } from "./commands/brand-scan.mjs";
import { reference } from "./commands/reference.mjs";
import { phase } from "./commands/phase.mjs";
import { ports } from "./commands/ports.mjs";
import { specPatch } from "./commands/spec-patch.mjs";
import { drift } from "./commands/drift.mjs";
import { compile } from "./commands/compile.mjs";
import { designShow } from "./commands/design-show.mjs";
import { designPick } from "./commands/design-pick.mjs";
import { orgInit, orgShow, orgValidate } from "./commands/org.mjs";
import { featureState } from "./commands/feature-state.mjs";
import { agentRun } from "./commands/agent-run.mjs";
import { governanceCheck, approve, deny, escalate } from "./commands/governance.mjs";
import { kadimaStart, kadimaStop, kadimaStatus, kadimaEnqueue } from "./commands/kadima.mjs";
import { dagValidate } from "./commands/dag-validate.mjs";
import { buildDispatch } from "./commands/build-dispatch.mjs";
import { buildStatus } from "./commands/build-status.mjs";
import { routeSelectCmd } from "./commands/route-select.mjs";
import { budgetStatus, budgetCheck } from "./commands/budget-cmd.mjs";
import { contextWrite, contextRead, contextList } from "./commands/context-store.mjs";
import { sessionList } from "./commands/session-cmd.mjs";
import { compileRun } from "./commands/compile-run.mjs";
import { agentList, agentShow, agentCreate } from "./commands/agent-cmd.mjs";
import { kadimaAllocate } from "./commands/kadima-allocate.mjs";
import { agentStatus, agentStop, agentEscalate } from "./commands/agent-manage.mjs";
import { auditShow, auditSearch, auditExport, auditReplay } from "./commands/audit-cmd.mjs";
import { budgetRecord, budgetReport } from "./commands/budget-report.mjs";
import { taskAllocate, taskAllocatePlan } from "./commands/task-allocate.mjs";
import { artifactList, artifactGet } from "./commands/artifact-cmd.mjs";
import { waveRun } from "./commands/wave-run.mjs";
import { lockAcquire, lockRelease, lockList } from "./commands/lock-cmd.mjs";
import { attestCreate, attestVerify } from "./commands/attest-cmd.mjs";
import { recoverClassify, recoverStrategy, recoverRewind } from "./commands/recover-cmd.mjs";
import { isolationResolve, isolationLevels } from "./commands/isolation-cmd.mjs";
import { governanceDiffCheck } from "./commands/governance-diff.mjs";
import { orgHealth } from "./commands/org-health.mjs";
import { snapshotCreate, snapshotList, snapshotShow } from "./commands/snapshot-cmd.mjs";
import { capabilityResolve, capabilityList } from "./commands/capability-cmd.mjs";
import { overrideCreate, overrideList, overrideRevoke } from "./commands/override-cmd.mjs";
import { companySnapshot } from "./commands/company-cmd.mjs";
import { deterministicEnable, deterministicDisable, deterministicStatus, freezeCmd, thawCmd } from "./commands/deterministic-cmd.mjs";
import { verifyUiCmd } from "./commands/verify-ui-cmd.mjs";
import { chaosPlan, chaosRun, chaosList, chaosInject } from "./commands/chaos-cmd.mjs";
import { performanceIndex, kadimaStandup } from "./commands/performance-cmd.mjs";
import { modelProviders, modelStatus, modelRoute } from "./commands/model-cmd.mjs";
import { budgetSet } from "./commands/budget-set.mjs";
import { memorySearch, memoryList, memoryStore } from "./commands/memory-cmd.mjs";
import { contractGenerate, contractList } from "./commands/contract-cmd.mjs";
import { schedulerStatus, schedulerQueue, schedulerFairness, schedulerSimulate } from "./commands/scheduler-cmd.mjs";
import { systemHalt, systemResume, systemHealth, circuitStatus, circuitReset, providerHealth, providerFailover } from "./commands/failure-cmd.mjs";
import { metricsHealth, metricsKpis, metricsSla, metricsRegression, metricsExport } from "./commands/metrics-cmd.mjs";
import { graphHash, graphVerify } from "./commands/graph-hash-cmd.mjs";
import { policyCompile, policyList, policyFreeze, policyUnfreeze, policyVerify, policyVersion } from "./commands/policy-cmd.mjs";
import { consistencyCheck, txList, txShow, txOrphaned, idempotencyClean } from "./commands/consistency-cmd.mjs";
import { sandboxPolicy, sandboxCheck } from "./commands/sandbox-cmd.mjs";
import { agentIdentity, agentRevoke, agentSessions, agentVerify } from "./commands/agent-identity-cmd.mjs";
import { knowledgeIndex, knowledgeQuery } from "./commands/knowledge-cmd.mjs";

const command = process.argv[2];

const commands = {
  init, validate, log, "repo-map": repoMap, context, adr, remember, doctor,
  "feature:create": featureCreate,
  "feature:validate": featureValidate,
  "contracts:validate": contractsValidate,
  "context:lock": contextLock,
  preview,
  profile,
  "contract:version": contractVersion,
  "contract:diff": contractDiff,
  "contract:migrate": contractMigrate,
  graph,
  impact,
  vision,
  "vision:baseline": vision,  // handled internally by vision command
  orchestrate,
  learn,
  recall,
  "observe:setup": observeSetup,
  observe: observeCmd,
  gates,
  theme,
  trends,
  migrate,
  clean,
  wip,
  switch: switchFeature,
  status,
  studio,
  "brand-scan": brandScan,
  reference,
  phase,
  ports,
  "spec:patch": specPatch,
  drift,
  compile,
  "design:show": designShow,
  "design:pick": designPick,
  "org:init": orgInit,
  "org:show": orgShow,
  "org:validate": orgValidate,
  "feature:state": featureState,
  "agent:run": agentRun,
  "governance:check": governanceCheck,
  approve,
  deny,
  escalate,
  "kadima:start": kadimaStart,
  "kadima:stop": kadimaStop,
  "kadima:status": kadimaStatus,
  "kadima:enqueue": kadimaEnqueue,
  "dag:validate": dagValidate,
  "build:dispatch": buildDispatch,
  "build:status": buildStatus,
  "route:select": routeSelectCmd,
  "budget:status": budgetStatus,
  "budget:check": budgetCheck,
  "context:write": contextWrite,
  "context:read": contextRead,
  "context:list": contextList,
  "session:list": sessionList,
  "compile:run": compileRun,
  "agent:list": agentList,
  "agent:show": agentShow,
  "agent:create": agentCreate,
  "kadima:allocate": kadimaAllocate,
  "agent:status": agentStatus,
  "agent:stop": agentStop,
  "agent:escalate": agentEscalate,
  "audit:show": auditShow,
  "audit:search": auditSearch,
  "audit:export": auditExport,
  "audit:replay": auditReplay,
  "budget:record": budgetRecord,
  "budget:report": budgetReport,
  "task:allocate": taskAllocate,
  "task:allocate-plan": taskAllocatePlan,
  "artifact:list": artifactList,
  "artifact:get": artifactGet,
  "wave:run": waveRun,
  "lock:acquire": lockAcquire,
  "lock:release": lockRelease,
  "lock:list": lockList,
  "attest:create": attestCreate,
  "attest:verify": attestVerify,
  "recover:classify": recoverClassify,
  "recover:strategy": recoverStrategy,
  "recover:rewind": recoverRewind,
  "isolation:resolve": isolationResolve,
  "isolation:levels": isolationLevels,
  "governance:diff-check": governanceDiffCheck,
  "org:health": orgHealth,
  "snapshot:create": snapshotCreate,
  "snapshot:list": snapshotList,
  "snapshot:show": snapshotShow,
  "capability:resolve": capabilityResolve,
  "capability:list": capabilityList,
  "override:create": overrideCreate,
  "override:list": overrideList,
  "override:revoke": overrideRevoke,
  "company:snapshot": companySnapshot,
  "deterministic:enable": deterministicEnable,
  "deterministic:disable": deterministicDisable,
  "deterministic:status": deterministicStatus,
  freeze: freezeCmd,
  thaw: thawCmd,
  "chaos:plan": chaosPlan,
  "chaos:run": chaosRun,
  "chaos:list": chaosList,
  "chaos:inject": chaosInject,
  "verify-ui": verifyUiCmd,
  "performance:index": performanceIndex,
  "kadima:standup": kadimaStandup,
  "model:route": modelRoute,
  "model:providers": modelProviders,
  "model:status": modelStatus,
  "budget:set": budgetSet,
  "memory:search": memorySearch,
  "memory:list": memoryList,
  "memory:store": memoryStore,
  "contract:generate": contractGenerate,
  "contract:list": contractList,
  "scheduler:status": schedulerStatus,
  "scheduler:queue": schedulerQueue,
  "scheduler:fairness": schedulerFairness,
  "scheduler:simulate": schedulerSimulate,
  "system:halt": systemHalt,
  "system:resume": systemResume,
  "system:health": systemHealth,
  "circuit:status": circuitStatus,
  "circuit:reset": circuitReset,
  "provider:health": providerHealth,
  "provider:failover": providerFailover,
  "metrics:health": metricsHealth,
  "metrics:kpis": metricsKpis,
  "metrics:sla": metricsSla,
  "metrics:regression": metricsRegression,
  "metrics:export": metricsExport,
  "graph:hash": graphHash,
  "graph:verify": graphVerify,
  "policy:compile": policyCompile,
  "policy:list": policyList,
  "policy:freeze": policyFreeze,
  "policy:unfreeze": policyUnfreeze,
  "policy:verify": policyVerify,
  "policy:version": policyVersion,
  "consistency:check": consistencyCheck,
  "tx:list": txList,
  "tx:show": txShow,
  "tx:orphaned": txOrphaned,
  "idempotency:clean": idempotencyClean,
  "sandbox:policy": sandboxPolicy,
  "sandbox:check": sandboxCheck,
  "agent:identity": agentIdentity,
  "agent:revoke": agentRevoke,
  "agent:sessions": agentSessions,
  "agent:verify": agentVerify,
  "knowledge:index": knowledgeIndex,
  "knowledge:query": knowledgeQuery,
};

if (!command || !commands[command]) {
  console.log("Usage: ogu <command> [options]\n");
  console.log("Core Pipeline:");
  console.log("  compile <slug>      Single compilation entry point (--fix, --gate N, --verbose)");
  console.log("  doctor              Full end-to-end health check (--strict, --report <path>)");
  console.log("  context             Assemble CONTEXT.md (--feature <slug>, --budget <tokens>)");
  console.log("  context:lock        Lock context/state/repo-map hashes");
  console.log("  feature:create      Create feature directory with templates");
  console.log("  feature:validate    Validate feature files (--phase-1, --phase-2)");
  console.log("  gates               Completion gates (run/status/reset <slug>, --force, --gate N)");
  console.log("  phase               Show current pipeline phase for active feature");
  console.log("  preview             Start local preview and verify health (--stop)");
  console.log("  spec:patch          Create Spec Change Record (SCR)");
  console.log("");
  console.log("Architecture & Contracts:");
  console.log("  profile             Detect project platform and service needs");
  console.log("  graph               Build dependency graph (static, dynamic, style, API, config)");
  console.log("  impact              Show what is affected by a file change");
  console.log("  adr                 Create Architecture Decision Record");
  console.log("  contracts:validate  Validate contract files have no TODOs");
  console.log("  contract:version    Bump version on .contract.json files");
  console.log("  contract:diff       Show structural changes in contracts");
  console.log("  contract:migrate    Detect breaking changes and assess impact");
  console.log("");
  console.log("Visual & Testing:");
  console.log("  vision              Run visual verification (DOM + screenshots)");
  console.log("  vision:baseline     Manage baselines (record/update/list <slug>)");
  console.log("  drift <slug>        Detect drift from spec, contracts, and design");
  console.log("");
  console.log("Memory & Learning:");
  console.log("  remember            Memory updates (--apply, --auto, --prune)");
  console.log("  learn               Extract patterns from completed features");
  console.log("  recall              Query cross-project patterns from global memory");
  console.log("  trends              Analyze gate failure rates and completion trends");
  console.log("");
  console.log("Orchestration & State:");
  console.log("  orchestrate         Build DAG for parallel execution (--validate)");
  console.log("  wip                 Show all features and their current phase");
  console.log("  switch              Switch active feature context");
  console.log("  status              Full project dashboard");
  console.log("");
  console.log("Production:");
  console.log("  observe:setup       Configure production observation sources");
  console.log("  observe             Fetch production data (--create-tickets)");
  console.log("");
  console.log("Theme:");
  console.log("  theme set <mood>    Set visual mood (cyberpunk, minimal, brutalist, ...)");
  console.log("  theme show          Display current theme");
  console.log("  theme apply         Write tokens to design.tokens.json");
  console.log("  theme presets       List built-in presets");
  console.log("");
  console.log("Design:");
  console.log("  design:show <slug>  Show design variant summaries");
  console.log("  design:pick <slug> <N> Apply chosen design variant");
  console.log("");
  console.log("Brand:");
  console.log("  brand-scan <url>    Scan website brand DNA (--deep, --apply, --soul)");
  console.log("  brand-scan list     List scanned brands");
  console.log("  brand-scan apply    Apply scanned brand as theme");
  console.log("  brand-scan compare  Compare two brand scans");
  console.log("  reference <urls|files> Composite design from sites + images/PDFs (--apply, --soul)");
  console.log("  reference show      Display current design reference");
  console.log("  reference clear     Remove reference data");
  console.log("");
  console.log("Ports:");
  console.log("  ports               List all registered ports across projects");
  console.log("  ports add <p> <svc> Register a port for the current project");
  console.log("  ports remove <p>    Unregister a port");
  console.log("  ports scan          Auto-detect ports from project config files");
  console.log("  ports register      Register ports for a named project (JSON)");
  console.log("  ports clear         Clear all ports for the current project");
  console.log("");
  console.log("Studio:");
  console.log("  studio              Launch Ogu Studio web dashboard (--port N, --no-open)");
  console.log("");
  console.log("Maintenance:");
  console.log("  init                Create Ogu directory structure and templates");
  console.log("  validate            Validate Ogu structure and required files");
  console.log("  log                 Append entry to today's daily log");
  console.log("  repo-map            Scan repo and update Repo_Map.md");
  console.log("  clean               Remove old artifacts (--all, --logs, --dry-run)");
  console.log("  migrate             Migrate .ogu/ to latest version (--dry-run)");
  process.exit(command ? 1 : 0);
}

try {
  const exitCode = await commands[command]();
  process.exit(exitCode ?? 0);
} catch (err) {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
}
