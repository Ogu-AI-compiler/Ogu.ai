/**
 * Hazard Detector — detect data hazards between pipeline instructions.
 */
export function createHazardDetector() {
  const instructions = [];
  function addInstruction(instr) { instructions.push(instr); }
  function detect() {
    const hazards = [];
    for (let i = 0; i < instructions.length - 1; i++) {
      for (let j = i + 1; j < instructions.length; j++) {
        const a = instructions[i], b = instructions[j];
        for (const w of (a.writes || [])) {
          if ((b.reads || []).includes(w)) hazards.push({ type: "RAW", register: w, from: i, to: j });
        }
      }
    }
    return hazards;
  }
  return { addInstruction, detect };
}
