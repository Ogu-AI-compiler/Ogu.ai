/**
 * Branch Strategy — define and validate branch naming strategies.
 */
export function createBranchStrategy(patterns = {}) {
  const rules = { feature: /^feature\//, bugfix: /^bugfix\//, release: /^release\//, hotfix: /^hotfix\//, ...patterns };
  function classify(branchName) {
    for (const [type, pattern] of Object.entries(rules)) {
      if (pattern.test(branchName)) return type;
    }
    return 'other';
  }
  function isValid(branchName) {
    return classify(branchName) !== 'other';
  }
  function suggest(type, name) {
    return `${type}/${name}`;
  }
  function listTypes() { return Object.keys(rules); }
  return { classify, isValid, suggest, listTypes };
}
