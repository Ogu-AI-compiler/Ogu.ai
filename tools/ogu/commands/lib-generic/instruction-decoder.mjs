/**
 * Instruction Decoder — decode instructions based on registered formats.
 */
export function createInstructionDecoder() {
  const formats = new Map();
  function addFormat(opcode, fields) { formats.set(opcode, fields); }
  function decode(instr) {
    const fields = formats.get(instr.opcode);
    if (!fields) return null;
    const result = { op: instr.opcode };
    fields.forEach((f, i) => { result[f] = instr.operands[i]; });
    return result;
  }
  return { addFormat, decode };
}
