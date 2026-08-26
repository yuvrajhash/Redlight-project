# friday-agent

The F.R.I.D.A.Y. voice agent (Sarvam STT → Gemini 2.5 Flash → OpenAI TTS), deployed to
**LiveKit Cloud Agents** which handles hosting, autoscaling, and regional placement.

This used to run as a child process inside the Electron app. It now lives here as a
standalone deployable so the desktop app ships **no** provider keys and **no** LiveKit
secret — the client only connects to a room with a token from `worker/`, and LiveKit
dispatches this agent into the room.

## Local testing (optional)

```bash
cd agent
pnpm install
cp .env.example .env.local   # fill in provider keys + LiveKit creds
pnpm build
pnpm dev                     # registers as a worker against your LiveKit project
```

While `dev` is running, connect the desktop app — LiveKit will dispatch this agent.

## Deploy to LiveKit Cloud

LiveKit Cloud builds a container from this folder (`Dockerfile`) and runs it.

```bash
# 1. Install the LiveKit CLI
#    macOS:  brew install livekit-cli
#    other:  https://docs.livekit.io/home/cli/cli-setup/

# 2. Authenticate against your LiveKit Cloud project
lk cloud auth

# 3. From this folder, create the agent. This scaffolds a livekit.toml (and can
#    generate/validate the Dockerfile). Accept its prompts.
cd agent
lk agent create

# 4. Add provider keys as deployment secrets (NOT the LiveKit creds — Cloud injects those)
#    Either via the dashboard (Agents → your agent → Secrets) or the CLI, e.g.:
lk agent update-secrets --secrets GOOGLE_API_KEY=...,OPENAI_API_KEY=...,SARVAM_API_KEY=...

# 5. Deploy / redeploy
lk agent deploy
```

Then watch it in the dashboard: https://cloud.livekit.io/projects/p_/agents

### Dispatch

By default LiveKit Cloud uses **automatic dispatch** — any participant that joins a room
in your project gets this agent, so the desktop app sends no agent info. If you switch to
explicit dispatch, give the agent a name and pass `{ "agentName": "<name>" }` to the
token worker's `/get-token` (the worker already supports this).

## Known TODOs

- **Panel open from the agent**: `open_nse_stock_visualizer` currently POSTs to
  `127.0.0.1:3210`, which only works when the agent is local. For cloud deployment it must
  publish a LiveKit **data message** to the client (see the inline TODO in `src/agent.ts`)
  and `dynamic-island.tsx` must listen for it. Until then the dashboard panel won't open
  from a cloud-deployed agent.
- **BYOK**: a bring-your-own-key user should run _their own_ agent with _their_ keys
  instead of this hosted one. Not wired yet.
