/**
 * Parser Combinator — composable parsing primitives.
 */
export function literal(str) {
  return (input) => {
    if (input.startsWith(str)) {
      return { success: true, value: str, rest: input.slice(str.length) };
    }
    return { success: false };
  };
}

export function sequence(parsers) {
  return (input) => {
    let rest = input;
    const values = [];
    for (const p of parsers) {
      const result = p(rest);
      if (!result.success) return { success: false };
      values.push(result.value);
      rest = result.rest;
    }
    return { success: true, value: values, rest };
  };
}

export function choice(parsers) {
  return (input) => {
    for (const p of parsers) {
      const result = p(input);
      if (result.success) return result;
    }
    return { success: false };
  };
}

export function many(parser) {
  return (input) => {
    const values = [];
    let rest = input;
    while (true) {
      const result = parser(rest);
      if (!result.success) break;
      values.push(result.value);
      rest = result.rest;
    }
    return { success: true, value: values, rest };
  };
}
