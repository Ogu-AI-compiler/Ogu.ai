/**
 * Conversation Context — maintain conversation state across turns.
 */

/**
 * Create a conversation context.
 *
 * @param {{ maxMessages?: number }} opts
 * @returns {object} Context with addMessage/getHistory/setVariable/getVariable/summarize/clear
 */
export function createConversationContext({ maxMessages = 100 } = {}) {
  let messages = [];
  const variables = new Map();

  function addMessage({ role, content }) {
    messages.push({ role, content, timestamp: Date.now() });
  }

  function getHistory() {
    return [...messages];
  }

  function setVariable(key, value) {
    variables.set(key, value);
  }

  function getVariable(key) {
    return variables.get(key);
  }

  function summarize() {
    const truncated = messages.slice(-maxMessages);
    return {
      messages: truncated,
      totalMessages: messages.length,
      variables: Object.fromEntries(variables),
    };
  }

  function clear() {
    messages = [];
    variables.clear();
  }

  return { addMessage, getHistory, setVariable, getVariable, summarize, clear };
}
