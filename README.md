# Gambit Room

*by Kimi*

A full chess game that runs entirely in a web browser, with no app to install. Three ways to play:

1. **Hot-Seat** — two people share one screen and one keyboard, taking turns.
2. **VS Computer** — you play White; the browser calculates and plays Black's moves.
3. **Online** — two people on two different devices type the same room code and play live, watching each other's moves appear in real time.

It's built and hosted on **Cloudflare Workers** — a service that runs small pieces of code "at the edge" (on servers close to whoever is visiting the site) instead of on one central server. That's what makes the Online mode possible without renting or managing a traditional server.

For the full plan — what each mode needs to do, how the look and sound should feel, and every technical rule this project has to follow — see [ProductSpec.md](ProductSpec.md).

To see the build broken into concrete, checkable tasks (in the order they'll be built), see [FEATUREROADMAP_workplan.md](FEATUREROADMAP_workplan.md).

## Status

Planning stage. No game code yet — see the roadmap for what's next and in what order.

## Running this project locally (once code exists)

These commands don't work yet (there's no code to run), but this is what they'll look like once the project is scaffolded:

```bash
npm install        # download the project's dependencies
npm run dev         # start a local copy of the site on your computer, via Wrangler
```

**Wrangler** is Cloudflare's command-line tool for developing and publishing Workers projects. `npm run dev` will use it to run a local preview of the game before anything is made public.

## Deploying

```bash
npm run deploy       # publish the current code to your live Cloudflare Workers URL
```

## Project structure (planned)

```
gambit room/
├── src/
│   ├── worker.js       # the entry point Cloudflare runs — routes requests
│   └── room.js          # the "Durable Object" that runs one online game room
├── public/               # everything served straight to the browser
│   ├── rules.js            # the chess rulebook — shared by every mode AND the server
│   ├── board.js             # board rendering, click handling, move execution
│   ├── hotseat.js            # hot-seat's turn flow (the 180° board flip)
│   ├── sounds.js               # move/capture/check tones (synthesized, no audio files)
│   ├── app.js                   # mode selection wiring
│   ├── index.html
│   └── styles.css
├── tests/                 # automated checks, including the move-count test for rules.js
├── wrangler.jsonc        # Cloudflare Workers configuration
└── package.json
```

`rules.js` lives inside `public/` — not `src/` — specifically so the browser can fetch it directly as a plain file, while the server-side code (`src/worker.js`, and later `src/room.js`) still imports that exact same file for the Online mode. One authored file, actually shared, not two copies kept in sync.

## Tech stack, in plain English

| Term | What it means here |
|---|---|
| Cloudflare Workers | The hosting platform. Runs our code on Cloudflare's global network instead of a single server we'd have to maintain. |
| Durable Object | A small, persistent unit of server-side state that Cloudflare can create on demand — one per chess room — that remembers the game even if no one is actively looking at it. |
| WebSocket | A connection between a browser and the server that stays open, so the server can push updates (like "the other player just moved") the instant they happen, instead of the browser having to keep asking. |
| SQLite | A lightweight embedded database. Each room's Durable Object has one, used to save the current board position after every move. |

More terms are defined in the [ProductSpec.md](ProductSpec.md) glossary.

## License

Not yet decided.
