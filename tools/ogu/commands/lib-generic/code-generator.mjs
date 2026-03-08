/**
 * Code Generator — generate TypeScript code from schemas.
 */

/**
 * Generate a TypeScript interface.
 */
export function generateInterface({ name, fields }) {
  const lines = [`export interface ${name} {`];
  for (const field of fields) {
    const opt = field.optional ? '?' : '';
    lines.push(`  ${field.name}${opt}: ${field.type};`);
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate a TypeScript function.
 */
export function generateFunction({ name, params = [], returnType, body }) {
  const paramStr = params.map(p => `${p.name}: ${p.type}`).join(', ');
  const retStr = returnType ? `: ${returnType}` : '';
  return `export async function ${name}(${paramStr})${retStr} {\n  ${body}\n}`;
}

/**
 * Generate a TypeScript module with imports and exports.
 */
export function generateModule({ name, imports = [], exports = [] }) {
  const lines = [];
  for (const imp of imports) {
    lines.push(`import { ${imp.names.join(', ')} } from '${imp.from}';`);
  }
  lines.push('');
  lines.push(`// ${name} module`);
  for (const exp of exports) {
    lines.push(`export function ${exp}() {}`);
  }
  return lines.join('\n');
}

/**
 * Generate a TypeScript enum.
 */
export function generateEnum({ name, values }) {
  const lines = [`export enum ${name} {`];
  for (const val of values) {
    lines.push(`  ${val} = '${val}',`);
  }
  lines.push('}');
  return lines.join('\n');
}
