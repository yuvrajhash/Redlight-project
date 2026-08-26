import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AccessToken } from 'livekit-server-sdk'
import { RoomConfiguration, RoomAgentDispatch } from '@livekit/protocol'

/**
 * Friday LiveKit Token Worker
 * ===========================
 * A stateless Cloudflare Worker that mints short-lived LiveKit access tokens.
 * It holds ONLY the LiveKit infrastructure credentials (URL / API key / secret)
 * as Worker secrets — they never ship in the desktop app.
 *
 * It does NOT hold any provider keys (OpenAI / Sarvam / Gemini). Those live with
 * the agent (LiveKit Cloud Agents), never on the client and never here.
 *
 * Route:
 *   POST /get-token  →  { participantToken, serverUrl }
 *     body (all optional): { roomName, participantIdentity, participantName,
 *                            agentName?, room_config?: { agents: [{ agent_name }] } }
 *
 * Agent dispatch:
 *   - LiveKit Cloud Agents use *automatic* dispatch by default, so you usually do
 *     NOT need to pass any agent info — just join the room and the agent appears.
 *   - To force *explicit* dispatch of a named agent, pass `agentName` (or a full
 *     `room_config.agents` array) and it will be attached to the token.
 */

interface Bindings {
  LIVEKIT_API_KEY: string
  LIVEKIT_API_SECRET: string
  LIVEKIT_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Allow the desktop app (and local dev) to call this from any origin.
app.use('*', cors())

app.get('/', (c) => c.text('friday-token-worker: POST /get-token'))

app.post('/get-token', async (c) => {
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>)

  const roomName = (body.roomName as string) || `room-${Math.random().toString(36).substring(2, 9)}`
  const participantName =
    (body.participantIdentity as string) ||
    (body.participantName as string) ||
    `user-${Math.random().toString(36).substring(2, 9)}`

  const at = new AccessToken(c.env.LIVEKIT_API_KEY, c.env.LIVEKIT_API_SECRET, {
    identity: participantName,
    name: participantName,
    ttl: '10m'
  })

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true
  })

  // Optional explicit agent dispatch. Omit for LiveKit Cloud automatic dispatch.
  const explicitAgents =
    (body.room_config as { agents?: Array<{ agent_name?: string; agentName?: string }> })?.agents ||
    (body.agentName ? [{ agentName: body.agentName as string }] : null)

  if (explicitAgents && explicitAgents.length > 0) {
    at.roomConfig = new RoomConfiguration({
      name: roomName,
      agents: explicitAgents.map(
        (agent) =>
          new RoomAgentDispatch({
            agentName: agent.agentName || agent.agent_name
          })
      )
    })
  }

  return c.json({
    participantToken: await at.toJwt(),
    serverUrl: c.env.LIVEKIT_URL
  })
})

export default app
