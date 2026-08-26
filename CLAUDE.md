# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

> ⚠️ **ARCHITECTURE CHANGED (2026-06-25) — read this first.** The **BYOK voice path has been
> fully migrated off LiveKit** onto `@openai/agents/realtime`. The whole agent now runs **inside
> the Electron app**: the realtime voice session is hosted in the renderer
> (`src/renderer/src/realtime/`), and tools call **main-process sub-agents** (`src/main/brains.ts`,
> `src/main/os.ts`) for vision (`look_at_screen`), web search (`search_web`, OpenAI hosted
> `web_search`), and computer-use (`control_computer` via nut.js). Main mints an OpenAI **ephemeral
> key** from the user's stored key; the renderer never sees the real key.
>
> As a result, the **`worker/` (Cloudflare token server), `agent/` (LiveKit Cloud agent), and all
> LiveKit/Sarvam/Google wiring described below are SUPERSEDED for the BYOK flow** (kept only as the
> old/subscription design reference). Where the sections below conflict with this note, this note
> and **`ROADMAP.md`** win. **See `ROADMAP.md`** for the as-built architecture, what's planned next,
> and launch-readiness gaps.

## What this is

**Friday** is a cross-platform **Electron desktop voice-agent app**. It has two phases:

1. **Onboarding** — a normal framed window where the user picks an intelligence stack
   (STT / LLM / TTS) and either brings their own API keys (BYOK) or chooses pay-as-you-go.
2. **Dynamic Island** — after onboarding, the app relaunches as a transparent, always-on-top,
   click-through **overlay** (a macOS-notch-style "Dynamic Island") that hosts a live LiveKit
   voice session with an embedded **F.R.I.D.A.Y.** agent. The island shows a WebGL aura
   visualizer, expands on hover (mic toggle), and can pop a bottom panel (a Groww stock card)
   driven by the agent or an external HTTP trigger.

The app is a **thin client**. It no longer runs the agent or signs tokens itself:

- **LiveKit tokens** come from a stateless **Cloudflare Worker** (`worker/`) that holds the
  LiveKit infra secret. The app ships no LiveKit secret.
- **The F.R.I.D.A.Y. agent** is deployed separately to **LiveKit Cloud Agents** (`agent/`), which
  hosts/scales it and dispatches it into each room. Provider keys (Google/OpenAI/Sarvam) live
  there, never in the app.

So the repo contains three deployables: the Electron app (`src/`), the token Worker (`worker/`),
and the agent (`agent/`).

- Package name: `friday` (v0.0.1). App id: `com.feynmanpi.friday`. Author: SAGAR TAMANG.
- Default git branch: `master`. Homepage: `friday.feynmanpi.com`.
- Status: **early-stage / WIP** — see "Current status" below.

> History: the island UI + agent were ported from `poc-dynamic-island-ai`; the token server from
> `voice-livekit-token-server`. The agent originally ran as a local child process + in-process
> token gen, then was moved to the Worker + LiveKit Cloud split described above.

## Tech stack

### Electron app (`src/`)

- **Electron 39** via **electron-vite 5** (separate `main` / `preload` / `renderer` builds).
- **React 19** + **TypeScript 5.9**, JSX runtime `react-jsx`.
- **Tailwind CSS v4** (`@tailwindcss/vite`) + **shadcn/ui** (style `radix-nova`, base `neutral`, lucide icons).
- **LiveKit**: `@livekit/components-react` + `livekit-client` (renderer only — the app is a media client, not an agent host).
- **electron-store 11** + Electron **safeStorage** (onboarding config + at-rest key encryption).
- **electron-log** (main-process logging), **electron-updater**.
- **@google/generative-ai** (validates Google keys during onboarding).
- Also present: `ai` (Vercel AI SDK), `streamdown` + `@streamdown/*`, `motion`.
- Package manager: **pnpm** (`shamefully-hoist=true`). Lockfile: `pnpm-lock.yaml`.

### Token worker (`worker/`)

