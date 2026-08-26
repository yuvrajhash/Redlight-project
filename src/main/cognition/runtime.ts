import { randomUUID } from 'node:crypto'
import type {
  CognitiveCycleResult,
  PerceptionEventInput,
  RuntimeStats,
  SleepReport,
  WorldChange,
  WorldEntityInput
} from '../../shared/runtime'
import type { CognitionStore } from './store.ts'
import type { GoalPlanner } from './planner.ts'
import type { KnowledgeGraph } from './knowledge-graph.ts'
import { PerceptionBuffer } from './perception.ts'
import type { SelfModel } from './metacognition.ts'
import type { SkillLibrary } from './skills.ts'
import type { WorldModel } from './world-model.ts'
import type { ExecutionSupervisor } from './safety.ts'

export class CognitiveRuntime {
  private readonly now: () => Date
  private totalCycles = 0
  private lastCycleAt: string | null = null
  private lastSleepAt: string | null = null
  private cycleRunning = false
  readonly perception: PerceptionBuffer
  private readonly parts: {
    store: CognitionStore
    planner: GoalPlanner
    knowledge: KnowledgeGraph
    world: WorldModel
    skills: SkillLibrary
    self: SelfModel
    supervisor: ExecutionSupervisor
    now?: () => Date
  }

  constructor(parts: {
    store: CognitionStore
    planner: GoalPlanner
    knowledge: KnowledgeGraph
    world: WorldModel
    skills: SkillLibrary
    self: SelfModel
    supervisor: ExecutionSupervisor
    now?: () => Date
  }) {
    this.parts = parts
    this.now = parts.now ?? (() => new Date())
    this.perception = new PerceptionBuffer({ now: this.now })
  }

  ingest(input: PerceptionEventInput) {
    return this.perception.ingest(input)
  }

  async updateWorld(input: WorldEntityInput) {
    return this.parts.world.observe(input)
  }

  async cycle(): Promise<CognitiveCycleResult> {
    if (this.cycleRunning) throw new Error('A cognitive cycle is already running.')
    this.cycleRunning = true
    const startedAt = this.now().toISOString()
    try {
      const { attended, ignored } = this.perception.drain(30)
      const worldChanges: WorldChange[] = []
      const warnings: string[] = []
      for (const event of attended) {
        const memorySource = event.source.startsWith('user')
          ? 'user'
          : event.modality === 'vision'
            ? 'screen'
            : event.modality === 'tool'
              ? 'tool'
              : 'system'
        await this.parts.store.observe({
          content: event.content,
          source: memorySource,
          tags: ['perception', event.modality, event.source],
          confidence: event.confidence,
          salience: event.attention,
          novelty: event.novelty,
          risk: event.risk,
          userDirected: event.userDirected,
          evidence: [
            {
              source: memorySource,
              observedAt: event.occurredAt,
              reference: event.id,
              excerpt: event.content.slice(0, 240)
            }
          ]
        })
        const entityName = event.attributes.entityName
        const entityKind = event.attributes.entityKind
        if (typeof entityName === 'string' && typeof entityKind === 'string') {
          const state = Object.fromEntries(
            Object.entries(event.attributes)
              .filter(([key]) => key.startsWith('state.'))
              .map(([key, value]) => [key.slice(6), value])
          )
          const observed = await this.parts.world.observe({
            name: entityName,
            kind: entityKind as WorldEntityInput['kind'],
            state,
            confidence: event.confidence,
            sourceEventId: event.id
          })
          worldChanges.push(...observed.changes)
        }
        if (event.risk >= 0.8)
          warnings.push(`High-risk event requires attention: ${event.content.slice(0, 120)}`)
      }
      const actions = this.parts.planner.nextActions(10)
      const skillMatches = attended
        .flatMap((event) => this.parts.skills.match(event.content, 2))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
      this.totalCycles++
      this.lastCycleAt = this.now().toISOString()
      return {
        id: randomUUID(),
        startedAt,
        completedAt: this.lastCycleAt,
        attendedEvents: attended,
        ignoredEventCount: ignored.length,
        worldChanges,
        candidateActions: actions.map((action) => ({
          goalId: action.goalId,
          stepId: action.step.id,
          title: action.step.title,
          ready: action.ready,
          requiresApproval: action.step.requiresApproval
        })),
        skillMatches: skillMatches.map((match) => ({
          skillId: match.skill.id,
          name: match.skill.name,
          score: match.score
        })),
        warnings
      }
    } finally {
      this.cycleRunning = false
    }
  }

  async sleep(): Promise<SleepReport> {
    const startedAt = this.now().toISOString()
    const memory = await this.parts.store.consolidate()
    const skillsPromoted = await this.parts.skills.promoteEligible()
    const staleWorldEntitiesRemoved = await this.parts.world.pruneStale(30 * 24 * 60 * 60 * 1000)
    const knowledgeStats = this.parts.knowledge.stats()
    const contradictionsReviewed = knowledgeStats.contestedBeliefs
    this.lastSleepAt = this.now().toISOString()
    const insights = [
      memory.merged ? `${memory.merged} duplicate memories were reinforced.` : '',
      skillsPromoted ? `${skillsPromoted} repeatedly successful skills were promoted.` : '',
      contradictionsReviewed
        ? `${contradictionsReviewed} contested beliefs remain visible for review.`
        : ''
    ].filter(Boolean)
    await this.parts.store.remember({
      kind: 'reflection',
      content: `Cognitive consolidation completed. ${insights.join(' ') || 'No material changes were required.'}`,
      source: 'reflection',
      tags: ['sleep-cycle', 'consolidation'],
      confidence: 0.95,
      salience: 0.35
    })
    return {
      startedAt,
      completedAt: this.lastSleepAt,
      memoriesMerged: memory.merged,
      memoriesArchived: memory.archived,
      expiredMemoriesRemoved: memory.removedExpired,
      skillsPromoted,
      staleWorldEntitiesRemoved,
      contradictionsReviewed,
      insights
    }
  }

  stats(): RuntimeStats {
    const skillStats = this.parts.skills.stats()
    const supervisor = this.parts.supervisor.state()
    return {
      mode: supervisor.mode,
      queuedEvents: this.perception.size(),
      totalCycles: this.totalCycles,
      worldEntities: this.parts.world.stats().entities,
      learnedSkills: skillStats.total,
      verifiedSkills: skillStats.verified,
      reasoningAudits: this.parts.self.stats().audits,
      emergencyStopAt: supervisor.emergencyStopAt,
      lastCycleAt: this.lastCycleAt,
      lastSleepAt: this.lastSleepAt
    }
  }

  clearVolatile(): void {
    this.perception.clear()
    this.totalCycles = 0
    this.lastCycleAt = null
    this.lastSleepAt = null
  }
}
