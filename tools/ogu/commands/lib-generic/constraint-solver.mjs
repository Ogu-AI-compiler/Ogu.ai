/**
 * Constraint Solver — solve constraints over variables.
 */

export function createConstraintSolver() {
  const constraints = [];

  function addConstraint(fn, name) {
    constraints.push({ fn, name: name || `constraint-${constraints.length}` });
  }

  function solve(variables) {
    for (const c of constraints) {
      if (!c.fn(variables)) {
        return { satisfied: false, failedConstraint: c.name };
      }
    }
    return { satisfied: true };
  }

  return { addConstraint, solve };
}
