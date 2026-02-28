/**
 * Navigation History — browser-like back/forward navigation.
 */
export function createNavigationHistory() {
  const backStack = [];
  const forwardStack = [];
  let current = null;
  function navigate(location) {
    if (current !== null) backStack.push(current);
    current = location;
    forwardStack.length = 0;
  }
  function back() {
    if (backStack.length === 0) return null;
    forwardStack.push(current);
    current = backStack.pop();
    return current;
  }
  function forward() {
    if (forwardStack.length === 0) return null;
    backStack.push(current);
    current = forwardStack.pop();
    return current;
  }
  function getCurrent() { return current; }
  function canGoBack() { return backStack.length > 0; }
  function canGoForward() { return forwardStack.length > 0; }
  return { navigate, back, forward, getCurrent, canGoBack, canGoForward };
}
