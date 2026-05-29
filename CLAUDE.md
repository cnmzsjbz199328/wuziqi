# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
wuziqi/
├── apps/gomoku-cf/      # ACTIVE: Cloudflare Workers rewrite (React + Vite + Hono + DO + KV)
├── Gomoku/              # REFERENCE ONLY: trimmed Java snippets for game rules + AI
├── REFACTOR_PLAN.md     # 6-milestone plan for the rewrite, KV/DO schema, ADRs
└── CLAUDE.md            # this file
```

**All active development happens in `apps/gomoku-cf/`.** The original Spring Boot project under `Gomoku/` has been pared down to 9 Java files that are kept purely as a reference for game logic and AI heuristics. There is no Gradle build, no Spring runtime, no tests, no CI on the Java side — none of it should be run, only read.

## `Gomoku/` — what's left and why

| File | Why it's kept |
|---|---|
| `Board.java` | Source of truth for the non-standard "clear winning line + randomly remove opponent stones" rule. The TS port in `apps/gomoku-cf/src/worker/game/board.ts` was derived from this. |
| `Game.java` | Reference for the main loop: place → check 5-in-a-row → clear + disrupt → score → next player. Spring-coupled and won't compile in isolation, but the flow is what matters. |
| `MoveStrategy.java` + `RandomMoveStrategy.java` + `SmartMoveStrategy.java` | AI strategies the TS `ai.ts` was based on. The original `SmartMoveStrategy` had a single-direction `checkLine` bug — the TS version fixes it. |
| `User.java` + `UserPool.java` | Data shape for users (`username` + `score`). Persistence in the original was a no-op; the rewrite ultimately dropped persistent user records too — identity is room-scoped and ephemeral, living in the `GameRoom` DO and dying with the room. |
| `Poem/Poem.java` + `Poem/PoemService.java` | Original inlined poem strings used as the win-screen flourish. The TS rewrite ships a curated 8-poem list inline at `src/worker/poems.ts` rather than seeding KV — the list is small, immutable, and KV would just add an extra read per round end. |

`Gomoku/legacy-frontend/` holds a snapshot of the old static frontend (`index.html`, `script.js`, `style.css`) plus a short `README.md` indexing what's worth lifting — the typewriter poem reveal in `style.css:102-126` triggered by `script.js:45-62` is the main one. **Do not run or import it**; it's read-only animation reference.

Everything else from the original tree (`build.gradle`, `gradlew`, Spring `*Application` / `*Controller` / `*Config` classes, `Main.java`, `GameMove.java`, the rest of `resources/` — `schema.sql`, `data.sql`, Liquibase changelog, Thymeleaf templates — the `src/test/` directory, the dead Docker+Render GitHub workflow, and Windows `.lnk` shortcuts) has been deleted from this branch. The `master`/`main` branch still has them if you need to dig.

## Non-standard Gomoku rules (the product's differentiator)

A 5-in-a-row is **not the end of the game**; it's a scoring + disrupt event:

- All of the winning player's stones that belong to any 5-in-a-row (overlapping/extended runs are de-duplicated) are removed from the board.
- Then, for each opposing color present on the board, `clearedSelf` of their stones are removed at random.
- Score awarded = `max(0, clearedSelf - 4)`. A single 5-run scores 1; a 6-run (one stone of overlap with the next position) scores 2; a fork that unions 9 unique stones scores 5.
- **There is no auto-end.** Play continues indefinitely; per-room scores accumulate in the DO. Every scoring clear (`pointsAwarded > 0`) carries a random Tang quatrain in its `ServerClear` message, which the client typewrites in the page header (room-scoped — only that room sees it). The only way scores reset is a manual `ClientRestart` from any seated player, which also clears the board.

Keep this rule intact unless the user explicitly asks otherwise — it was previously flagged as a bug, but the user has confirmed it's the product's core differentiator.

## Multi-player rooms (the always-present bot)

Every `GameRoom` Durable Object seats one AI player (`username = "Bot"`, color `amber`) at init time and keeps it for the room's lifetime. A room with one human still has an opponent; a room with 2-4 humans always has a fourth actor breaking up any 1v1 standoff. Turn order = humans (in join order, only connected ones) → bot → loop.

- **Visibility**: public rooms appear in `GET /api/room` (KV index at `room_idx:public:<code>`). Private rooms have no index entry — joinable only by 6-char code.
- **Seats**: max 4 humans + 1 bot. Human colors `black / white / red / blue` assigned in join order; bot fixed `amber`.
- **5-in-a-row in N-player**: clear winner's lines; then for **each** other player (including bot), randomly remove `clearedSelf` of their stones.
- **Single alarm slot, three uses**: `bot_move` (+1500ms when bot's turn — long enough for the previous move + any clear/disrupt animation to register), `turn_timeout` (+3min on a connected human's turn, **only when ≥2 humans are in the room** — solo-human-vs-bot rooms skip the deadline since there's nobody else waiting), `room_gc` (+5min when no humans connected → `destroy()`). Stored in `alarm_reason`; reconciled by `rescheduleAlarm()` after every state mutation.
- **Score persistence**: per-room scores live entirely in the DO (`bumpPlayerScore` writes to DO storage) and are scoped to the room's current round. They are NOT mirrored to KV — KV holds only the public-room lobby index. There is no global user store; identity is room-scoped and ephemeral (see below).
- **Identity is room-scoped, not global**: there is no account, claim, or KV user record. Every WS opens as a spectator; a player takes a seat in-band by sending a `join` (name + a client-generated seat token). `ensureSeat` enforces name uniqueness *within the room only* and binds the seat to the token — a reconnect with the matching token reclaims the seat; a mismatch reports `name_taken`. The same name is freely reusable in a different room, and the seat (name+token) is stored client-side per room (`localStorage["gomoku.seat:<code>"]`). Giving up a seat (`resign`) frees the name and downgrades the socket back to spectator.

## `apps/gomoku-cf/` — the active project

Stack: **React 19 + Vite 6 + TypeScript + Tailwind v4** (client), **Hono 4 + Workers + Durable Objects (SQLite) + KV** (backend), **Zod** for schema validation, **`@cloudflare/vite-plugin`** for full-stack dev. **Vitest** for unit tests with an in-memory KV fake.

```
apps/gomoku-cf/
├── src/
│   ├── react-app/                       # Vite-bundled React frontend, single-page
│   │   ├── main.tsx, App.tsx, index.css # entry + Tailwind + typewriter @keyframes
│   │   ├── pages/GamePage.tsx           # the only page: board (left) + sidebar (right)
│   │   ├── components/                  # Board, PoemHeader, LobbyWidget, PlayerList,
│   │   │                                  RoomWidget, SignInCard
│   │   ├── hooks/                       # useRoomSeat (per-room name+token),
│   │   │                                  useMultiPlayerGame (WS + reconnect +
│   │   │                                  in-band join + ClearEvent/poem)
│   │   └── lib/                         # api.ts (REST client), randomName
│   ├── worker/                          # Cloudflare Worker
│   │   ├── index.ts                     # Hono entry, exports GameRoom DO, mounts routes
│   │   ├── routes/                      # room.ts
│   │   │                                  (create/list/meta/ws-upgrade)
│   │   ├── do/GameRoom.ts               # the per-room DO: seats (in-band join +
│   │   │                                  seat token), turn rotation, single
│   │   │                                  alarm slot, restartRound
│   │   ├── game/                        # board.ts, ai.ts — pure, marker-agnostic
│   │   │                                  (any string is a valid Cell value)
│   │   ├── kv/                          # rooms.ts (public lobby index)
│   │   └── poems.ts                     # inline Tang quatrains for the scoring flourish
│   └── shared/protocol.ts               # Zod schemas + types for ALL cross-boundary
│                                          traffic (REST + WS)
├── wrangler.jsonc                       # bindings: KV (real id), GAME_ROOM DO, ASSETS
├── vite.config.ts                       # react() + tailwindcss() + cloudflare() plugins
├── vitest.config.ts
└── worker-configuration.d.ts            # generated by `wrangler types`, do not edit
```

### Single-page architecture

There is **no in-app navigation** and no sign-in gate. On load `App.tsx`
rehydrates the last room code from `localStorage["gomoku.lastRoom"]` (or
auto-creates a private room) and renders `GamePage` directly — you land
on a live board as a spectator. Naming happens in-room: clicking the
board prompts for a room-scoped name, which takes a seat.
A user can switch rooms from the sidebar's RoomWidget (new public /
new private / join by code) or LobbyWidget (click any public room) —
those updates only change `App.tsx`'s `roomCode` state, which
re-triggers `useMultiPlayerGame`'s WS reconnect to the new DO. No
separate "home", "single-player", or "lobby" routes exist; being alone
in a room with the always-present bot IS single-player.

### Commands (all run from `apps/gomoku-cf/`)

```bash
npm run dev          # Vite + Workers dev server on :5173, full-stack HMR
npm test             # Vitest run-once (68 tests at M5)
npm run test:watch   # Vitest watch
npm run build        # tsc -b && vite build → dist/client + dist/gomoku_cf
npm run check        # build + `wrangler deploy --dry-run` — pre-flight before deploy
npm run deploy       # wrangler deploy (needs `wrangler login` + real KV id)
npm run lint         # ESLint
npm run cf-typegen   # regenerate worker-configuration.d.ts after wrangler.jsonc changes
```

### Critical conventions

- **`src/shared/protocol.ts` is the only source of truth for cross-boundary types.** Both worker and react-app import from it. Adding a new WS message or REST endpoint? Add a Zod schema here first.
- **`UsernameSchema`: 1-16 chars, `[a-zA-Z0-9_]` only.** CJK was considered and dropped — non-ASCII round-tripping through URLs, KV keys, and shell scripts caused bugs without enough product value. `"Bot"` is reserved (`ensureSeat` rejects it for humans). Uniqueness is **room-scoped**, enforced by the DO — not global.
- **`Cell = string | null`.** A non-empty marker (a player's username). Game functions (`placeStone`, `hasFiveInARow`, `clearWinningLines`, `smartMove`) accept any string identifier — that's what lets the same engine drive the bot and N human players uniformly.
- **Durable Object: SQLite-backed, Hibernation API.** `GameRoom.fetch` accepts WS upgrades via `ctx.acceptWebSocket(server)` — never call `ws.accept()` (that disables hibernation and burns GB-s). Sockets carry `{ username }` (null = spectator) via `serializeAttachment` so identity survives wake-up; it's updated in place when a socket takes or gives up a seat.
- **Seating is in-band, room-scoped, and done by the DO** (not the Worker, not KV). Every socket opens as a spectator; the client sends a `join` (name + client-generated seat token), which `ensureSeat` validates against the DO's own player list — name free → seat it; name held with matching token → reconnect; mismatch → `name_taken`. No global user store, no URL credentials.
- **Single alarm slot in `GameRoom`** drives three concerns: `bot_move`, `turn_timeout`, `room_gc`. Recompute via `rescheduleAlarm()` after every state mutation; never set the alarm directly. The handler in `alarm()` reads `alarm_reason` from storage and re-validates the precondition (a reconnect can race the GC).
- **KV binding ID in `wrangler.jsonc` is a real namespace id**, not a placeholder. Local dev (Miniflare) uses an in-memory store and ignores it; production reads/writes the real namespace.
- **`compatibility_date`**: pinned to `2025-11-25` because the bundled workerd doesn't support later dates. Bump only when upgrading wrangler/workerd.
- **`run_worker_first: ["/api/*"]` in `assets` config**: Worker handles `/api/*` first; all other paths fall through to the SPA bundle.
- **Re-export the DO class from `src/worker/index.ts`** (`export { GameRoom } from "./do/GameRoom";`) — wrangler binds DO classes by import from the main module.
- **Game functions are pure + immutable.** `placeStone` / `clearWinningLines` return new boards; never mutate the input. The RNG used by `clearWinningLines` is injected for testability.
- **Seat token = 128 hex chars** (64 random bytes from `crypto.getRandomValues`), generated **client-side** in `useRoomSeat`. It's a per-room seat secret, not a global credential: stored in `localStorage["gomoku.seat:<code>"]`, sent with `join`, and bound to the name by the DO. A reconnect presenting the same token reclaims the seat.

## Milestones progress

`REFACTOR_PLAN.md` has the full plan. Completed:

- **M0** — scaffold (Vite-React-Cloudflare template + Tailwind + Zod + DO/KV bindings + smoke endpoints)
- **M1** — pure game engine + AI in `src/worker/game/`, 33 tests, 99% line coverage
- **M2** — username claim + KV adapter + welcome modal + identity hook, 16 more tests
- **M3** — single-player vs AI: responsive SVG board, `useSinglePlayerGame` hook, `POST /api/user/score`, `ScoreToast` for 5-in-a-row clear events. 59 tests total.
- **M4** — multiplayer rooms with always-present bot. `Cell` decoupled from stone color; `GameRoom` DO + WS Hibernation; public/private room visibility + KV lobby index; `/api/room` create/list/meta/ws routes; multi-color `Board` + `PlayerStrip` chips; `useMultiPlayerGame` WS hook. 64 tests.
- **M5** — round end + polish. 3-min per-turn timeout (only when ≥2 humans) + 5-min-idle room GC sharing one alarm slot via `rescheduleAlarm`; random Tang poem on each scoring clear, typewritten in the page header via `PoemHeader` (JS-driven for CJK); 10s lobby auto-refresh; mobile-friendly top bars + touch targets. Later reworked: dropped the first-to-5 auto-end / `EndScreen` in favour of open-ended per-room scoring.
- **M6.x** — single-page rewrite of the frontend. Dropped the 4-view router (`HomePage` / `SinglePlayerPage` / `LobbyPage` / `MultiPlayerPage`) and the standalone single-player engine (`useSinglePlayerGame`, `lib/singlePlayer*`, `ScoreToast`, horizontal `PlayerStrip`) in favour of one `GamePage` with a board + right sidebar (`RoomWidget` for current-room controls, vertical `PlayerList`, `LobbyWidget` for public rooms). `App.tsx` auto-creates a private room so the user lands on a playable board with no intermediate menu.
- **M7** — room-scoped ephemeral identity. Removed the entire global user layer: `/api/user/*` routes (claim/rename/score), the `kv/users.ts` adapter + `kv/types.ts`, `useIdentity`, `UserBadge`, and the global token. Identity is now established in-band over WS via a `join` (name + client-generated seat token), unique per-room only, stored in `localStorage` per room; the same name is reusable across rooms and nothing persists to KV but the lobby index. You land as a spectator and name yourself only when taking a seat. Also fixed `advanceTurn` to wrap to the front when the current turn-holder leaves the order. 42 tests.

Production runs on Cloudflare Workers Builds — push to `rewrite/serverless` auto-deploys; PRs against it get isolated preview deployments. See `apps/gomoku-cf/README.md` for the operational guide.