- **Hono** + **livekit-server-sdk** on **Cloudflare Workers** (`nodejs_compat`). No state, no media.

### Voice agent (`agent/`)

- **`@livekit/agents`** + plugins `-google` / `-openai` / `-sarvam` / `-silero`, **`@google/genai`**, **`zod`**, **`dotenv`**.
- Deployed to **LiveKit Cloud Agents** (us-east). Pipeline: Sarvam STT → Gemini 2.5 Flash → OpenAI TTS.

## Commands

```bash
pnpm install          # install (+ electron-builder install-app-deps rebuilds native modules)
pnpm dev              # run app in dev (electron-vite dev, renderer HMR)
pnpm build            # typecheck (node + web) then electron-vite build
pnpm start            # preview a built app

pnpm typecheck        # typecheck:node (main+preload+worker) + typecheck:web (renderer)
pnpm lint             # eslint --cache .
pnpm format           # prettier --write .

pnpm build:win        # build + electron-builder --win (NSIS installer)
pnpm build:mac        # electron-vite build + electron-builder --mac (dmg)
pnpm build:linux      # build + electron-builder --linux (AppImage, snap, deb)

pnpm ui:add <name>           # add a shadcn/ui primitive
pnpm agents-ui:add <name>    # add LiveKit agents-ui components
pnpm ai-elements:add <name>  # add AI SDK elements

npx tsx trigger-panel.ts open   # manually open the island bottom panel (close = `close`)
```

There are **no tests** in this repo yet.

## Project layout

```
src/
  main/                     # Electron main process (Node)
    index.ts                # window factories, tray, IPC, trigger server
    logger.ts               # electron-log setup (logs to %TEMP%/electron-app-logs/main.log)
    store.ts                # electron-store schema + encrypted key helpers
    validate-key.ts         # validateGoogleApiKey() via @google/generative-ai
  preload/
    index.ts                # contextBridge → window.api (store.*, completeOnboarding)
    types.d.ts              # ProviderConfig / KnownService types + window typing
  renderer/
    index.html              # CSP (LiveKit + Google Fonts); <html class="dark">
    src/
      main.tsx              # React root; toggles body.overlay before paint when onboarded
      App.tsx               # router: Onboarding vs DynamicIslandApp (based on onboarding state)
      components/
        onboarding.tsx          # BYOK + pay-as-you-go onboarding flow
        card-spotlight.tsx      # CardBottomImage used in plan selection
        dynamic-island.tsx      # post-onboarding island: LiveKit session + hover/panel UI
        stock-graph-card.tsx    # Groww card shown in the island bottom panel
        agents-ui/              # LiveKit agent UI (aura visualizer, control bar, transcript, …)
        ui/                     # shadcn primitives (button, input, field, card, radio-group, …)
      hooks/use-store.ts    # thin wrapper around window.api.store
      lib/utils.ts          # cn() helper
      assets/               # main.css (theme + island animations), webp images, img/ (livekit.svg, groww_logo.webp)
resources/                  # runtime assets (icon.png) — asarUnpack'd
build/                      # build resources (icon.png, mac entitlements)
trigger-panel.ts            # standalone HTTP trigger test script (POSTs to :3210/toggle-panel)
worker/                     # Cloudflare Worker token server (Hono + livekit-server-sdk)
  src/index.ts              # POST /get-token → { participantToken, serverUrl }
  wrangler.toml             # workers_dev=false; custom domain api.friday.feynmanpi.com
  .dev.vars.example         # template for local secrets (copy to .dev.vars, gitignored)
agent/                      # LiveKit Cloud Agents deployable (the F.R.I.D.A.Y. agent)
  src/agent.ts              # Sarvam STT → Gemini 2.5 Flash → OpenAI TTS, NSE tools
  livekit.toml              # generated by `lk agent create` — agent name + region (us-east)
  Dockerfile                # used by LiveKit Cloud remote build
  .env.example              # template for local secrets (copy to .env.local, gitignored)
```

