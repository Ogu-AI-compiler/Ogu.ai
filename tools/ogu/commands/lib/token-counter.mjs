/**
 * Token Counter — estimate token counts for text.
 *
 * Uses ~4 chars/token heuristic (close to Claude's tokenizer).
 */

const CHARS_PER_TOKEN = 4;
const OVERHEAD_PER_MESSAGE = 4; // role/metadata tokens

/**
 * Estimate token count for a text string.
 */
export function estimateTokens(text) {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate total tokens for a messages array.
 */
export function countMessages(messages) {
  let total = 0;
  for (const msg of messages) {
    total += OVERHEAD_PER_MESSAGE;
    total += estimateTokens(msg.content || '');
  }
  return total;
}
