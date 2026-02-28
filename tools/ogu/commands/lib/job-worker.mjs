/**
 * Job Worker — process jobs from a queue.
 */
export function createJobWorker(name, processor) {
  let jobsProcessed = 0;
  let errors = 0;
  let active = false;
  function process(job) {
    active = true;
    try {
      const result = processor(job);
      jobsProcessed++;
      return { status: 'done', result };
    } catch (e) {
      errors++;
      return { status: 'error', error: e.message };
    } finally {
      active = false;
    }
  }
  function processBatch(jobs) { return jobs.map(j => process(j)); }
  function getStats() { return { name, jobsProcessed, errors, active }; }
  function getName() { return name; }
  return { process, processBatch, getStats, getName };
}
