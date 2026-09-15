# Gambit Room — Product Spec

This document describes *what* Gambit Room must do and *how it must be built*, in enough detail that any task in the roadmap can be checked off objectively. If a line here and a line in the roadmap ever disagree, this document wins.

---

## 1. Overview

Gambit Room is a browser chess game with three modes, all sharing one rulebook and one visual design. It is a static-feeling web page backed by a small amount of server logic (only needed for the Online mode) and runs on Cloudflare Workers, Cloudflare's platform for hosting code close to users worldwide rather than on one traditional server.

## 2. The three modes

### 2.1 Hot-Seat
Two people, one screen, one device. Players alternate turns on the same board. After every move, the board **rotates 180 degrees** so the person about to move always sees it right-side-up from their own side.

### 2.2 VS Computer
The human always plays White. The browser itself calculates Black's replies — no server round-trip, no network needed once the page is loaded. See §5 for the exact algorithm and time limit.

### 2.3 Online
Two players on two separate devices type the same **room code** to join the same game.
- Whoever joins first plays White; whoever joins second plays Black; anyone after that can watch but not move.
- The **server** (not either browser) is the single source of truth for whether a move is legal and whose turn it is — this prevents cheating or the two screens disagreeing with each other.
- Refreshing the page rejoins the same game in progress, in the same seat (White/Black/spectator), because the server remembers.
- A "New Game" button resets the board for both players at once.

## 3. Look and feel

**Board & color palette:** warm walnut (a medium-brown wood tone) and cream squares, with deep forest green as the accent color used for selection, legal-move markers, and highlights.

**Typography:** a serif typeface for headings (titles, mode names, result messages) paired with a plain sans-serif for labels, buttons, and any small UI text. Serif = the kind of typeface with small decorative strokes at the end of letters (like a typewriter or a printed book); sans-serif = the plainer kind without those strokes, more common in app interfaces.

**Selection & legal moves:**
- Clicking your own piece gives its square a soft green glow.
- Every square that piece could legally move to shows a small green dot in the center.
- If a legal destination would capture an enemy piece, it shows a **filled ring** instead of a dot (a hollow circle outline filled with the accent color) — a capture reads differently from a quiet move at a glance.

**Move history highlight:** the square a piece moved *from* and the square it moved *to* both stay subtly highlighted (a light tint) until the next move replaces them.

**Sound:**
- A light *click* when a piece moves.
- A slightly heavier *thud* when a move captures a piece.
- A short, distinct *tone* the instant a king is put in check.

**End of game:** no browser `alert()` popups. On checkmate, the losing king's square glows red while a short result message (e.g. "Checkmate — White wins") fades into view.

## 4. Definition of "done" (applies to every mode)

- All six piece types move and capture per standard chess rules.
- Check, checkmate, and stalemate are all correctly detected.
- Special moves work: castling (kingside and queenside, with all of their legality conditions), en passant, and pawn promotion — with the player choosing *which* piece to promote to (queen, rook, bishop, or knight), not an automatic queen.
- **An illegal move must be literally impossible to make** — not flagged after the fact, not just visually discouraged. The interface only ever lets you complete moves the rules module says are legal.

**Explicitly out of scope for this project:** user accounts/login, chess clocks, ELO-style ratings, draw by threefold repetition, draw by the fifty-move rule, opening book / opening names, exporting move lists (e.g. PGN), and React (or any UI framework) — this is plain HTML, CSS, and JavaScript.

## 5. The computer opponent

- Algorithm: **minimax with alpha-beta pruning**, searching **2 ply deep** (two half-moves: the computer's move and the best human reply it's defending against).
  - *Minimax* is a way of picking a move by assuming the opponent will always play their own best reply, then choosing the move that gives you the best outcome *after* that — planning a couple of steps ahead rather than just grabbing whatever looks good right now.
  - *Alpha-beta pruning* is an optimization that lets the search skip branches it can prove won't change the outcome, so it explores far fewer positions for the same search depth without changing the result.
- Must always return a **legal** move.
- Must always respond within **2 seconds**.
- Runs entirely in the browser (client-side JavaScript) — no server involvement.

## 6. Non-negotiable technical constraints

These are fixed requirements, not suggestions — they shape the whole roadmap.

