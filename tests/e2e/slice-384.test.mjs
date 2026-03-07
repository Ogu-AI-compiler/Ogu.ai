/**
 * Slice 384 — 4-Layer Prompt Assembler
 */

import { assembleSystemPrompt, buildDnaLayer, buildExperienceLayer, validatePromptLayers, countLayers } from "../../tools/ogu/commands/lib/prompt-assembler.mjs";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 384 — 4-Layer Prompt Assembler\x1b[0m\n");

const samplePlaybook = { body: "# Playbook Body\n\nCore content here." };
const sampleSpecialty = { body: "# React Addendum\n\nReact-specific content." };
const sampleDna = {
  work_style: "async-first",
  communication_style: "concise",
  risk_appetite: "balanced",
  strength_bias: "analytical",
  tooling_bias: "cli",
  failure_strategy: "retry",
};
const sampleExperience = "When building: always validate inputs\nWhen testing: cover edge cases";

assert("assembleSystemPrompt includes all 4 layers", () => {
  const prompt = assembleSystemPrompt({
    playbook: samplePlaybook,
    specialty: sampleSpecialty,
    dna: sampleDna,
    experience: sampleExperience,
  });
  if (!prompt.includes("Playbook Body")) throw new Error("missing playbook");
  if (!prompt.includes("React Addendum")) throw new Error("missing specialty");
  if (!prompt.includes("Agent DNA Profile")) throw new Error("missing DNA");
  if (!prompt.includes("Learned Experience Rules")) throw new Error("missing experience");
});

assert("Layers are separated by ---", () => {
  const prompt = assembleSystemPrompt({
    playbook: samplePlaybook,
    specialty: sampleSpecialty,
    dna: sampleDna,
    experience: sampleExperience,
  });
  if (!prompt.includes("---")) throw new Error("missing separator");
});

assert("Correct layer order: playbook → specialty → DNA → experience", () => {
  const prompt = assembleSystemPrompt({
    playbook: samplePlaybook,
    specialty: sampleSpecialty,
    dna: sampleDna,
    experience: sampleExperience,
  });
  const pbIdx = prompt.indexOf("Playbook Body");
  const specIdx = prompt.indexOf("React Addendum");
  const dnaIdx = prompt.indexOf("Agent DNA Profile");
  const expIdx = prompt.indexOf("Learned Experience Rules");
  if (pbIdx >= specIdx) throw new Error("playbook should come before specialty");
  if (specIdx >= dnaIdx) throw new Error("specialty should come before DNA");
  if (dnaIdx >= expIdx) throw new Error("DNA should come before experience");
});

assert("buildDnaLayer includes all 6 dimensions", () => {
  const layer = buildDnaLayer(sampleDna);
  if (!layer.includes("Work Style")) throw new Error("missing work_style");
  if (!layer.includes("Communication Style")) throw new Error("missing communication_style");
  if (!layer.includes("Risk Appetite")) throw new Error("missing risk_appetite");
  if (!layer.includes("Strength Bias")) throw new Error("missing strength_bias");
  if (!layer.includes("Tooling Bias")) throw new Error("missing tooling_bias");
  if (!layer.includes("Failure Strategy")) throw new Error("missing failure_strategy");
});

assert("buildDnaLayer handles empty dna", () => {
  const layer = buildDnaLayer({});
  if (layer !== "") throw new Error("should be empty string for empty dna");
});

assert("buildDnaLayer handles null", () => {
  const layer = buildDnaLayer(null);
  if (layer !== "") throw new Error("should be empty string");
});

assert("buildExperienceLayer formats rules as checklist", () => {
  const layer = buildExperienceLayer(sampleExperience);
  if (!layer.includes("Learned Experience Rules")) throw new Error("missing header");
  if (!layer.includes("- When building:")) throw new Error("missing rule format");
});

assert("buildExperienceLayer returns empty for null", () => {
  const layer = buildExperienceLayer(null);
  if (layer !== "") throw new Error("should be empty");
});

assert("buildExperienceLayer returns empty for empty string", () => {
  const layer = buildExperienceLayer("");
  if (layer !== "") throw new Error("should be empty");
});

assert("assembleSystemPrompt works with no specialty", () => {
  const prompt = assembleSystemPrompt({
    playbook: samplePlaybook,
    specialty: null,
    dna: sampleDna,
    experience: "",
  });
  if (!prompt.includes("Playbook Body")) throw new Error("missing playbook");
  if (prompt.includes("React Addendum")) throw new Error("should not have specialty");
});

assert("assembleSystemPrompt works with empty experience", () => {
  const prompt = assembleSystemPrompt({
    playbook: samplePlaybook,
    specialty: null,
    dna: sampleDna,
    experience: "",
  });
  if (prompt.includes("Learned Experience Rules")) throw new Error("should not have experience");
});

assert("validatePromptLayers succeeds with valid inputs", () => {
  const result = validatePromptLayers({
    playbook: samplePlaybook,
    specialty: sampleSpecialty,
    dna: sampleDna,
    experience: sampleExperience,
  });
  if (!result.valid) throw new Error(`errors: ${result.errors.join(", ")}`);
});

assert("validatePromptLayers fails without playbook", () => {
  const result = validatePromptLayers({
    playbook: null,
    dna: sampleDna,
  });
  if (result.valid) throw new Error("should fail");
  if (!result.errors.some(e => e.includes("playbook"))) throw new Error("should mention playbook");
});

assert("validatePromptLayers fails with incomplete DNA", () => {
  const result = validatePromptLayers({
    playbook: samplePlaybook,
    dna: { work_style: "async-first" },
  });
  if (result.valid) throw new Error("should fail");
  if (!result.errors.some(e => e.includes("missing dimensions"))) throw new Error("should mention dimensions");
});

assert("countLayers returns correct count", () => {
  if (countLayers({ playbook: samplePlaybook, specialty: sampleSpecialty, dna: sampleDna, experience: sampleExperience }) !== 4) throw new Error("should be 4");
  if (countLayers({ playbook: samplePlaybook, specialty: null, dna: sampleDna, experience: "" }) !== 2) throw new Error("should be 2");
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
