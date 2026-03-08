/**
 * Batch Processor — process items in configurable batches.
 */

/**
 * Create a batch processor.
 *
 * @param {{ batchSize: number }} opts
 * @returns {object} Processor with add/process/getStats
 */
export function createBatchProcessor({ batchSize = 10 }) {
  const items = [];
  let totalItems = 0;
  let batchesProcessed = 0;

  function add(item) {
    items.push(item);
  }

  async function process(handler) {
    totalItems = items.length;
    batchesProcessed = 0;

    while (items.length > 0) {
      const batch = items.splice(0, batchSize);
      await handler(batch);
      batchesProcessed++;
    }
  }

  function getStats() {
    return { totalItems, batchesProcessed, batchSize };
  }

  return { add, process, getStats };
}
