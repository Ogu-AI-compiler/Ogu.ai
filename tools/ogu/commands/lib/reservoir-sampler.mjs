/**
 * Reservoir Sampler — uniform random sampling from a stream.
 */
export function createReservoirSampler(k) {
  const reservoir = [];
  let count = 0;

  function add(item) {
    count++;
    if (reservoir.length < k) {
      reservoir.push(item);
    } else {
      const j = Math.floor(Math.random() * count);
      if (j < k) reservoir[j] = item;
    }
  }

  function getSample() { return [...reservoir]; }
  function getCount() { return count; }

  return { add, getSample, getCount };
}
