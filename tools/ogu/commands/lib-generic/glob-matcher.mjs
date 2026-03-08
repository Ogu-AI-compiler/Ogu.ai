/**
 * Glob Matcher — match file paths against glob patterns.
 */
export function match(pattern, path) {
  const regex = globToRegex(pattern);
  return regex.test(path);
}

function globToRegex(pattern) {
  let reg = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          reg += "(?:.+/)?";
          i += 3;
        } else {
          reg += ".*";
          i += 2;
        }
      } else {
        reg += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      reg += "[^/]";
      i++;
    } else if (".()[]{}+^$|\\".includes(ch)) {
      reg += "\\" + ch;
      i++;
    } else {
      reg += ch;
      i++;
    }
  }
  reg += "$";
  return new RegExp(reg);
}

export function filter(pattern, paths) {
  return paths.filter(p => match(pattern, p));
}
