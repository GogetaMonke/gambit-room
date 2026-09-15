// Gambit Room chess rules engine.
//
// Board representation: a flat array of 64 squares, index = rank*8 + file,
// where file 0 = 'a', rank 0 = rank 1 (White's back rank). So index 0 is a1,
// index 7 is h1, index 56 is a8, index 63 is h8.
//
// Pieces are single characters: uppercase = White (P N B R Q K),
// lowercase = Black (p n b r q k). Empty squares are `null`.
//
// This task (0.2) covers plain moves and captures for all six piece types,
// with full check-legality filtering (you may never leave your own king in
// check). Castling, en passant, and pawn promotion are deliberately left
// for task 0.3 — none of them can occur within the first 3 moves from the
// start position, so they don't affect the perft numbers this file is
// proven against here.

const FILES = 'abcdefgh';

const FILE = (sq) => sq % 8;
const RANK = (sq) => Math.floor(sq / 8);
const SQUARE = (file, rank) => rank * 8 + file;
const ON_BOARD = (file, rank) => file >= 0 && file < 8 && rank >= 0 && rank < 8;

export function squareName(sq) {
  return FILES[FILE(sq)] + (RANK(sq) + 1);
}

export function pieceColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function opponentOf(color) {
  return color === 'w' ? 'b' : 'w';
}

const START_BOARD = [
  'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R',
  'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
  'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
];

export function createInitialState() {
  return {
    board: START_BOARD.slice(),
    turn: 'w',
    // Which castling moves are still legally available (rights, not
    // necessarily currently possible — squares might be blocked/attacked).
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    // The square a pawn can capture *to* via en passant right now, or null.
    // Only ever set for the one move immediately after a double pawn push.
    epSquare: null,
  };
}

const KNIGHT_STEPS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_STEPS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];

function stepTargets(from, steps) {
  const f = FILE(from);
  const r = RANK(from);
  const targets = [];
  for (const [df, dr] of steps) {
    const nf = f + df;
    const nr = r + dr;
    if (ON_BOARD(nf, nr)) targets.push(SQUARE(nf, nr));
  }
  return targets;
}

function moveIfLandable(board, from, to, moves) {
  const color = pieceColor(board[from]);
  const target = board[to];
  if (!target) {
    moves.push({ from, to });
  } else if (pieceColor(target) !== color) {
    moves.push({ from, to, capture: true });
  }
}

function slidingMoves(board, from, dirs) {
  const moves = [];
  const color = pieceColor(board[from]);
  const f0 = FILE(from);
  const r0 = RANK(from);
  for (const [df, dr] of dirs) {
    let f = f0;
    let r = r0;
    for (;;) {
      f += df;
      r += dr;
      if (!ON_BOARD(f, r)) break;
      const to = SQUARE(f, r);
      const target = board[to];
      if (!target) {
        moves.push({ from, to });
      } else {
        if (pieceColor(target) !== color) moves.push({ from, to, capture: true });
        break;
      }
    }
  }
  return moves;
}

const PROMOTION_PIECES = ['Q', 'R', 'B', 'N'];

function pawnMoves(board, from, color, epSquare) {
  const moves = [];
  const f = FILE(from);
  const r = RANK(from);
  const dir = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 1 : 6;
  const promotionRank = color === 'w' ? 7 : 0;
  const oneRank = r + dir;
  if (oneRank < 0 || oneRank > 7) return moves;

  const pushMove = (to, extra) => {
    if (oneRank === promotionRank) {
      for (const promotion of PROMOTION_PIECES) moves.push({ from, to, promotion, ...extra });
    } else {
      moves.push({ from, to, ...extra });
    }
  };

  const oneTo = SQUARE(f, oneRank);
  if (!board[oneTo]) {
    pushMove(oneTo);
    if (r === startRank) {
      const twoTo = SQUARE(f, r + dir * 2);
      if (!board[twoTo]) moves.push({ from, to: twoTo, doublePush: true });
    }
  }

  for (const df of [-1, 1]) {
    const cf = f + df;
    if (cf < 0 || cf > 7) continue;
    const capTo = SQUARE(cf, oneRank);
    const target = board[capTo];
    if (target && pieceColor(target) !== color) {
      pushMove(capTo, { capture: true });
    } else if (capTo === epSquare) {
      moves.push({ from, to: capTo, capture: true, enPassant: true, captureSquare: SQUARE(cf, r) });
    }
  }

  return moves;
}

