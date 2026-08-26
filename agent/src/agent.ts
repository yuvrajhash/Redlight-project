/**
 * Friday Voice Agent — F.R.I.D.A.Y.
 * ==================================
 * Deployed to LiveKit Cloud Agents (managed hosting + autoscaling). LiveKit
 * dispatches this agent into a room when a participant joins.
 *
 * Pipeline: Sarvam STT (saaras:v3) → Google Gemini 2.5 Flash → OpenAI TTS (nova)
 *
 * Provider keys come from the deployment environment (LiveKit Cloud secrets):
 *   GOOGLE_API_KEY, OPENAI_API_KEY, SARVAM_API_KEY
 * LiveKit connection vars (LIVEKIT_URL/API_KEY/API_SECRET) are injected by the
 * platform when running on LiveKit Cloud — you do NOT set them as secrets there.
 *
 * Run locally for testing:  node dist/agent.js dev
 * Run in production:         node dist/agent.js start
 */

import { config } from 'dotenv'
import {
  cli,
  defineAgent,
  type JobContext,
  type JobProcess,
  voice,
  ServerOptions,
  llm
} from '@livekit/agents'
import * as openai from '@livekit/agents-plugin-openai'
import * as google from '@livekit/agents-plugin-google'
import * as sarvam from '@livekit/agents-plugin-sarvam'
import * as silero from '@livekit/agents-plugin-silero'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { fileURLToPath } from 'node:url'
import * as http from 'node:http'

// Local dev: load agent/.env.local. On LiveKit Cloud the platform injects env
// vars and this file is absent, so this call simply no-ops.
config({ path: '.env.local' })

// ---------------------------------------------------------------------------
// System Prompt — F.R.I.D.A.Y
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are F.R.I.D.A.Y. — Fully Responsive Intelligent Digital Assistant for You — Tony Stark's AI, now serving your user, the boss.

You are calm, composed, and always informed. You speak like a trusted aide who's been awake while the boss slept — precise, warm when the moment calls for it, and occasionally dry. You brief, then you move on. No rambling, ever.

Your tone: relaxed but sharp. Conversational, not robotic. Short. Confident. Think late-night briefing officer, not a chatbot.

---

## Capabilities

### get_nse_market_data — Live Market Check
Checks the live internet for the current state of the Indian stock market (NSE) — Nifty 50, Sensex, and overall sentiment.
- Call this WHENEVER the boss asks about the market, stocks, indices, Nifty, Sensex, or "how are things looking".
- NEVER guess or invent prices, numbers, or news. Always pull live data with this tool first.

### open_nse_stock_visualizer — Visual Finance Dashboard
Opens a live NSE finance dashboard on the boss's screen.
- After checking the market, ALWAYS open this BEFORE you speak your summary.
- No need to explain it. Just open it, then talk.

---

## Handling a market question

When the boss asks how the market is doing, follow this exact sequence:
1. Say one quick filler line first — "Let me check, boss." or "One sec, pulling it up."
2. Silently call get_nse_market_data to get the live numbers.
3. Silently call open_nse_stock_visualizer to put the dashboard on screen — do this BEFORE your spoken summary.
4. Then give ONE short, confident line based on the live data.
   Example: "Pretty good, boss — Nifty's hovering around twenty-three thousand five hundred, holding steady today."

Keep the final summary to a single sentence. Confident. Casual. Never read out a list of numbers like a report.

---

## Greeting

When the session starts, greet with exactly this energy:
"Good evening, boss. Late one tonight. What are you up to?"

Warm. Slightly curious. Very FRIDAY.

---

## Behavioral Rules

1. Call tools silently — never say "I'm going to call..." or name a tool. Just do it.
2. Always open the visualizer BEFORE speaking your market summary.
3. Every spoken response is SHORT — one or two sentences, max. Usually one.
4. No bullet points, no markdown, no lists, no reading out tables of numbers. You are speaking, not writing.
5. Stay in character. You are Stark's AI — "boss", "affirmative", "on it", "standing by".
6. Use natural spoken language: contractions, light pauses via commas, no stiff phrasing.
7. If a tool fails, say so calmly and briefly.

---

## Tone Reference

Right: "Let me check, boss." → [checks + opens dashboard] → "Pretty good — Nifty's holding steady around twenty-three five."
Wrong: "I will now retrieve the latest market data using the market tool and then open the visualizer."

Right: "Markets are looking healthy, boss. Nothing wild."
Wrong: "The Nifty 50 is at 23,547.75, down 1.50%, while the Sensex is at 74,775.74, down 1.44%..."

---

## CRITICAL RULES

