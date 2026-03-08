/**
 * Particle Swarm Optimization — swarm-based optimization.
 */
export function createParticleSwarm({ dimensions, particles: numParticles, fitness, bounds }) {
  let iteration = 0;
  const swarm = [];
  let globalBest = { position: null, fitness: Infinity };

  for (let i = 0; i < numParticles; i++) {
    const position = bounds.map(([lo, hi]) => lo + Math.random() * (hi - lo));
    const velocity = new Array(dimensions).fill(0).map(() => (Math.random() - 0.5) * 2);
    const f = fitness(position);
    const particle = { position, velocity, bestPosition: [...position], bestFitness: f };
    swarm.push(particle);
    if (f < globalBest.fitness) globalBest = { position: [...position], fitness: f };
  }

  function iterate(n) {
    for (let iter = 0; iter < n; iter++) {
      for (const p of swarm) {
        for (let d = 0; d < dimensions; d++) {
          const r1 = Math.random(), r2 = Math.random();
          p.velocity[d] = 0.7 * p.velocity[d]
            + 1.5 * r1 * (p.bestPosition[d] - p.position[d])
            + 1.5 * r2 * (globalBest.position[d] - p.position[d]);
          p.position[d] += p.velocity[d];
          p.position[d] = Math.max(bounds[d][0], Math.min(bounds[d][1], p.position[d]));
        }
        const f = fitness(p.position);
        if (f < p.bestFitness) { p.bestFitness = f; p.bestPosition = [...p.position]; }
        if (f < globalBest.fitness) globalBest = { position: [...p.position], fitness: f };
      }
      iteration++;
    }
  }

  function getBest() { return { position: [...globalBest.position], fitness: globalBest.fitness }; }
  function getIteration() { return iteration; }
  return { iterate, getBest, getIteration };
}