Path aliases: `@/*` and `@renderer/*` → `src/renderer/src/*` (in `electron.vite.config.ts` +
the tsconfigs).

## Architecture & key flows

### Two window models (the central design point)

Onboarding and the island need **incompatible BrowserWindow configs**, so the main process
uses two factories in `src/main/index.ts` and **recreates the window** on transition:

- `createOnboardingWindow()` — 900×670, framed, opaque, not resizable. Passes
  `--onboarding-complete=false`.
- `createIslandWindow()` — fullscreen (`screen.getPrimaryDisplay().bounds`), `transparent`,
  `frame:false`, `hasShadow:false`, `alwaysOnTop` (`'screen-saver'` level), `skipTaskbar`,
  `type:'toolbar'`, `setIgnoreMouseEvents(true,{forward:true})`, visible on all workspaces.
  Passes `--onboarding-complete=true`.

**Startup**: `isOnboardingComplete() ? createIslandWindow()+startServices() : createOnboardingWindow()`.

**Transition**: onboarding's `onComplete` → `window.api.completeOnboarding()` → main sets the
store flag, creates the island window, starts services, and destroys the old window. The
renderer routes purely off `initialOnboardingComplete` (no in-renderer screen flip).

**Transparency without flash**: `main.tsx` adds `body.overlay` (CSS forces transparent bg)
before first paint when `initialOnboardingComplete` is true; the onboarding window stays opaque.

### Mouse passthrough (overlay interactivity)

The island is click-through by default. On `mouseenter` the renderer sends
`set-ignore-mouse-events(false)` (island becomes clickable); on `mouseleave` it sends
`set-ignore-mouse-events(true,{forward:true})`. Main re-asserts `setAlwaysOnTop('screen-saver')`
after each toggle to avoid z-order drift.

### Voice agent — `agent/` (deployed to LiveKit Cloud)

The F.R.I.D.A.Y. agent is **not** in the Electron app. It's a standalone deployable in `agent/`
(pipeline: **Sarvam STT saaras:v3 → Gemini 2.5 Flash → OpenAI TTS nova**, Silero VAD prewarmed;
tools `get_nse_market_data` + `open_nse_stock_visualizer`). It's deployed to **LiveKit Cloud
Agents** via the `lk` CLI; LiveKit hosts/scales it and dispatches it into rooms (automatic
dispatch by default). Provider keys are LiveKit Cloud deployment secrets.

> ⚠️ `open_nse_stock_visualizer` still POSTs to `127.0.0.1:3210`, which only worked when the
> agent ran locally. A cloud agent can't reach the user's localhost — this must become a LiveKit
> **data message** to the client (TODO, noted in `agent/src/agent.ts` + `agent/README.md`).

### LiveKit tokens — `worker/` (Cloudflare Worker)

Tokens are minted by the Worker's `POST /get-token` (Hono + `livekit-server-sdk` `AccessToken`),
returning `{ participantToken, serverUrl }`. The renderer's `TokenSource.custom`
(`dynamic-island.tsx`) `fetch`es `VITE_LIVEKIT_TOKEN_ENDPOINT`; the session auto-connects on mount.
The Worker holds the LiveKit secret; the app holds none.

### Local HTTP trigger server

`startTriggerServer()` listens on `http://127.0.0.1:3210`; `POST /toggle-panel {isOpen}`
broadcasts `toggle-bottom-panel` IPC to renderers. Now used only for **manual UI testing** via
`trigger-panel.ts` (and the `toggle-dynamic-island-panel` IPC). The panel auto-closes ~10s after
open. The cloud agent can't reach localhost, so agent-driven panel opening is a TODO (see above).

### IPC / preload bridge

All renderer↔main calls go through `window.api.*` (contextBridge). Surface:

- `store.*` — `isOnboardingComplete`, `setOnboardingComplete`, `saveApiKey`, `getApiKey`,
  `deleteApiKey`, `validateGoogleKey`, `getProviderConfig`, `setProviderConfig`, `resetStore`,
  plus the synchronous `initialOnboardingComplete` (parsed from the `--onboarding-complete` arg).
