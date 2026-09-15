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

function pawnMoves(board, from, color) {
  const moves = [];
  const f = FILE(from);
  const r = RANK(from);
  const dir = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 1 : 6;
  const oneRank = r + dir;
  if (oneRank < 0 || oneRank > 7) return moves; // pawn on last rank: promotion arrives in 0.3

  const oneTo = SQUARE(f, oneRank);
  if (!board[oneTo]) {
    moves.push({ from, to: oneTo });
    if (r === startRank) {
      const twoRank = r + dir * 2;
      const twoTo = SQUARE(f, twoRank);
      if (!board[twoTo]) moves.push({ from, to: twoTo, doublePush: true });
    }
  }

  for (const df of [-1, 1]) {
    const cf = f + df;
    if (cf < 0 || cf > 7) continue;
    const capTo = SQUARE(cf, oneRank);
    const target = board[capTo];
    if (target && pieceColor(target) !== color) {
      moves.push({ from, to: capTo, capture: true });
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
        moves.push(...pawnMoves(board, sq, turn));
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
  newBoard[move.to] = newBoard[move.from];
  newBoard[move.from] = null;
  return newBoard;
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
  return {
    board: applyMoveToBoard(state.board, move),
    turn: opponentOf(state.turn),
  };
}
