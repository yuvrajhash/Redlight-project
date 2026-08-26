import { tool } from '@openai/agents/realtime'
import { z } from 'zod'
import type { ControlBrain, VisionMode } from '../../../preload/types'

type InjectFn = (event: Record<string, unknown>) => void

export function createFridayTools({
  visionMode,
  controlBrain,
  inject
}: {
  visionMode: VisionMode
  controlBrain: ControlBrain
  inject: InjectFn
}) {
  const effectiveVisionMode = controlBrain === 'realtime' ? 'direct' : visionMode

  const lookAtScreen = tool({
    name: 'look_at_screen',
    description: `Sees the boss's screen to answer a question about what's on it. Call this whenever the boss refers to something on screen — "what is this", "read this", "what does this error say", "how do I fix this" — or any request using "this / that / here / it" pointing at the display. The screen changes constantly, so always call this fresh; never reuse an earlier look.`,
    parameters: z.object({
      question: z
        .string()
        .describe(
          'What the boss wants to know about the screen, e.g. "what does this error mean". Phrase it as the actual question to answer from the screenshot.'
        )
    }),
    execute: async ({ question }) => {
      window.api.log('Tool', `look_at_screen (${effectiveVisionMode}): ${question}`)
      if (effectiveVisionMode === 'subagent') {
        const answer = await window.api.describeScreen(question)
        void window.api.cognition
          .remember({
            kind: 'episodic',
            content: `Screen question: ${question}\nObserved answer: ${answer}`,
            source: 'screen',
            tags: ['screen-observation', 'vision'],
            confidence: 0.72,
            salience: 0.5,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .catch((error) => window.api.log('Cognition', `failed to remember screen view: ${error}`))
        return answer
      }
      const { image } = await window.api.captureScreen()
      if (!image) return 'Could not capture the screen right now, boss.'
      inject({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_image', image_url: image, detail: 'low' }]
        }
      })
      return 'Screenshot captured and attached. Answer based only on what is actually visible in it.'
    }
  })

  const searchWeb = tool({
    name: 'search_web',
    description: `Searches the live internet for current facts about ANYTHING — news, "what's happening today", a company, a person, a price, the weather, sports, an event. IMPORTANT: this runs in the BACKGROUND — it returns instantly so you can keep talking, then the answer comes back to you a few seconds later and you speak it then.`,
    parameters: z.object({
      query: z
        .string()
        .describe('What to look up, in plain language, e.g. "latest on Tesla stock".')
    }),
    execute: async ({ query }) => {
      window.api.log('Tool', `search_web: ${query}`)
      void window.api.cognition
        .observe({
          content: `The user requested a live web search for: ${query}`,
          source: 'user',
          tags: ['web-search', 'active-question'],
          confidence: 0.98,
          salience: 0.55,
          novelty: 0.6,
          userDirected: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .catch((error) =>
          window.api.log('Cognition', `failed to remember search request: ${error}`)
        )
      const { busy } = await window.api.webSearch(query)
      if (busy) {
        return `You're already searching — do NOT call search_web again. Just say you're still looking ("Still pulling it up, boss.") and wait; the answer is on its way.`
      }
      return `Search started in the background. Your ONLY job this turn is to say ONE short filler line that you're looking it up (e.g. "Looking into it, boss — one sec."). Do NOT answer the question, do NOT summarize, do NOT guess or use your own knowledge — it is stale. STOP after the filler line. The real answer will be delivered to you in a few seconds; speak ONLY that when it arrives.`
    }
  })

  const recallMemory = tool({
    name: 'recall_memory',
    description:
      'Searches Friday long-term memory for prior conversations, user preferences, corrections, past outcomes, learned procedures, or known facts. Use when the user asks what they previously said, refers to an earlier event, or when past experience could materially improve the answer.',
    parameters: z.object({
      query: z.string().describe('A concise description of what should be remembered.'),
      kinds: z
        .array(z.enum(['episodic', 'semantic', 'procedural', 'self', 'reflection']))
        .optional()
        .describe('Optional memory types to search.')
    }),
    execute: async ({ query, kinds }) => {
      const context = await window.api.cognition.context({
        query,
        kinds,
        limit: 8
      })
      return context.text || 'No relevant long-term memory was found. Do not invent one.'
    }
  })

  const rememberThis = tool({
    name: 'remember_this',
    description:
      'Stores a durable memory only when the user explicitly asks Friday to remember something, states a stable preference, teaches a reusable procedure, or corrects a previous belief. Do not store passwords, API keys, payment details, or other secrets.',
    parameters: z.object({
      content: z
        .string()
        .describe('The durable fact, preference, correction, or procedure to remember.'),
      kind: z
        .enum(['semantic', 'procedural', 'self'])
        .describe(
          'semantic=fact/preference, procedural=how-to, self=Friday capability or limitation.'
        ),
      tags: z.array(z.string()).optional().describe('A few short retrieval tags.')
    }),
    execute: async ({ content, kind, tags }) => {
      await window.api.cognition.remember({
        kind,
        content,
        source: 'user',
        tags: ['explicit-memory', ...(tags ?? [])],
        confidence: 0.95,
        salience: 0.9
      })
      return 'Stored in long-term memory.'
    }
  })

  const auditMemory = tool({
    name: 'audit_memory',
    description:
      'Checks a claim against Friday stored memories, including contradictory experiences and evidence. This audits internal consistency only. Use live web search as well when the claim is current or externally verifiable.',
    parameters: z.object({
      claim: z.string().describe('The precise claim to check against long-term memory.')
    }),
    execute: async ({ claim }) => {
      const audit = await window.api.cognition.audit(claim)
      return JSON.stringify({
        verdict: audit.verdict,
        confidence: audit.confidence,
        explanation: audit.explanation,
        supporting: audit.supporting.map((memory) => memory.content),
        conflicting: audit.conflicting.map((memory) => memory.content)
      })
    }
  })

  return [
    lookAtScreen,
    searchWeb,
    recallMemory,
    rememberThis,
    auditMemory,
    ...createControlTools(controlBrain)
  ]
}

function createControlTools(controlBrain: ControlBrain) {
  if (controlBrain === 'realtime') {
    return [clickScreen, typeText, pressKey, scrollScreen]
  }
  return [controlComputer]
}

const controlComputer = tool({
  name: 'control_computer',
  description: `Carries out a multi-step task directly on the boss's computer — opening apps, clicking, typing, navigating, searching, filling forms. Hand off the WHOLE task in plain language (e.g. "open Chrome and search for pizza", "play Daft Punk on Spotify", "close this window"). A specialist vision agent takes over, sees the screen, does the task step by step, and reports back what it did. Say a short filler line FIRST, then call this; it runs a few seconds.`,
  parameters: z.object({
    task: z
      .string()
      .describe('The full task in plain language, e.g. "open Spotify and play Daft Punk".')
  }),
  execute: async ({ task }) => {
    window.api.log('Tool', `control_computer: ${task}`)
    const result = await window.api.controlComputer(task)
    void window.api.cognition
      .remember({
        kind: 'procedural',
        content: `Computer task: ${task}\nOutcome: ${result}`,
        source: 'tool',
        tags: ['computer-control', 'task-outcome'],
        confidence: /done|complete|opened|finished/i.test(result) ? 0.75 : 0.45,
        salience: 0.68
      })
      .catch((error) => window.api.log('Cognition', `failed to remember task outcome: ${error}`))
    return result
  }
})

const clickScreen = tool({
  name: 'click_screen',
  description:
    'Clicks at a point on the screen. Coordinates are NORMALIZED to a 0–1000 grid where (0,0) is the top-left and (1000,1000) is the bottom-right, regardless of resolution. You MUST call look_at_screen first to see where things are, then estimate the coordinates from that fresh screenshot.',
  parameters: z.object({
    x: z.number().describe('Horizontal position, 0 (far left) to 1000 (far right).'),
    y: z.number().describe('Vertical position, 0 (top) to 1000 (bottom).'),
    target: z.string().describe('What you are clicking, e.g. "the blue Submit button".'),
    double: z.boolean().describe('True for a double-click (e.g. to open a file).'),
    right: z.boolean().describe('True for a right-click (context menu).')
  }),
  execute: async ({ x, y, target, double, right }) => {
    window.api.log(
      'Tool',
      `click_screen: "${target}" @ (${x},${y})${double ? ' x2' : ''}${right ? ' right' : ''}`
    )
    const action = double ? 'double_click' : right ? 'right_click' : 'click'
    const { ok } = await window.api.computerAction({ action, x, y })
    return ok
      ? `Clicked ${target}. The screen has likely changed — call look_at_screen again before your next action.`
      : 'The click failed. Tell the boss you could not click right now.'
  }
})

const typeText = tool({
  name: 'type_text',
  description:
    'Types text using the keyboard into whatever field is currently focused. Click the target field first with click_screen if it is not already focused.',
  parameters: z.object({
    text: z.string().describe('The exact text to type.')
  }),
  execute: async ({ text }) => {
    const { ok } = await window.api.computerAction({ action: 'type', text })
    return ok ? 'Typed the text.' : 'Typing failed. Tell the boss you could not type right now.'
  }
})

const pressKey = tool({
  name: 'press_key',
  description:
    'Presses a key or keyboard shortcut. Examples: "enter", "tab", "escape", "backspace", "ctrl+a", "ctrl+c", "ctrl+v", "alt+tab", "win+d". Use for submitting, navigating, or shortcuts.',
  parameters: z.object({
    keys: z.string().describe('The key or combo, e.g. "enter" or "ctrl+s".')
  }),
  execute: async ({ keys }) => {
    const { ok } = await window.api.computerAction({ action: 'key', keys })
    return ok ? `Pressed ${keys}.` : 'Key press failed. Tell the boss it did not go through.'
  }
})

const scrollScreen = tool({
  name: 'scroll_screen',
  description:
    'Scrolls the page or view up or down. Use before look_at_screen if the thing you need is off-screen.',
  parameters: z.object({
    direction: z.enum(['up', 'down']).describe('Which way to scroll.'),
    amount: z.number().describe('How many scroll steps (3 is a normal amount).')
  }),
  execute: async ({ direction, amount }) => {
    const { ok } = await window.api.computerAction({
      action: 'scroll',
      direction,
      amount
    })
    return ok ? `Scrolled ${direction}. Call look_at_screen to see the new view.` : 'Scroll failed.'
  }
})
