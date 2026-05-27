# 五子棋项目重构计划：迁移至 Cloudflare Workers

> 分支：`rewrite/serverless`
> 目标：把 Spring Boot 单体改写为 Cloudflare 全栈无服务器架构，**全部在 Workers 免费计划额度内运行**。

---

## 1. 目标与范围

### 目标
- 用 **React + Vite + TypeScript** 重写前端，构建静态资源由 Worker 自带的 Static Assets 提供。
- 用 **Cloudflare Workers + Hono** 重写后端 REST API。
- 用 **Durable Objects (SQLite-backed) + WebSocket Hibernation** 承载实时多人对战房间。
- 用 **Workers KV** 存冷数据：用户档案、积分排行榜、古诗库。
- 一条 `wrangler deploy` 命令完成全量发布；本地一条 `npm run dev` 启动全栈热重载。

### 保留的产品功能
1. **人机对战**：Random AI 和 Smart AI 两种策略可切换。
2. **多人对战**：创建房间 → 分享房间号/链接 → 朋友加入对战（房间模式）。
3. **用户注册 + 积分排行榜**：注册即用、KV 存档。
4. **胜利时显示古诗**：保留作为彩蛋。

### 非目标（明确不做）
- 不做 OAuth / 社交登录；用户名注册 + 简单的 token 即可。
- 不做匹配队列、好友、聊天、观战、回放（可标注为后续扩展点）。
- 不保留 Java/Spring/JPA/Liquibase 任何代码，原 `Gomoku/` 目录在重构完成后会保留作为参考实现，不再维护。
- 不写 Dockerfile / GitHub Actions 复杂流水线 —— `wrangler deploy` + 一个简单的 push-to-deploy workflow 即可。

### 关键玩法保留（原项目特色）
- **五连珠不结束本局，而是触发"清连珠 + 扰乱对手"事件**：
  - 把己方所有当前的连珠（≥ 5 子）从棋盘移除；
  - 然后随机从每个对手身上移除"己方刚清掉的子数"那么多颗棋子；
  - 积分 = 己方清掉的子数 − 4（即单条 5 连珠 = 1 分，跨线/复式连珠收益指数级放大）；
  - 棋局持续进行，玩家继续轮流落子，直到主动结束或离开房间。
- 这套机制是这款五子棋的**核心差异化玩法**（鼓励"做形"而非"快胜"），不改回标准规则。

---

## 2. 技术栈最终选型

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | React 18 + TypeScript | 生态最大，AI 友好 |
| 构建 | Vite + `@cloudflare/vite-plugin` | 官方推荐；同时构建前端 + Worker，`dev` 全栈热重载 |
| 状态管理 | React 内建 + Zustand | 棋盘和房间状态简单，不需要 Redux |
| 样式 | Tailwind CSS | 棋盘和按钮组件用 utility class 最快 |
| 后端运行时 | Cloudflare Workers | 免费 10 万请求/天 |
| 后端路由 | Hono | 事实标准；轻量 + 完整 TS 类型 |
| 实时通信 | Durable Objects + WebSocket Hibernation API | DO 已加入免费计划（2025-04）；Hibernation 期间不计费 |
| 冷数据存储 | Workers KV | 1 GB / 100 K 读 / 1 K 写 每天 — 满足排行榜场景 |
| 校验 | Zod | API 请求/响应 schema 单一来源 |
| 测试 | Vitest + `@cloudflare/vitest-pool-workers` | 在真实 Worker 运行时跑单元测试，含 DO 模拟 |
| 部署 | `wrangler deploy`（CI 中触发） | 单命令；Wrangler 4+ |

### 关键约束（写代码时必须记住）

- **KV：每个 key 每秒只能写 1 次**，最终一致性 ~60 秒。
  → **排行榜不能写"全局排行榜"单一 key**，必须每个用户一个 key (`user:<name>`)，读时用 `list({ prefix: "user:" })` 聚合。
  → 写榜频次本来就低（仅在胜局后写），不会触发限速。
- **DO：单线程**。一个房间内的所有消息按到达顺序串行处理，**天然解决原项目的并发竞态**。
- **DO Hibernation：必须用 `ctx.acceptWebSocket(ws)`**，不能用 `ws.accept()`。后者会把 DO 钉在内存里，浪费 GB-s 配额。
- **静态资源路由**：Worker 配置 `not_found_handling = "single-page-application"`，SPA 路由由前端处理，404 时回退到 `index.html`。

