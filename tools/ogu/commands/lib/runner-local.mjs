/**
 * Runner Local — local subprocess runner implementation.
 */

import { execFile } from 'node:child_process';

/**
 * Create a local runner that executes commands as subprocesses.
 *
 * @param {{ workDir: string, name?: string }} opts
 * @returns {object} Runner with execute/getStatus
 */
export function createLocalRunner({ workDir, name = 'local-runner' } = {}) {
  const type = 'local';

  async function execute({ taskId, command, args = [] }) {
    return new Promise((resolve) => {
      execFile(command, args, { cwd: workDir, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            taskId,
            status: 'error',
            exitCode: error.code || 1,
            stdout: stdout || '',
            stderr: stderr || error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          resolve({
            taskId,
            status: 'success',
            exitCode: 0,
            stdout: stdout || '',
            stderr: stderr || '',
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  }

  function getStatus() {
    return { name, type, workDir };
  }

  return { name, type, execute, getStatus };
}
