/**
 * WebSocket Frame Parser — parse and build WebSocket-like frames.
 */
export function encodeFrame(opcode, payload) {
  return { opcode, payload, length: payload.length, masked: false };
}

export function decodeFrame(frame) {
  return { opcode: frame.opcode, payload: frame.payload, length: frame.length };
}

export function createFrameBuilder() {
  function text(msg) { return encodeFrame(0x01, msg); }
  function binary(data) { return encodeFrame(0x02, data); }
  function ping(data = '') { return encodeFrame(0x09, data); }
  function pong(data = '') { return encodeFrame(0x0A, data); }
  function close(code = 1000) { return encodeFrame(0x08, String(code)); }
  return { text, binary, ping, pong, close };
}
