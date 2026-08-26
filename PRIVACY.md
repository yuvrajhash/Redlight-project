# YUV privacy model

YUV uses user-provided API credentials stored through the operating system's secure storage. The
renderer cannot read decrypted credentials. Realtime audio, screen images, web queries, and computer-
control screenshots are sent only to the configured model provider when the user invokes those
features.

Persistent cognition is encrypted with Electron `safeStorage`, written atomically with a recovery
snapshot, and disabled if secure OS storage is unavailable. YUV rejects common credentials, payment
card numbers, one-time codes, and private keys from semantic memory. “Forget all” clears memories,
goals, knowledge, world state, learned procedures, and the self-model.

Computer control requires explicit approval for consequential actions and can be stopped globally
with Ctrl/Cmd+Shift+F12. YUV does not include a cloud account service, telemetry service, or bundled
Google OAuth client secret.
