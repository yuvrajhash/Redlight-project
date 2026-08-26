# Friday voice agent — container image for LiveKit Cloud Agents.
# NOTE: `lk agent create` can scaffold/validate a Dockerfile for you; this is a
# working starting point you can keep or let the CLI regenerate.

FROM node:22-slim

# Build tools for any native deps that need to compile (onnxruntime-node /
# @livekit/rtc-node usually ship prebuilt binaries, but keep these for safety).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Pre-download model weights (e.g. Silero VAD) at build time so first connection
# isn't slowed by a cold download.
RUN npm run download-files || true

# Production worker mode.
CMD ["node", "dist/agent.js", "start"]
