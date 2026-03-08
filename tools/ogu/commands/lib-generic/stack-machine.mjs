/**
 * Stack Machine — execute instructions using a stack.
 */
export function createStackMachine() {
  const stack = [];
  const ops = {
    PUSH: (instr) => stack.push(instr.val),
    POP: () => stack.pop(),
    ADD: () => { const b = stack.pop(), a = stack.pop(); stack.push(a + b); },
    SUB: () => { const b = stack.pop(), a = stack.pop(); stack.push(a - b); },
    MUL: () => { const b = stack.pop(), a = stack.pop(); stack.push(a * b); },
    DIV: () => { const b = stack.pop(), a = stack.pop(); stack.push(Math.floor(a / b)); },
    DUP: () => stack.push(stack[stack.length - 1]),
  };
  function execute(instructions) {
    for (const instr of instructions) {
      const handler = ops[instr.op];
      if (handler) handler(instr);
    }
  }
  function peek() { return stack[stack.length - 1]; }
  function getStack() { return [...stack]; }
  return { execute, peek, getStack };
}
