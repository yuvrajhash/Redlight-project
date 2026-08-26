# Friday — Roadmap & Pickup Notes

> Working notes for picking the project back up in a fresh session. Captures what's
> built, what's planned next (Sagar's list), and the launch-readiness gaps flagged
> along the way. Last updated **2026-06-25**.

---

## Where the project is now (as-built)

The **BYOK voice path is fully migrated off LiveKit** onto `@openai/agents/realtime`.
LiveKit, the token Worker (`worker/`), and the cloud agent (`agent/`) are **no longer
used by the BYOK flow** (those folders/dirs describe the old subscription design and
are superseded — see `CLAUDE.md` note). The whole agent now runs inside the Electron app:

- **Voice transport** — `@openai/agents/realtime` (`RealtimeAgent` + `RealtimeSession` +
  `OpenAIRealtimeWebRTC`) hosted in the **renderer** (`src/renderer/src/realtime/useFridaySession.ts`).
  Main mints a short-lived **ephemeral key** from the user's stored OpenAI key
  (`realtime:mintEphemeralKey`); the renderer never sees the real key.
- **Tools** (`src/renderer/src/realtime/tools.ts`) → IPC → **main-process sub-agents**
  (`src/main/brains.ts`), each a separate OpenAI call returning only short text so the
  voice context stays lean:
  - **`look_at_screen`** — vision. Two modes (flag): `subagent` (vision model returns
    text) or `direct` (screenshot injected into the realtime session). `src/main/os.ts`
    captures; `describeScreen()` is the sub-agent.
  - **`search_web`** — OpenAI hosted `web_search` (Responses API), **background** pattern:
    returns instantly, FRIDAY says a filler line, the real answer is broadcast back and
    spoken. Sources enriched with favicons → right-side source cards.
  - **`control_computer`** (or `click_screen`/`type_text`/`press_key`/`scroll_screen`) —
    computer-use. Two brains (flag): `openai-cua` (hands whole task to the `gpt-5.5` +
    `{type:'computer'}` look→act loop, executed via **nut.js** in `os.ts`) or `realtime`
    (the voice model drives clicks itself). Single OpenAI key throughout.
- **Visuals/audio** — capture flash, computer-use screen glow + status card, search source
  cards (`src/renderer/src/components/{dynamic-island,computer-use-card,search-sources-panel}.tsx`,
  CSS in `assets/main.css`, SFX in `assets/sfx/`).
- **Logging** — everything funnels to `electron-log` (terminal + `%TEMP%/electron-app-logs/main.log`):
  transcripts (user + friday), tool calls, search queries+results+sources, vision Q&A,
  CUA steps, control actions. Renderer → main via `window.api.log(scope, message)` → `app:log`.
- **Persona** — full F.R.I.D.A.Y. system prompt built in `brains.ts` (`buildSystemPrompt`),
  with hard anti-fabrication rules (never speak stale news/prices; after `search_web` say
  only a filler then wait for the real result).

**Dev flags** (`.env.local`, dev only — defaults apply for end users):
`VISION_MODE=subagent|direct`, `CONTROL_BRAIN=openai-cua|realtime`, plus model overrides
`VISION_MODEL` / `WEB_SEARCH_MODEL` / `COMPUTER_USE_MODEL` / `REALTIME_VOICE`. See `.env.example`.

Build/typecheck are green; **packaging (`build:win`) is NOT yet verified** with the native
nut.js module.

---

## Planned next (Sagar's roadmap)

In Sagar's intended order. Packaging verification comes **after** these.

### 1. Redesign the onboarding screen (Figma-led)

Make it classy — better than the current basic form. Implement from a Figma design.

- File: `src/renderer/src/components/onboarding.tsx`. Today: `PlanSelection` → `BYOKSetup`
  (single OpenAI-key field) + `PayAsYouGo` (subscription stub).