// Castling moves for the king on `from`, if the state's remaining rights
// and the current board allow it: king and rook unmoved (tracked via
// state.castling), nothing between them, and the king is not currently in
// check, does not pass through an attacked square, and does not land on one.
function castlingMoves(state, from) {
  const { board, turn, castling } = state;
  const rank = turn === 'w' ? 0 : 7;
  if (from !== SQUARE(4, rank)) return [];
  const opponent = opponentOf(turn);
  if (isSquareAttacked(board, from, opponent)) return [];

  const moves = [];
  const kingRight = turn === 'w' ? castling.wK : castling.bK;
  if (kingRight) {
    const f1 = SQUARE(5, rank);
    const g1 = SQUARE(6, rank);
    if (!board[f1] && !board[g1]
      && !isSquareAttacked(board, f1, opponent) && !isSquareAttacked(board, g1, opponent)) {
      moves.push({ from, to: g1, castle: 'K' });
    }
  }
  const queenRight = turn === 'w' ? castling.wQ : castling.bQ;
  if (queenRight) {
    const d1 = SQUARE(3, rank);
    const c1 = SQUARE(2, rank);
    const b1 = SQUARE(1, rank);
    if (!board[d1] && !board[c1] && !board[b1]
      && !isSquareAttacked(board, d1, opponent) && !isSquareAttacked(board, c1, opponent)) {
      moves.push({ from, to: c1, castle: 'Q' });
    }
  }
  return moves;
}

function generatePseudoMoves(state) {
  const { board, turn } = state;
  const moves = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || pieceColor(piece) !== turn) continue;
    switch (piece.toUpperCase()) {
      case 'P':
        moves.push(...pawnMoves(board, sq, turn, state.epSquare));
        break;
      case 'N':
        for (const to of stepTargets(sq, KNIGHT_STEPS)) moveIfLandable(board, sq, to, moves);
        break;
      case 'B':
        moves.push(...slidingMoves(board, sq, BISHOP_DIRS));
        break;
      case 'R':
        moves.push(...slidingMoves(board, sq, ROOK_DIRS));
        break;
      case 'Q':
        moves.push(...slidingMoves(board, sq, QUEEN_DIRS));
        break;
      case 'K':
        for (const to of stepTargets(sq, KING_STEPS)) moveIfLandable(board, sq, to, moves);
        moves.push(...castlingMoves(state, sq));
        break;
      default:
        break;
    }
  }
  return moves;
}

function slidingAttacker(board, square, dirs, bySide, pieceTypes) {
  const f0 = FILE(square);
  const r0 = RANK(square);
  for (const [df, dr] of dirs) {
    let f = f0;
    let r = r0;
    for (;;) {
      f += df;
      r += dr;
      if (!ON_BOARD(f, r)) break;
      const piece = board[SQUARE(f, r)];
      if (piece) {
        if (pieceColor(piece) === bySide && pieceTypes.includes(piece.toUpperCase())) return true;
        break;
      }
    }
  }
  return false;
}

