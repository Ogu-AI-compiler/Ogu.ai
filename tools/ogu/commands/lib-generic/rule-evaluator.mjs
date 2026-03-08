/**
 * Rule Evaluator — named rules with multiple conditions.
 */
import { evaluateCondition } from './condition-evaluator.mjs';

export function createRuleEvaluator() {
  const rules = new Map();
  function addRule(name, conditions) { rules.set(name, conditions); }
  function evaluate(name, data) {
    const conditions = rules.get(name);
    if (!conditions) return false;
    return conditions.every(c => evaluateCondition(c, data));
  }
  function listRules() { return [...rules.keys()]; }
  return { addRule, evaluate, listRules };
}
