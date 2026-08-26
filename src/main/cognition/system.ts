import type {
  CognitiveContext,
  MemoryQuery,
  MemoryRecordInput,
  ObservationInput
} from '../../shared/cognition'
import type { GoalInput, GoalPlanInput, GoalQuery, GoalStatus } from '../../shared/planning'
import type { BeliefInput, KnowledgeQuery } from '../../shared/knowledge'
import { KnowledgeGraph } from './knowledge-graph.ts'
import { GoalPlanner } from './planner.ts'
import { CognitionStore, type CognitionStoreOptions } from './store.ts'

export type CognitiveSystemOptions = CognitionStoreOptions & {
  planningFilePath?: string
  knowledgeFilePath?: string
}

export class CognitiveSystem {
  readonly store: CognitionStore
  readonly planner: GoalPlanner
  readonly knowledge: KnowledgeGraph

  constructor(options: CognitiveSystemOptions) {
    this.store = new CognitionStore(options)
    this.planner = new GoalPlanner({
      filePath: options.planningFilePath ?? `${options.filePath}.planning`,
      now: options.now
    })
    this.knowledge = new KnowledgeGraph({
      filePath: options.knowledgeFilePath ?? `${options.filePath}.knowledge`,
      now: options.now
    })
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.store.initialize(),
      this.planner.initialize(),
      this.knowledge.initialize()
    ])
  }

  remember(input: MemoryRecordInput) {
    return this.store.remember(input)
  }

  observe(input: ObservationInput) {
    return this.store.observe(input)
  }

  recall(query: MemoryQuery) {
    return this.store.recall(query)
  }

  auditClaim(claim: string) {
    return this.store.auditClaim(claim)
  }

  learnBelief(input: BeliefInput) {
    return this.knowledge.learn(input)
  }

  queryKnowledge(query: KnowledgeQuery) {
    return this.knowledge.query(query)
  }

  inspectEntity(entityId: string) {
    return this.knowledge.inspectEntity(entityId)
  }

  async clearAll(): Promise<void> {
    await Promise.all([this.store.clear(), this.planner.clear(), this.knowledge.clear()])
  }

  createGoal(input: GoalInput) {
    return this.planner.createGoal(input)
  }

  planGoal(input: GoalPlanInput) {
    return this.planner.setPlan(input)
  }

  listGoals(query?: GoalQuery) {
    return this.planner.listGoals(query)
  }

  nextActions(limit?: number) {
    return this.planner.nextActions(limit)
  }

  approveStep(goalId: string, stepId: string, userConfirmed: boolean) {
    return this.planner.approveStep(goalId, stepId, userConfirmed)
  }

  beginStep(goalId: string, stepId: string) {
    return this.planner.beginStep(goalId, stepId)
  }

  async resolveStep(goalId: string, stepId: string, outcome: string, succeeded: boolean) {
    const result = await this.planner.resolveStep(goalId, stepId, outcome, succeeded)
    await this.store.remember({
      kind: 'reflection',
      content: [
        `Goal: ${result.goal.title}`,
        `Action: ${result.step.title}`,
        `Expected: ${result.reflection.expected}`,
        `Observed: ${result.reflection.actual}`,
        `Lesson: ${result.reflection.lesson}`
      ].join('\n'),
      source: 'reflection',
      tags: [
        'goal-reflection',
        succeeded ? 'successful-outcome' : 'failed-outcome',
        result.reflection.matched ? 'prediction-matched' : 'prediction-mismatch'
      ],
      confidence: 0.9,
      salience: succeeded ? 0.7 : 0.85,
      goalIds: [goalId]
    })
    return result
  }

  setGoalStatus(goalId: string, status: GoalStatus) {
    return this.planner.setGoalStatus(goalId, status)
  }

  async context(query: MemoryQuery): Promise<CognitiveContext> {
    const memories = await this.store.recall(query)
    const knowledge = this.knowledge.query({
      query: query.query,
      limit: 8,
      includeContested: true
    })
    const goals = this.planner.listGoals({ statuses: ['active', 'blocked'], limit: 5 })
    const actions = this.planner.nextActions(5)
    const memoryText = memories
      .map(
        (memory) =>
          `- [${memory.kind}; confidence ${memory.confidence.toFixed(2)}] ${memory.content}`
      )
      .join('\n')
    const goalText = goals
      .map((goal) => `- [${goal.status}; ${goal.priority}] ${goal.title}: ${goal.desiredOutcome}`)
      .join('\n')
    const actionText = actions
      .map(
        (action) =>
          `- [${action.ready ? 'ready' : 'waiting'}] ${action.step.title}: ${action.reason}`
      )
      .join('\n')
    const knowledgeText = knowledge.facts
      .map(
        (fact) =>
          `- [${fact.status}; confidence ${fact.confidence.toFixed(2)}] ${fact.subject.name} ${fact.predicate} ${fact.object.name}`
      )
      .join('\n')
    const sections = [
      memoryText
        ? `Relevant long-term memory (treat as fallible context, not unquestionable fact):\n${memoryText}`
        : '',
      knowledgeText
        ? `Connected knowledge (contested relationships must be disclosed):\n${knowledgeText}`
        : '',
      goalText ? `Current goals:\n${goalText}` : '',
      actionText
        ? `Candidate next actions (never bypass approval requirements):\n${actionText}`
        : ''
    ].filter(Boolean)
    return {
      text: sections.join('\n\n'),
      memories
    }
  }
}
