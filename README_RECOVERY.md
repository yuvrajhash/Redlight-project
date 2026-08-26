# Friday 0.0.1 — Recovered Application Files

This directory was statically extracted from `friday-0.0.1-setup.exe`. The installer was **not executed**.

## What was recovered

- Original TypeScript source:
  - `agent/src/agent.ts`
  - `worker/src/index.ts`
  - `trigger-panel.ts`
- Original scripts, project configuration, plans, and README files.
- Compiled Electron main process: `out/main/`
- Compiled Electron preload: `out/preload/`
- Compiled React renderer and assets: `out/renderer/`

## Important limitation

The original desktop application source directories (such as `src/main`, `src/preload`, and the React TSX source tree) were not included in the distributed installer. No application source maps were present under `out/`.

The shipped JavaScript is readable and can be inspected or reformatted, but reconstructing it does not restore the exact original TypeScript/TSX, comments, file boundaries, variable names, build configuration, or Git history.

## Package metadata found in the installer

- Name: `friday`
- Version: `0.0.1`
- Framework: Electron + React + TypeScript
- Author: SAGAR TAMANG
- Repository metadata: `https://github.com/SAGAR-TAMANG/friday.git`

The repository address is metadata from the packaged `package.json`; it was not verified during extraction.

## Suggested inspection order

1. `package.json`
2. `out/main/index.js`
3. `out/preload/index.js`
4. `out/renderer/assets/index-CK565UOG.js`
5. `agent/src/agent.ts`
6. `worker/src/index.ts`
7. `ROADMAP.md` and `ONBOARDING-PLAN.md`

## Rebuilding

This archive is useful for auditing, understanding behavior, and partial reconstruction. It should not be treated as a guaranteed buildable copy of the original project because development dependencies, desktop source files, lockfile, and build configuration are incomplete or absent.
