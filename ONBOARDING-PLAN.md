# Onboarding — Creation Plan

> The plan for Friday's new onboarding + first-run intro. Goal: make it the
> coolest onboarding ever — cinematic, voice-first, and unmistakably FRIDAY from
> the first second. Built **step by step** (each phase shippable on its own).
> Created 2026-06-25.

---

## Vision (Sagar's brief, as given)

Two distinct experiences, in order:

### A. Onboarding (setup)

1. **Google login** — first thing, before anything else.
2. **Permissions** — request everything the tools need:
   - **macOS:** a guided **three-step** flow (Microphone, Screen Recording, Accessibility).
   - **Windows:** a lighter / "normal" flow (little to nothing required — see permissions note).
3. Onboarding ends → app transitions to the island.

### B. First-time intro (the "wow", runs once after onboarding)

A short **video of Sagar speaking**, introducing FRIDAY, with **live actions firing
on screen as he narrates**:

- "This is FRIDAY, and here's what it can do…"
- "Say I want to go to the Indian Space Research Organization — I just **ask** FRIDAY,
  and it opens it" → **[action: opens the ISRO link]**
- "You can also tell me how you like the app — reply to my Twitter post"
  → **[action: opens Twitter]**
- "…or email me" → **[action: opens Gmail]**
- **Disclaimer:** make sure you understand the risks (computer control, screen
  access, data sent to OpenAI).

Then the intro ends and the user is live with FRIDAY.

---

## Current state (what exists today)

`src/renderer/src/components/onboarding.tsx`:

- `PlanSelection` → **Subscription (stub)** or **BYOK**.
- `BYOKSetup` — single OpenAI key field (`sk-` prefix check only), saves via
  `store.saveApiKey('openai', …)`, then `onComplete()`.
- `PayAsYouGo` — pure stub (`$5 credit` UI, no auth/billing), then `onComplete()`.

Flow plumbing (keep — it already works):

- `onComplete()` → `window.api.completeOnboarding()` → main sets the store flag,
  swaps the framed onboarding window for the transparent island, starts services.
- Routing is purely off `store.initialOnboardingComplete` (no in-renderer flip).

Store (`src/main/store.ts`): `onboardingComplete`, `encryptedApiKeys`,
`providerConfig`.

---

## ⚠️ Open decisions (resolve before building Phase A)

1. **Where does the OpenAI key come from now?** The app _cannot run_ without one
   (main mints the realtime ephemeral key from it). The new flow leads with Google
   login but never mentions a key. Two options:
   - **(a) BYOK stays:** Google login = account/identity only; user still pastes
     their OpenAI key in a setup step. Simplest; no backend.
   - **(b) Managed key:** Google login authenticates to _your_ backend, which mints
     the ephemeral key server-side from a hosted OpenAI key (the "pay-as-you-go"
     path). No key step for the user, but needs auth + billing infra (not built).
   - 👉 Recommendation: ship **(a)** first (works today), design the UI so **(b)**
     can slot in later behind the same Google account.

2. **What is Google login _for_ at launch?** Identity/personalization/sync, or the
   gate to managed billing? If purely cosmetic for v1, consider making it
   **optional/skippable** so it doesn't block a BYOK user who just wants in.

