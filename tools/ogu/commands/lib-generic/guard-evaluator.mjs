/**
 * Guard Evaluator — evaluate transition guards and conditions.
 */

export function createGuardEvaluator() {
  const guards = new Map();

  function addGuard(name, fn) {
    guards.set(name, fn);
  }

  function evaluate(name, context) {
    const guard = guards.get(name);
    if (!guard) return { allowed: false, reason: `Unknown guard: ${name}` };
    const result = guard(context);
    return { allowed: !!result, guard: name };
  }

  function evaluateAll(names, context) {
    for (const name of names) {
      const result = evaluate(name, context);
      if (!result.allowed) {
        return { allowed: false, failedGuard: name };
      }
    }
    return { allowed: true };
  }

  return { addGuard, evaluate, evaluateAll };
}
