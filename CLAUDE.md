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
| `User.java` + `UserPool.java` | Data shape for users (`username` + `score`). Persistence in the original was a no-op; in the rewrite we use KV. |
| `Poem/Poem.java` + `Poem/PoemService.java` | Original inlined poem strings used as the win-screen flourish. The TS rewrite ships a curated 8-poem list inline at `src/worker/poems.ts` rather than seeding KV — the list is small, immutable, and KV would just add an extra read per round end. |

`Gomoku/legacy-frontend/` holds a snapshot of the old static frontend (`index.html`, `script.js`, `style.css`) plus a short `README.md` indexing what's worth lifting — the typewriter poem reveal in `style.css:102-126` triggered by `script.js:45-62` is the main one. **Do not run or import it**; it's read-only animation reference.

Everything else from the original tree (`build.gradle`, `gradlew`, Spring `*Application` / `*Controller` / `*Config` classes, `Main.java`, `GameMove.java`, the rest of `resources/` — `schema.sql`, `data.sql`, Liquibase changelog, Thymeleaf templates — the `src/test/` directory, the dead Docker+Render GitHub workflow, and Windows `.lnk` shortcuts) has been deleted from this branch. The `master`/`main` branch still has them if you need to dig.

## Non-standard Gomoku rules (the product's differentiator)

A 5-in-a-row is **not the end of the game**; it's a scoring + disrupt event:

- All of the winning player's stones that belong to any 5-in-a-row (overlapping/extended runs are de-duplicated) are removed from the board.
- Then, for each opposing color present on the board, `clearedSelf` of their stones are removed at random.
- Score awarded = `max(0, clearedSelf - 4)`. A single 5-run scores 1; a 6-run (one stone of overlap with the next position) scores 2; a fork that unions 9 unique stones scores 5.
- A round ends when one player accumulates **5 in-room points** (`ROUND_WIN_POINTS` in `GameRoom.ts`). The DO broadcasts `ServerEnd { finalScores, poem }` and any seated player can send `ClientRestart` to start a fresh round.

Keep this rule intact unless the user explicitly asks otherwise — it was previously flagged as a bug, but the user has confirmed it's the product's core differentiator.

## Multi-player rooms (the always-present bot)

Every `GameRoom` Durable Object seats one AI player (`username = "Bot"`, color `amber`) at init time and keeps it for the room's lifetime. A room with one human still has an opponent; a room with 2-4 humans always has a fourth actor breaking up any 1v1 standoff. Turn order = humans (in join order, only connected ones) → bot → loop.

- **Visibility**: public rooms appear in `GET /api/room` (KV index at `room_idx:public:<code>`). Private rooms have no index entry — joinable only by 6-char code.
- **Seats**: max 4 humans + 1 bot. Human colors `black / white / red / blue` assigned in join order; bot fixed `amber`.
- **5-in-a-row in N-player**: clear winner's lines; then for **each** other player (including bot), randomly remove `clearedSelf` of their stones.
- **Single alarm slot, three uses**: `bot_move` (+600ms when bot's turn), `turn_timeout` (+60s on a connected human's turn → auto-skip), `room_gc` (+5min when no humans connected → `destroy()`). Stored in `alarm_reason`; reconciled by `rescheduleAlarm()` after every state mutation.
- **Score persistence**: per-room scores live in the DO; on every clear with `pointsAwarded > 0` for a human, the DO fires `addScoreInternal` against KV via `ctx.waitUntil`. KV is the durable home for cross-room totals.

## `apps/gomoku-cf/` — the active project

Stack: **React 19 + Vite 6 + TypeScript + Tailwind v4** (client), **Hono 4 + Workers + Durable Objects (SQLite) + KV** (backend), **Zod** for schema validation, **`@cloudflare/vite-plugin`** for full-stack dev. **Vitest** for unit tests with an in-memory KV fake.

