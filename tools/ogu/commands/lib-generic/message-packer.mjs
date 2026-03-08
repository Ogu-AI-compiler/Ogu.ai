/**
 * Message Packer — pack/unpack structured messages.
 */
export function pack(obj) { return JSON.stringify(obj); }
export function unpack(str) { return JSON.parse(str); }
