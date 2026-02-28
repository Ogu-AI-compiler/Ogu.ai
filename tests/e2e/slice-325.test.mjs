import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 325 — Consensus Engine + Voting System\x1b[0m\n');
console.log('\x1b[36m  Part 1: Consensus Engine\x1b[0m');
test('consensus-engine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/consensus-engine.mjs')));
const { createConsensusEngine } = await import('../../tools/ogu/commands/lib/consensus-engine.mjs');
test('propose and accept', () => { const ce = createConsensusEngine(['n1', 'n2', 'n3']); ce.propose('p1', 'valueA'); ce.vote('p1', 'n1', true); ce.vote('p1', 'n2', true); assert.ok(ce.isAccepted('p1')); });
test('not accepted without majority', () => { const ce = createConsensusEngine(['n1', 'n2', 'n3']); ce.propose('p1', 'v'); ce.vote('p1', 'n1', true); assert.ok(!ce.isAccepted('p1')); });
test('get status', () => { const ce = createConsensusEngine(['n1', 'n2']); ce.propose('p1', 'v'); ce.vote('p1', 'n1', true); const s = ce.getStatus('p1'); assert.equal(s.accepts, 1); assert.equal(s.total, 2); });
test('list proposals', () => { const ce = createConsensusEngine(['n1']); ce.propose('p1', 'a'); ce.propose('p2', 'b'); assert.deepEqual(ce.listProposals(), ['p1', 'p2']); });

console.log('\n\x1b[36m  Part 2: Voting System\x1b[0m');
test('voting-system.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/voting-system.mjs')));
const { createVotingSystem } = await import('../../tools/ogu/commands/lib/voting-system.mjs');
test('cast and tally', () => { const vs = createVotingSystem(); vs.castVote('alice', 'A'); vs.castVote('bob', 'B'); vs.castVote('charlie', 'A'); const t = vs.tally(); assert.equal(t.A, 2); assert.equal(t.B, 1); });
test('winner', () => { const vs = createVotingSystem(); vs.castVote('a', 'X'); vs.castVote('b', 'X'); vs.castVote('c', 'Y'); assert.equal(vs.winner(), 'X'); });
test('total votes', () => { const vs = createVotingSystem(); vs.castVote('a', 'X'); vs.castVote('b', 'Y'); assert.equal(vs.totalVotes(), 2); });
test('has voted', () => { const vs = createVotingSystem(); vs.castVote('alice', 'A'); assert.ok(vs.hasVoted('alice')); assert.ok(!vs.hasVoted('bob')); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
