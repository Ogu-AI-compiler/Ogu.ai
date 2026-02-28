/**
 * Cron Expression Parser — parse and evaluate cron expressions.
 */
export function parse(expr) {
  const parts = expr.trim().split(/\s+/);
  return {
    minute: parts[0] || "*",
    hour: parts[1] || "*",
    dayOfMonth: parts[2] || "*",
    month: parts[3] || "*",
    dayOfWeek: parts[4] || "*"
  };
}

export function matches(expr, date) {
  const cron = parse(expr);
  return (
    fieldMatches(cron.minute, date.getMinutes()) &&
    fieldMatches(cron.hour, date.getHours()) &&
    fieldMatches(cron.dayOfMonth, date.getDate()) &&
    fieldMatches(cron.month, date.getMonth() + 1) &&
    fieldMatches(cron.dayOfWeek, date.getDay())
  );
}

function fieldMatches(field, value) {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    return value % step === 0;
  }
  if (field.includes(",")) {
    return field.split(",").some(v => parseInt(v, 10) === value);
  }
  if (field.includes("-")) {
    const [lo, hi] = field.split("-").map(Number);
    return value >= lo && value <= hi;
  }
  return parseInt(field, 10) === value;
}
