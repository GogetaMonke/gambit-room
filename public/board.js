import {
  createInitialState,
  generateLegalMoves,
  makeMove,
  isInCheck,
  isCheckmate,
  isStalemate,
  pieceColor,
} from './rules.js';
import { playMoveClick, playCaptureThud, playCheckTone } from './sounds.js';

const GLYPH_BY_TYPE = {
  P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚',
};
const FILE_LETTERS = 'abcdefgh';

function fileOf(sq) { return sq % 8; }
function rankOf(sq) { return Math.floor(sq / 8); }
function isLightSquare(sq) { return (fileOf(sq) + rankOf(sq)) % 2 === 1; }

// Squares in top-left-to-bottom-right visual order for a given orientation.
// 'w' = White's own view (rank 8 at top); 'b' = Black's own view (rank 1 at
// top) — this is what makes the board "right-side-up" after it flips.
function visualSquareOrder(orientation) {
  const order = [];
  if (orientation === 'w') {
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file <= 7; file++) order.push(rank * 8 + file);
    }
  } else {
    for (let rank = 0; rank <= 7; rank++) {
      for (let file = 7; file >= 0; file--) order.push(rank * 8 + file);
    }
  }
  return order;
}

// Public: creates a self-contained board UI bound to the given elements.
// `onMove(newState)` fires after a move is fully applied and rendered (not
// on game-ending moves' immediate render — still fires so a caller like
// hotseat.js can react, e.g. to flip the board for the next player).
export function createBoard({ boardEl, statusEl, endOverlayEl, endMessageEl, promotionEl, promoChoicesEl, onMove }) {
  let state = createInitialState();
  let orientation = 'w';
  let selected = null;
  let legalMoves = [];
  let lastMove = null;
  let gameOver = false;
  let endResult = null; // { type: 'checkmate', losingColor } | { type: 'stalemate' }

  function findKingSquare(color) {
    return state.board.indexOf(color === 'w' ? 'K' : 'k');
  }

  function render() {
    boardEl.innerHTML = '';
    const order = visualSquareOrder(orientation);

    const checkedKingSquare = gameOver && endResult?.type === 'checkmate'
      ? findKingSquare(endResult.losingColor)
      : (!gameOver && isInCheck(state) ? findKingSquare(state.turn) : null);

    order.forEach((sq, i) => {
      const div = document.createElement('div');
      div.className = `square ${isLightSquare(sq) ? 'light' : 'dark'}`;
      div.dataset.square = String(sq);

      if (lastMove && (sq === lastMove.from || sq === lastMove.to)) {
        div.classList.add('last-move');
      }
      if (selected === sq) div.classList.add('selected');
      if (checkedKingSquare === sq) {
        div.classList.add(gameOver ? 'checkmate-king' : 'in-check-king');
      }

      const piece = state.board[sq];
      if (piece) {
        const span = document.createElement('span');
        span.className = `piece ${pieceColor(piece) === 'w' ? 'white' : 'black'}`;
        span.textContent = GLYPH_BY_TYPE[piece.toUpperCase()];
        div.appendChild(span);
      }

      const moveHere = legalMoves.find((m) => m.to === sq);
      if (moveHere) {
        const marker = document.createElement('span');
        marker.className = `marker${moveHere.capture ? ' capture' : ''}`;
        div.appendChild(marker);
      }

      const row = Math.floor(i / 8);
      const col = i % 8;
      if (row === 7) {
        const label = document.createElement('span');
        label.className = 'coord file';
        label.textContent = FILE_LETTERS[fileOf(sq)];
        div.appendChild(label);
      }
      if (col === 0) {
        const label = document.createElement('span');
        label.className = 'coord rank';
        label.textContent = String(rankOf(sq) + 1);
        div.appendChild(label);
      }

      boardEl.appendChild(div);
    });

    if (!gameOver) {
      const turnName = state.turn === 'w' ? 'White' : 'Black';
      statusEl.textContent = isInCheck(state) ? `${turnName} to move — Check!` : `${turnName} to move`;
    }
  }

  function showEndOverlay(message) {
    endMessageEl.textContent = message;
    endOverlayEl.classList.add('visible');
  }

  function hideEndOverlay() {
    endOverlayEl.classList.remove('visible');
  }

  function showPromotionPicker(moves, onChosen) {
    promoChoicesEl.innerHTML = '';
    for (const move of moves) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo-btn';
      btn.textContent = GLYPH_BY_TYPE[move.promotion];
      btn.addEventListener('click', () => {
        promotionEl.classList.remove('visible');
        onChosen(move);
      });
      promoChoicesEl.appendChild(btn);
    }
    promotionEl.classList.add('visible');
  }

  function executeMove(move) {
    const wasCapture = !!move.capture;
    state = makeMove(state, move);
    lastMove = { from: move.from, to: move.to };
    selected = null;
    legalMoves = [];

    if (wasCapture) playCaptureThud(); else playMoveClick();

    if (isCheckmate(state)) {
      gameOver = true;
      endResult = { type: 'checkmate', losingColor: state.turn };
      render();
      const winner = state.turn === 'w' ? 'Black' : 'White';
      setTimeout(() => showEndOverlay(`Checkmate — ${winner} wins`), 350);
      return;
    }
    if (isStalemate(state)) {
      gameOver = true;
      endResult = { type: 'stalemate' };
      render();
      setTimeout(() => showEndOverlay('Stalemate — Draw'), 350);
      return;
    }

    if (isInCheck(state)) setTimeout(() => playCheckTone(), 130);

    render();
    if (onMove) onMove(state);
  }

  function handleSquareClick(sq) {
    if (gameOver) return;

    if (selected !== null) {
      const movesToSquare = legalMoves.filter((m) => m.to === sq);
      if (movesToSquare.length > 1) {
        showPromotionPicker(movesToSquare, executeMove);
        return;
      }
      if (movesToSquare.length === 1) {
        executeMove(movesToSquare[0]);
        return;
      }
    }

    const piece = state.board[sq];
    if (piece && pieceColor(piece) === state.turn) {
      selected = sq;
      legalMoves = generateLegalMoves(state).filter((m) => m.from === sq);
    } else {
      selected = null;
      legalMoves = [];
    }
    render();
  }

  boardEl.addEventListener('click', (e) => {
    const target = e.target.closest('.square');
    if (!target) return;
    handleSquareClick(Number(target.dataset.square));
  });

  function reset() {
    state = createInitialState();
    orientation = 'w';
    selected = null;
    legalMoves = [];
    lastMove = null;
    gameOver = false;
    endResult = null;
    hideEndOverlay();
    render();
  }

  function setOrientation(color) {
    orientation = color;
    render();
  }

  render();

  return { reset, setOrientation, getState: () => state };
}
