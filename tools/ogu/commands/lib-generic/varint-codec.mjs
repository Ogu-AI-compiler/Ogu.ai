/**
 * Varint Codec — variable-length integer encoding (protobuf style).
 */
export function encodeVarint(value) {
  const bytes = [];
  while (value > 0x7F) {
    bytes.push((value & 0x7F) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7F);
  return bytes;
}

export function decodeVarint(bytes) {
  let value = 0, shift = 0;
  for (let i = 0; i < bytes.length; i++) {
    value |= (bytes[i] & 0x7F) << shift;
    if ((bytes[i] & 0x80) === 0) return { value, bytesRead: i + 1 };
    shift += 7;
  }
  return { value, bytesRead: bytes.length };
}
