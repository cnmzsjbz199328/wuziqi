# gomoku-cf

Gomoku on Cloudflare Workers. React + Vite SPA, Hono Worker, SQLite-backed
Durable Objects for real-time rooms, KV for user records and the
leaderboard. All within the Workers free plan.

```
Browser (React SPA)
       │
       ▼
Cloudflare Worker (Hono)
       │
       ├── /api/user/* ──► KV
       ├── /api/room/*/ws ► Durable Object (one per room, WS Hibernation)
       └── /*           ──► static assets (the SPA bundle)
```

## Local development

```bash
cd apps/gomoku-cf
npm install         # first time only
npm run dev         # http://localhost:5173, full-stack HMR
npm test            # vitest run-once
npm run check       # tsc -b && vite build && wrangler deploy --dry-run
```

The dev server uses Miniflare under the hood, so KV and Durable Objects
work in-memory. The placeholder KV id in `wrangler.jsonc` is ignored
locally; you do **not** need a Cloudflare account to develop.

## Production deployment (one-time setup)

Deployment runs on Cloudflare's Workers Builds — push to the connected
branch and Cloudflare builds + deploys automatically. No `wrangler deploy`
from your laptop, no API tokens in CI secrets, no `.env` files.

### 1. Cloudflare account

Sign in at <https://dash.cloudflare.com>. The free plan is enough for
this project (we've verified we stay inside its limits — see
`REFACTOR_PLAN.md` §2 for the math).

### 2. Create the KV namespace (dashboard, 30 seconds)

The Worker reads and writes user records to KV. The namespace must exist
*before* the first deploy, otherwise runtime calls will fail.

1. Dashboard → **Storage & Databases** → **KV**
2. **Create a namespace** → name it `gomoku-cf-kv` → **Add**
3. Copy the **Namespace ID** (32 hex chars).

### 3. Wire the real KV id into `wrangler.jsonc`

In `apps/gomoku-cf/wrangler.jsonc` replace the placeholder:

```jsonc
"kv_namespaces": [
  { "binding": "KV", "id": "0000000000000000000000000000aaaa" }   // ← placeholder
]
```

with the real id you just copied. Commit and push — the change has to
land on the branch Cloudflare is going to build, or the deploy will use
the placeholder and runtime KV calls will 404.

> **Why is the id in source?** KV namespace ids aren't secret. They're
> account-scoped public identifiers, like an S3 bucket name. They go in
> the config alongside the binding name.

### 4. Connect the GitHub repo to Workers Builds

1. Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. Authorize Cloudflare's GitHub App on the `cnmzsjbz199328/wuziqi` repo
   when prompted. Scope it to just this repo if your account has many.
3. Pick the repo, then configure the build:

   | Field | Value |
   |---|---|
   | **Project name** | `gomoku-cf` (becomes part of the URL) |
   | **Production branch** | `rewrite/serverless` (switch to `main` after the merge) |
   | **Root directory** | `apps/gomoku-cf` |
   | **Build command** | `npm run build` |
   | **Deploy command** | `npx wrangler deploy` |
   | **Build variables** | _(none)_ |
   | **Build system version** | v2 (default) |

4. **Save and Deploy.** First build takes ~2 minutes (npm install + tsc
   + vite + wrangler). You'll get a `gomoku-cf.<your-subdomain>.workers.dev`
   URL when it finishes.

### 5. Smoke-test the live URL

```bash
URL=https://gomoku-cf.<your-subdomain>.workers.dev

curl -fs $URL/api/ping
# → {"ok":true,"now":"..."}

curl -fs $URL/api/_bindings
# → {"kv":true,"gameRoom":true,"assets":true}

curl -fs -X POST -H 'Content-Type: application/json' \
  -d '{"username":"smoketest"}' \
  $URL/api/user/claim
# → {"username":"smoketest","token":"<128 hex chars>"}
```

Then open `$URL` in a browser — you should land on the welcome modal
with the two-button "🎲 Random / ✏️ Custom" choice.

## Subsequent deploys

Just push to the production branch:

```bash
git push origin rewrite/serverless
```

Cloudflare detects the push, runs the build, and rolls the new version
out. Builds and deploys show up at Dashboard → Workers & Pages →
`gomoku-cf` → **Deployments**.

PRs against the production branch get **preview deployments** at
`<commit-hash>.gomoku-cf.<your-subdomain>.workers.dev`, isolated from
the production KV (Cloudflare provisions a preview namespace
automatically).

## Troubleshooting

### Build fails on `wrangler deploy`

If `npm run check` works locally but the CF build fails, common causes:

- **KV id is still the placeholder.** Replace it in `wrangler.jsonc` and
  push.
- **`worker-configuration.d.ts` is stale** because someone added a new
  binding to `wrangler.jsonc` without running `npm run cf-typegen`.
  Re-generate it locally and commit.
- **`compatibility_date`** (`2025-11-25` as pinned) is older than what
  the build's workerd supports — that's only a warning, not an error.
  Safe to ignore; bump only if you actually need a newer feature.

### `/api/_bindings` shows `"kv": false`

You're hitting the deployed Worker but the KV binding isn't wired. Most
likely the placeholder id was never replaced, or the change to
`wrangler.jsonc` is on a different branch than the one Cloudflare is
building from.

### Durable Object errors on first deploy

The first deploy must include the `migrations` block that ships with
`wrangler.jsonc`:

```jsonc
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["GameRoom"] }
]
```

If you ever rename the DO class, **add a new migration** with a new
`tag` and a `renamed_classes` entry — don't edit the v1 entry. The
existing `tag: "v1"` line is permanent.

### Rolling back

Dashboard → Workers & Pages → `gomoku-cf` → **Deployments** → pick a
previous successful deployment → **Rollback**. Takes effect within a
few seconds globally.

### Watching live logs

```bash
npx wrangler tail   # from apps/gomoku-cf, requires `wrangler login` first
```

Or Dashboard → Workers & Pages → `gomoku-cf` → **Logs**.

## What's NOT yet wired in production

These are explicitly missing as of M2 — they ship in later milestones:

- **M3**: single-player vs AI, the board UI, score submission to the
  leaderboard.
- **M4**: real-time multiplayer (Durable Object game rooms with
  WebSocket Hibernation). The DO class exists as a stub that only echoes
  messages back.
- **M5**: leaderboard endpoint, poem seed data, mobile polish.

The deploy still works at M2 — it just shows the welcome modal and
ping/bindings smoke endpoints behind it.
