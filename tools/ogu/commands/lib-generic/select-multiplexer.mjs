/**
 * Select Multiplexer — multiplex across multiple channels.
 */
export function createSelectMultiplexer() {
  const channels = new Map();
  function addChannel(name, ch) { channels.set(name, ch); }
  function select() {
    for (const [name, ch] of channels) {
      if (ch.pending && ch.pending() > 0) {
        return { name, value: ch.receive() };
      }
    }
    return null;
  }
  function removeChannel(name) { channels.delete(name); }
  return { addChannel, select, removeChannel };
}
