# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The repository root contains a single Spring Boot application under `Gomoku/`. There is no monorepo or multi-project Gradle setup — the working directory for almost every command is `Gomoku/`.

```
wuziqi/
├── Gomoku/                    # Spring Boot app (Java 17, Gradle)
│   ├── build.gradle
│   ├── src/main/java/com/tang0488/
│   ├── src/main/resources/    # application.properties, static/, templates/, schema.sql, data.sql
│   └── src/test/java/com/tang0488/
└── .github/workflows/deploy.yml
```

## Common commands

All commands run from `Gomoku/`:

```bash
./gradlew build                              # compile + run tests + assemble jar
./gradlew bootRun                            # start web app on http://localhost:8080
./gradlew test                               # run all JUnit 5 tests
./gradlew test --tests BoardTest             # single test class
./gradlew test --tests BoardTest.testCheckWin # single test method
./gradlew clean build -x test                # build skipping tests
```

The H2 console (when the app is running) is exposed at `http://localhost:8080/h2-console` with `jdbc:h2:mem:testdb`, user `sa`, password `password` (see `application.properties`). The DB is in-memory and reset on every restart.

There is no lint/format tool configured — don't fabricate `./gradlew check` workflows beyond what Spring Boot's plugin provides by default.

## Two entry points (important)

The code has **two parallel ways to run the game**, and they share most domain classes:

1. **`GomokuApplication.java`** — the real Spring Boot web app (`@SpringBootApplication`). This is what `bootRun` starts. The browser plays against the Spring-managed `Game` singleton via REST + STOMP/WebSocket.
2. **`Main.java`** — a standalone `main()` that wires the same classes manually (`new UserPool()`, `new Game(...)`) and runs a console-based REPL via `Game.start()`, which reads from `System.in` with a `Scanner`. Not invoked by Spring; useful for local debugging only.

When changing domain classes (`Game`, `Board`, `UserPool`, strategies), check both paths still compile. `Game.start()`'s console loop is dead code in production but referenced by `Main`.

## Architecture: singleton game with hybrid REST + WebSocket

The runtime design is unusual and easy to misread:

- **`Game` is a Spring singleton `@Component`** with mutable fields (`board`, `currentPlayerIndex`, `moveHistory`). There is exactly **one game instance for the entire application** — no per-session or per-room state. Two browsers hitting `/game/move` mutate the same board.
- **`UserPool` is also a singleton** with a plain `ArrayList<User>` (not thread-safe). It seeds itself with a single user `"G"` in its constructor — this is the **hardcoded AI identifier** (`GameController.java:75` checks `equals("G")` to decide whether to invoke the AI strategy after a human move).
- **`User` is NOT a JPA entity** despite the `jakarta.persistence` import — there are no `@Entity`/`@Table` annotations, no repository, and no persistence. `schema.sql` / `data.sql` / `db/changelog/db.changelog-master.yaml` all reference a `users` table that is created by Spring but never read or written by application code. Treat the DB layer as effectively dead.
- **REST endpoints under `/game/*`** (in `GameController`) handle moves, registration, strategy selection. They return `Map<String, Object>` JSON blobs (no DTOs).
- **WebSocket / STOMP** is configured (`WebSocketConfig`) with broker prefix `/topic` and endpoint `/ws` (SockJS). `GameController` broadcasts the user list to `/topic/users` after registration, but moves themselves go through plain REST POSTs, not WebSocket — the front-end polls/posts and uses WS only for the user list.
- **Strategy pattern**: `MoveStrategy` interface, `RandomMoveStrategy` and `SmartMoveStrategy` (both `@Component`s). `SmartMoveStrategy` takes `RandomMoveStrategy` as a fallback for ties. `Game.moveStrategy` defaults to `SmartMoveStrategy` and is switched via `POST /game/strategy?strategy=random|smart`.

## Non-standard Gomoku rules (intentional, not bugs)

The game does not stop on a win — instead:

- `Board.clearWinningLine(player)` removes the 5 winning stones AND then calls `removeRandomOpponentPieces` to delete additional stones belonging to opponents at random. Play continues on the modified board.
- It returns `totalRemoved - 4` as the score increment (so a single 5-in-a-row scores 1). Anywhere "score" appears, this is the source.
- This is deliberate — keep the behavior unless the user asks otherwise.

## Frontend

`src/main/resources/static/` holds plain `index.html` + `script.js` + `style.css` — no build step, no framework. JS uses SockJS + STOMP client loaded from CDN. The "winning poem" animation in `style.css` uses CSS typewriter `steps(40, end)` regardless of poem length.

