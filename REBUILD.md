# Friday — reconstructed source notes

This tree was rebuilt from a static extract of `friday-0.0.1` (`recovered-out/`) plus docs.

## Run

```bash
pnpm install
cp .env.example .env.local   # add GOOGLE_OAUTH_* for sign-in
pnpm dev
```

BYOK needs an OpenAI key entered during onboarding (or Settings). Google OAuth credentials must be set in `.env.local` for the welcome sign-in step.

## Layout

- `src/main/` — Electron main (store, brains, os, auth, permissions)
- `src/preload/` — `window.api` bridge
- `src/renderer/` — React onboarding + Dynamic Island + OpenAI Realtime
- `agent/` / `worker/` — legacy LiveKit path (not used by BYOK)
- `recovered-out/` — original installer bundles kept for reference

## Verify locally

```bash
pnpm typecheck
pnpm build          # or: pnpm exec electron-vite build
pnpm dev
```
