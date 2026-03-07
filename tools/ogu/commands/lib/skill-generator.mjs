/**
 * skill-generator.mjs — Slice 396
 * Generates SKILL.md files from skill slugs using domain-aware templates.
 *
 * Generated SKILL.md format (Claude Skills):
 *   ---
 *   name: skill-slug
 *   description: What it does. Use when X. Triggers: "phrase1", "phrase2".
 *   ---
 *   # Title
 *   ## When to Use
 *   ## Workflow
 *   ## Quality Bar
 *   ## Scripts (optional — references to executable scripts)
 *
 * Scripts can live in skills/{name}/scripts/ (self-contained)
 * or anywhere in the repo (referenced by path in ## Scripts section).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Domain definitions ────────────────────────────────────────────────────────

const DOMAINS = {
  frontend: {
    keywords: ["react", "vue", "angular", "css", "html", "ui", "ux", "component",
      "responsive", "animation", "dom", "browser", "frontend", "jsx", "tsx",
      "tailwind", "sass", "webpack", "vite", "design-system", "typography",
      "wireframe", "prototype", "visual-design", "color", "layout", "rendering",
      "wcag", "aria", "accessibility", "semantic-html", "performance-web",
      "css-architecture", "css-systems", "style-guide", "dashboard-design",
      "information-architecture", "progressive", "spa", "pwa", "web3"],
    verb: "implements",
    what: (w) => `${cap(w)} expertise for building and improving user interfaces and web experiences.`,
    useWhen: (w) => `Use when implementing ${w}, building UI components, or improving web frontend quality.`,
    triggers: (w, slug) => [`"${w}"`, `"build ${w}"`, `"implement ${w}"`, `"frontend ${slug}"`],
    workflowSteps: [
      "Review design specs, wireframes, or requirements",
      "Set up component structure and file organization",
      "Implement core functionality with proper state management",
      "Apply styling and responsive design patterns",
      "Handle edge cases, loading states, and error states",
      "Write unit and component tests",
      "Review for accessibility (WCAG 2.1 AA minimum)",
      "Optimize for performance (bundle size, render cycles, LCP/CLS)",
      "Document component API and usage examples",
    ],
    qualityBar: [
      "- All tests pass (unit, component, e2e)",
      "- Meets accessibility standards (WCAG 2.1 AA)",
      "- Responsive across target breakpoints",
      "- No console errors in production mode",
      "- Core Web Vitals within target thresholds",
    ],
  },

  backend: {
    keywords: ["api", "rest", "grpc", "graphql", "node", "express", "server",
      "backend", "endpoint", "route", "middleware", "session", "database",
      "sql", "postgres", "mysql", "mongo", "redis", "cache", "queue",
      "service", "microservice", "webhook", "rpc", "http", "business-logic",
      "pagination", "indexing", "connection-pooling", "idempotency",
      "versioning", "rate-limiting", "circuit-breakers", "retry", "timeout",
      "caching-strategy", "api-contracts", "api-integration", "api-development",
      "api-testing", "api-security", "api-reference", "rest-apis", "rest-design"],
    verb: "implements",
    what: (w) => `${cap(w)} expertise for building robust, scalable backend services and APIs.`,
    useWhen: (w) => `Use when implementing ${w}, designing APIs, or building server-side features.`,
    triggers: (w, slug) => [`"${w}"`, `"implement ${w}"`, `"build ${slug}"`, `"backend ${slug}"`],
    workflowSteps: [
      "Define API contract (OpenAPI spec) or data model",
      "Implement business logic with clear separation of concerns",
      "Add input validation and sanitization at entry points",
      "Implement authentication and authorization checks",
      "Add structured logging and observability instrumentation",
      "Write unit tests for business logic",
      "Write integration tests for API endpoints",
      "Review for security vulnerabilities (OWASP Top 10)",
      "Document API behavior, error codes, and examples",
    ],
    qualityBar: [
      "- All endpoints return correct HTTP status codes",
      "- Input validation rejects malformed requests with clear errors",
      "- Authentication/authorization enforced on all protected routes",
      "- Performance meets SLO targets (p95 latency)",
      "- No sensitive data leaked in error responses",
    ],
  },

  ops: {
    keywords: ["ci", "cd", "docker", "kubernetes", "k8s", "terraform", "ansible",
      "deploy", "infra", "infrastructure", "monitoring", "alerting", "logging",
      "observability", "devops", "pipeline", "helm", "aws", "gcp", "azure",
      "cloud", "container", "ecs", "vpc", "dns", "networking", "load-balancing",
      "scaling", "high-availability", "multi-region", "disaster-recovery",
      "runbook", "on-call", "incident", "slo", "sre", "platform", "golden-path",
      "developer-experience", "internal-developer-portal", "self-service",
      "deployment-strategy", "deployment-coordination", "rollback-strategy",
      "release-automation", "release-management", "canary", "progressive-rollout",
      "infrastructure-abstraction", "platform-engineering", "platform-reliability"],
    verb: "manages",
    what: (w) => `${cap(w)} expertise for operating and improving infrastructure, deployment, and platform reliability.`,
    useWhen: (w) => `Use when working on ${w}, setting up infrastructure, or improving operational practices.`,
    triggers: (w, slug) => [`"${w}"`, `"set up ${w}"`, `"configure ${slug}"`, `"deploy with ${slug}"`],
    workflowSteps: [
      "Assess current state, constraints, and requirements",
      "Design infrastructure or pipeline architecture",
      "Implement with Infrastructure as Code (IaC) where possible",
      "Add monitoring, alerting, and observability hooks",
      "Test in a staging environment before production",
      "Document runbooks and operational procedures",
      "Review for security, cost efficiency, and reliability",
      "Plan rollout and tested rollback strategy",
      "Validate SLO/SLA requirements are met",
    ],
    qualityBar: [
      "- Infrastructure is reproducible via IaC (Terraform/Helm/etc.)",
      "- Monitoring and alerts configured for all critical paths",
      "- Runbooks documented and reviewed",
      "- Rollback procedure tested and documented",
      "- Cost baseline established with budget alerts",
    ],
  },

  data: {
    keywords: ["data", "analytics", "etl", "warehouse", "spark", "kafka",
      "stream", "batch", "pipeline", "quality", "lineage", "catalog", "dbt",
      "lakehouse", "metrics", "dashboard", "reporting", "sql-modeling",
      "dimensional-modeling", "feature-store", "feature-engineering",
      "data-modeling", "data-pipelines", "data-transformation", "data-governance",
      "data-catalog", "data-visualization", "data-access", "data-documentation",
      "data-protection", "data-loading", "data-extraction", "data-lineage",
      "elt-transformations", "stream-processing", "backfill"],
    verb: "processes",
    what: (w) => `${cap(w)} expertise for building reliable, high-quality data systems and pipelines.`,
    useWhen: (w) => `Use when designing or implementing ${w}, building data pipelines, or ensuring data quality.`,
    triggers: (w, slug) => [`"${w}"`, `"build ${slug}"`, `"implement ${slug}"`, `"data ${slug}"`],
    workflowSteps: [
      "Understand data sources, schemas, and freshness requirements",
      "Design data model or pipeline architecture",
      "Implement ingestion and transformation logic",
      "Add data quality checks (nulls, duplicates, schema drift)",
      "Implement error handling, retry logic, and dead-letter queues",
      "Add monitoring, alerting, and data lineage tracking",
      "Write tests for transformations (unit + end-to-end)",
      "Document data definitions, lineage, and SLAs",
      "Validate output against business requirements",
    ],
    qualityBar: [
      "- Data quality checks pass (completeness, consistency, accuracy)",
      "- Pipeline is idempotent and resumable on failure",
      "- Lineage tracked and documented",
      "- Performance meets data freshness SLA",
      "- Schema changes are backwards compatible or versioned",
    ],
  },

  security: {
    keywords: ["security", "auth", "oauth", "jwt", "encryption", "vulnerability",
      "pentest", "owasp", "sast", "dast", "zero-trust", "secrets", "compliance",
      "audit", "threat", "risk", "access", "iam", "rbac", "abac", "firewall",
      "network-security", "pen-testing", "exploit-development", "code-audit",
      "security-audit", "security-automation", "security-coding",
      "security-infrastructure", "security-k8s", "security-node",
      "security-operations", "security-reporting", "security-standards",
      "supply-chain-security", "token-security", "password-security",
      "secret-management", "mfa", "sso", "oidc", "identity-federation",
      "identity-management", "session-management", "authentication",
      "authorization", "defense-in-depth", "attack-surface-mapping",
      "vulnerability-assessment", "vulnerability-management", "remediation-verification"],
    verb: "assesses and mitigates",
    what: (w) => `${cap(w)} expertise for identifying, assessing, and remediating security risks.`,
    useWhen: (w) => `Use when performing ${w}, assessing security posture, or implementing security controls.`,
    triggers: (w, slug) => [`"${w}"`, `"security review of ${slug}"`, `"audit ${slug}"`, `"assess ${slug}"`],
    workflowSteps: [
      "Define threat model and attack surface scope",
      "Assess current security posture and controls",
      "Identify vulnerabilities using manual and automated methods",
      "Prioritize findings by severity (CVSS score or business impact)",
      "Develop and implement mitigations or compensating controls",
      "Verify fixes with automated tests and manual validation",
      "Document findings, evidence, and remediation steps",
      "Map findings to compliance requirements if applicable",
      "Schedule ongoing monitoring and review cadence",
    ],
    qualityBar: [
      "- No critical or high severity vulnerabilities left unmitigated",
      "- All findings documented with evidence and CVSS scores",
      "- Compliance requirements mapped and addressed",
      "- Automated security scans configured in CI pipeline",
      "- Remediation timeline agreed with stakeholders",
    ],
  },

  management: {
    keywords: ["planning", "roadmap", "stakeholder", "strategy", "leadership",
      "team", "hiring", "mentorship", "onboarding", "sprint", "agile", "scrum",
      "product", "requirements", "prioritization", "communication", "coaching",
      "facilitation", "retrospective", "standup", "governance", "people-management",
      "team-building", "team-alignment", "team-health", "team-leadership",
      "team-coordination", "technical-leadership", "technical-strategy",
      "technical-vision", "career-development", "performance-management",
      "one-on-ones", "conflict-resolution", "conflict-facilitation",
      "decision-making", "change-management", "executive-communication",
      "cross-team-coordination", "cross-team-influence",
      "cross-organizational-leadership", "organizational-design",
      "organizational-impact", "organizational-influence", "program-governance",
      "program-closeout", "delivery-management", "milestone-planning",
      "resource-planning", "velocity-tracking", "dora-metrics",
      "engineering-culture", "engineering-leadership", "engineering-management",
      "innovation", "servant-leadership", "public-speaking"],
    verb: "facilitates",
    what: (w) => `${cap(w)} expertise for leading teams, aligning stakeholders, and delivering organizational outcomes.`,
    useWhen: (w) => `Use when facilitating ${w}, managing team dynamics, or driving organizational initiatives.`,
    triggers: (w, slug) => [`"${w}"`, `"facilitate ${slug}"`, `"plan ${slug}"`, `"manage ${slug}"`],
    workflowSteps: [
      "Gather context, goals, constraints, and stakeholder expectations",
      "Align with key stakeholders on priorities and success criteria",
      "Develop a clear plan, framework, or structure",
      "Communicate decisions and expectations clearly to all parties",
      "Execute with regular check-ins and adaptive adjustments",
      "Track progress against goals and surface blockers early",
      "Resolve impediments or escalate with context",
      "Document decisions, rationale, and outcomes",
      "Conduct retrospective and capture learnings for future cycles",
    ],
    qualityBar: [
      "- Stakeholders informed, aligned, and unblocked",
      "- Decisions documented with rationale",
      "- Progress tracked with clear visibility",
      "- Learnings captured and shared",
      "- Team health maintained",
    ],
  },

  quality: {
    keywords: ["testing", "test", "qa", "quality", "regression", "unit",
      "integration", "e2e", "coverage", "bug", "debugging", "triage",
      "automation", "flakiness", "exploratory-testing", "load-testing",
      "stress-testing", "performance-testing", "resilience-testing",
      "test-planning", "test-strategy", "test-infrastructure", "test-data-management",
      "page-object-model", "parallel-testing", "contract-testing",
      "risk-based-testing", "blockchain-testing", "firmware-testing",
      "testing-compilers", "testing-frontend", "testing-backend",
      "visual-qa", "quality-gates", "quality-metrics", "quality-culture",
      "qa-management", "automation-scripting", "automation-strategy",
      "edge-case-detection", "flakiness-management"],
    verb: "validates",
    what: (w) => `${cap(w)} expertise for ensuring software quality through systematic testing and validation.`,
    useWhen: (w) => `Use when implementing ${w}, writing test cases, or improving test coverage and reliability.`,
    triggers: (w, slug) => [`"${w}"`, `"write tests for ${slug}"`, `"test ${slug}"`, `"validate ${slug}"`],
    workflowSteps: [
      "Understand requirements and define test scope",
      "Design test strategy (unit / integration / e2e / exploratory)",
      "Write test cases covering happy path, edge cases, and error conditions",
      "Implement automated tests with clear naming and documentation",
      "Execute test suite and analyze results",
      "Triage failures: flaky tests vs. real bugs",
      "File bugs with reproduction steps, expected vs. actual behavior",
      "Verify bug fixes pass all relevant tests",
      "Report quality metrics and coverage trends",
    ],
    qualityBar: [
      "- Test coverage meets target threshold",
      "- All automated tests are deterministic (no flakiness)",
      "- Bugs documented with clear reproduction steps",
      "- Quality gate criteria satisfied for release",
      "- Test suite runs in acceptable time",
    ],
  },

  docs: {
    keywords: ["documentation", "docs", "writing", "readme", "changelog",
      "guide", "tutorial", "knowledge", "reference", "openapi", "sdk-documentation",
      "api-documentation", "technical-writing", "user-guides", "developer-guides",
      "developer-advocacy", "interactive-documentation", "docs-as-code",
      "documentation-strategy", "documentation-testing", "content-structure",
      "content-creation", "audience-analysis", "changelog-management",
      "code-examples", "webhook-documentation"],
    verb: "documents",
    what: (w) => `${cap(w)} expertise for creating clear, accurate, and useful technical documentation.`,
    useWhen: (w) => `Use when writing or improving ${w}, creating developer guides, or documenting APIs and systems.`,
    triggers: (w, slug) => [`"${w}"`, `"document ${slug}"`, `"write docs for ${slug}"`, `"create ${slug}"`],
    workflowSteps: [
      "Identify target audience and documentation goals",
      "Audit existing documentation for gaps and inaccuracies",
      "Gather technical details from code, SMEs, and product specs",
      "Structure content with clear information architecture",
      "Write accurate, concise, and example-rich content",
      "Add working code samples and usage examples",
      "Technical review: verify accuracy with engineering",
      "Editorial review: clarity, readability, consistency",
      "Publish, version, and set up a maintenance process",
    ],
    qualityBar: [
      "- Content is technically accurate and up-to-date",
      "- Code examples are tested and working",
      "- Clear and appropriate for target audience",
      "- Internal links and external references valid",
      "- Versioned alongside product releases",
    ],
  },

  distributed: {
    keywords: ["distributed", "consensus", "crdts", "eventual-consistency",
      "saga", "event-sourcing", "cqrs", "transaction", "replication",
      "partition", "cap", "raft", "paxos", "message-queues",
      "message-driven-architecture", "event-driven-architecture",
      "event-driven-integration", "event-modeling", "event-storming",
      "aggregate-design", "bounded-context-design", "domain-event-design",
      "domain-modeling", "ddd-patterns", "distributed-transactions",
      "distributed-tracing", "distributed-systems", "fault-tolerance",
      "graceful-degradation", "cap-theorem", "consistency-models"],
    verb: "designs and implements",
    what: (w) => `${cap(w)} expertise for building reliable distributed systems with strong consistency guarantees.`,
    useWhen: (w) => `Use when designing ${w}, handling distributed transactions, or ensuring consistency across services.`,
    triggers: (w, slug) => [`"${w}"`, `"design ${slug}"`, `"implement ${slug}"`, `"distributed ${slug}"`],
    workflowSteps: [
      "Define consistency, availability, and partition tolerance requirements (CAP trade-offs)",
      "Select appropriate distributed patterns (saga, event sourcing, CQRS, etc.)",
      "Design failure modes, recovery strategies, and compensating transactions",
      "Implement with idempotency guarantees for all operations",
      "Add distributed tracing across service boundaries",
      "Test failure scenarios with chaos engineering",
      "Document system behavior under network partitions",
      "Validate against consistency and durability requirements",
      "Set up observability for distributed flows (traces, metrics, logs)",
    ],
    qualityBar: [
      "- Idempotency guaranteed for all state mutations",
      "- Failure modes documented and handled",
      "- Distributed tracing instrumented end-to-end",
      "- Consistency model clearly documented",
      "- Chaos tests cover key failure scenarios",
    ],
  },

  mobile: {
    keywords: ["ios", "android", "react-native", "mobile", "offline-first",
      "push-notifications", "app-store-submission", "mobile-development",
      "accessibility-mobile", "performance-mobile", "responsive-mobile",
      "cross-platform", "camera-systems", "peripheral-drivers"],
    verb: "builds",
    what: (w) => `${cap(w)} expertise for building high-quality native and cross-platform mobile applications.`,
    useWhen: (w) => `Use when implementing ${w}, building mobile features, or optimizing mobile app quality.`,
    triggers: (w, slug) => [`"${w}"`, `"build ${slug}"`, `"mobile ${slug}"`, `"implement ${slug}"`],
    workflowSteps: [
      "Review platform-specific requirements (iOS/Android guidelines)",
      "Design UI following platform conventions (HIG/Material Design)",
      "Implement features with offline-first patterns where needed",
      "Handle app lifecycle events and background tasks",
      "Optimize for performance, battery life, and memory usage",
      "Test on physical devices across supported OS versions",
      "Review for accessibility (VoiceOver/TalkBack)",
      "Address crash reporting and error monitoring",
      "Prepare for app store submission (metadata, screenshots, review guidelines)",
    ],
    qualityBar: [
      "- Passes all platform-specific tests",
      "- Meets platform accessibility standards",
      "- Offline scenarios handled gracefully",
      "- App store guidelines compliant",
      "- Crash-free rate meets target (e.g. >99.9%)",
    ],
  },

  ml: {
    keywords: ["ml", "machine-learning", "model", "training", "inference",
      "embedding", "fine-tuning", "rag", "prompt-engineering", "llm",
      "deep-learning", "neural", "classification", "feature",
      "ai-agents", "ai-safety", "activation-engineering", "evaluation",
      "explainability", "output-parsing", "model-deployment", "model-evaluation",
      "model-monitoring", "model-optimization", "model-serving", "mlops",
      "ml-ci-cd", "ml-pipelines", "training-infrastructure",
      "vector-databases", "experiment-tracking", "reproducibility",
      "anomaly-detection", "behavioral-analysis"],
    verb: "develops",
    what: (w) => `${cap(w)} expertise for building, evaluating, and deploying machine learning systems.`,
    useWhen: (w) => `Use when developing ${w}, fine-tuning models, or setting up ML pipelines and evaluation.`,
    triggers: (w, slug) => [`"${w}"`, `"build ${slug}"`, `"train ${slug}"`, `"ml ${slug}"`],
    workflowSteps: [
      "Define problem statement, success metrics, and evaluation protocol",
      "Collect, validate, and document training and evaluation datasets",
      "Select model architecture or base model for fine-tuning",
      "Implement training/fine-tuning pipeline with experiment tracking",
      "Evaluate model against baseline and target metrics",
      "Optimize for inference performance (latency, throughput, cost)",
      "Set up model monitoring and drift detection in production",
      "Write model card (training data, limitations, metrics, intended use)",
      "Version model artifacts and document reproducibility steps",
    ],
    qualityBar: [
      "- Metrics meet or exceed target thresholds",
      "- Evaluation dataset is representative and unbiased",
      "- Model card documented with limitations",
      "- Inference latency meets SLO",
      "- Experiment is reproducible from logged artifacts",
    ],
  },

  game: {
    keywords: ["game", "gameplay", "player", "pathfinding", "physics",
      "shader", "shaders", "rendering", "gpu", "vulkan", "opengl", "directx",
      "ray-tracing", "post-processing", "frame-budgeting", "texture",
      "lighting", "pbr", "procedural-generation", "multiplayer-networking",
      "game-ai", "game-architecture", "game-days", "animation", "compute-shaders"],
    verb: "implements",
    what: (w) => `${cap(w)} expertise for game development, real-time systems, and interactive applications.`,
    useWhen: (w) => `Use when implementing ${w}, building game systems, or optimizing real-time rendering and simulation.`,
    triggers: (w, slug) => [`"${w}"`, `"implement ${slug}"`, `"game ${slug}"`, `"build ${slug}"`],
    workflowSteps: [
      "Define gameplay requirements and performance targets (frame budget)",
      "Design system architecture (entity-component, game loop, state machine)",
      "Implement core mechanic or system",
      "Profile performance against frame budget targets",
      "Optimize hot paths (CPU, GPU, memory allocation)",
      "Add debug visualization and tooling",
      "Test across target platforms and hardware tiers",
      "Document system design and performance characteristics",
    ],
    qualityBar: [
      "- Meets frame rate targets on all supported platforms",
      "- No memory leaks or excessive allocations in hot paths",
      "- Tested across hardware tiers",
      "- System is deterministic where required (multiplayer)",
    ],
  },

  systems: {
    keywords: ["embedded", "firmware", "rtos", "microcontroller", "real-time",
      "interrupt", "io-programming", "memory-management", "lock-free",
      "low-level", "systems-programming", "hardware", "peripheral",
      "compiler", "formal-verification", "type-systems", "formal-languages",
      "program-analysis", "parsing", "concurrency", "tcp-ip",
      "packet-analysis", "power-optimization"],
    verb: "implements",
    what: (w) => `${cap(w)} expertise for low-level systems programming, embedded development, and performance-critical code.`,
    useWhen: (w) => `Use when implementing ${w}, working with hardware interfaces, or optimizing system-level code.`,
    triggers: (w, slug) => [`"${w}"`, `"implement ${slug}"`, `"systems ${slug}"`, `"low-level ${slug}"`],
    workflowSteps: [
      "Define hardware constraints, timing requirements, and resource limits",
      "Design data structures and algorithms for the constrained environment",
      "Implement with explicit memory management and error handling",
      "Add hardware-specific validation and boundary condition checks",
      "Profile: CPU cycles, memory footprint, interrupt latency",
      "Test on target hardware with edge-case conditions",
      "Test failure modes: power loss, hardware fault injection",
      "Document interfaces, timing contracts, and resource usage",
    ],
    qualityBar: [
      "- Meets timing and resource constraints",
      "- No undefined behavior (validated with sanitizers/static analysis)",
      "- Tested on target hardware",
      "- Failure modes handled safely",
      "- Memory footprint within budget",
    ],
  },

  blockchain: {
    keywords: ["blockchain", "smart-contracts", "solidity", "ethereum", "defi",
      "web3", "erc-standards", "gas-optimization", "token-security",
      "oracle-integration", "consensus-protocols"],
    verb: "develops",
    what: (w) => `${cap(w)} expertise for blockchain development, smart contracts, and decentralized systems.`,
    useWhen: (w) => `Use when developing ${w}, auditing smart contracts, or building decentralized applications.`,
    triggers: (w, slug) => [`"${w}"`, `"build ${slug}"`, `"audit ${slug}"`, `"blockchain ${slug}"`],
    workflowSteps: [
      "Define on-chain vs off-chain logic boundaries",
      "Design contract architecture with upgradeability in mind",
      "Implement with gas optimization patterns from the start",
      "Audit for common vulnerabilities (reentrancy, overflow, access control)",
      "Write comprehensive tests (unit, invariant, fuzzing)",
      "Deploy to testnet and verify behavior",
      "Formal verification for critical paths where feasible",
      "Document ABI, events, and administrative functions",
    ],
    qualityBar: [
      "- No known vulnerability patterns present",
      "- Gas costs benchmarked and optimized",
      "- Tests include adversarial scenarios",
      "- Contract verified on block explorer",
    ],
  },

  product: {
    keywords: ["product-strategy", "prd", "user-research", "persona",
      "journey-mapping", "user-flow", "wireframing", "prototyping",
      "usability", "feedback", "survey", "interview", "card-sorting",
      "affinity-diagramming", "contextual-inquiry", "cohort-analysis",
      "funnel-analysis", "funnel-optimization", "retention", "retention-analysis",
      "growth-modeling", "referral-mechanics", "unit-economics",
      "build-vs-buy", "feature-intake", "research-synthesis",
      "rapid-prototyping", "design-handoff"],
    verb: "facilitates",
    what: (w) => `${cap(w)} expertise for product discovery, user research, and data-driven product decisions.`,
    useWhen: (w) => `Use when conducting ${w}, validating product hypotheses, or synthesizing user insights.`,
    triggers: (w, slug) => [`"${w}"`, `"run ${slug}"`, `"conduct ${slug}"`, `"product ${slug}"`],
    workflowSteps: [
      "Define research questions or product hypotheses",
      "Select appropriate method (interviews, surveys, analytics, etc.)",
      "Recruit or identify participants or data sources",
      "Execute research or analysis plan",
      "Synthesize findings into actionable insights",
      "Prioritize insights by impact and confidence",
      "Communicate findings to stakeholders",
      "Define success metrics and measurement plan",
      "Close the loop: validate decisions against outcomes",
    ],
    qualityBar: [
      "- Research questions answered with sufficient evidence",
      "- Insights tied to business metrics",
      "- Decisions documented with supporting evidence",
      "- Success metrics defined before launch",
    ],
  },
};

// ── Text helpers ──────────────────────────────────────────────────────────────

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function humanize(slug) {
  return slug.split("-").join(" ");
}

// ── Domain detection ──────────────────────────────────────────────────────────

/**
 * detectDomain(slug) → domain key string
 * Scores each domain by keyword match against slug words.
 */
