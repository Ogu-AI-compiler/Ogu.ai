/**
 * Execution Replay Engine — replay from recorded operation logs.
 *
 * Records operations during execution, then replays them
 * with forced determinism by returning stored results.
 */

/**
 * Create a replay engine.
 *
 * @returns {object} Engine with record/replay/getLog/getSnapshot
 */
export function createReplayEngine() {
  const operations = [];

  function record(op) {
    operations.push({
      ...op,
      recordedAt: Date.now(),
      index: operations.length,
    });
  }

  function getLog() {
    return [...operations];
  }

  function replay() {
    let cursor = 0;

    return {
      next() {
        if (cursor >= operations.length) {
          return { done: true, result: undefined };
        }
        const op = operations[cursor++];
        return { done: false, ...op };
      },
      isDone() {
        return cursor >= operations.length;
      },
      getCursor() {
        return cursor;
      },
    };
  }

  function getSnapshot() {
    return {
      operations: operations.map(op => ({ ...op })),
      count: operations.length,
      snapshotAt: Date.now(),
    };
  }

  return { record, replay, getLog, getSnapshot };
}