3. **Subscription card:** currently launches a **keyless island that fails**. Until
   billing exists, **hide or disable it** (folded into this redesign — ROADMAP #1).

---

## Permissions reference (per-OS)

Capabilities that touch the OS: **mic** (voice), **screen capture**
(`look_at_screen` + CUA), **input injection** (`control_computer` / nut.js).

### Windows — minimal

- **Mic:** global privacy toggle ("Let desktop apps access your microphone"); no
  per-app prompt. Detect failure → instruct.
- **Screen capture:** no permission.
- **Input injection:** no permission. Caveat: can't drive _elevated_ windows
  unless Friday runs as admin (UIPI). Not an onboarding concern.
- ➡️ Onboarding = essentially a silent mic check, otherwise skip.

### macOS — the real work (cannot grant programmatically; detect + deep-link)

| Capability             | Permission           | API / link                                                                                                                                                |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voice                  | **Microphone**       | `systemPreferences.askForMediaAccess('microphone')`                                                                                                       |
| `look_at_screen` + CUA | **Screen Recording** | `getMediaAccessStatus('screen')`; link `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`; **needs app restart after grant** |
| `control_computer`     | **Accessibility**    | `isTrustedAccessibilityClient(true)` to prompt; link `…?Privacy_Accessibility`                                                                            |

Gotchas to bake in:

- **Dev mode:** grants attach to **Electron.app**, not the packaged "Friday".
- **Restart-after-grant** for Screen Recording — flow must handle "granted, relaunch".
- Live status rows (✅/⚠️) that poll and flip green as the user grants.

---

## Step-by-step build plan

Each step is independently shippable; do them in order.

- **Step 0 — Scaffolding.** New step-machine in `onboarding.tsx` (replace the 3-step
  enum with a richer ordered flow). Add store flags: `introComplete` (separate from
  `onboardingComplete`), `googleAccount` (optional). Wire `introComplete` so the
  island shows the intro overlay once.
- **Step 1 — Google login.** UI + auth. (Decide provider: native OAuth via a system
  browser + loopback, or a hosted callback.) Persist minimal profile. Skippable if
  v1 identity is cosmetic.
- **Step 2 — Permissions (platform-aware).** New main IPC: `permissions:getStatus`,
  `permissions:request(kind)`, `permissions:openSettings(kind)`. Renderer renders
  Windows-light vs macOS-three-step with live polling. Gate "continue" on Mic +
  Screen Recording (Accessibility optional unless computer-use is on).
- **Step 3 — Key / plan.** BYOK key entry (option a). Add **real key validation**
  (a cheap live OpenAI call, not just the `sk-` prefix — ROADMAP launch gap). Hide
  the Subscription card for now.
- **Step 4 — Transition.** Existing `completeOnboarding()` path. Sets
  `onboardingComplete=true`.
- **Step 5 — First-run intro overlay.** On first island launch with
  `introComplete=false`: full-screen intro hosting Sagar's video + synced live
  actions + risk disclaimer + "Get started". Sets `introComplete=true` on finish.
  Replayable later from settings.

---

## Cooler / bigger ideas (suggestions)

Pick what fits — these layer onto the brief above.

### Make it voice-first and _alive_

- **FRIDAY greets you during onboarding**, not just after. The aura visualizer is
  present the whole time; FRIDAY speaks each step ("First, I'll need your
  microphone, boss."). Sells the product before setup even finishes.
- **Live mic test on the permission step** — show the user's voice driving the aura
  in real time the moment mic is granted. Instant "it works" proof.
- **End with a guided first command** instead of a passive video: "Now you try —
  ask me to open anything." First successful command = the real activation moment.

### Make the intro a _demo_, not a video

- Sagar's narration is great, but consider the actions being **real, not canned** —
  FRIDAY actually performs each open live, synced to the audio. Bigger flex than a
  screen recording, and proves it's real.
- **Captions/subtitles** on the video (accessibility + muted autoplay friendly).
- **Skip + Replay** controls; store `introComplete` so it never nags.

### Trust & safety as a feature (not fine print)

- A **"What FRIDAY can see & control" transparency screen** — plainly: screenshots
  - screen control are sent to OpenAI. Doubles as the launch-required privacy
    disclosure (ROADMAP launch gap) and builds trust.
- **Per-capability consent**: an explicit "I understand" toggle that _gates
  computer-use specifically_ (ties to the computer-use safety work, ROADMAP #4).
  Vision/voice on by default; "hands" opt-in.

### Personalization

- **Pick FRIDAY's voice** from the realtime voices during onboarding (`REALTIME_VOICE`
  is already a config). Fun, memorable, low effort.
- **Name capture** so FRIDAY addresses the user (beyond "boss") if they want.
- Tie personalization to the Google account so it **syncs across devices** later.

### Polish

- Cinematic transitions between steps (the aura morphing between states).
- A "booting sequence" beat on launch (you already tease this copy) — lean in.
- Progress affordance (3–4 dots) so users know how long setup is.
- **Resilience:** handle no-internet, denied mic, bad key mid-flow with friendly
  recovery, not dead ends (ROADMAP launch gap).

### Stretch

- **Account-synced settings/memory** (pairs with the memory feature, ROADMAP #6).
- **Referral / share moment** baked into the intro (Sagar already asks for Twitter
  replies — make that a one-click share with prefilled text).

---

## Suggested first move

Resolve the **Open decisions** (esp. #1 key source), then build **Step 0 + Step 2
(permissions)** first — permissions are the highest-risk, most platform-specific
piece, and getting the detection IPC right unblocks the rest. The video/intro
(Step 5) can come last since it has no dependencies on the others.
