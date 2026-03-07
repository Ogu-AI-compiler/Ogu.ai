export interface ArchetypeQuestion {
  id: string;
  type: "select" | "multiselect" | "short_text";
  prompt: string;
  options?: string[];
  required?: boolean;
}

export interface ArchetypeStep {
  id: string;
  title: string;
  questions: ArchetypeQuestion[];
  required_outputs: string[];
}

export interface Archetype {
  id: string;
  mode: "website" | "application" | "venture";
  title: string;
  emoji: string;
  description: string;
  steps: ArchetypeStep[];
  next_action_map: Record<string, string>;
}

export type WizardMode = "website" | "application" | "venture";

import { WEBSITE_ARCHETYPES } from "./website";
import { APPLICATION_ARCHETYPES } from "./application";
import { VENTURE_ARCHETYPES } from "./venture";

export const ARCHETYPES: Record<WizardMode, Archetype[]> = {
  website: WEBSITE_ARCHETYPES,
  application: APPLICATION_ARCHETYPES,
  venture: VENTURE_ARCHETYPES,
};

export function getArchetypeById(id: string): Archetype | undefined {
  for (const list of Object.values(ARCHETYPES)) {
    const found = list.find((a) => a.id === id);
    if (found) return found;
  }
  return undefined;
}