```
apps/gomoku-cf/
├── src/
│   ├── react-app/                       # Vite-bundled React frontend
│   │   ├── main.tsx, App.tsx, index.css # entry + Tailwind + typewriter @keyframes
│   │   ├── pages/                       # HomePage (inline in App), SinglePlayerPage,
│   │   │                                  LobbyPage, MultiPlayerPage (+EndScreen overlay)
│   │   ├── components/                  # Board, PlayerStrip, ScoreToast, UserBadge,
│   │   │                                  WelcomeModal
│   │   ├── hooks/                       # useIdentity, useSinglePlayerGame,
│   │   │                                  useMultiPlayerGame (WS + reconnect + EndEvent)
│   │   └── lib/                         # api.ts (REST client), randomName, singlePlayer
│   ├── worker/                          # Cloudflare Worker
│   │   ├── index.ts                     # Hono entry, exports GameRoom DO, mounts routes
│   │   ├── routes/                      # user.ts (claim/rename/score), room.ts
│   │   │                                  (create/list/meta/ws-upgrade)
│   │   ├── do/GameRoom.ts               # the per-room DO: seats, turn rotation, single
│   │   │                                  alarm slot, restartRound, endRound
│   │   ├── game/                        # board.ts, ai.ts — pure, marker-agnostic
│   │   │                                  (any string is a valid Cell value)
│   │   ├── kv/                          # users.ts (+ addScoreInternal), rooms.ts
│   │   │                                  (public lobby index), types.ts
│   │   └── poems.ts                     # inline Tang quatrains for round-end flourish
│   └── shared/protocol.ts               # Zod schemas + types for ALL cross-boundary
│                                          traffic (REST + WS)
├── wrangler.jsonc                       # bindings: KV (real id), GAME_ROOM DO, ASSETS
├── vite.config.ts                       # react() + tailwindcss() + cloudflare() plugins
├── vitest.config.ts
└── worker-configuration.d.ts            # generated by `wrangler types`, do not edit
```

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
- **`UsernameSchema`: 3-16 chars, `[a-zA-Z0-9_]` only.** CJK was considered and dropped — non-ASCII round-tripping through URLs, KV keys, and shell scripts caused bugs without enough product value. `"Bot"` is reserved (`ensureSeat` rejects it for humans).
- **`Cell = string | null`.** A non-empty marker (username or a legacy `"black"/"white"` tag in single-player). Game functions (`placeStone`, `hasFiveInARow`, `clearWinningLines`, `smartMove`) accept any string identifier — that's what lets the same engine drive 2-color single-player AND N-player rooms.
- **Durable Object: SQLite-backed, Hibernation API.** `GameRoom.fetch` accepts WS upgrades via `ctx.acceptWebSocket(server)` — never call `ws.accept()` (that disables hibernation and burns GB-s). Sockets carry `{ username }` via `serializeAttachment` so identity survives wake-up.
- **DO auth is in the DO** (not the Worker). The browser WebSocket API can't send headers, so the WS upgrade URL carries `?username=X&token=Y` which the DO validates against KV before accepting. URL is over TLS but visible in access logs — acceptable for a casual game.
- **Single alarm slot in `GameRoom`** drives three concerns: `bot_move`, `turn_timeout`, `room_gc`. Recompute via `rescheduleAlarm()` after every state mutation; never set the alarm directly. The handler in `alarm()` reads `alarm_reason` from storage and re-validates the precondition (a reconnect can race the GC).
- **KV binding ID in `wrangler.jsonc` is a real namespace id**, not a placeholder. Local dev (Miniflare) uses an in-memory store and ignores it; production reads/writes the real namespace.
- **`compatibility_date`**: pinned to `2025-11-25` because the bundled workerd doesn't support later dates. Bump only when upgrading wrangler/workerd.
- **`run_worker_first: ["/api/*"]` in `assets` config**: Worker handles `/api/*` first; all other paths fall through to the SPA bundle.
- **Re-export the DO class from `src/worker/index.ts`** (`export { GameRoom } from "./do/GameRoom";`) — wrangler binds DO classes by import from the main module.
- **Game functions are pure + immutable.** `placeStone` / `clearWinningLines` return new boards; never mutate the input. The RNG used by `clearWinningLines` is injected for testability.
- **Token = 128 hex chars** (64 random bytes from `crypto.getRandomValues`). Compared in constant time. Stored in KV `user:<username>.token` and in the browser's `localStorage`.

## Milestones progress

`REFACTOR_PLAN.md` has the full plan. Completed:

- **M0** — scaffold (Vite-React-Cloudflare template + Tailwind + Zod + DO/KV bindings + smoke endpoints)
- **M1** — pure game engine + AI in `src/worker/game/`, 33 tests, 99% line coverage
- **M2** — username claim + KV adapter + welcome modal + identity hook, 16 more tests
- **M3** — single-player vs AI: responsive SVG board, `useSinglePlayerGame` hook, `POST /api/user/score`, `ScoreToast` for 5-in-a-row clear events. 59 tests total.
- **M4** — multiplayer rooms with always-present bot. `Cell` decoupled from stone color; `GameRoom` DO + WS Hibernation; public/private room visibility + KV lobby index; `/api/room` create/list/meta/ws routes; multi-color `Board` + `PlayerStrip` chips; `useMultiPlayerGame` WS hook. 64 tests.
- **M5** — round end + polish. 60s per-turn timeout + 5-min-idle room GC sharing one alarm slot via `rescheduleAlarm`; first-to-5-points round end with random Tang poem via `EndScreen` overlay (JS-driven typewriter for CJK); 10s lobby auto-refresh; mobile-friendly top bars + touch targets. 68 tests.

Production runs on Cloudflare Workers Builds — push to `rewrite/serverless` auto-deploys; PRs against it get isolated preview deployments. See `apps/gomoku-cf/README.md` for the operational guide.
