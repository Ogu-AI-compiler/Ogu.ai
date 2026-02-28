/**
 * Input Transformer — transform input data before validation.
 */

const BUILT_IN = {
  trim: (v) => (typeof v === "string" ? v.trim() : v),
  lowercase: (v) => (typeof v === "string" ? v.toLowerCase() : v),
  uppercase: (v) => (typeof v === "string" ? v.toUpperCase() : v),
};

export function createInputTransformer() {
  const rules = [];

  function addRule({ field, transform }) {
    const fn = typeof transform === "function" ? transform : BUILT_IN[transform];
    if (!fn) throw new Error(`Unknown transform: ${transform}`);
    rules.push({ field, fn });
  }

  function transform(input) {
    const output = { ...input };
    for (const rule of rules) {
      if (rule.field in output) {
        output[rule.field] = rule.fn(output[rule.field]);
      }
    }
    return output;
  }

  return { addRule, transform };
}
