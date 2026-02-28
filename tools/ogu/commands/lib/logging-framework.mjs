/**
 * Logging Framework — structured logging with levels, JSON/human format.
 */

export const LOG_LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Format a log entry as JSON.
 * @param {object} entry
 * @returns {string}
 */
export function formatJSON(entry) {
  return JSON.stringify(entry);
}

/**
 * Format a log entry as a human-readable string.
 * @param {object} entry
 * @returns {string}
 */
export function formatHuman(entry) {
  const lvl = (entry.level || 'info').toUpperCase().padEnd(5);
  const ts = entry.timestamp || new Date().toISOString();
  const data = entry.data && Object.keys(entry.data).length > 0
    ? ' ' + JSON.stringify(entry.data)
    : '';
  return `[${ts}] ${lvl} ${entry.message}${data}`;
}

/**
 * Create a structured logger.
 *
 * @param {{ level?: string, sink?: (entry: object) => void }} opts
 * @returns {object} Logger with trace/debug/info/warn/error/fatal methods
 */
export function createLogger({ level = 'info', sink } = {}) {
  const minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;

  function log(lvl, message, data) {
    if ((LOG_LEVELS[lvl] ?? 0) < minLevel) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      message,
      data: data || {},
    };
    if (sink) {
      sink(entry);
    }
  }

  return {
    trace: (msg, data) => log('trace', msg, data),
    debug: (msg, data) => log('debug', msg, data),
    info:  (msg, data) => log('info', msg, data),
    warn:  (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    fatal: (msg, data) => log('fatal', msg, data),
  };
}
