# YUV

YUV is a private cognitive desktop assistant for Windows, macOS, and Linux, created for Yuvraj
Choudhary (Yuv). It combines realtime voice, screen understanding, controlled computer actions,
persistent encrypted memory, a semantic knowledge graph, goals, procedural learning, a world model,
metacognitive audits, consolidation, and an emergency stop.

The Cognitive Control Centre provides a full-size, local interface for inspecting and managing
memory, goals, knowledge, learned procedures, privacy retention, capabilities, and the computer
action audit trail. Open it from YUV's settings panel.

## Development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

API credentials are bring-your-own-key and are stored using the operating system's secure storage.
See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and [NOTICE.md](NOTICE.md).
