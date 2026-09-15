import { createBoard } from './board.js';

// Hot-seat's one extra piece of behavior on top of the shared board: after
// each move, spin the board 180 degrees so it lands right-side-up for
// whoever is about to play next. The spin is a real visual rotation of the
// whole board; it settles back to upright with the new orientation already
// applied, so pieces read correctly the instant it stops.
export function initHotSeat({ boardWrapperEl, ...boardElements }) {
  const board = createBoard({
    ...boardElements,
    onMove: (newState) => flipTo(newState.turn),
  });

  function flipTo(nextColor) {
    const animation = boardWrapperEl.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }],
      { duration: 450, easing: 'ease-in-out' },
    );
    animation.onfinish = () => board.setOrientation(nextColor);
  }

  return board;
}
