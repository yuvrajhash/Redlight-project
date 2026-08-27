import { tool } from '@openai/agents/realtime'
import { z } from 'zod'
import type { ControlBrain, VisionMode } from '../../../preload/types'

type InjectFn = (event: Record<string, unknown>) => void

const entitySchema = z.object({
  name: z.string().describe('Canonical entity name.'),
  kind: z.enum([
    'person',
    'organization',
    'product',
    'place',
    'project',
    'concept',
    'event',
    'other'
  ]),
  aliases: z.array(z.string()).optional(),
  attributes: z.record(z.string()).optional()
})

export function createYUVTools({
  visionMode,
  controlBrain,
  inject,
  consumeFreshApproval
}: {
  visionMode: VisionMode
  controlBrain: ControlBrain
  inject: InjectFn
  consumeFreshApproval: (requestedAt: number) => boolean
}) {
  const effectiveVisionMode = controlBrain === 'realtime' ? 'direct' : visionMode
  let pendingApproval: {
    goalId: string
    stepId: string
    requestedAt: number
  } | null = null

  const lookAtScreen = tool({
    name: 'look_at_screen',
    description: `Sees the user's screen to answer a question about what's on it. Call this whenever the user refers to something on screen — "what is this", "read this", "what does this error say", "how do I fix this" — or any request using "this / that / here / it" pointing at the display. The screen changes constantly, so always call this fresh; never reuse an earlier look.`,
    parameters: z.object({
      question: z
        .string()
        .describe(
          'What the user wants to know about the screen, e.g. "what does this error mean". Phrase it as the actual question to answer from the screenshot.'
        )
    }),
    execute: async ({ question }) => {
      window.api.log('Tool', `look_at_screen (${effectiveVisionMode}): ${question}`)
      if (effectiveVisionMode === 'subagent') {
        const answer = await window.api.describeScreen(question)
        void window.api.runtime.ingest({
          modality: 'vision',
          source: 'screen-analysis',
          content: `Screen question: ${question}\nObserved answer: ${answer}`,
          confidence: 0.72,
          novelty: 0.65,
          urgency: 0.35,
          risk: 0.2,
          userDirected: true
        })
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
      if (!image) return 'Could not capture the screen right now, user.'
      void window.api.runtime.ingest({
        modality: 'vision',
        source: 'screen-capture',
        content: `A fresh screenshot was captured to answer: ${question}`,
        confidence: 0.98,
        novelty: 0.55,
        urgency: 0.3,
        risk: 0.15,
        userDirected: true
      })
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
        return `You're already searching — do NOT call search_web again. Just say you're still looking ("Still pulling it up, user.") and wait; the answer is on its way.`
      }
      return `Search started in the background. Your ONLY job this turn is to say ONE short filler line that you're looking it up (e.g. "Looking into it, user — one sec."). Do NOT answer the question, do NOT summarize, do NOT guess or use your own knowledge — it is stale. STOP after the filler line. The real answer will be delivered to you in a few seconds; speak ONLY that when it arrives.`
    }
  })

  const recallMemory = tool({
    name: 'recall_memory',
    description:
      'Searches YUV long-term memory for prior conversations, user preferences, corrections, past outcomes, learned procedures, or known facts. Use when the user asks what they previously said, refers to an earlier event, or when past experience could materially improve the answer.',
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
      'Stores a durable memory only when the user explicitly asks YUV to remember something, states a stable preference, teaches a reusable procedure, or corrects a previous belief. Do not store passwords, API keys, payment details, or other secrets.',
    parameters: z.object({
      content: z
        .string()
        .describe('The durable fact, preference, correction, or procedure to remember.'),
      kind: z
        .enum(['semantic', 'procedural', 'self'])
        .describe(
          'semantic=fact/preference, procedural=how-to, self=YUV capability or limitation.'
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
      'Checks a claim against YUV stored memories, including contradictory experiences and evidence. This audits internal consistency only. Use live web search as well when the claim is current or externally verifiable.',
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

  const learnRelationship = tool({
    name: 'learn_relationship',
    description:
      'Extracts one stable subject-predicate-object relationship from an explicit user statement or verified tool result. Use for durable entity knowledge, corrections, and time-bounded facts. Do not infer unstated relationships or store secrets.',
    parameters: z.object({
      statement: z.string().describe('The exact source statement supporting this relationship.'),
      subject: entitySchema,
      predicate: z.string().describe('A short relationship such as "works at" or "site price".'),
      object: entitySchema,
      source: z
        .enum(['user', 'tool'])
        .describe('user for an explicit user statement; tool only for a verified tool result.'),
      confidence: z.number().min(0).max(1),
      validFrom: z
        .string()
        .optional()
        .describe('Optional ISO timestamp when the fact became valid.'),
      validTo: z
        .string()
        .optional()
        .describe('Optional ISO timestamp when the fact stopped being valid.')
    }),
    execute: async ({
      statement,
      subject,
      predicate,
      object,
      source,
      confidence,
      validFrom,
      validTo
    }) => {
      const fact = await window.api.knowledge.learn({
        subject,
        predicate,
        object,
        source,
        confidence,
        validFrom,
        validTo,
        evidence: [
          {
            source,
            observedAt: new Date().toISOString(),
            excerpt: statement.slice(0, 240)
          }
        ]
      })
      return JSON.stringify({
        beliefId: fact.beliefId,
        relationship: `${fact.subject.name} ${fact.predicate} ${fact.object.name}`,
        status: fact.status,
        confidence: fact.confidence
      })
    }
  })

  const queryKnowledge = tool({
    name: 'query_knowledge',
    description:
      'Traverses YUV connected entity and belief graph using local semantic-vector recall. Use when the user asks how people, products, projects, places, or concepts are related. Contested facts must be described as uncertain.',
    parameters: z.object({
      query: z.string(),
      atTime: z.string().optional().describe('Optional ISO timestamp for a historical question.'),
      includeContested: z.boolean()
    }),
    execute: async ({ query, atTime, includeContested }) => {
      const result = await window.api.knowledge.query({
        query,
        atTime,
        includeContested,
        limit: 12
      })
      return JSON.stringify({
        entities: result.entities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          kind: entity.kind
        })),
        facts: result.facts.map((fact) => ({
          subject: fact.subject.name,
          predicate: fact.predicate,
          object: fact.object.name,
          status: fact.status,
          confidence: fact.confidence,
          validFrom: fact.validFrom,
          validTo: fact.validTo
        }))
      })
    }
  })

  const inspectEntity = tool({
    name: 'inspect_entity',
    description:
      'Returns every stored relationship for a specific entity ID obtained from query_knowledge.',
    parameters: z.object({ entityId: z.string() }),
    execute: async ({ entityId }) => window.api.knowledge.inspectEntity(entityId)
  })

  const createGoal = tool({
    name: 'create_goal',
    description:
      'Creates a durable goal when the user explicitly asks YUV to pursue, track, or accomplish an outcome. A goal is not permission to execute consequential actions.',
    parameters: z.object({
      title: z.string().describe('Short goal title.'),
      desiredOutcome: z.string().describe('Concrete definition of success.'),
      priority: z.enum(['low', 'normal', 'high', 'critical']),
      constraints: z.array(z.string()).optional()
    }),
    execute: async ({ title, desiredOutcome, priority, constraints }) => {
      const goal = await window.api.planning.createGoal({
        title,
        desiredOutcome,
        priority,
        constraints,
        source: 'user'
      })
      return JSON.stringify({
        id: goal.id,
        title: goal.title,
        status: goal.status
      })
    }
  })

  const planGoal = tool({
    name: 'plan_goal',
    description:
      'Decomposes an existing goal into ordered, inspectable steps. Dependencies use zero-based indexes and may refer only to earlier steps. Mark external communication, deletion, purchases, credential changes, or irreversible actions high risk.',
    parameters: z.object({
      goalId: z.string(),
      steps: z
        .array(
          z.object({
            title: z.string(),
            expectedOutcome: z.string(),
            risk: z.enum(['low', 'medium', 'high', 'critical']),
            requiresApproval: z.boolean(),
            dependsOn: z.array(z.number().int().nonnegative()).optional()
          })
        )
        .min(1)
        .max(30)
    }),
    execute: async ({ goalId, steps }) => {
      const goal = await window.api.planning.setPlan({ goalId, steps })
      return JSON.stringify({
        goalId: goal.id,
        status: goal.status,
        steps: goal.steps.map((step) => ({
          id: step.id,
          title: step.title,
          status: step.status,
          requiresApproval: step.requiresApproval,
          dependsOn: step.dependsOn
        }))
      })
    }
  })

  const reviewGoals = tool({
    name: 'review_goals',
    description:
      'Reviews active and blocked goals and identifies safe next actions. Use before claiming that YUV is continuing or resuming prior work.',
    parameters: z.object({}),
    execute: async () => {
      const [goals, actions] = await Promise.all([
        window.api.planning.listGoals({
          statuses: ['active', 'blocked'],
          limit: 10
        }),
        window.api.planning.nextActions(10)
      ])
      return JSON.stringify({ goals, nextActions: actions })
    }
  })

  const beginGoalStep = tool({
    name: 'begin_goal_step',
    description:
      'Marks a dependency-ready plan step in progress. If it returns waiting_approval, explain the exact action and ask the user for confirmation; do not execute it.',
    parameters: z.object({ goalId: z.string(), stepId: z.string() }),
    execute: async ({ goalId, stepId }) => {
      const step = await window.api.planning.beginStep(goalId, stepId)
      if (step.status === 'waiting_approval') {
        pendingApproval = { goalId, stepId, requestedAt: Date.now() }
      }
      return JSON.stringify({
        id: step.id,
        title: step.title,
        status: step.status,
        risk: step.risk,
        instruction:
          step.status === 'waiting_approval'
            ? 'Stop. Describe this exact action and request explicit user approval.'
            : 'The step may now be attempted using the appropriate capability.'
      })
    }
  })

  const approveGoalStep = tool({
    name: 'approve_goal_step',
    description:
      'Consumes a fresh explicit user confirmation for the exact plan step that is waiting. Call only immediately after the user says yes, approve, proceed, go ahead, or do it in response to the approval question.',
    parameters: z.object({ goalId: z.string(), stepId: z.string() }),
    execute: async ({ goalId, stepId }) => {
      if (
        !pendingApproval ||
        pendingApproval.goalId !== goalId ||
        pendingApproval.stepId !== stepId ||
        !consumeFreshApproval(pendingApproval.requestedAt)
      ) {
        return 'Approval denied: no fresh explicit user confirmation matched this pending step.'
      }
      const step = await window.api.planning.approveStep(goalId, stepId, true)
      pendingApproval = null
      return JSON.stringify({
        id: step.id,
        status: step.status,
        approvedAt: step.approvedAt
      })
    }
  })

  const resolveGoalStep = tool({
    name: 'resolve_goal_step',
    description:
      'Records the observed result of an in-progress goal step. Never report success unless the tool or screen actually confirmed the outcome.',
    parameters: z.object({
      goalId: z.string(),
      stepId: z.string(),
      outcome: z.string(),
      succeeded: z.boolean()
    }),
    execute: async ({ goalId, stepId, outcome, succeeded }) => {
      const result = await window.api.planning.resolveStep(goalId, stepId, outcome, succeeded)
      return JSON.stringify({
        goalStatus: result.goal.status,
        stepStatus: result.step.status,
        reflection: result.reflection
      })
    }
  })

  const updateWorldState = tool({
    name: 'update_world_state',
    description:
      'Updates YUV current world model from a fresh observation. Use only for directly observed application, window, document, device, person, task, object, place, or concept state. Never infer hidden state.',
    parameters: z.object({
      name: z.string(),
      kind: z.enum([
        'person',
        'application',
        'window',
        'document',
        'device',
        'place',
        'task',
        'object',
        'concept'
      ]),
      state: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
      confidence: z.number().min(0).max(1)
    }),
    execute: async ({ name, kind, state, confidence }) => {
      const result = await window.api.runtime.updateWorld({
        name,
        kind,
        state,
        confidence
      })
      return JSON.stringify(result)
    }
  })

  const learnProcedure = tool({
    name: 'learn_procedure',
    description:
      'Stores a reusable procedure from an explicit user demonstration or a task with verified observed success. New procedures remain candidates until repeated successful outcomes verify them.',
    parameters: z.object({
      name: z.string(),
      description: z.string(),
      triggerPhrases: z.array(z.string()).optional(),
      source: z.enum(['user', 'successful-task', 'verified-tool']),
      steps: z
        .array(
          z.object({
            instruction: z.string(),
            expectedOutcome: z.string(),
            risk: z.enum(['low', 'medium', 'high', 'critical'])
          })
        )
        .min(1)
        .max(30)
    }),
    execute: async ({ name, description, triggerPhrases, source, steps }) => {
      const skill = await window.api.runtime.learnSkill({
        name,
        description,
        triggerPhrases,
        demonstration: { source, steps }
      })
      return JSON.stringify({
        id: skill.id,
        name: skill.name,
        status: skill.status,
        confidence: skill.confidence
      })
    }
  })

  const findProcedure = tool({
    name: 'find_procedure',
    description:
      'Finds previously demonstrated procedures relevant to a task. Candidate procedures are guidance only; high-risk procedures always require approval.',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      const matches = await window.api.runtime.matchSkills(query, 5)
      return JSON.stringify(
        matches.map((match) => ({
          id: match.skill.id,
          name: match.skill.name,
          status: match.skill.status,
          confidence: match.skill.confidence,
          steps: match.skill.steps,
          executable: match.executable,
          reason: match.reason
        }))
      )
    }
  })

  const recordProcedureOutcome = tool({
    name: 'record_procedure_outcome',
    description:
      'Updates a learned procedure only after its outcome was directly observed. Never mark success based solely on an attempted action or an assistant claim.',
    parameters: z.object({
      skillId: z.string(),
      succeeded: z.boolean(),
      evidence: z.string().min(1)
    }),
    execute: async ({ skillId, succeeded, evidence }) => {
      const skill = await window.api.runtime.recordSkillOutcome({
        skillId,
        succeeded,
        evidence
      })
      return JSON.stringify({
        id: skill.id,
        status: skill.status,
        confidence: skill.confidence,
        successes: skill.successes,
        failures: skill.failures
      })
    }
  })

  const updateCapability = tool({
    name: 'update_capability_state',
    description:
      'Updates YUV self-model after direct evidence shows a capability is available, degraded, or unavailable. This prevents claiming abilities that are currently broken.',
    parameters: z.object({
      name: z.string(),
      state: z.enum(['available', 'degraded', 'unavailable']),
      confidence: z.number().min(0).max(1),
      evidence: z.string().min(1)
    }),
    execute: async (input) => window.api.runtime.updateCapability(input)
  })

  const auditReasoning = tool({
    name: 'audit_reasoning',
    description:
      'Audits a proposed conclusion before presenting or acting on it. Use for high-stakes, uncertain, contradictory, or multi-step reasoning. Disclose unsupported assumptions and calibrated confidence.',
    parameters: z.object({
      question: z.string(),
      conclusion: z.string(),
      assumptions: z.array(z.string()),
      evidence: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      externallyVerified: z.boolean()
    }),
    execute: async (input) => window.api.runtime.auditReasoning(input)
  })

  const cognitiveStatus = tool({
    name: 'cognitive_status',
    description:
      'Inspects YUV current cognitive runtime, including queued perceptions, world model size, learned skills, reasoning audits, sleep cycles, and emergency-stop state.',
    parameters: z.object({}),
    execute: async () => window.api.runtime.stats()
  })

  return [
    lookAtScreen,
    searchWeb,
    recallMemory,
    rememberThis,
    auditMemory,
    learnRelationship,
    queryKnowledge,
    inspectEntity,
    createGoal,
    planGoal,
    reviewGoals,
    beginGoalStep,
    approveGoalStep,
    resolveGoalStep,
    updateWorldState,
    learnProcedure,
    findProcedure,
    recordProcedureOutcome,
    updateCapability,
    auditReasoning,
    cognitiveStatus,
    ...createControlTools(controlBrain, consumeFreshApproval)
  ]
}

function createControlTools(
  controlBrain: ControlBrain,
  consumeFreshApproval: (requestedAt: number) => boolean
) {
  if (controlBrain === 'realtime') {
    return [clickScreen, typeText, pressKey, scrollScreen]
  }
  return [createControlComputerTool(consumeFreshApproval)]
}

function createControlComputerTool(consumeFreshApproval: (requestedAt: number) => boolean) {
  let pending: { task: string; requestedAt: number } | null = null
  return tool({
    name: 'control_computer',
    description: `Carries out a multi-step task directly on the user's computer — opening apps, clicking, typing, navigating, searching, filling forms. Hand off the WHOLE task in plain language (e.g. "open Chrome and search for pizza", "play Daft Punk on Spotify", "close this window"). A specialist vision agent takes over, sees the screen, does the task step by step, and reports back what it did. Say a short filler line FIRST, then call this; it runs a few seconds.`,
    parameters: z.object({
      task: z
        .string()
        .describe('The full task in plain language, e.g. "open Spotify and play Daft Punk".')
    }),
    execute: async ({ task }) => {
      const consequential =
        /\b(send|post|publish|submit|pay|purchase|buy|delete|erase|refund|install|uninstall|password|otp|account settings|security settings|change budget)\b/i.test(
          task
        )
      let approved = false
      if (consequential) {
        if (!pending || pending.task !== task) {
          pending = { task, requestedAt: Date.now() }
          return `Approval required. Explain the exact consequential action: "${task}" and ask for explicit confirmation. Do not execute yet.`
        }
        approved = consumeFreshApproval(pending.requestedAt)
        if (!approved)
          return 'Approval denied: no fresh explicit confirmation matched this computer task.'
        pending = null
      }
      window.api.log('Tool', `control_computer: ${task}`)
      const result = await window.api.controlComputer(task, approved)
      void window.api.runtime.ingest({
        modality: 'tool',
        source: 'computer-control',
        content: `Computer task: ${task}\nObserved result: ${result}`,
        confidence: /done|complete|opened|finished/i.test(result) ? 0.78 : 0.45,
        novelty: 0.65,
        urgency: 0.25,
        risk: consequential ? 0.9 : 0.35,
        userDirected: true
      })
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
}

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
      : 'The click failed. Tell the user you could not click right now.'
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
    return ok ? 'Typed the text.' : 'Typing failed. Tell the user you could not type right now.'
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
    return ok ? `Pressed ${keys}.` : 'Key press failed. Tell the user it did not go through.'
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
