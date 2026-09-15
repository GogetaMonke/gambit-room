// Scenario tests for the special rules added in task 0.3: castling, en
// passant, promotion, and check/checkmate/stalemate detection.
//
// These don't show up within perft's first 3 plies from the start position
// (see rules.js), so unlike task 0.2 they're proven with hand-picked
// positions instead — each one built directly rather than played out from
// the start.
//
// Run with: node tests/rules.test.js

import {
  generateLegalMoves,
  makeMove,
  isInCheck,
  isCheckmate,
  isStalemate,
} from '../public/rules.js';

let failures = 0;

function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}`);
  if (!condition) failures++;
}

function sq(name) {
  const file = 'abcdefgh'.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  return rank * 8 + file;
}

function state(pieces, turn, overrides = {}) {
  const board = new Array(64).fill(null);
  for (const [square, piece] of Object.entries(pieces)) board[sq(square)] = piece;
  return {
    board,
    turn,
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    epSquare: null,
    ...overrides,
  };
}

function findMove(moves, predicate) {
  return moves.find(predicate);
}

// --- En passant -------------------------------------------------------

{
  // White pawn on e5; Black about to double-push d7-d5, landing beside it.
  let s = state({ e1: 'K', e8: 'k', e5: 'P', d7: 'p' }, 'b');
  const doublePush = findMove(generateLegalMoves(s), (m) => m.from === sq('d7') && m.to === sq('d5'));
  check('en passant setup: d7-d5 double push is legal', !!doublePush);

  s = makeMove(s, doublePush);
  check('en passant setup: epSquare is d6 after the double push', s.epSquare === sq('d6'));

  const epCapture = findMove(generateLegalMoves(s), (m) => m.enPassant);
  check('en passant: e5xd6 en passant capture is offered', !!epCapture && epCapture.to === sq('d6'));

  s = makeMove(s, epCapture);
  check('en passant: capturing pawn lands on d6', s.board[sq('d6')] === 'P');
  check('en passant: captured black pawn is removed from d5', s.board[sq('d5')] === null);
}

// --- Castling -----------------------------------------------------------

{
  const s = state(
    { e1: 'K', h1: 'R', a1: 'R', e8: 'k' },
    'w',
    { castling: { wK: true, wQ: true, bK: false, bQ: false } },
  );
  const moves = generateLegalMoves(s);
  const kingside = findMove(moves, (m) => m.castle === 'K');
  const queenside = findMove(moves, (m) => m.castle === 'Q');
  check('castling: kingside castle is offered when clear', !!kingside);
  check('castling: queenside castle is offered when clear', !!queenside);

  const after = makeMove(s, kingside);
  check('castling: king lands on g1', after.board[sq('g1')] === 'K');
  check('castling: rook lands on f1', after.board[sq('f1')] === 'R');
  check('castling: h1 is empty afterwards', after.board[sq('h1')] === null);
}

{
  // Same position, but a black rook on f4 attacks f1 — the king would pass
  // through an attacked square, so kingside castling must be illegal.
  const s = state(
    { e1: 'K', h1: 'R', a1: 'R', e8: 'k', f4: 'r' },
    'w',
    { castling: { wK: true, wQ: true, bK: false, bQ: false } },
  );
  const kingside = findMove(generateLegalMoves(s), (m) => m.castle === 'K');
  check('castling: blocked when king would pass through check', !kingside);
}

// --- Promotion -----------------------------------------------------------

{
  const s = state({ a7: 'P', e1: 'K', e8: 'k' }, 'w');
  const moves = generateLegalMoves(s).filter((m) => m.from === sq('a7'));
  const promotions = moves.map((m) => m.promotion).sort();
  check('promotion: all four piece choices are offered', promotions.join(',') === 'B,N,Q,R');

  const queenPromo = findMove(moves, (m) => m.promotion === 'Q');
  const after = makeMove(s, queenPromo);
  check('promotion: pawn becomes a queen on a8', after.board[sq('a8')] === 'Q');
}

// --- Check / checkmate / stalemate ---------------------------------------

{
  // Classic back-rank mate: king boxed in by its own pawns, rook checks
  // along the open first rank with nothing able to block or capture it.
  const s = state({ g1: 'K', f2: 'P', g2: 'P', h2: 'P', a1: 'r', h8: 'k' }, 'w');
  check('checkmate: white king is in check', isInCheck(s));
  check('checkmate: position is checkmate', isCheckmate(s));
  check('checkmate: no legal moves remain', generateLegalMoves(s).length === 0);
}

{
  // Classic stalemate: black king boxed in on a8, not in check, no legal move.
  const s = state({ a8: 'k', c7: 'K', b6: 'Q' }, 'b');
  check('stalemate: black king is not in check', !isInCheck(s));
  check('stalemate: position is stalemate', isStalemate(s));
  check('stalemate: not also flagged as checkmate', !isCheckmate(s));
}

if (failures > 0) {
  console.error(`\n${failures} scenario test(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll rules.js scenario tests PASSED.');
