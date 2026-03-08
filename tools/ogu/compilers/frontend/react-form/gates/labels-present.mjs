/**
 * Gate: labels-present
 * Every input/select/textarea must have an associated label or aria-label.
 * No unlabelled form controls.
 */
import { readFileSync, existsSync } from "fs";

const INPUT_RE = /<(input|select|textarea)\b([^>]*)\/?>/gi;
const ARIA_LABEL_RE = /aria-label\s*=/i;
const ID_RE = /\bid\s*=\s*["'{`]([^"'}`]+)["'{`]/i;
const LABEL_FOR_RE = /<label[^>]+htmlFor\s*=\s*["'{`]([^"'}`]+)["'{`]/gi;

export async function run({ dir }) {
  const formPath = `${dir}/Form.tsx`;
  if (!existsSync(formPath)) {
    return { pass: false, code: "RF005", message: "Form.tsx not found" };
  }

  const content = readFileSync(formPath, "utf8");

  // Collect all label htmlFor values
  const labelledIds = new Set();
  let lm;
  LABEL_FOR_RE.lastIndex = 0;
  while ((lm = LABEL_FOR_RE.exec(content)) !== null) {
    labelledIds.add(lm[1]);
  }

  const violations = [];
  let match;
  INPUT_RE.lastIndex = 0;
  while ((match = INPUT_RE.exec(content)) !== null) {
    const tag = match[0];
    const attrs = match[2];

    // hidden inputs don't need labels
    if (/type\s*=\s*["']hidden["']/i.test(attrs)) continue;

    const hasAriaLabel = ARIA_LABEL_RE.test(attrs);
    const idMatch = attrs.match(ID_RE);
    const hasLabelFor = idMatch && labelledIds.has(idMatch[1]);

    if (!hasAriaLabel && !hasLabelFor) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      violations.push({
        element: match[1],
        line: lineNum,
        tag: tag.slice(0, 60),
      });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RF005",
      message: `${violations.length} form control(s) missing label or aria-label`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { labelledIds: [...labelledIds] } };
}
