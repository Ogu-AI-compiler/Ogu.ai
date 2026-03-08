/**
 * String Template — mustache-style {{var}} template rendering.
 */
export function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match;
  });
}
