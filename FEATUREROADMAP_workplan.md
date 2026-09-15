# Gambit Room — Feature Roadmap / Workplan

How to read this document:

- Each task is a checkbox: `[ ]` not started, `[x]` done.
- **Depends on** lists tasks that must be checked off first. Don't start a task until its dependencies are done.
- **Files** lists what gets created or edited.
- **Definition of done** is the objective test for checking the box — if it's not true yet, the box doesn't get checked.

Terms like *Durable Object*, *WebSocket*, *perft*, *minimax* are defined in [ProductSpec.md](ProductSpec.md#8-glossary).

**Order of the four phases, and why:** the rules engine has to be correct before anything is built on top of it, so it comes first. After that, Hot-Seat comes before VS Computer and Online because it's the smallest possible complete, playable game — get *something real* live on the internet fast, then layer in the computer opponent (still runs entirely in the browser, no new infrastructure), then Online (the most complex piece — a real server, real-time sync, persistence), and the Danger Zone overlay last since it's an optional cosmetic layer on logic that already has to exist by then.

---

## Phase 0 — Rules Engine Foundation

Nothing else in this project may be started until Phase 0 is fully checked off.

- [ ] **0.1 — Project scaffold**
  - Depends on: —
  - Files: `package.json`, `wrangler.jsonc`, `src/` and `tests/` folders
  - Definition of done: `npm install` runs with no errors; `wrangler.jsonc` exists with `compatibility_date` set to today and `observability` enabled (no `assets` or Durable Object config yet — that's added in the phases that need them); project structure matches the layout in [README.md](README.md#project-structure-planned).

- [ ] **0.2 — Core move generation, verified by perft**
  - Depends on: 0.1
  - Files: `src/rules.js`, `tests/perft.test.js`
  - Definition of done: `rules.js` represents the board and generates legal moves for all six piece types (including sliding pieces — bishop, rook, queen — respecting blockers, and correctly *excluding* moves that would leave your own king in check). Running `node tests/perft.test.js` from the start position prints:
    - depth 1 → **20**
    - depth 2 → **400**
    - depth 3 → **8,902**

    All three must match exactly. No other task in this project may begin until this passes.

- [ ] **0.3 — Special rules: castling, en passant, promotion, check/checkmate/stalemate**
  - Depends on: 0.2
  - Files: `src/rules.js`, `tests/rules.test.js` (scenario-based positions, since these rules mostly don't appear within perft depth 3)
  - Definition of done: given hand-picked test positions, `rules.js` correctly allows/forbids castling (kingside, queenside, and each of their individual legality conditions — rook/king unmoved, no pieces between, king not moving through check), allows en passant only on the immediate next move after a qualifying two-square pawn advance, offers all four promotion piece choices when a pawn reaches the last rank, and correctly reports check, checkmate, and stalemate for known test positions. `rules.js` also exposes a reusable "is this square attacked by the opponent" function — needed again later for Phase 4.

---

## Phase 1 — Hot-Seat, live on the internet

Goal: the smallest complete, fully-playable game, reachable at a public URL.

- [ ] **1.1 — Static site deploy pipeline**
  - Depends on: 0.1
  - Files: `wrangler.jsonc` (add `assets` config, `not_found_handling: "single-page-application"`), `public/index.html` (placeholder), `src/worker.js` (minimal request handler)
  - Definition of done: `npm run deploy` publishes successfully; the resulting `*.workers.dev` URL loads the placeholder page in a browser.

- [ ] **1.2 — Board and piece rendering**
  - Depends on: 0.2, 1.1
  - Files: `public/index.html`, `public/styles.css`, `public/board.js`
  - Definition of done: loading the page shows a full 8×8 board in the walnut/cream palette with all 32 pieces in their correct starting squares, using the serif/sans-serif type pairing from the spec. No interactivity yet — this task is purely visual.

- [ ] **1.3 — Move input and legal-move highlighting**
  - Depends on: 0.2, 1.2
  - Files: `public/board.js`
  - Definition of done: clicking a piece gives its square the green glow and shows a dot on every legal destination square (a filled ring on capture squares), using `rules.js` as the only source of truth for what's legal. Clicking a square that isn't a legal destination does nothing — it is not possible to make an illegal move through the interface.

- [ ] **1.4 — Full move execution and special rules in the UI**
  - Depends on: 0.3, 1.3
  - Files: `public/board.js`
  - Definition of done: castling, en passant, and promotion (with a piece-choice prompt) all work by clicking through the board exactly like any other move. Check is visually/audibly indicated (see 1.6). Checkmate and stalemate end the game: on checkmate the losing king's square glows red and a result message fades in (no `alert()`); on stalemate a similar non-blocking message appears.

- [ ] **1.5 — Hot-seat turn flow**
  - Depends on: 1.4
  - Files: `public/board.js`, `public/hotseat.js`
  - Definition of done: after each move, the board visually rotates 180 degrees so the next player sees it from their own side; the from/to squares of the last move stay highlighted until the following move; two people can play a complete legal game, start to finish, on one device.

- [ ] **1.6 — Sound effects**
  - Depends on: 1.4
  - Files: `public/sounds/` (click, thud, check audio files), `public/board.js`
  - Definition of done: a quiet click plays on a normal move, a heavier thud plays on a capture, and a distinct short tone plays the instant either king is put in check.

- [ ] **1.7 — Mode selection screen**
  - Depends on: 1.5
  - Files: `public/index.html`, `public/app.js`
  - Definition of done: landing on the site shows a choice of the three modes; selecting Hot-Seat goes straight into a playable game. (VS Computer and Online options can be visibly present but non-functional until Phases 2 and 3 are done.)

- [ ] **1.8 — Deploy and confirm Hot-Seat is live**
  - Depends on: 1.6, 1.7
  - Files: none (verification task)
  - Definition of done: `npm run deploy` succeeds; a complete hot-seat game (including at least one castle, one promotion, and a checkmate) is played start-to-finish on the public URL with no console errors.

---

## Phase 2 — VS Computer

- [ ] **2.1 — Minimax + alpha-beta search engine**
  - Depends on: 0.3
  - Files: `src/ai.js`
  - Definition of done: given any legal position and a side to move, `ai.js` returns a legal move, searching 2 ply deep with alpha-beta pruning. Verified against several hand-picked positions with an obvious best move (e.g. a free capture, or escaping a forced mate) to confirm it actually finds it.

- [ ] **2.2 — VS Computer mode UI**
  - Depends on: 1.4, 2.1
  - Files: `public/vscomputer.js`, `public/app.js`
  - Definition of done: selecting "VS Computer" starts a game where the human is always White; after each human move, the browser calls `ai.js` and plays Black's reply within 2 seconds, using the same board/highlighting/sound/checkmate UI already built in Phase 1. A full game is completable, including the AI itself being checkmated or delivering checkmate.

- [ ] **2.3 — Deploy and confirm VS Computer is live**
  - Depends on: 2.2
  - Files: none (verification task)
  - Definition of done: `npm run deploy` succeeds; a full VS Computer game is played on the public URL with every AI reply arriving within 2 seconds.

---

## Phase 3 — Online rooms

The most complex phase — a real server, persistence, and real-time sync between two devices.

- [ ] **3.1 — Durable Object room skeleton**
  - Depends on: 0.3, 1.1
  - Files: `wrangler.jsonc` (Durable Object binding `ROOM`, `new_sqlite_classes`), `src/room.js`, `src/worker.js` (route WebSocket upgrade requests to `env.ROOM.getByName(roomCode)`, `run_worker_first` for that path)
  - Definition of done: requesting a WebSocket upgrade at the room route successfully reaches a Durable Object instance (confirmed via logs/observability); each distinct room code gets its own instance.

- [ ] **3.2 — WebSocket protocol and connection handling**
  - Depends on: 3.1
  - Files: `src/room.js`
  - Definition of done: `src/room.js` accepts connections with `ctx.acceptWebSocket()`; defines and handles JSON messages of the form `{ "type": ..., "payload": ... }` for at least `join`, `move`, `state`, and `error`; uses `ws.serializeAttachment()` to remember which connection is White, Black, or a spectator.

- [ ] **3.3 — Server-authoritative move validation**
  - Depends on: 0.3, 3.2
  - Files: `src/room.js` (imports `src/rules.js`)
  - Definition of done: the server, not the browser, decides whether a submitted move is legal and whose turn it is, using `rules.js`. An illegal or out-of-turn move sent over the WebSocket is rejected with an `error` message and does not change the game state. First connection to a room is assigned White, second is assigned Black, any further connections are spectators.

- [ ] **3.4 — Persistence: save after every move, no timers**
  - Depends on: 3.3
  - Files: `src/room.js`
  - Definition of done: the current position is written to the Durable Object's SQLite storage immediately after each accepted move — not on any timer or delay. Manually stopping and restarting the Worker (or waiting for the Durable Object to go idle) and then reconnecting shows the game exactly as it was left.

- [ ] **3.5 — Room code join UI**
  - Depends on: 1.7, 3.3
  - Files: `public/online.js`, `public/app.js`
  - Definition of done: selecting "Online" lets a player type/create a room code and connects via WebSocket; two separate browser windows (or devices) using the same code land in the same game, each seeing the correct color assignment.

- [ ] **3.6 — Live move sync**
  - Depends on: 3.4, 3.5
  - Files: `public/online.js`
  - Definition of done: a move made on one device appears on the other device's board within a second or two, with no page refresh, using the same board/highlight/sound UI from Phase 1.

- [ ] **3.7 — Refresh-to-rejoin**
  - Depends on: 3.6
  - Files: `public/online.js`, `src/room.js`
  - Definition of done: refreshing the browser mid-game reconnects to the same room and restores the current position and the same seat (White/Black/spectator) that connection had before.

- [ ] **3.8 — New Game control**
  - Depends on: 3.6
  - Files: `public/online.js`, `src/room.js`
  - Definition of done: either player clicking "New Game" resets the board to the starting position for both connected clients at once.

- [ ] **3.9 — Deploy and confirm Online is live**
  - Depends on: 3.7, 3.8
  - Files: none (verification task)
  - Definition of done: a full game is played live between two actual separate devices (not two tabs faking it) over the public URL, including a refresh mid-game by at least one player, ending in checkmate, followed by a successful New Game.

---

## Phase 4 — Danger Zone overlay (optional extra, built last)

- [ ] **4.1 — Danger zone hover overlay**
  - Depends on: 0.3, 1.4, 2.2, 3.6 (all three modes' board UI must exist since this applies everywhere)
  - Files: `public/board.js`
  - Definition of done: hovering your mouse over your own king highlights every square containing an enemy piece currently attacking that king, using the same "is this square attacked" function from `rules.js` built in Task 0.3 — no new chess logic is written for this task. Moving the mouse away clears the highlight.

---

## After this document

This roadmap will be updated (boxes checked, tasks adjusted) as work proceeds — it's a living plan, not a one-time deliverable.
