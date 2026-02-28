/**
 * @ogu/contracts — Shared schemas, envelopes, and error codes
 *
 * The single source of truth for all data structures in the Agentic Company OS.
 * Every service (CLI, Kadima, Runner, Studio) imports from here.
 */

// ── Schemas ──
export { AuditEventSchema, AuditEventTypes } from './schemas/audit-event.mjs';
export { OrgSpecSchema, AgentRoleSchema, ProviderConfigSchema, BudgetConfigSchema, TeamSchema, CapabilitySchema } from './schemas/org-spec.mjs';
export { AgentStateSchema, AgentSessionSchema } from './schemas/agent-identity.mjs';
export { FeatureStateSchema, FeatureStates, ValidTransitions, isValidTransition } from './schemas/feature-state.mjs';
export { PolicyRuleSchema, PolicyRuleSetSchema, PolicyEffectSchema } from './schemas/policy-rule.mjs';
export { BudgetTransactionSchema, BudgetStateSchema } from './schemas/budget-entry.mjs';
export { InputEnvelopeSchema } from './schemas/input-envelope.mjs';
export { OutputEnvelopeSchema } from './schemas/output-envelope.mjs';

// ── Envelope builders ──
export { buildInputEnvelope } from './envelopes/input.mjs';
export { buildOutputEnvelope, buildFailureEnvelope } from './envelopes/output.mjs';

// ── Errors ──
export { OguError } from './errors/error.mjs';
export { ALL_ERRORS, lookupError } from './errors/codes.mjs';