// Is `square` attacked by any piece belonging to `bySide`? Shared by check
// detection, and later reused for castling-through-check (0.3) and the
// danger-zone overlay (Phase 4) — the same attack logic, just a different
// square asked about.
export function isSquareAttacked(board, square, bySide) {
  const f = FILE(square);
  const r = RANK(square);

  const pawnRank = r + (bySide === 'w' ? -1 : 1);
  if (pawnRank >= 0 && pawnRank <= 7) {
    const pawnChar = bySide === 'w' ? 'P' : 'p';
    for (const df of [-1, 1]) {
      const pf = f + df;
      if (pf < 0 || pf > 7) continue;
      if (board[SQUARE(pf, pawnRank)] === pawnChar) return true;
    }
  }

  const knightChar = bySide === 'w' ? 'N' : 'n';
  for (const to of stepTargets(square, KNIGHT_STEPS)) {
    if (board[to] === knightChar) return true;
  }

  const kingChar = bySide === 'w' ? 'K' : 'k';
  for (const to of stepTargets(square, KING_STEPS)) {
    if (board[to] === kingChar) return true;
  }

  if (slidingAttacker(board, square, BISHOP_DIRS, bySide, ['B', 'Q'])) return true;
  if (slidingAttacker(board, square, ROOK_DIRS, bySide, ['R', 'Q'])) return true;

  return false;
}

function findKing(board, color) {
  return board.indexOf(color === 'w' ? 'K' : 'k');
}

function applyMoveToBoard(board, move) {
  const newBoard = board.slice();
  const piece = newBoard[move.from];
  newBoard[move.to] = move.promotion
    ? (pieceColor(piece) === 'w' ? move.promotion : move.promotion.toLowerCase())
    : piece;
  newBoard[move.from] = null;

  if (move.enPassant) {
    newBoard[move.captureSquare] = null;
  }

  if (move.castle) {
    const rank = RANK(move.from);
    const [rookFrom, rookTo] = move.castle === 'K'
      ? [SQUARE(7, rank), SQUARE(5, rank)]
      : [SQUARE(0, rank), SQUARE(3, rank)];
    newBoard[rookTo] = newBoard[rookFrom];
    newBoard[rookFrom] = null;
  }

  return newBoard;
}

const CASTLE_CLEARING_SQUARES = {
  [SQUARE(4, 0)]: ['wK', 'wQ'], // e1: white king moves or is (impossibly) captured
  [SQUARE(0, 0)]: ['wQ'], // a1 rook
  [SQUARE(7, 0)]: ['wK'], // h1 rook
  [SQUARE(4, 7)]: ['bK', 'bQ'], // e8: black king
  [SQUARE(0, 7)]: ['bQ'], // a8 rook
  [SQUARE(7, 7)]: ['bK'], // h8 rook
};

function updateCastlingRights(castling, move) {
  const next = { ...castling };
  for (const square of [move.from, move.to]) {
    const rights = CASTLE_CLEARING_SQUARES[square];
    if (rights) for (const right of rights) next[right] = false;
  }
  return next;
}

export function isInCheck(state, color = state.turn) {
  const kingSquare = findKing(state.board, color);
  return isSquareAttacked(state.board, kingSquare, opponentOf(color));
}

// All fully legal moves for the side to move: pseudo-legal moves with any
// move that would leave the mover's own king in check filtered out.
export function generateLegalMoves(state) {
  const pseudo = generatePseudoMoves(state);
  const legal = [];
  const opponent = opponentOf(state.turn);
  for (const move of pseudo) {
    const newBoard = applyMoveToBoard(state.board, move);
    const kingSquare = findKing(newBoard, state.turn);
    if (!isSquareAttacked(newBoard, kingSquare, opponent)) {
      legal.push({ ...move, piece: state.board[move.from] });
    }
  }
  return legal;
}

export function makeMove(state, move) {
  let epSquare = null;
  if (move.doublePush) {
    const midRank = (RANK(move.from) + RANK(move.to)) / 2;
    epSquare = SQUARE(FILE(move.from), midRank);
  }
  return {
    board: applyMoveToBoard(state.board, move),
    turn: opponentOf(state.turn),
    castling: updateCastlingRights(state.castling, move),
    epSquare,
  };
}

export function isCheckmate(state) {
  return isInCheck(state) && generateLegalMoves(state).length === 0;
}

export function isStalemate(state) {
  return !isInCheck(state) && generateLegalMoves(state).length === 0;
}
