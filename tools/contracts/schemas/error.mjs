import { z } from 'zod';

/**
 * OGU Error Code Schema — formal error codes with severity and source.
 *
 * Error codes follow the pattern OGU#### where #### is a 4-digit number.
 * Categories:
 *   OGU1xxx — Validation errors (spec, contracts, IR)
 *   OGU2xxx — Governance & authorization errors
 *   OGU3xxx — Sandbox & isolation errors
 *   OGU4xxx — Budget & resource errors
 *   OGU5xxx — Transaction & consistency errors
 *   OGU6xxx — Runtime & execution errors
 *   OGU7xxx — Agent & session errors
 *   OGU8xxx — Infrastructure errors (filesystem, network)
 *   OGU9xxx — System halt & emergency errors
 */

export const ErrorCodeSchema = z.object({
  /** OGU error code, e.g. "OGU1001" */
  code: z.string().regex(/^OGU\d{4}$/),

  /** Human-readable error message */
  message: z.string().min(1),

  /** Error severity */
  severity: z.enum(['info', 'warning', 'error', 'critical', 'fatal']),

  /** Source module that raised the error */
  source: z.string().min(1),

  /** ISO 8601 timestamp */
  timestamp: z.string().datetime(),

  /** Optional: feature slug context */
  featureSlug: z.string().optional(),

  /** Optional: task ID context */
  taskId: z.string().optional(),

  /** Optional: additional context data */
  context: z.record(z.unknown()).optional(),
});

export const ERROR_CATEGORIES = {
  '1': { range: [1000, 1999], label: 'Validation', description: 'Spec, contracts, IR validation errors' },
  '2': { range: [2000, 2999], label: 'Governance', description: 'Governance & authorization errors' },
  '3': { range: [3000, 3999], label: 'Sandbox', description: 'Sandbox & isolation errors' },
  '4': { range: [4000, 4999], label: 'Budget', description: 'Budget & resource errors' },
  '5': { range: [5000, 5999], label: 'Transaction', description: 'Transaction & consistency errors' },
  '6': { range: [6000, 6999], label: 'Runtime', description: 'Runtime & execution errors' },
  '7': { range: [7000, 7999], label: 'Agent', description: 'Agent & session errors' },
  '8': { range: [8000, 8999], label: 'Infrastructure', description: 'Filesystem, network errors' },
  '9': { range: [9000, 9999], label: 'System', description: 'System halt & emergency errors' },
};

/**
 * Validate an error code string.
 * @param {string} code - e.g. "OGU1001"
 * @returns {{ valid: boolean, category?: string, number?: number }}
 */
export function validateErrorCode(code) {
  if (!code || typeof code !== 'string') return { valid: false };
  const match = code.match(/^OGU(\d{4})$/);
  if (!match) return { valid: false };
  const num = parseInt(match[1], 10);
  const catKey = match[1][0];
  const cat = ERROR_CATEGORIES[catKey];
  if (!cat) return { valid: false };
  if (num < cat.range[0] || num > cat.range[1]) return { valid: false };
  return { valid: true, category: cat.label, number: num };
}

/**
 * Create a structured error object.
 * @param {string} code
 * @param {string} message
 * @param {object} [opts]
 * @returns {object} Validated error object
 */
export function createError(code, message, { severity = 'error', source = 'unknown', featureSlug, taskId, context } = {}) {
  return {
    code,
    message,
    severity,
    source,
    timestamp: new Date().toISOString(),
    featureSlug,
    taskId,
    context,
  };
}
