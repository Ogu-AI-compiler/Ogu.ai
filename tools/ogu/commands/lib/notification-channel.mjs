/**
 * notification-channel.mjs — Multi-channel notification dispatcher.
 */
const SEVERITY_ORDER = ['debug', 'info', 'warn', 'error', 'critical'];

export function createNotifier({ root, minSeverity = 'info' } = {}) {
  const minIdx = SEVERITY_ORDER.indexOf(minSeverity);

  return {
    send({ channel = 'console', severity = 'info', title, message } = {}) {
      if (SEVERITY_ORDER.indexOf(severity) < minIdx) return;
      if (channel === 'console' || channel === '*') {
        const prefix = `[${severity.toUpperCase()}]${title ? ` ${title}:` : ''}`;
        severity === 'error' || severity === 'critical' ? console.error(prefix, message) : console.log(prefix, message);
      }
    },
    canSend(severity) { return SEVERITY_ORDER.indexOf(severity) >= minIdx; },
  };
}