- ⚠️ Fold in the launch gap: **the Subscription card currently launches a keyless island
  that fails** — hide/disable it (or gate it) as part of the redesign.

### 2. Settings in the Dynamic Island UI

- A settings affordance on the island to **change the API key** (needs: settings panel UI +
  re-mint after key change; `store.saveApiKey` already exists, add UI + IPC wiring).
- **Surface "API not working" state** — e.g. the aura visualizer turns **red** on auth/connection
  failure. Hook points: `useFridaySession` already sets `agentState='failed'`; add a distinct
  error state + color mapping in `agent-state.ts` / `agent-audio-visualizer-aura.ts`. Detect
  OpenAI auth failures (bad/expired key) explicitly.

### 3. Multi-monitor + responsive island window

- Make the island **draggable to other displays** (multi-screen setups).
- **Re-fit on screen-size change** — current bug: the island window is sized once to the
  primary display bounds and **stays stuck** when resolution/displays change.
- Hook points: `createIslandWindow()` in `src/main/index.ts` (currently fixed to
  `screen.getPrimaryDisplay().bounds`). Add listeners for `screen` events
  (`display-metrics-changed`, `display-added`, `display-removed`) to reposition/resize, and
  a drag/move-to-display mechanism.

### 4. Extra validation / safety for computer-use

- Harder guardrails before/while FRIDAY controls the machine. Ideas: a **global abort hotkey**
  to kill the CUA loop and regain control; explicit confirm for destructive actions (currently
  only a prompt rule, not enforced); maybe an opt-in toggle.
- Hook points: `runComputerUseLoop()` in `brains.ts`, `runComputerAction()` in `os.ts`.

### 5. macOS access requirements → advanced onboarding

- On macOS the user must grant **Accessibility** (for nut.js input control) and **Screen
  Recording** (for `desktopCapturer`). Build an **advanced onboarding** that walks the user
  through enabling these OS permissions, with state detection.
- Hook points: `session.setPermissionRequestHandler` in `main/index.ts`; new onboarding steps.

### 6. Memory logic (à la openclaw / hermes)

- Persistent memory so FRIDAY remembers the user/context across sessions. Architecture TBD —
  likely a memory store + retrieval that feeds the system prompt and/or a memory sub-agent.

---

## Launch-readiness gaps (flagged 2026-06-25, not yet done)

Beyond Sagar's list, these block a clean _public_ launch (vs. a friendly beta):

- **🔴 Verify packaging** — `pnpm build:win` with the native **nut.js** addon
  (`asarUnpack` + load from the installed `.exe`; confirm computer-use works packaged). The
  one true blocker — nothing ships until this passes. (Sagar: do this last, after the above.)
- **🔴 Real OpenAI key validation in onboarding** — today only checks the `sk-` prefix; a
  valid-format-but-wrong key → dead "failed" orb. Validate with a real call before launch.
  (Overlaps roadmap #2.)
- **🟠 Code signing + notarization** — unsigned → Windows SmartScreen / macOS Gatekeeper
  warnings; notarization is mandatory for macOS distribution.
- **🟠 Auto-update** — `electron-updater` points at a **placeholder URL**; wire it so fixes
  can reach users post-launch.
- **🟠 Verify the anti-hallucination fix** (step-4 prompt changes) holds in real use.
- **🟡 Privacy disclosure** — screenshots + screen control are sent to OpenAI; tell users.
- **🟡 Resilience UX** — no internet, expired key mid-session, rate limits, mic denied.
- **🟡 Misc** — distinct computer-use SFX; deferred subscription / BYOK-runs-own-agent paths;
  tests + CI.

---

## Suggested sequence

Sagar's 1→6, then packaging. Quick wins worth pulling forward: **hide the subscription card**
(do it inside onboarding redesign #1) and **real key validation** (do it inside settings #2).
Treat **packaging verification** as the gate to any beta — run it early enough that native-module
surprises don't ambush you at the end.
