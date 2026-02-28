/**
 * Protocol Buffer Lite — simplified protobuf encode/decode.
 */
export function createProtobufLite() {
  const schemas = new Map();
  function defineMessage(name, fields) { schemas.set(name, fields); }
  function encode(name, data) {
    const schema = schemas.get(name);
    return JSON.stringify({ __type: name, ...data });
  }
  function decode(name, buffer) {
    const parsed = JSON.parse(buffer);
    const { __type, ...data } = parsed;
    return data;
  }
  return { defineMessage, encode, decode };
}
