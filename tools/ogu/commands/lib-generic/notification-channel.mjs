/**
 * Notification Channel — multi-channel notifications.
 */

export const NOTIFICATION_CHANNELS = ['console', 'file', 'webhook'];

const SEVERITY_ORDER = { info: 0, warning: 1, error: 2, critical: 3 };

/**
 * Create a notifier instance.
 *
 * @param {{ root: string, minSeverity?: string }} opts
 * @returns {object} Notifier with send/getHistory
 */
export function createNotifier({ root, minSeverity = 'info' } = {}) {
  const history = [];

  function send({ channel, severity, title, message }) {
    const minLevel = SEVERITY_ORDER[minSeverity] || 0;
    const level = SEVERITY_ORDER[severity] || 0;
    if (level < minLevel) return;

    const entry = {
      channel,
      severity,
      title,
      message,
      timestamp: Date.now(),
    };
    history.push(entry);
  }

  function getHistory() {
    return [...history];
  }

  return { send, getHistory };
}
