/**
 * role-taxonomy.mjs — Slice 383
 * Single source of truth for all 64 marketplace agent roles.
 * Categories, display names, minimum tiers, and capacity units.
 */

export const ROLE_TAXONOMY = {
  // ── Product (6 roles) ──
  "product-manager":       { category: "product",       displayName: "Product Manager",         minTier: 1, capacityUnits: 6  },
  "ux-researcher":         { category: "product",       displayName: "UX Researcher",           minTier: 1, capacityUnits: 6  },
  "ux-designer":           { category: "product",       displayName: "UX Designer",             minTier: 1, capacityUnits: 8  },
  "product-analyst":       { category: "product",       displayName: "Product Analyst",         minTier: 1, capacityUnits: 6  },
  "growth-engineer":       { category: "product",       displayName: "Growth Engineer",         minTier: 2, capacityUnits: 8  },
  "scrum-master":          { category: "product",       displayName: "Scrum Master",            minTier: 1, capacityUnits: 6  },
  "program-manager":       { category: "product",       displayName: "Program Manager",         minTier: 2, capacityUnits: 6  },
  "engineering-manager":   { category: "product",       displayName: "Engineering Manager",     minTier: 2, capacityUnits: 6  },

  // ── Architecture (6 roles) ──
  "backend-architect":     { category: "architecture",  displayName: "Backend Architect",       minTier: 2, capacityUnits: 8  },
  "cloud-architect":       { category: "architecture",  displayName: "Cloud Architect",         minTier: 2, capacityUnits: 8  },
  "solutions-architect":   { category: "architecture",  displayName: "Solutions Architect",     minTier: 2, capacityUnits: 8  },
  "domain-modeler":        { category: "architecture",  displayName: "Domain Modeler",          minTier: 2, capacityUnits: 6  },
  "integration-architect": { category: "architecture",  displayName: "Integration Architect",   minTier: 2, capacityUnits: 8  },
  "event-architect":       { category: "architecture",  displayName: "Event Architect",         minTier: 2, capacityUnits: 8  },
  "api-designer":          { category: "architecture",  displayName: "API Designer",            minTier: 2, capacityUnits: 8  },

  // ── Engineering (10 roles) ──
  "frontend-developer":    { category: "engineering",   displayName: "Frontend Developer",      minTier: 1, capacityUnits: 10 },
  "backend-developer":     { category: "engineering",   displayName: "Backend Developer",       minTier: 1, capacityUnits: 10 },
  "full-stack-developer":  { category: "engineering",   displayName: "Full-Stack Developer",    minTier: 1, capacityUnits: 10 },
  "mobile-developer":      { category: "engineering",   displayName: "Mobile Developer",        minTier: 1, capacityUnits: 10 },
  "ui-developer":          { category: "engineering",   displayName: "UI Developer",            minTier: 1, capacityUnits: 10 },
  "systems-programmer":    { category: "engineering",   displayName: "Systems Programmer",      minTier: 2, capacityUnits: 8  },
  "compiler-engineer":     { category: "engineering",   displayName: "Compiler Engineer",       minTier: 3, capacityUnits: 6  },
  "tech-lead":             { category: "engineering",   displayName: "Tech Lead",               minTier: 2, capacityUnits: 8  },

  // ── Quality (5 roles) ──
  "qa-engineer":           { category: "quality",       displayName: "QA Engineer",             minTier: 1, capacityUnits: 8  },
  "test-automation":       { category: "quality",       displayName: "Test Automation Engineer", minTier: 1, capacityUnits: 8  },
  "performance-tester":    { category: "quality",       displayName: "Performance Tester",      minTier: 2, capacityUnits: 8  },
  "accessibility-expert":  { category: "quality",       displayName: "Accessibility Expert",    minTier: 2, capacityUnits: 6  },
  "qa-lead":               { category: "quality",       displayName: "QA Lead",                 minTier: 2, capacityUnits: 6  },

  // ── Security (6 roles) ──
  "security-architect":    { category: "security",      displayName: "Security Architect",      minTier: 2, capacityUnits: 8  },
  "security-auditor":      { category: "security",      displayName: "Security Auditor",        minTier: 2, capacityUnits: 8  },
  "penetration-tester":    { category: "security",      displayName: "Penetration Tester",      minTier: 2, capacityUnits: 8  },
  "compliance-officer":    { category: "security",      displayName: "Compliance Officer",      minTier: 2, capacityUnits: 6  },
  "devsecops-engineer":    { category: "security",      displayName: "DevSecOps Engineer",      minTier: 2, capacityUnits: 8  },
  "identity-engineer":     { category: "security",      displayName: "Identity Engineer",       minTier: 2, capacityUnits: 8  },

  // ── DevOps (8 roles) ──
  "devops-engineer":       { category: "devops",        displayName: "DevOps Engineer",         minTier: 1, capacityUnits: 8  },
  "site-reliability":      { category: "devops",        displayName: "Site Reliability Engineer", minTier: 2, capacityUnits: 8  },
  "release-manager":       { category: "devops",        displayName: "Release Manager",         minTier: 1, capacityUnits: 6  },
  "platform-engineer":     { category: "devops",        displayName: "Platform Engineer",       minTier: 2, capacityUnits: 8  },
  "incident-commander":    { category: "devops",        displayName: "Incident Commander",      minTier: 2, capacityUnits: 6  },
  "chaos-engineer":        { category: "devops",        displayName: "Chaos Engineer",          minTier: 3, capacityUnits: 6  },
  "cost-optimizer":        { category: "devops",        displayName: "Cost Optimizer",          minTier: 2, capacityUnits: 6  },
  "observability-engineer":{ category: "devops",        displayName: "Observability Engineer",  minTier: 2, capacityUnits: 8  },
  "infra-engineer":        { category: "devops",        displayName: "Infrastructure Engineer", minTier: 1, capacityUnits: 8  },

  // ── Data (5 roles) ──
  "data-engineer":         { category: "data",          displayName: "Data Engineer",           minTier: 1, capacityUnits: 8  },
  "data-scientist":        { category: "data",          displayName: "Data Scientist",          minTier: 2, capacityUnits: 6  },
  "analytics-engineer":    { category: "data",          displayName: "Analytics Engineer",      minTier: 1, capacityUnits: 8  },
  "ml-engineer":           { category: "data",          displayName: "ML Engineer",             minTier: 2, capacityUnits: 8  },
  "database-admin":        { category: "data",          displayName: "Database Administrator",  minTier: 2, capacityUnits: 8  },
  "etl-developer":         { category: "data",          displayName: "ETL Developer",           minTier: 1, capacityUnits: 8  },

  // ── Documentation (3 roles) ──
  "technical-writer":      { category: "documentation", displayName: "Technical Writer",        minTier: 1, capacityUnits: 6  },
  "developer-advocate":    { category: "documentation", displayName: "Developer Advocate",      minTier: 2, capacityUnits: 6  },
  "api-documentarian":     { category: "documentation", displayName: "API Documentarian",       minTier: 1, capacityUnits: 6  },

  // ── Expert (8 roles) ──
  "scale-performance":     { category: "expert",        displayName: "Scale & Performance Expert", minTier: 3, capacityUnits: 6  },
  "ai-engineer":           { category: "expert",        displayName: "AI Engineer",             minTier: 3, capacityUnits: 6  },
  "blockchain-developer":  { category: "expert",        displayName: "Blockchain Developer",    minTier: 3, capacityUnits: 6  },
  "embedded-engineer":     { category: "expert",        displayName: "Embedded Engineer",       minTier: 3, capacityUnits: 6  },
  "graphics-programmer":   { category: "expert",        displayName: "Graphics Programmer",     minTier: 3, capacityUnits: 6  },
  "game-developer":        { category: "expert",        displayName: "Game Developer",          minTier: 3, capacityUnits: 6  },
  "networking-engineer":   { category: "expert",        displayName: "Networking Engineer",     minTier: 3, capacityUnits: 6  },
  "distributed-systems":   { category: "expert",        displayName: "Distributed Systems Expert", minTier: 3, capacityUnits: 6  },
  "cto":                   { category: "expert",        displayName: "CTO",                     minTier: 4, capacityUnits: 4  },
  "vp-engineering":        { category: "expert",        displayName: "VP Engineering",          minTier: 4, capacityUnits: 4  },
  "staff-engineer":        { category: "expert",        displayName: "Staff Engineer",          minTier: 3, capacityUnits: 6  },
  "principal-engineer":    { category: "expert",        displayName: "Principal Engineer",      minTier: 3, capacityUnits: 6  },
};

/**
 * All unique category names.
 */
export const CATEGORIES = [...new Set(Object.values(ROLE_TAXONOMY).map(r => r.category))].sort();

/**
 * getRolesByCategory(category) → [{ slug, ...config }]
 */
export function getRolesByCategory(category) {
  return Object.entries(ROLE_TAXONOMY)
    .filter(([, cfg]) => cfg.category === category)
    .map(([slug, cfg]) => ({ slug, ...cfg }));
}

/**
 * getRoleConfig(slug) → config | null
 */
export function getRoleConfig(slug) {
  return ROLE_TAXONOMY[slug] || null;
}

/**
 * isExpertRole(slug) → boolean
 * Expert roles have category "expert" and minTier >= 3.
 */
export function isExpertRole(slug) {
  const cfg = ROLE_TAXONOMY[slug];
  if (!cfg) return false;
  return cfg.category === "expert" && cfg.minTier >= 3;
}

/**
 * getAllSlugs() → string[]
 */
export function getAllSlugs() {
  return Object.keys(ROLE_TAXONOMY);
}
