/**
 * Alert Manager — manage alert lifecycle (fire, acknowledge, resolve, silence).
 */

let nextId = 1;

/**
 * Create an alert manager.
 *
 * @returns {object} Manager with fire/acknowledge/resolve/silence/getActiveAlerts
 */
export function createAlertManager() {
  const alerts = new Map();
  const silenced = new Map(); // name → { until }

  function fire({ name, severity, message }) {
    const id = `alert-${nextId++}`;
    const isSilenced = silenced.has(name) && silenced.get(name).until > Date.now();
    const alert = {
      id,
      name,
      severity,
      message,
      status: 'firing',
      silenced: isSilenced,
      firedAt: Date.now(),
    };
    alerts.set(id, alert);
    return alert;
  }

  function acknowledge(id, { by }) {
    const alert = alerts.get(id);
    if (!alert) throw new Error(`Alert ${id} not found`);
    alert.status = 'acknowledged';
    alert.acknowledgedBy = by;
    alert.acknowledgedAt = Date.now();
    return alert;
  }

  function resolve(id, { by, resolution }) {
    const alert = alerts.get(id);
    if (!alert) throw new Error(`Alert ${id} not found`);
    alert.status = 'resolved';
    alert.resolvedBy = by;
    alert.resolution = resolution;
    alert.resolvedAt = Date.now();
    return alert;
  }

  function silence(name, { duration }) {
    silenced.set(name, { until: Date.now() + duration });
  }

  function getActiveAlerts() {
    return Array.from(alerts.values()).filter(a => a.status !== 'resolved');
  }

  return { fire, acknowledge, resolve, silence, getActiveAlerts };
}
