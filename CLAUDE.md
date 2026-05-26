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

The branch `rewrite/serverless` is a planned rewrite to React + Vite + TypeScript on the frontend and Cloudflare Workers + KV on the backend (no Spring, no JVM at runtime). The Java code in `Gomoku/` is the reference implementation for game rules during that rewrite. When working on `rewrite/serverless`, treat `Gomoku/` as read-only spec; the new code will live elsewhere in the tree.