---

## 3. 目录结构（重构后）

```
wuziqi/
├── Gomoku/                       # 原 Spring Boot 代码，保留为只读参考
├── apps/
│   └── gomoku-cf/                # 新工程根
│       ├── src/
│       │   ├── client/           # React 前端
│       │   │   ├── main.tsx
│       │   │   ├── App.tsx
│       │   │   ├── pages/        # Home, Room, Leaderboard
│       │   │   ├── components/   # Board, Cell, ScoreList, RoomCode
│       │   │   ├── hooks/        # useWebSocket, useGameState
│       │   │   └── lib/api.ts    # 前端 API 客户端
│       │   ├── worker/           # Cloudflare Worker
│       │   │   ├── index.ts      # Hono 入口，路由总线
│       │   │   ├── routes/
│       │   │   │   ├── auth.ts
│       │   │   │   ├── room.ts   # 创建房间、生成房间号
│       │   │   │   └── leaderboard.ts
│       │   │   ├── do/
│       │   │   │   └── GameRoom.ts  # Durable Object 类
│       │   │   ├── game/
│       │   │   │   ├── board.ts     # 棋盘 + 胜负判定（纯函数）
│       │   │   │   ├── ai.ts        # Random + Smart AI
│       │   │   │   └── rules.ts     # 规则常量
│       │   │   ├── kv/
│       │   │   │   ├── users.ts     # 用户 CRUD
│       │   │   │   ├── leaderboard.ts
│       │   │   │   └── poems.ts
│       │   │   └── types.ts      # 共享类型（与 client 共享 import）
│       │   └── shared/           # client + worker 都用的类型/协议
│       │       ├── protocol.ts   # WS 消息类型（Zod schemas）
│       │       └── api-types.ts
│       ├── public/
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── wrangler.jsonc        # Worker 配置（KV / DO bindings）
│       └── tailwind.config.js
├── CLAUDE.md
├── REFACTOR_PLAN.md              # 本文档
└── README.md
```

> 用 `apps/gomoku-cf/` 是为了将来万一加 admin 后台或共享 npm 包，结构可扩展。如果坚持极简，可以把 `apps/gomoku-cf/` 拍平到根目录。

---

## 4. 数据模型

### 4.1 KV 键设计

| Key 模式 | Value | 写入时机 |
|---|---|---|
| `user:<username>` | `{ username, token, score, gamesPlayed, createdAt }` | 首次认领用户名、胜局结束 |
| `poem:<id>` | `{ id, text, author }` | 一次性导入种子数据 |
| `poems:index` | `[id1, id2, ...]`（数组） | 随种子一起写 |

**没有密码、没有 session 表**。每个用户名首次认领时生成一个 token（64 字节 hex），存到该用户的 KV 记录里 + 浏览器 localStorage。后续所有请求带上 `{username, token}`，Worker 读 `user:<username>` 比对 token 一致即放行。简单、零门槛，但能防止他人冒用已注册的用户名刷分。

排行榜不单独建 key —— 直接 `KV.list({ prefix: "user:" })` + 内存排序。免费额度下 1 GB 存储足够十万级用户，list 操作 1000 次/天也够个人项目用。

### 4.2 Durable Object 状态（`GameRoom`）

每个房间一个 DO 实例，ID 由房间号（6 位字母数字）派生：`env.GAME_ROOM.idFromName(roomCode)`。

`GameRoom` 实例字段（in-memory，DO 单线程）：
```ts
{
  roomCode: string;
  board: (Stone | null)[][];        // 15x15
  players: { ws: WebSocket, username: string, stone: 'black' | 'white' }[];
  currentTurn: 'black' | 'white';
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  createdAt: number;
}
```

游戏中状态只在 DO 内存里 —— **不持久化到 SQLite**。理由：游戏结束就清空，没必要保留；崩了重连重新开始即可（五子棋一局短）。
胜局结束后才把"对局结果"写入 KV（更新双方积分），不写对局过程。

### 4.3 协议（WebSocket 消息）

定义在 `src/shared/protocol.ts`，**Zod schema 单一来源** —— 客户端和 DO 都从这里 import：

