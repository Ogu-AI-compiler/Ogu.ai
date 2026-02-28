/**
 * Actor Model — lightweight actor system with message passing.
 */
export function createActorSystem() {
  const actors = new Map();
  const mailboxes = new Map();
  function spawn(name, behavior) {
    actors.set(name, behavior);
    mailboxes.set(name, []);
  }
  function send(name, message) {
    const mb = mailboxes.get(name);
    if (mb) mb.push(message);
  }
  function tick() {
    for (const [name, behavior] of actors) {
      const mb = mailboxes.get(name);
      while (mb.length > 0) {
        behavior(mb.shift());
      }
    }
  }
  function list() { return [...actors.keys()]; }
  return { spawn, send, tick, list };
}
