/**
 * Condition Evaluator — evaluate field conditions against data.
 */
export function evaluateCondition(condition, data) {
  const { field, op, value } = condition;
  const actual = data[field];
  switch (op) {
    case 'eq': return actual === value;
    case 'neq': return actual !== value;
    case 'gt': return actual > value;
    case 'gte': return actual >= value;
    case 'lt': return actual < value;
    case 'lte': return actual <= value;
    case 'contains': return String(actual).toLowerCase().includes(String(value).toLowerCase());
    case 'startsWith': return String(actual).startsWith(String(value));
    case 'endsWith': return String(actual).endsWith(String(value));
    default: return false;
  }
}
