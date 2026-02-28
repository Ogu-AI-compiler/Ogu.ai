/**
 * IO Controller — manage and dispatch commands to devices.
 */
export function createIOController() {
  const devices = new Map();
  function registerDevice(name, device) { devices.set(name, device); }
  function send(deviceName, command) {
    const dev = devices.get(deviceName);
    if (!dev) throw new Error(`device ${deviceName} not found`);
    return dev.execute(command);
  }
  function listDevices() { return [...devices.keys()]; }
  return { registerDevice, send, listDevices };
}
