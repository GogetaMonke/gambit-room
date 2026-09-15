import { initHotSeat } from './hotseat.js';

const modeSelectEl = document.getElementById('mode-select');
const gameScreenEl = document.getElementById('game-screen');

const boardElements = {
  boardWrapperEl: document.getElementById('board-wrapper'),
  boardEl: document.getElementById('board'),
  statusEl: document.getElementById('status-bar'),
  endOverlayEl: document.getElementById('end-overlay'),
  endMessageEl: document.getElementById('end-message'),
  promotionEl: document.getElementById('promotion-picker'),
  promoChoicesEl: document.getElementById('promo-choices'),
};

let activeGame = null;

function showGameScreen() {
  modeSelectEl.hidden = true;
  gameScreenEl.hidden = false;
}

function showModeSelect() {
  gameScreenEl.hidden = true;
  modeSelectEl.hidden = false;
}

document.getElementById('mode-hotseat').addEventListener('click', () => {
  if (!activeGame) activeGame = initHotSeat(boardElements);
  else activeGame.reset();
  showGameScreen();
});

document.getElementById('new-game-btn').addEventListener('click', () => {
  if (activeGame) activeGame.reset();
});

document.getElementById('back-btn').addEventListener('click', showModeSelect);
