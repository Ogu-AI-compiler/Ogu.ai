import { lookupError } from './codes.mjs';

/**
 * Structured error class for the Company OS.
 * Every error has a formal OGU code, name, severity, and optional context.
 */
export class OguError extends Error {
  /**
   * @param {string} code - Error code, e.g. 'OGU2001'
   * @param {string} [detail] - Human-readable detail
   * @param {Record<string, unknown>} [context] - Structured context for audit
   */
  constructor(code, detail, context = {}) {
    const known = lookupError(code);
    const name = known?.name || 'UNKNOWN_ERROR';
    const severity = known?.severity || 'error';

    super(`${code} (${name}): ${detail || 'No detail provided'}`);

    this.code = code;
    this.errorName = name;
    this.severity = severity;
    this.detail = detail;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  /** Serialize for audit log / OutputEnvelope */
  toJSON() {
    return {
      code: this.code,
      name: this.errorName,
      severity: this.severity,
      detail: this.detail,
      context: this.context,
      timestamp: this.timestamp,
    };
  }

  /** Check if this is a critical error that should halt operations */
  isCritical() {
    return this.severity === 'critical';
  }

  /** Format for CLI output */
  toCliString() {
    const icon = this.severity === 'critical' ? '!!!'
      : this.severity === 'error' ? '!!'
      : '!';
    return `[${icon}] ${this.code} ${this.errorName}: ${this.detail || ''}`;
  }
}
