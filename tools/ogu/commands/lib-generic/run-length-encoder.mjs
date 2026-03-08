/**
 * Run-Length Encoder — compress consecutive repeated characters.
 */
export function encode(input) {
  if (!input) return "";
  let result = "";
  let count = 1;
  for (let i = 1; i <= input.length; i++) {
    if (i < input.length && input[i] === input[i - 1]) {
      count++;
    } else {
      result += (count > 1 ? count : "") + input[i - 1];
      count = 1;
    }
  }
  return result;
}

export function decode(input) {
  if (!input) return "";
  let result = "";
  let num = "";
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") {
      num += ch;
    } else {
      const count = num ? parseInt(num, 10) : 1;
      result += ch.repeat(count);
      num = "";
    }
  }
  return result;
}