```ts
// 客户端 → DO
type ClientMessage =
  | { type: 'join'; username: string; token: string }
  | { type: 'place'; row: number; col: number }
  | { type: 'resign' };

// DO → 客户端
type ServerMessage =
  | { type: 'state'; board: Cell[][]; turn: Stone; players: PublicPlayer[]; status: GameStatus }
  | { type: 'move'; row: number; col: number; by: Stone }
  | { type: 'win'; winner: string; poem: string }
  | { type: 'error'; code: string; message: string };
```

### 4.4 REST API

```
POST /api/user/claim       { username }                 → { username, token }
                           # 用户名不存在 → 创建并返回新 token
                           # 用户名已存在但请求未带 token → 409 Conflict（被占用）
                           # 用户名已存在且 token 匹配 → 返回相同 token（幂等）

POST /api/user/rename      { username, token, newName } → { username, token }
                           # 改名（带原 token），把记录从 user:<old> 迁到 user:<new>，token 不变

POST /api/room             { username, token }          → { roomCode }
GET  /api/room/:code       → { exists, status, playerCount }
GET  /api/leaderboard      → { entries: [{username, score, games}] }
GET  /api/poem/random      → { text, author }

WS   /api/room/:code/ws    ← WebSocket upgrade，转发到 DO
                              首条 join 消息内携带 username + token
```

**前端首次访问流程（最小门槛）：**

```
打开页面
  │
  ▼
检查 localStorage 有没有 { username, token }
  │                                          
  ├─ 有  → 直接进主页，无任何弹窗
  │
  └─ 无  → 弹一个简单选择层（不是表单！）：
          ┌──────────────────────────────┐
          │  欢迎来玩五子棋              │
          │                              │
          │  [🎲 随机昵称开始]  ← 推荐    │
          │  [✏️ 自定义昵称]              │
          └──────────────────────────────┘

「随机昵称」点击 → 前端生成 `玩家_<6位随机>` → 调 claim
   → 极小概率冲突时自动重试一次 → 写 localStorage → 进主页
   → 进主页后右上角显示"玩家_837421（改名）"，
     点"改名"可弹输入框走 /api/user/rename

「自定义昵称」点击 → 弹输入框（带格式提示）→ 调 claim
   → 被占用 → 内联红字"该名字已被占，试试别的或用随机昵称"
```

整个流程**只需一次点击即可开玩**，无表单、无验证码、无密码、无邮箱。

---

## 5. AI 移植（Java → TypeScript）

原项目的 `RandomMoveStrategy` 和 `SmartMoveStrategy` 移到 `src/worker/game/ai.ts`，改为纯函数：

```ts
export function randomMove(board: Cell[][]): [number, number] | null { ... }
export function smartMove(board: Cell[][], self: Stone, opponent: Stone): [number, number] { ... }
```

AI 仅在"对人机"模式中由 DO 在玩家落子后立即调用 —— 不需要单独路由，AI 就是 DO 的内部分支。

注意原 `SmartMoveStrategy` 的实现非常基础（只看 4 个方向各 1 步），可以借此机会改进为经典启发式：评估每个空位的"攻 + 守"得分（活四=10000、冲四=1000、活三=100、眠三=10），但**不要过度工程化** —— 简单版即可，AI 不是这个项目的核心卖点。

---

## 6. 安全与认证（刻意保持简单）

**设计原则：让"打开网页"和"开始下棋"之间最多只有一次点击。**

参考即时娱乐游戏（gartic.io、skribbl.io、agar.io 等）的入场体验 —— 注册不是产品的一部分。具体取舍：

- **默认路径是"一键随机昵称"**：用户不需要想名字也能玩，但仍有身份和积分（系统帮他想了）。
- 想用自己想好的名字也行（一次输入），但**绝不强制**。
- **无密码、无邮箱、无验证码、无短信、无 OAuth**。

- **认领即拥有**：首次 `POST /api/user/claim { username }` 时生成 64 字节 hex token，写入 KV `user:<username>` 并返回客户端，由 localStorage 保存。
- **后续请求**：所有需要"以本人身份"操作的接口（开房、写分、加入房间）携带 `{ username, token }`，Worker 读 KV 比对。
- **WebSocket 鉴权**：DO 接收到首条 `join` 消息时校验 token，不通过则 `ws.close(4001, 'unauthorized')`。
- **token 丢失**：用户清缓存就丢身份 —— 这是 trade-off，换来的是免密码注册的丝滑体验。用户重新认领即可（若名字被占就换名）。
- **输入校验**：每个 REST handler 用 Zod 校验 body，每条 WS 消息也用 Zod parse；DO 内对 `row`/`col` 做范围 + 占位检查。
- **用户名规则**：3-16 字符，ASCII 字母 / 数字 / 下划线。CJK 曾考虑过但放弃 —— 非 ASCII 在 URL 路径、KV key、shell 脚本之间往返容易踩坑，收益不足以抵消。
- **房间号**：6 位 base32（去掉易混淆字符 0/O/1/I/L），命名空间足够（~10⁹），无需碰撞检测。
- **不做主动防滥用**：上线初期不加速率限制 / 验证码。真出现批量占名再用 Cloudflare 的 [Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) 在 zone 级别加一条规则即可，无需改代码。

