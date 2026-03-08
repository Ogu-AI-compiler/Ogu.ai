/**
 * Instruction Emitter — emit typed instructions for a virtual machine.
 */

export function createInstructionEmitter() {
  let instructions = [];

  function emit(instruction) {
    instructions.push({
      ...instruction,
      address: instructions.length,
    });
  }

  function getInstructions() {
    return [...instructions];
  }

  function clear() {
    instructions = [];
  }

  return { emit, getInstructions, clear };
}