- **Hosting:** Cloudflare Workers, on the **Free plan** (no paid tier features may be required).
- **Static site delivery:** served via the `assets` feature in `wrangler.jsonc` (Cloudflare's config file), with `not_found_handling` set to `"single-page-application"` (any unmatched URL falls back to the main page, standard behavior for a single-page app) and `run_worker_first` enabled specifically for the WebSocket connection path (so that request reaches our code instead of being served as a static file).
- **Compatibility date:** `compatibility_date` in the config is set to the date the config is written, and **observability** (Cloudflare's built-in request/error logging) is turned on.
- **The rules are homemade.** All chess logic — move generation, legality, check/checkmate/stalemate detection, castling, en passant, promotion — lives in **one file, `rules.js`**, written from scratch. No chess library (e.g. `chess.js`) and no chess engine dependency, for any mode, client or server. Every mode and the server all import and share this same file, so the rules can never disagree with themselves.
- **Proof of correctness — the perft test:** before any other game code is written, `rules.js` must pass a **move-count test** (a "perft" test — short for *performance test*, a standard way of sanity-checking a chess move generator by counting how many possible game positions exist after N moves from the start). From the starting position:
  - After 1 move (depth 1): exactly **20** possible positions.
  - After 2 moves (depth 2): exactly **400**.
  - After 3 moves (depth 3): exactly **8,902**.

  These are well-known, verified numbers for the standard chess starting position. If `rules.js` doesn't produce them exactly, the move generator has a bug — full stop, before anything else gets built on top of it.
- **No outside real-time libraries.** No Socket.IO, no Express, no `ws` npm package. Real-time communication uses Cloudflare's **native WebSocket** support directly.
- **One room, one Durable Object.** A **Durable Object** is a small unit of server-side code-plus-storage that Cloudflare can spin up on demand and keep alive for as long as it's needed — think of it as a tiny dedicated mini-server for exactly one chess room, created via `env.ROOM.getByName(roomCode)`. Each Durable Object has its own private **SQLite** database (a lightweight embedded database) for saving that room's state, enabled via the `"new_sqlite_classes"` setting.
- **Connection handling:** WebSocket connections are accepted with `ctx.acceptWebSocket()` (Cloudflare's native API, not a library). Every message sent over the connection is JSON with a `"type"` field (what kind of message it is) and a `"payload"` field (the data that goes with it). Which player is which (White, Black, or spectator) is tracked using `ws.serializeAttachment()`, a Cloudflare API for attaching small bits of data directly to a WebSocket connection so the server remembers who's who even if the Durable Object briefly goes to sleep and wakes back up.
- **No timers, anywhere.** The current game position is saved to SQLite **immediately after every move** — not on a schedule, not on a delay. This keeps the room's state always accurate and means a Durable Object can be safely put to sleep between moves without losing anything.

## 7. Optional extra (built last, after everything above works)

**Danger zone overlay:** hovering your mouse over your own king highlights every square containing an enemy piece that is currently attacking that king. This reuses the exact same "is this square under attack" logic already required to detect check — it's a new way of *displaying* information the rules engine already knows, not new chess logic.

## 8. Glossary

| Term | Plain-English definition |
|---|---|
| Cloudflare Workers | A platform for running small pieces of backend code on servers spread around the world, instead of one server in one place. |
| Durable Object | A single persistent "mini-server plus storage" instance that Cloudflare creates on demand and can address by name — used here as one per chess room. |
| SQLite | A small, file-based database that lives inside a single Durable Object, used to save that room's current game. |
| WebSocket | A connection between a browser and a server that both sides can send messages over at any time, without the browser needing to repeatedly ask "anything new?" |
| Wrangler | Cloudflare's command-line tool for developing and deploying Workers projects. |
| Static assets / SPA | A "single-page application" is a web page that loads once and then updates itself with JavaScript, rather than reloading a new page for every action; "static assets" are the fixed files (HTML/CSS/JS/images) that make it up. |
| Minimax | A move-choosing strategy that looks a few moves ahead, assuming the opponent always replies with their own best move, and picks the move that leads to the best outcome under that assumption. |
| Alpha-beta pruning | A shortcut for minimax that skips exploring moves it can prove won't affect the final decision, making the search faster without changing the answer. |
| Perft test | "Performance test" — a standard chess-programming sanity check that counts the exact number of possible positions reachable in N moves, used to verify a move generator has no bugs. |
| En passant | A special pawn-capture rule: if an enemy pawn just moved two squares forward and landed beside your pawn, you may capture it as if it had only moved one square — but only on the very next move. |
| Castling | A special king-and-rook move, done once per game per side, that moves the king two squares toward a rook and the rook to the square the king crossed — only legal under specific conditions (neither piece has moved, no pieces between them, king not in or passing through check). |
| Ply | One half-move — one player's single move. "2 ply" means one move by each side. |