- `completeOnboarding()`, `ping()`. (Tokens are fetched by the renderer directly from the
  Worker — no IPC.)
- Renderer→main events: `set-ignore-mouse-events`, `toggle-dynamic-island-panel`. Main→renderer:
  `toggle-bottom-panel`.

### Persistent store (`src/main/store.ts`)

`friday-config.json` in `userData`. Schema: `onboardingComplete`, `encryptedApiKeys`
(livekit/openai/google/sarvam), `providerConfig` (`llm`, `stt`, `tts`). Keys are encrypted via
`safeStorage` (`ENC_` prefix; `RAW_` plaintext fallback if encryption is unavailable).

## Configuration & environment

Secrets are split across the three deployables — the app itself holds none:

- **App** — root `.env.local` (gitignored; see `.env.example`) has only
  `VITE_LIVEKIT_TOKEN_ENDPOINT` (the deployed Worker's `…/get-token` URL; Vite exposes it to the
  renderer). Local dev points it at `http://localhost:8787/get-token`.
- **Worker** (`worker/`) — LiveKit infra secrets via `wrangler secret put` (prod) or
  `worker/.dev.vars` (local): `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`.
- **Agent** (`agent/`) — provider keys via LiveKit Cloud deployment secrets (prod) or
  `agent/.env.local` (local): `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `SARVAM_API_KEY` (+ LiveKit
  vars for local-only testing; LiveKit Cloud injects them in prod).
- **CSP** in `renderer/index.html`: `self` + LiveKit hosts + `api.friday.feynmanpi.com` +
  `localhost:8787` (local Worker dev) + Google Fonts.
- **Theme**: dark by default (forced in main + `<html class="dark">`); oklch tokens + island
  animations (`--border-angle` / `animate-border-spin`) in `assets/main.css`.
- **Build**: `electron.vite.config.ts` is back to a single main entry (`index`) — the agent is no
  longer bundled into the app. `worker/` and `agent/` are independent packages with their own
  `package.json` / install (not part of the root pnpm install).
- **Auto-update**: `electron-updater` + `dev-app-update.yml` / `electron-builder.yml` point at a
  **placeholder** URL — not configured for real releases.

## Tooling conventions

- **Prettier**: single quotes, no semicolons, `printWidth: 100`, no trailing commas.
- **ESLint** (flat): electron-toolkit TS + React + hooks + react-refresh, Prettier last.
- TS projects: `tsconfig.node.json` (main/preload/worker) and `tsconfig.web.json` (renderer).
  Note `noUnusedLocals` is on — unused imports fail the build.

### Packaging deps & the `patches/` directory

- `pnpm-workspace.yaml` must keep **`nodeLinker: hoisted`** (flat, npm-like `node_modules`).
  `isolated` breaks electron-builder's dependency packaging → "Cannot find module" crashes in
  packaged builds. In hoisted mode prod packages live flat at top-level `node_modules/` (not
  under `node_modules/.pnpm/`), which is where you grep to confirm an installed/patched file.
- **`patches/`** holds **pnpm patches** (`pnpm patch <pkg>` → edit → `pnpm patch-commit`), each
  registered under `patchedDependencies:` in `pnpm-workspace.yaml`. They are diffs re-applied to
  third-party deps on every `pnpm install`, so a fix in `node_modules` survives reinstalls and is
  reproducible on every machine/CI. Keyed to an exact version — a dep bump means re-creating the
  patch.
- Current patch: **`patches/app-builder-lib@26.8.1.patch`** fixes electron-builder 26's pnpm
  dependency collector. It runs `pnpm list --depth Infinity`, which *deduplicates* — a package
  fully expanded in one branch is emitted with EMPTY `dependencies` elsewhere; the collector
  cached the empty occurrence first and dropped that package's whole subtree from `app.asar`.
  This silently dropped the entire `@jimp/*` scope (a transitive dep of `@nut-tree-fork/nut-js`),
  so nut.js crashed at load with `Cannot find module '@jimp/custom'` and `control_computer` input
  injection was disabled. The patch reconstructs missing dep edges from each package's own
  `package.json` instead of trusting pnpm's deduped tree node. Verify after a build:
  `npx asar list dist/win-unpacked/resources/app.asar | grep -c "@jimp"` should be large, not 0.

## Current status (as of 2026-06-04)

### ✅ Working end-to-end

The full voice pipeline is confirmed live:

```
Electron app
  → POST https://api.friday.feynmanpi.com/get-token  (Cloudflare Worker, tamang LK project)
  → joins room on wss://tamang-c6ghlobx.livekit.cloud
  → LiveKit Cloud dispatches F.R.I.D.A.Y. agent (us-east)
  → agent speaks (Sarvam STT → Gemini 2.5 Flash → OpenAI TTS)
```

- `pnpm typecheck` + `electron-vite build` pass.
- Onboarding → island transition works.
- Dynamic Island overlay, aura visualizer, mic toggle all working.
- Token Worker deployed at `api.friday.feynmanpi.com` (custom domain, `workers_dev=false`).
- Agent deployed to LiveKit Cloud Agents (us-east, tamang project). Deployment secrets set:
  `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `SARVAM_API_KEY`.

### ⚠️ Deployed infra note

All LiveKit infra (Worker secrets + agent deployment) is on the **tamang** LiveKit project
(`wss://tamang-c6ghlobx.livekit.cloud`). If you're on a new machine, the Worker `.dev.vars`
and agent `.env.local` both need the tamang project credentials (see each folder's `.example`
file). Do NOT use the old `twospoon` project — the agent and token server must point at the
same project.

### Known TODOs (prioritised)

1. **Agent → open visualizer panel**: `open_nse_stock_visualizer` POSTs to `127.0.0.1:3210`
   which a cloud agent can't reach. Replace with a LiveKit **data channel message** to the
   client; `dynamic-island.tsx` listens via `RoomEvent.DataReceived`. Inline TODO in
   `agent/src/agent.ts`.
2. **STT/LLM/TTS upgrade**: replace Sarvam STT with device-native OS STT; LLM → Gemini 2.0
   Flash (faster TTFT); TTS → ElevenLabs `eleven_flash_v2_5` (~200ms first chunk). Target
   stack for best latency.
3. **BYOK runs its own agent**: a bring-your-own-key user should deploy their own agent with
   their own keys rather than hitting the hosted one. Architecture TBD.
4. **Pay-as-you-go billing**: onboarding stub — no auth or credit provisioning yet.
5. **BYOK keys stored but unused**: keys collected in onboarding are encrypted in electron-store
   but the hosted agent doesn't read them.
6. **Packaging**: `pnpm build:win` etc. not verified for shipping installers.
7. **Cleanup**: `components/login-form.tsx`, `Versions.tsx`, `hooks/use-agent-*.ts` are unused
   scaffolding.
8. **No tests, no CI.**

## Notes for making changes

- Adding a renderer↔main capability = three coordinated edits: handler in `main/index.ts`,
  method in `preload/index.ts`, type in `preload/types.d.ts` (and usually `hooks/use-store.ts`).
  Keep `KnownService` / `ProviderConfig` in sync with `StoreSchema` in `store.ts`.
- The island UI lives in `dynamic-island.tsx`; the agent persona/pipeline/tools live in
  `agent/src/agent.ts` (deployed to LiveKit Cloud); the token logic in `worker/src/index.ts`.
- `agents-ui/*` is registry-managed (LiveKit) — prefer the `agents-ui:add` adder over hand-edits.
- Don't commit `.env*`, `.dev.vars`, `temp.md`, `out/`, or `node_modules` (all gitignored).
  `.claude`/`.cursor` are also gitignored.

```

```
