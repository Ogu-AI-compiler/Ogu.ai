/**
 * Training Loop — configurable epoch-based training.
 */
export function createTrainingLoop({ epochs, onEpoch }) {
  const history = [];
  function run(data) {
    for (let e = 0; e < epochs; e++) {
      onEpoch(e, data);
      history.push({ epoch: e, ...JSON.parse(JSON.stringify(data)) });
    }
    return data;
  }
  function getHistory() { return [...history]; }
  return { run, getHistory };
}