---

## 7. 实施阶段（Milestones）

每个 milestone 是**独立可提交的 commit 序列**，做完该阶段功能可运行。

### M0：脚手架（半天）
- [ ] 在 `apps/gomoku-cf/` 用 `npm create cloudflare@latest -- gomoku-cf --framework=react` 创建模板（React + Vite + Workers）
- [ ] 加 Tailwind、Hono、Zod 依赖
- [ ] 配置 `wrangler.jsonc` 的 KV 和 DO bindings（占位）
- [ ] 在 `src/shared/protocol.ts` 写好所有 Zod schema
- [ ] `npm run dev` 能跑通，浏览器看到默认页面

**验收**：`curl localhost:5173/api/ping` 返回 `{ok:true}`

### M1：纯游戏引擎（半天）
- [ ] `src/worker/game/board.ts`：所有 API **纯函数 + 不可变**（接受 board，返回新 board）：
  - `createBoard()` → 15×15 `(Stone | null)[][]`
  - `placeStone(board, row, col, stone)` → `{ ok: true, board } | { ok: false, reason }`
  - `hasFiveInARow(board, stone)` → boolean（含 ≥5 子连续判定）
  - `clearWinningLines(board, stone, rng)` → `{ board, clearedSelf, removedFromOpponents }`
    - 收集己方所有 ≥5 连珠的格子（去重）一次性清掉
    - 然后从每个对手随机抽 `clearedSelf` 颗棋子也清掉
    - rng 注入便于测试用确定性 mock
  - `scoreForClear(clearedSelf)` → `Math.max(0, clearedSelf - 4)`（单 5 连 = 1 分；6 连 = 2；双线交叉 = 更多）
  - `isBoardEmpty(board)` → boolean（用于"开局让 AI 走中心"等场景）
- [ ] `src/worker/game/ai.ts`：
  - `randomMove(board)` → `[row, col] | null`
  - `smartMove(board, self, opponent)` → `[row, col]` —— 启发式评分（活四/冲四/活三/眠三/活二），不要 Monte Carlo
- [ ] Vitest 单元测试，覆盖：
  - 水平/垂直/两条对角线 ≥5 连珠都能检出
  - 一条 5 连珠：clearedSelf=5、score=1、对手随机被抽 5 颗（用 mock rng 断言确定性）
  - 6 连珠（一条延长）：clearedSelf=6、score=2
  - 双线交叉（同一颗子属于水平 + 垂直两条 5 连）：clearedSelf 去重正确
  - 对手棋子不足 N 颗时，全部清掉，不报错
  - 越界、占位返回错误
  - `placeStone` 是纯函数：原 board 不被修改
  - AI 在空棋盘倾向中心区域
  - smartMove 优先阻挡对方活四
  - smartMove 若有自己的活四会直接成连而不是去挡

**验收**：`npm test` 全绿，`board.ts` 和 `ai.ts` 行覆盖率 ≥ 90%

### M2：用户名认领 + KV（半天）
- [ ] `src/worker/kv/users.ts`：`claim(username, providedToken?)`、`rename(...)`、`getUser(username)`、`updateScore(...)`
- [ ] `src/worker/routes/user.ts`：`POST /api/user/claim`、`POST /api/user/rename`
- [ ] 前端 `lib/randomName.ts`：生成 `玩家_<6位随机>`
- [ ] 前端 `components/WelcomeModal.tsx`：两个大按钮 [🎲 随机昵称开始] [✏️ 自定义昵称]，**不是表单**
- [ ] 前端 `useIdentity` hook：读 localStorage，无身份则展示 WelcomeModal；有则直接进主页
- [ ] 主页右上角显示用户名 + 一个"改名"按钮（弹简单输入框走 rename API）
- [ ] 错误处理：自定义名被占用 → 内联红字提示并建议用随机；随机名极小概率冲突 → 自动换一个重试

