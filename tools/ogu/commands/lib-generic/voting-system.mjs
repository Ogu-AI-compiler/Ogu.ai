/**
 * Voting System — collect and tally votes with multiple strategies.
 */
export function createVotingSystem() {
  const ballots = [];
  function castVote(voter, choice) {
    ballots.push({ voter, choice, time: Date.now() });
  }
  function tally() {
    const counts = {};
    for (const b of ballots) {
      counts[b.choice] = (counts[b.choice] || 0) + 1;
    }
    return counts;
  }
  function winner() {
    const counts = tally();
    let best = null, bestCount = 0;
    for (const [choice, count] of Object.entries(counts)) {
      if (count > bestCount) { best = choice; bestCount = count; }
    }
    return best;
  }
  function totalVotes() { return ballots.length; }
  function hasVoted(voter) { return ballots.some(b => b.voter === voter); }
  return { castVote, tally, winner, totalVotes, hasVoted };
}
