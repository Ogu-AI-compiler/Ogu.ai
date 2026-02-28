/**
 * Cron Parser — parse cron expressions.
 */
export function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return { minute, hour, dayOfMonth, month, dayOfWeek, raw: expr };
}

export function describeCron(parsed) {
  if (!parsed) return 'Invalid cron expression';
  const parts = [];
  if (parsed.minute === '*') parts.push('every minute');
  else parts.push(`at minute ${parsed.minute}`);
  if (parsed.hour === '*') parts.push('every hour');
  else parts.push(`at hour ${parsed.hour}`);
  if (parsed.dayOfMonth !== '*') parts.push(`on day ${parsed.dayOfMonth}`);
  if (parsed.month !== '*') parts.push(`in month ${parsed.month}`);
  if (parsed.dayOfWeek !== '*') parts.push(`on weekday ${parsed.dayOfWeek}`);
  return parts.join(', ');
}

export function isValidCron(expr) { return parseCron(expr) !== null; }
