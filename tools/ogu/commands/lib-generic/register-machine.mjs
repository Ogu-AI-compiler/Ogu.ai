/**
 * Register Machine — execute instructions using named registers.
 */
export function createRegisterMachine() {
  const registers = {};
  const ops = {
    LOAD: (instr) => { registers[instr.reg] = instr.val; },
    ADD: (instr) => { registers[instr.dst] = (registers[instr.src1] || 0) + (registers[instr.src2] || 0); },
    SUB: (instr) => { registers[instr.dst] = (registers[instr.src1] || 0) - (registers[instr.src2] || 0); },
    MUL: (instr) => { registers[instr.dst] = (registers[instr.src1] || 0) * (registers[instr.src2] || 0); },
    MOV: (instr) => { registers[instr.dst] = registers[instr.src] || 0; },
  };
  function execute(instructions) {
    for (const instr of instructions) {
      const handler = ops[instr.op];
      if (handler) handler(instr);
    }
  }
  function getRegister(name) { return registers[name]; }
  function getRegisters() { return { ...registers }; }
  return { execute, getRegister, getRegisters };
}
