# friday-token-worker

A stateless Cloudflare Worker that mints short-lived LiveKit access tokens for the
Friday desktop app. It holds **only** the LiveKit infra credentials as secrets — no
provider keys (those live with the LiveKit Cloud agent), and nothing sensitive ships
in the desktop binary.

Route: `POST /get-token` → `{ participantToken, serverUrl }`

## Develop locally

```bash
cd worker
pnpm install
cp .dev.vars.example .dev.vars   # fill in your LiveKit creds
pnpm dev                         # http://localhost:8787
```

Test it:

```bash
curl -X POST http://localhost:8787/get-token -H 'content-type: application/json' -d '{}'
```

Point the desktop app at it by setting `VITE_LIVEKIT_TOKEN_ENDPOINT` in the repo-root
`.env.local` to `http://localhost:8787/get-token`.

## Deploy

```bash
cd worker
pnpm install

# one-time login
pnpm exec wrangler login

# set the LiveKit infra secrets (prompted to paste each)
pnpm exec wrangler secret put LIVEKIT_URL
pnpm exec wrangler secret put LIVEKIT_API_KEY
pnpm exec wrangler secret put LIVEKIT_API_SECRET

pnpm deploy
```

Wrangler prints a URL like `https://friday-token-worker.<your-subdomain>.workers.dev`.
Set the desktop app's `VITE_LIVEKIT_TOKEN_ENDPOINT` to `<that-url>/get-token`.

> Note: `LIVEKIT_URL` is not really a secret; you can instead put it under `[vars]` in
> `wrangler.toml`. Keeping all three together as secrets is simplest.

## Agent dispatch

LiveKit Cloud Agents use **automatic dispatch** by default — just join a room and the
deployed agent appears, so the app sends no agent info. To force explicit dispatch of a
named agent, POST `{ "agentName": "friday" }` (or a full `room_config.agents` array).