## Test suite caveats

- Several tests under `src/test/java/com/tang0488/` are partially commented out (`UserRepositoryTest`, `WebSocketIntegrationTest`).
- `GameControllerTest` posts to `/move` rather than `/game/move` — the path is wrong and the test does not actually exercise the controller. Fix the path if touching that test.
- `Game`'s constructor requires `PoemService`; any new test that builds `Game` directly must pass one (or a mock).

## Junk / dead files to ignore (or delete if asked)

These exist in the tree but are not part of the build:
- `Gomoku/src/main/java/com/tang0488/xxx.java`
- `Gomoku/src/main/java/com/tang0488/test.txt`
- `Gomoku - Shortcut.lnk`, `Gomoku/src - Shortcut.lnk` (Windows shortcuts)
- `Gomoku/src/main/resources/templates/data.sql` (duplicate of `resources/data.sql`, in the wrong directory)
- `db/changelog/db.changelog-master.yaml` (Liquibase changelog, but Liquibase is not on the classpath)

## CI / deploy

`.github/workflows/deploy.yml` references placeholder Docker Hub credentials (`yourusername/yourappname`) and a stub `curl` to Render — it has never been a working pipeline. Do not assume CI is green; treat the workflow file as a draft.

## Active refactor

The branch `rewrite/serverless` is the in-progress rewrite to Cloudflare Workers. **All new development happens in `apps/gomoku-cf/`**; the Java code in `Gomoku/` is now read-only reference for game rules and AI strategy.

See `REFACTOR_PLAN.md` (project root) for the full 6-milestone plan, KV/DO schema, and ADRs.

### New project: `apps/gomoku-cf/`

Stack: **React 19 + Vite 6 + TypeScript + Tailwind v4** (client), **Hono 4 + Workers + Durable Objects (SQLite) + KV** (backend), **Zod** for schema validation, **`@cloudflare/vite-plugin`** for full-stack dev.

```
apps/gomoku-cf/
├── src/
│   ├── react-app/      # Vite-bundled React frontend
│   │   ├── main.tsx, App.tsx, index.css   # entry + Tailwind import
│   │   ├── pages/, components/, hooks/, lib/   # populated per-milestone
│   ├── worker/         # Cloudflare Worker
│   │   ├── index.ts    # Hono entry, exports GameRoom DO
│   │   ├── routes/     # /api/* handlers (one file per resource)
│   │   ├── do/GameRoom.ts   # the per-room Durable Object
│   │   ├── game/       # pure functions: board, ai, rules
│   │   └── kv/         # user / leaderboard / poems KV adapters
│   └── shared/protocol.ts   # Zod schemas + types for ALL client↔server traffic
├── wrangler.jsonc      # bindings: KV (placeholder id), GAME_ROOM DO, ASSETS
├── vite.config.ts      # react() + tailwindcss() + cloudflare() plugins
└── worker-configuration.d.ts   # generated by `wrangler types`, do not edit
```

### Working in `apps/gomoku-cf/`

All commands run from `apps/gomoku-cf/`:

```bash
npm run dev      # Vite dev server on :5173, full-stack hot reload (client + worker)
npm run build    # tsc -b && vite build → dist/client + dist/gomoku_cf
npm run check    # build + `wrangler deploy --dry-run` — pre-flight before deploy
npm run deploy   # wrangler deploy (requires `wrangler login` + real KV id)
npm run lint     # ESLint
npm run cf-typegen   # regenerate worker-configuration.d.ts after wrangler.jsonc changes
```

### Critical conventions

- **`src/shared/protocol.ts` is the only source of truth for cross-boundary types.** Both worker and react-app import from it. Adding a new WS message or REST endpoint? Add a Zod schema here first.
- **Durable Object: SQLite-backed, Hibernation API.** `GameRoom.fetch` accepts WS upgrades via `ctx.acceptWebSocket(server)` — never call `ws.accept()` (that disables hibernation and burns GB-s).
- **KV binding ID `0000000000000000000000000000aaaa` in `wrangler.jsonc` is a placeholder.** Local dev (Miniflare) ignores it; real deploy needs a real ID from `wrangler kv namespace create`.
- **`compatibility_date`**: pinned to `2025-11-25` because the bundled workerd doesn't support later dates. Bump only when upgrading wrangler/workerd.
- **`run_worker_first: ["/api/*"]` in `assets` config**: Worker handles `/api/*` first; all other paths fall through to the SPA bundle.
- **Re-export the DO class from `src/worker/index.ts`** (`export { GameRoom } from "./do/GameRoom";`) — wrangler binds DO classes by import from the main module.
