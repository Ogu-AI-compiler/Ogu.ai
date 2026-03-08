/**
 * Bytecode Builder — build bytecode sequences from instructions.
 */

export function createBytecodeBuilder() {
  const buffer = [];
  const labels = {};

  function addOp(opcode, operands = []) {
    buffer.push(opcode, ...operands);
  }

  function addLabel(name) {
    labels[name] = buffer.length;
  }

  function build() {
    return [...buffer];
  }

  function getLabels() {
    return { ...labels };
  }

  function getSize() {
    return buffer.length;
  }

  return { addOp, addLabel, build, getLabels, getSize };
}