**验收**：
1. 清缓存 → 打开页面 → 点"随机昵称" → **0.5 秒内** 进入主页能开玩
2. 清缓存 → 打开页面 → 点"自定义昵称" → 输 1 个字符即可（最低 3 字符上限 16）→ 进主页
3. 刷新页面 → 跳过欢迎层直接进主页
4. 主页 → 改名 → 名字立即更新且 token 保持（积分不丢）

### M3：单机人机对战（1 天）
- [ ] 前端 `Board` 组件：15×15 棋盘、点击落子（已落子位变灰，禁止重落）
- [ ] 本地 React state 持有 board / turn / 双方累积积分；后端不持久化单机局
- [ ] AI 跑在 Worker 上 —— POST `/api/single/move { board, self, opponent, difficulty }` 返回 AI 应手坐标。保证棋力一致、便于后续接入更复杂 AI
- [ ] 五连珠触发"清连珠"动画 + 古诗弹层 + 双方积分变化提示
- [ ] "结束本局"按钮：把本局最终自方积分调 `/api/score { delta }` 累加到 KV 排行榜
- [ ] AI 难度切换（random / smart）

**验收**：能玩一局连续模式（出现 ≥ 1 次清连珠事件且对方棋子被随机抽掉），结束本局后排行榜出现自己

### M4：Durable Object 房间 + WebSocket（1.5 天）
- [ ] `src/worker/do/GameRoom.ts`：继承 `DurableObject`，实现 `fetch`（处理 WS upgrade）、`webSocketMessage`、`webSocketClose`
- [ ] 用 **Hibernation API**：`ctx.acceptWebSocket(ws)`
- [ ] `webSocketMessage` 内部 dispatch：`join` / `place` / `resign` / `endRound`，Zod 校验
- [ ] **连续模式**：连珠后清线 + 扰乱对手，棋局不结束；任一玩家发 `resign` 或 `endRound` 才结算并写榜
- [ ] `/api/room` 创建房间（生成 6 位房间号，返回）
- [ ] WS 客户端 hook `useWebSocket(roomCode)` 负责连接、重连、消息分发
- [ ] 前端房间页面：分享链接、等待第二位玩家、对战 UI 与单机共用 `Board`；清连珠动画 + 古诗弹层

**验收**：两个浏览器窗口能同时进入同一房间，连珠时**双方都能看到棋子被清/扰乱**、积分实时同步；任一方点结束 → 最终分写榜

### M5：排行榜 + 古诗 + 抛光（半天）
- [ ] `/api/leaderboard` 实现 `KV.list({ prefix: "user:" })` 聚合 + 排序 + 截取 top 50
- [ ] 古诗库种子脚本（一次性导入到 KV）
- [ ] 移动端响应式（Tailwind breakpoint）
- [ ] 棋盘音效（落子声、胜利声，可选）
- [ ] README 更新部署步骤

**验收**：移动设备能玩；排行榜显示正确；古诗在胜利动画后显示

### M6：部署 + CI（半天）
- [ ] `wrangler deploy` 上线到 `*.workers.dev`
- [ ] 配 KV namespace、DO migration（`new_sqlite_classes`）
- [ ] GitHub Actions：push 到 `main` 时 `wrangler deploy`，secret 用 `CLOUDFLARE_API_TOKEN`
- [ ] 在 README 写明本地开发、部署、查日志（`wrangler tail`）步骤

**验收**：生产 URL 能完整玩；`wrangler tail` 看到请求日志

**总估时：约 4-5 天纯开发**

---

## 8. wrangler.jsonc 关键配置（参考）

```jsonc
{
  "name": "gomoku-cf",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-04-23",
  "compatibility_flags": ["nodejs_compat"],

  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },

  "kv_namespaces": [
    { "binding": "KV", "id": "<填 wrangler kv:namespace create 返回的 id>" }
  ],

  "durable_objects": {
    "bindings": [
      { "name": "GAME_ROOM", "class_name": "GameRoom" }
    ]
  },

  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["GameRoom"] }
  ]
}
```

`new_sqlite_classes`（而不是 `new_classes`）—— 这是 SQLite-backed DO，免费计划要的就是它。

---

## 9. 测试策略

