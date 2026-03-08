/**
 * Gate: stable-deps
 * useCallback / useMemo / useEffect must not have empty [] dependency arrays
 * while referencing variables from outer scope (stale closure detection).
 *
 * Also flags missing dependency arrays entirely (no-dep-array is stricter than empty).
 *
 * This is static analysis — it catches the most common violations.
 */
import { readFileSync, existsSync, readdirSync } from "fs";

const HOOKS_WITH_DEPS = ["useCallback", "useMemo", "useEffect", "useLayoutEffect"];

function extractHookCalls(content) {
  const calls = [];

  for (const hookName of HOOKS_WITH_DEPS) {
    let searchFrom = 0;
    while (true) {
      const idx = content.indexOf(`${hookName}(`, searchFrom);
      if (idx === -1) break;

      const lineNum = content.slice(0, idx).split("\n").length;

      // Find the callback body and deps array
      // Pattern: hookName(callback, [deps])
      // We need to find the last argument (deps array)
      let depth = 0;
      let j = idx + hookName.length + 1;
      let start = j;
      let commaAtDepth1 = -1;

      while (j < content.length) {
        const ch = content[j];
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" || ch === "]" || ch === "}") {
          depth--;
          if (depth < 0) break;
        } else if (ch === "," && depth === 0) {
          commaAtDepth1 = j;
        }
        j++;
      }

      const fullCall = content.slice(idx, j);
      const callbackBody = commaAtDepth1 > 0 ? content.slice(start, commaAtDepth1) : fullCall;
      const depsStr = commaAtDepth1 > 0 ? content.slice(commaAtDepth1 + 1, j).trim() : null;

      calls.push({ hookName, lineNum, callbackBody, depsStr, fullCall: fullCall.slice(0, 200) });
      searchFrom = idx + 1;
    }
  }

  return calls;
}

export async function run({ dir }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  if (hookFiles.length === 0) {
    return { pass: false, code: "RH009", message: "No hook file found" };
  }

  const violations = [];

  for (const file of hookFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");
    const calls = extractHookCalls(content);

    for (const call of calls) {
      // No deps array at all (for useEffect/useLayoutEffect this is always suspicious)
      if (!call.depsStr && (call.hookName === "useEffect" || call.hookName === "useLayoutEffect")) {
        violations.push({
          file,
          line: call.lineNum,
          hook: call.hookName,
          issue: "Missing dependency array — effect will run on every render",
        });
        continue;
      }

      if (!call.depsStr) continue;

      // Empty [] with variables referenced in callback body
      const isEmpty = /^\[\s*\]$/.test(call.depsStr.trim());
      if (isEmpty) {
        // Heuristic: look for prop/state-like variable references in callback body
        // Variables that look like props or state (camelCase identifiers not defined inside callback)
        const innerDefs = new Set(
          [...call.callbackBody.matchAll(/(?:const|let|var)\s+(\w+)/g)].map(m => m[1])
        );
        const refs = [...call.callbackBody.matchAll(/\b([a-z][a-zA-Z0-9]*)\s*(?:\(|\[|\.|\b)/g)]
          .map(m => m[1])
          .filter(v => !innerDefs.has(v))
          .filter(v => !["true", "false", "null", "undefined", "return", "async", "await", "const", "let", "var", "if", "else", "for", "while", "try", "catch", "new", "typeof", "instanceof"].includes(v));

        if (refs.length > 2) {
          violations.push({
            file,
            line: call.lineNum,
            hook: call.hookName,
            issue: `Empty [] dependency array but callback references: ${[...new Set(refs)].slice(0, 5).join(", ")}`,
            hint: "Add referenced variables to dependency array or verify they are stable (from useState setter, useRef, etc.)",
          });
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RH009",
      message: `${violations.length} potential stale closure(s) detected`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { hooksChecked: hookFiles.length } };
}
