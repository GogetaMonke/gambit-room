// Move-count ("perft") test for src/rules.js.
//
// perft(depth) counts the total number of legal move sequences of exactly
// that length from a position. These three numbers, from the standard
// chess starting position, are well-known and used across chess programming
// as a correctness check for a move generator: if a generator has a bug
// (illegal moves allowed, legal moves missed, captures mishandled, etc.)
// the counts almost always come out wrong.
//
// Run with: node tests/perft.test.js

import { createInitialState, generateLegalMoves, makeMove } from '../src/rules.js';

function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = generateLegalMoves(state);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    nodes += perft(makeMove(state, move), depth - 1);
  }
  return nodes;
}

const expected = { 1: 20, 2: 400, 3: 8902 };
const start = createInitialState();

let allPassed = true;
for (const depth of [1, 2, 3]) {
  const actual = perft(start, depth);
  const passed = actual === expected[depth];
  if (!passed) allPassed = false;
  console.log(`perft(${depth}): expected ${expected[depth]}, got ${actual} — ${passed ? 'PASS' : 'FAIL'}`);
}

if (!allPassed) {
  console.error('\nperft test FAILED — rules.js move generation has a bug.');
  process.exit(1);
}

console.log('\nperft test PASSED — core move generation is correct.');