// Words that should be ignored when scoring (too generic, appear everywhere)
const GENERIC_WORDS = new Set(["integration", "management", "design", "development", "engineering",
  "architecture", "implementation", "system", "service", "platform", "operations"]);

export function detectDomain(slug) {
  const words = slug.split("-");
  const scores = {};

  for (const [domain, config] of Object.entries(DOMAINS)) {
    scores[domain] = 0;

    // Full slug match
    if (config.keywords.includes(slug)) {
      scores[domain] += 10;
      continue;
    }

    for (const word of words) {
      if (GENERIC_WORDS.has(word)) continue; // skip generic words

      if (config.keywords.includes(word)) {
        scores[domain] += 3;
      }
      for (const kw of config.keywords) {
        if (kw !== word && kw !== slug &&
            (kw.startsWith(`${word}-`) || kw.endsWith(`-${word}`))) {
          scores[domain] += 0.5;
        }
      }
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[1] > 0 ? ranked[0][0] : "backend";
}

// ── Description generator ─────────────────────────────────────────────────────

/**
 * generateDescription(slug, domainKey) → description string ≤1024 chars
 * Format: "What it does. Use when X. Triggers: 'phrase1', 'phrase2'."
 */
export function generateDescription(slug, domainKey) {
  const words = humanize(slug);
  const domain = DOMAINS[domainKey] || DOMAINS.backend;

  const what = domain.what(words);
  const useWhen = domain.useWhen(words);
  const triggerPhrases = domain.triggers(words, slug);
  const triggers = `Triggers: ${triggerPhrases.join(", ")}.`;

  const full = `${what} ${useWhen} ${triggers}`;
  return full.length <= 1024 ? full : full.slice(0, 1021) + "...";
}

// ── Body generator ────────────────────────────────────────────────────────────

/**
 * generateBody(slug, domainKey, opts?) → SKILL.md body string
 * opts.includeScripts: boolean — add ## Scripts section template
 */
export function generateBody(slug, domainKey, opts = {}) {
  const words = humanize(slug);
  const title = cap(words);
  const domain = DOMAINS[domainKey] || DOMAINS.backend;

  const steps = domain.workflowSteps
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");

  const qualityLines = domain.qualityBar.join("\n");

  let scriptsSection = "";
  if (opts.includeScripts) {
    scriptsSection = `
## Scripts

Reference scripts for automating ${words} tasks (loaded on demand — lazy loading):

- \`scripts/analyze.mjs\` — analyzes ${words} artifacts and reports issues
- \`scripts/fix.mjs\` — applies automated fixes for common ${words} problems

> Place scripts in \`skills/${slug}/scripts/\` (self-contained) or reference any repo path.
`;
  }

  return `# ${title}

## When to Use

Activate this skill when:
- Working on ${words} tasks
- Reviewing or improving existing ${words} implementations
- Troubleshooting issues related to ${words}
- Setting up or configuring ${words} from scratch

## Workflow

${steps}

## Quality Bar

${qualityLines}
${scriptsSection}
## Related Skills

See complementary skills in the same domain for additional workflows.
`;
}

// ── Full SKILL.md content generator ──────────────────────────────────────────

/**
 * generateSkillContent(slug, opts?) → { frontmatter, body, content, domain }
 * opts.domain: override detected domain
 * opts.description: override generated description
 * opts.includeScripts: add ## Scripts section
 * opts.overwrite: allow overwriting existing files
 */
export function generateSkillContent(slug, opts = {}) {
  const domainKey = opts.domain || detectDomain(slug);
  const description = opts.description || generateDescription(slug, domainKey);
  const body = generateBody(slug, domainKey, opts);
  const frontmatter = `---\nname: ${slug}\ndescription: ${description}\n---\n`;
  const content = frontmatter + "\n" + body;

  return { frontmatter, body, content, domain: domainKey };
}

// ── File writer ───────────────────────────────────────────────────────────────

/**
 * writeSkillFile(skillsDir, slug, opts?) → { wrote, path, reason? }
 * Writes SKILL.md to skillsDir/{slug}/SKILL.md.
 * Skips if file already exists (unless opts.overwrite = true).
 */
export function writeSkillFile(skillsDir, slug, opts = {}) {
  const dir = join(skillsDir, slug);
  const path = join(dir, "SKILL.md");

  if (existsSync(path) && !opts.overwrite) {
    return { wrote: false, path, reason: "exists" };
  }

  const { content } = generateSkillContent(slug, opts);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf-8");

  return { wrote: true, path };
}

// ── Batch generator ───────────────────────────────────────────────────────────

/**
 * generateMissingSkills(skillsDir, slugs, opts?) → { generated, skipped, errors }
 * Generates SKILL.md for each slug that doesn't already have one.
 */
export function generateMissingSkills(skillsDir, slugs, opts = {}) {
  const generated = [];
  const skipped = [];
  const errors = [];

  for (const slug of slugs) {
    try {
      const result = writeSkillFile(skillsDir, slug, opts);
      if (result.wrote) {
        generated.push(slug);
      } else {
        skipped.push(slug);
      }
    } catch (e) {
      errors.push({ slug, error: e.message });
    }
  }

  return { generated, skipped, errors };
}

// ── Playbook scanner ──────────────────────────────────────────────────────────

/**
 * scanPlaybooksForSkills(playbooksDir) → string[]
 * Reads all markdown files in playbooksDir recursively and extracts skill slugs
 * from <!-- skills: skill-a, skill-b --> comments.
 */
export function scanPlaybooksForSkills(playbooksDir) {
  const skills = new Set();
  const regex = /<!--\s*skills:\s*([\w,\s-]+?)-->/g;

  function scanDir(dir) {
    if (!existsSync(dir)) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith(".md")) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          let m;
          regex.lastIndex = 0;
          while ((m = regex.exec(content)) !== null) {
            const names = m[1].split(",").map(s => s.trim()).filter(Boolean);
            for (const name of names) skills.add(name);
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  scanDir(playbooksDir);
  return [...skills].sort();
}

// ── Default paths ─────────────────────────────────────────────────────────────

export function defaultSkillsDir() {
  const thisFile = fileURLToPath(new URL(import.meta.url));
  return join(thisFile, "..", "..", "skills");
}

export function defaultPlaybooksDir() {
  const thisFile = fileURLToPath(new URL(import.meta.url));
  // thisFile = tools/ogu/commands/lib/skill-generator.mjs
  // go up: lib → commands → ogu → tools/../playbooks = tools/ogu/playbooks
  return join(thisFile, "..", "..", "..", "playbooks");
}

export { DOMAINS };
