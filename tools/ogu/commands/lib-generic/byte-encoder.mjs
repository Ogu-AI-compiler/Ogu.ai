/**
 * Byte Encoder — UTF-8 encoding and hex conversion.
 */
export function encodeUtf8(str) {
  return [...new TextEncoder().encode(str)];
}

export function decodeUtf8(bytes) {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function toHex(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i+2), 16));
  return bytes;
}