- **纯函数**（board、ai、密码哈希）：Vitest 单元测试，目标覆盖率 80%+。
- **REST API**：`@cloudflare/vitest-pool-workers` 在真 Worker runtime 跑，模拟 KV。
- **DO**：`vitest-pool-workers` 提供 DO 测试支持，模拟 WebSocket 连接，断言消息序列。
- **E2E**：暂不上 Playwright；M4 用两个浏览器窗口手动测一局即可（M5 之后可补）。
- **不测的东西**：UI 视觉、CSS 像素对齐、Tailwind class —— 浪费时间。

---

## 10. 风险与回退

| 风险 | 影响 | 应对 |
|---|---|---|
| Hibernation API 在 wrangler dev 行为与生产不一致 | 本地测不出 idle 时的状态恢复 | M4 完成后必须在真实 `*.workers.dev` 跑一次；不能只本地测过就交付 |
| KV 最终一致：刚认领用户名后立刻被其他客户端读到为"占用"可能有延迟 | 极少数情况下两个人同时认领同一名字 | claim 是幂等的：先 read，无则 write；写之后立即返回 token，写入后短时间内若另一人也认领，KV 读到旧空值会"成功"占用 —— 由于只有一个 token 是后写入的，先写入的 token 在下次读时被覆盖。可接受。如担心可在更新积分前重新 read 验证 token |
| 免费 100 K req/天用完 | 服务变 429 | 监控；如果真用完，加自适应限流或 D1 缓存热路径 |
| Smart AI 计算超 10 ms CPU 限制 | 单机模式中 AI 应手报错 | 限制搜索深度；落子时机不在 WS 关键路径，可在 setTimeout 让客户端先看到自己落子 |
| 玩家断线 → 房间永远卡在 playing | 占用 DO 实例 | DO 定期（`setAlarm`）检查超时，自动清房 |

---

## 11. 后续扩展点（不在本次重构内）

- 观战模式：房间增加 `spectators: WebSocket[]`，只接收 state 不能落子
- 对局回放：DO 在结束时把 move 序列写入 KV `game:<id>`，前端读取重播
- 匹配队列：单独一个 DO `MatchmakingQueue` 维护等待玩家列表
- 好友系统、聊天 in-room
- AI 升级到 Monte Carlo 或调用 Workers AI

---

## 12. 决策记录（ADR 节选）

| # | 决策 | 替代方案 | 选择理由 |
|---|---|---|---|
| 1 | DO 而非纯 KV 做实时 | KV 轮询 | KV 1K writes/day 远不够；DO 已加入免费计划 |
| 2 | Hono 而非裸 Workers `fetch` | 裸 fetch + 手写 router | Hono 中间件、类型推导、生态成熟，~3 KB 包体可接受 |
| 3 | Workers Static Assets 而非 Cloudflare Pages | Pages | 官方在 Wrangler 4 已弃用 Pages 给 SPA 使用；Static Assets 是当下正路 |
| 4 | SQLite-backed DO 而非 KV-backed | KV-backed DO | SQLite DO 在免费计划，KV-backed 即将停用 |
| 5 | 默认一键随机昵称，自定义昵称仅作为可选入口 | 强制用户输入名字 / 用户名+密码 / OAuth | 即时小游戏的核心是"打开就玩"。强制输入名字本身就是门槛 —— 让系统帮用户起名，需要时再改 |
| 6 | 房间号 6 位 base32 而非 UUID | UUID | 用户体验 —— 短码方便分享给朋友 |
| 7 | 保留"清连珠 + 扰乱对手"非标准规则（核心特色） | 改回标准五子棋 | 原项目的独特卖点：连珠不是终点而是计分事件，棋盘永远不下满，鼓励"做形"。score = `clearedCount − 4` 来自原版本，能放大复式连珠（fork）的收益，保留 |

---

## 开始之前的确认清单

- [x] 分支 `rewrite/serverless` 已创建
- [x] `CLAUDE.md` 已写好（描述原项目，含本次重构上下文）
- [x] 架构 + KV/DO/前端选型已确认
- [x] 多人房间模式已确认（创建 + 房间号加入）
- [ ] 准备 Cloudflare 账户、`wrangler login`（M6 阶段需要）
- [ ] 可选：申请自定义域名（不申请也能用 `*.workers.dev`）

下一步：开 M0 — 跑 `npm create cloudflare@latest -- gomoku-cf --framework=react` 起骨架。
