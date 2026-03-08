/**
 * Media Type Parser — parse and format MIME types.
 */
export function parse(mediaType) {
  const [typePart, ...paramParts] = mediaType.split(";").map(s => s.trim());
  const [type, subtype] = typePart.split("/");
  const params = {};
  for (const p of paramParts) {
    const [key, value] = p.split("=").map(s => s.trim());
    if (key && value) params[key] = value;
  }
  return { type, subtype, params };
}

export function format({ type, subtype, params }) {
  let result = `${type}/${subtype}`;
  for (const [k, v] of Object.entries(params || {})) {
    result += `; ${k}=${v}`;
  }
  return result;
}

export function isMatch(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  return pa.type === pb.type && pa.subtype === pb.subtype;
}
