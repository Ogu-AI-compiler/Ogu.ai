import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR003 — model-card-linked
 * Every model registry entry must link to its model card.
 *
 * Why:
 * - A model card is the documentation of a model's intended use, limitations,
 *   training data, performance across subgroups, and ethical considerations.
 *   Without a link from the registry entry, the card is disconnected from
 *   the artifact — people deploy the model without reading its documentation.
 * - The model card → registry link enables automated documentation checks:
 *   CI can verify that before a model advances to "production" stage, its
 *   model card exists and has been reviewed.
 * - Responsible AI principles require model cards for any model making
 *   decisions affecting people. The link from registry ensures the card
 *   is findable by anyone examining the registry.
 *
 * Required: model-metadata.json must include model_card_path pointing to
 * an existing markdown file.
 *
 * Escape hatch: add "noModelCard": true to registry-spec.json only for
 * internal utility models (e.g., deduplication, text cleanup) that don't
 * make decisions affecting end users.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'registry-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'MR003', message: 'registry-spec.json not readable' }; }

  if (spec.noModelCard === true) {
    return { pass: true, code: 'MR003', message: 'noModelCard: true — model card not required (utility model)', skipped: true };
  }

  let meta;
  try { meta = JSON.parse(readFileSync(join(dir, 'model-metadata.json'), 'utf8')); }
  catch { return { pass: false, code: 'MR003', message: 'model-metadata.json not readable' }; }

  const cardPath = meta.model_card_path ?? meta.model_card ?? meta.card_path;

  if (!cardPath) {
    return {
      pass: false, code: 'MR003',
      message: 'model-metadata.json missing model_card_path',
      detail: 'Add to model-metadata.json:\n  "model_card_path": "../../model-card/MODEL_CARD.md"\n\nModel card must exist in the model-card compiler directory.',
    };
  }

  const fullPath = join(dir, String(cardPath));
  if (!existsSync(fullPath)) {
    return {
      pass: false, code: 'MR003',
      message: `Model card not found at: ${cardPath}`,
      detail: 'Create the model card before registering the model.\nRun the model-card compiler first.',
    };
  }

  return {
    pass: true, code: 'MR003',
    message: `Model card linked: ${cardPath}`,
  };
}
