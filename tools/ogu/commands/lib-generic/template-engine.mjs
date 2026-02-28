/**
 * Template Engine — variable substitution, conditionals, loops.
 *
 * Supports: {{var}}, {{obj.prop}}, {{#if var}}...{{/if}}, {{#each arr}}...{{/each}}
 */

/**
 * Render a template string with context data.
 *
 * @param {string} template - Template with {{placeholders}}
 * @param {object} context - Data for substitution
 * @returns {string} Rendered output
 */
export function render(template, context) {
  let result = template;

  // Process {{#each items}} ... {{/each}}
  result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
    const arr = resolve(context, key);
    if (!Array.isArray(arr)) return '';
    return arr.map(item => body.replace(/\{\{\.\}\}/g, String(item))).join('');
  });

  // Process {{#if var}} ... {{/if}}
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) => {
    const val = resolve(context, key);
    return val ? body : '';
  });

  // Process {{var}} and {{obj.prop}}
  result = result.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const val = resolve(context, key);
    return val !== undefined ? String(val) : '';
  });

  return result;
}

/**
 * Render with explicit conditional blocks (convenience wrapper).
 * Same as render but makes the #if behavior explicit in the API.
 */
export function renderBlock(template, context) {
  return render(template, context);
}

/**
 * Resolve a dotted path against an object.
 */
function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}
