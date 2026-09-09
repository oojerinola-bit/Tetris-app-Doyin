# Parlor — Multiplayer Tetris

Real-time head-to-head Tetris. Two players share a room code, see each other's
board live, and send garbage lines by clearing multiple rows at once.

Vite + React 19 on the front end, a Cloudflare Worker with a Durable Object
per room on the back end.

## Layout

| Path                | What it is                                            |
| ------------------- | ----------------------------------------------------- |
| `src/`              | React app (lobby, game screen, Tetris engine)          |
| `src/gameReducer.ts`| Pure game logic — gravity, locking, garbage, attacks   |
| `src/useRoom.ts`    | WebSocket client: reconnect, opponent state, attacks   |
| `src/protocol.ts`   | Wire types shared by browser and Worker                |
| `worker/index.ts`   | Worker entry — routes `/api/*`, serves the SPA         |
| `worker/room.ts`    | `Room` Durable Object — one per room code              |
| `public/_headers`   | Response security headers                              |

## Local development

```bash
pnpm install
pnpm run dev
```

`pnpm run dev` serves the front end alone (port 8443), so the lobby's
create/join flow has no server to talk to. To exercise multiplayer locally,
run the real Worker instead:

```bash
pnpm run build && pnpm run cf:dev
```

Then open `http://localhost:8787` in two browser windows — create a room in
one, join with that code in the other.

## Deploying

```bash
pnpm run deploy
```

That runs `vite build` and then `wrangler deploy`, which uploads `dist/` as
static assets and the Worker (with its Durable Object) together. First deploy
asks you to authenticate with `wrangler login`.

The `Room` class is registered as a **SQLite-backed** Durable Object
(`new_sqlite_classes` in `wrangler.jsonc`), which is available on the free
Workers plan.

### Protocol

- `GET /api/room/:code` — `{ exists, players, full }`, used by the lobby so
  joining a nonexistent or full room fails with a clear message.
- `GET /api/room/:code/ws` — WebSocket upgrade into that room.

Rooms hold at most two players; a third is refused with `room-full`. Board
snapshots travel as a 200-character digit string and are coalesced to at most
one send per 60 ms. The Durable Object uses hibernatable WebSockets, so idle
rooms cost nothing, and an empty room deletes its storage after 10 minutes.

### Room codes

Codes are `XXXX-XXXX` over an alphabet that omits `0`, `O`, `1` and `I` to
avoid transcription mistakes — so a code never contains any of those four
characters.