1. NEVER invent stock prices or market news. Always call get_nse_market_data for live data first.
2. NEVER say tool names, function names, or anything technical out loud.
3. After getting market data, you MUST open_nse_stock_visualizer BEFORE your spoken summary.
4. You are a voice. Keep it short and confident — one sentence wins. No lists, no markdown, no numbers dump.
`.trim()

// ---------------------------------------------------------------------------
// Live market data — Google Search grounding
// ---------------------------------------------------------------------------

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

async function fetchNseMarketData(): Promise<string> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents:
      'In two sentences max, what is the current state of the Indian stock market (NSE) right now? ' +
      'Give the latest Nifty 50 and Sensex levels, the percentage change, and the overall sentiment. ' +
      'Be concise and factual — no preamble.',
    config: {
      tools: [{ googleSearch: {} }]
    }
  })

  return response.text?.trim() || 'Market data is unavailable right now.'
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const fctx: llm.ToolContext = {
  get_nse_market_data: llm.tool({
    description:
      'Checks the live internet for the current NSE (Indian stock market) prices and sentiment — ' +
      'Nifty 50, Sensex, and overall mood. Call this whenever the user asks about the market, ' +
      'stocks, indices, or how things are looking. Returns live, real-time data.',
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe(
          'Optional specific thing to look up, e.g. "Reliance share price". Leave empty for a general market check.'
        )
    }),
    execute: async ({ query }) => {
      console.log(
        `[Agent] Fetching live NSE market data via Google Search grounding... ${query ?? ''}`
      )
      try {
        const data = await fetchNseMarketData()
        console.log(`[Agent] Market data: ${data}`)
        return data
      } catch (e) {
        console.error('[Agent] Failed to fetch market data:', e)
        return 'Could not reach the markets right now — network issue.'
      }
    }
  }),

  open_nse_stock_visualizer: llm.tool({
    description:
      'Opens a live NSE finance dashboard on the host machine to visualize the stock market.',
    parameters: z.object({
      execute_now: z.boolean().optional().describe('Set to true to execute')
    }),
    execute: async () => {
      console.log('[Agent] Opening NSE stock visualizer...')

      // ⚠️ TODO (cloud deployment): This POSTs to 127.0.0.1:3210 on the *host*, which
      // only works when the agent runs locally on the user's machine. Once this agent
      // is deployed to LiveKit Cloud it CANNOT reach the user's localhost. Replace this
      // with a LiveKit data message to the client, e.g.:
      //   ctx.room.localParticipant.publishData(
      //     new TextEncoder().encode(JSON.stringify({ type: 'toggle-panel', isOpen: true })),
      //     { reliable: true }
      //   )
      // and have dynamic-island.tsx listen via RoomEvent.DataReceived. Until then this
      // call simply no-ops (network error) when deployed, leaving the panel closed.
      return new Promise<string>((resolve) => {
        const data = JSON.stringify({ isOpen: true })
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: 3210,
            path: '/toggle-panel',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': data.length
            }
          },
          (res) => {
            res.on('data', () => {})
            res.on('end', () =>
              resolve('Visualizer opened. Now give your short spoken summary of the market.')
            )
          }
        )

        req.on('error', (e) => {
          console.error('[Agent] Failed to trigger panel (expected when deployed remotely):', e)
          resolve('Visualizer requested. Now give your short spoken summary of the market.')
        })

        req.write(data)
        req.end()
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Voice Agent class
// ---------------------------------------------------------------------------

class FridayAgent extends voice.Agent {
  constructor() {
    super({
      instructions: SYSTEM_PROMPT,
      tools: fctx
    })
  }

  override async onEnter(): Promise<void> {
    this.session.generateReply({
      instructions:
        "Greet the user with this message: 'Good evening, boss. You are late up night today. What you up to?'"
    })
  }
}

// ---------------------------------------------------------------------------
// Agent definition
// ---------------------------------------------------------------------------

interface WorkerData {
  vad: silero.VAD
}

export default defineAgent<WorkerData>({
  prewarm: async (proc: JobProcess<WorkerData>) => {
    proc.userData.vad = await silero.VAD.load()
  },
  entry: async (ctx: JobContext<WorkerData>) => {
    console.log(`[Agent] Room connected: ${ctx.room.name}`)

    const session = new voice.AgentSession({
      stt: new sarvam.STT({
        model: 'saaras:v3',
        languageCode: 'unknown',
        mode: 'transcribe'
      }),
      llm: new google.LLM({
        model: 'gemini-2.5-flash'
      }),
      tts: new openai.TTS({
        model: 'tts-1',
        voice: 'nova'
      }),
      vad: ctx.proc.userData.vad,
      turnDetection: 'vad'
    })

    await session.start({ agent: new FridayAgent(), room: ctx.room })
  }
})

// ---------------------------------------------------------------------------
// CLI entry — runs the worker (`dev` locally, `start` in production)
// ---------------------------------------------------------------------------

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }))
