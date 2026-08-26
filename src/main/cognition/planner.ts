import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  Goal,
  GoalInput,
  GoalPlanInput,
  GoalQuery,
  GoalStatus,
  NextAction,
  PlanStep,
  PlanningStats,
  StepResolution
} from '../../shared/planning'
import { lexicalSimilarity } from './scoring.ts'

type PersistedPlanning = {
  version: 1
  goals: Goal[]
}

export type GoalPlannerOptions = {
  filePath: string
  now?: () => Date
  maxGoals?: number
}

const TERMINAL_STEP_STATUSES = new Set(['completed', 'failed', 'skipped'])
const VALID_GOAL_STATUSES: GoalStatus[] = ['active', 'paused', 'blocked', 'completed', 'cancelled']

export class GoalPlanner {
  private readonly filePath: string
  private readonly now: () => Date
  private readonly maxGoals: number
  private goals: Goal[] = []
  private writeChain: Promise<void> = Promise.resolve()

  constructor(options: GoalPlannerOptions) {
    this.filePath = options.filePath
    this.now = options.now ?? (() => new Date())
    this.maxGoals = options.maxGoals ?? 100
  }

  async initialize(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as PersistedPlanning
      if (parsed.version !== 1 || !Array.isArray(parsed.goals)) return
      this.goals = parsed.goals.filter((goal) => VALID_GOAL_STATUSES.includes(goal.status))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async createGoal(input: GoalInput): Promise<Goal> {
    const title = input.title.trim()
    const desiredOutcome = input.desiredOutcome.trim()
    if (!title || !desiredOutcome) throw new Error('A goal needs a title and desired outcome.')
    const openGoals = this.goals.filter((goal) => !['completed', 'cancelled'].includes(goal.status))
    if (openGoals.length >= this.maxGoals) {
      throw new Error('Too many open goals. Complete, cancel, or archive an existing goal first.')
    }
    const now = this.now().toISOString()
    const goal: Goal = {
      id: randomUUID(),
      title,
      desiredOutcome,
      priority: input.priority ?? 'normal',
      status: 'active',
      constraints: [
        ...new Set((input.constraints ?? []).map((item) => item.trim()).filter(Boolean))
      ],
      source: input.source ?? 'user',
      targetAt: input.targetAt,
      steps: [],
      createdAt: now,
      updatedAt: now
    }
    this.goals.push(goal)
    await this.persist()
    return this.cloneGoal(goal)
  }

  async setPlan(input: GoalPlanInput): Promise<Goal> {
    const goal = this.requireGoal(input.goalId)
    if (['completed', 'cancelled'].includes(goal.status)) {
      throw new Error('A terminal goal cannot be replanned.')
    }
    if (!input.steps.length || input.steps.length > 30) {
      throw new Error('A plan must contain between 1 and 30 steps.')
    }
    const now = this.now().toISOString()
    const ids = input.steps.map(() => randomUUID())
    goal.steps = input.steps.map((draft, index) => {
      const title = draft.title.trim()
      const expectedOutcome = draft.expectedOutcome.trim()
      if (!title || !expectedOutcome) {
        throw new Error(`Plan step ${index + 1} needs a title and expected outcome.`)
      }
      const dependencies = [...new Set(draft.dependsOn ?? [])]
      if (dependencies.some((dependency) => dependency < 0 || dependency >= index)) {
        throw new Error(
          `Plan step ${index + 1} can depend only on earlier zero-based step indexes.`
        )
      }
      const risk = draft.risk ?? 'low'
      return {
        id: ids[index]!,
        title,
        expectedOutcome,
        status: 'pending',
        risk,
        requiresApproval: draft.requiresApproval === true || risk === 'high' || risk === 'critical',
        dependsOn: dependencies.map((dependency) => ids[dependency]!),
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }
    })
    goal.status = 'active'
    goal.updatedAt = now
    await this.persist()
    return this.cloneGoal(goal)
  }

  listGoals(query: GoalQuery = {}): Goal[] {
    const statuses = query.statuses ? new Set(query.statuses) : null
    const limit = Math.max(1, Math.min(100, query.limit ?? 20))
    return this.goals
      .filter((goal) => !statuses || statuses.has(goal.status))
      .sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority))
      .slice(0, limit)
      .map((goal) => this.cloneGoal(goal))
  }

  nextActions(limit = 5): NextAction[] {
    const actions: NextAction[] = []
    for (const goal of this.listGoals({ statuses: ['active', 'blocked'], limit: 100 })) {
      if (goal.status !== 'active') continue
      for (const step of goal.steps) {
        if (TERMINAL_STEP_STATUSES.has(step.status) || step.status === 'in_progress') continue
        const unmet = step.dependsOn.filter(
          (dependency) =>
            goal.steps.find((candidate) => candidate.id === dependency)?.status !== 'completed'
        )
        const approvalRequired = step.requiresApproval && !step.approvedAt
        actions.push({
          goalId: goal.id,
          goalTitle: goal.title,
          step,
          ready: unmet.length === 0 && !approvalRequired,
          reason: unmet.length
            ? `Waiting for ${unmet.length} prerequisite step(s).`
            : approvalRequired
              ? 'Explicit user approval is required before this action.'
              : 'Dependencies and approval requirements are satisfied.'
        })
      }
    }
    return actions
      .sort((a, b) => Number(b.ready) - Number(a.ready))
      .slice(0, Math.max(1, Math.min(20, limit)))
  }

  async approveStep(goalId: string, stepId: string, userConfirmed: boolean): Promise<PlanStep> {
    if (!userConfirmed) throw new Error('Approval must come from an explicit user confirmation.')
    const { goal, step } = this.requireStep(goalId, stepId)
    if (!step.requiresApproval) throw new Error('This step does not require approval.')
    if (TERMINAL_STEP_STATUSES.has(step.status))
      throw new Error('A finished step cannot be approved.')
    const now = this.now().toISOString()
    step.approvedAt = now
    step.status = 'pending'
    step.updatedAt = now
    goal.status = 'active'
    goal.updatedAt = now
    await this.persist()
    return structuredClone(step)
  }

  async beginStep(goalId: string, stepId: string): Promise<PlanStep> {
    const { goal, step } = this.requireStep(goalId, stepId)
    if (goal.status !== 'active') throw new Error('Only an active goal can start a step.')
    if (TERMINAL_STEP_STATUSES.has(step.status))
      throw new Error('A finished step cannot be started.')
    const unmet = step.dependsOn.filter(
      (dependency) =>
        goal.steps.find((candidate) => candidate.id === dependency)?.status !== 'completed'
    )
    if (unmet.length) throw new Error('This step has incomplete prerequisites.')
    const now = this.now().toISOString()
    if (step.requiresApproval && !step.approvedAt) {
      step.status = 'waiting_approval'
      step.updatedAt = now
      goal.updatedAt = now
      await this.persist()
      return structuredClone(step)
    }
    step.status = 'in_progress'
    step.attempts++
    step.updatedAt = now
    goal.updatedAt = now
    await this.persist()
    return structuredClone(step)
  }

  async resolveStep(
    goalId: string,
    stepId: string,
    outcome: string,
    succeeded: boolean
  ): Promise<StepResolution> {
    const { goal, step } = this.requireStep(goalId, stepId)
    if (step.status !== 'in_progress') throw new Error('Only an in-progress step can be resolved.')
    const actual = outcome.trim()
    if (!actual) throw new Error('A step outcome is required.')
    const now = this.now().toISOString()
    step.actualOutcome = actual
    step.status = succeeded ? 'completed' : 'failed'
    step.updatedAt = now
    const matched = succeeded && lexicalSimilarity(step.expectedOutcome, actual) >= 0.2
    const lesson = succeeded
      ? matched
        ? 'The action produced an outcome consistent with the prediction.'
        : 'The action succeeded, but the observed outcome differed from the prediction.'
      : 'The action failed; revise the plan or retry only after diagnosing the cause.'
    if (!succeeded) goal.status = 'blocked'
    else if (goal.steps.every((candidate) => ['completed', 'skipped'].includes(candidate.status))) {
      goal.status = 'completed'
      goal.completedAt = now
    }
    goal.updatedAt = now
    await this.persist()
    return {
      goal: this.cloneGoal(goal),
      step: structuredClone(step),
      reflection: {
        expected: step.expectedOutcome,
        actual,
        matched,
        lesson
      }
    }
  }

  async setGoalStatus(goalId: string, status: GoalStatus): Promise<Goal> {
    const goal = this.requireGoal(goalId)
    if (goal.status === 'completed' || goal.status === 'cancelled') {
      throw new Error('A terminal goal cannot change status.')
    }
    if (!['active', 'paused', 'cancelled'].includes(status)) {
      throw new Error('Goals can be activated, paused, or cancelled through this operation.')
    }
    const now = this.now().toISOString()
    goal.status = status
    goal.updatedAt = now
    await this.persist()
    return this.cloneGoal(goal)
  }

  stats(): PlanningStats {
    const steps = this.goals.flatMap((goal) => goal.steps)
    return {
      totalGoals: this.goals.length,
      activeGoals: this.goals.filter((goal) => goal.status === 'active').length,
      blockedGoals: this.goals.filter((goal) => goal.status === 'blocked').length,
      completedGoals: this.goals.filter((goal) => goal.status === 'completed').length,
      pendingSteps: steps.filter((step) => step.status === 'pending').length,
      waitingApprovalSteps: steps.filter((step) => step.status === 'waiting_approval').length
    }
  }

  private requireGoal(goalId: string): Goal {
    const goal = this.goals.find((candidate) => candidate.id === goalId)
    if (!goal) throw new Error('Goal not found.')
    return goal
  }

  private requireStep(goalId: string, stepId: string): { goal: Goal; step: PlanStep } {
    const goal = this.requireGoal(goalId)
    const step = goal.steps.find((candidate) => candidate.id === stepId)
    if (!step) throw new Error('Plan step not found.')
    return { goal, step }
  }

  private priorityWeight(priority: Goal['priority']): number {
    return { low: 0, normal: 1, high: 2, critical: 3 }[priority]
  }

  private cloneGoal(goal: Goal): Goal {
    return structuredClone(goal)
  }

  private persist(): Promise<void> {
    const snapshot: PersistedPlanning = { version: 1, goals: this.goals }
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporary = `${this.filePath}.tmp`
      await writeFile(temporary, JSON.stringify(snapshot, null, 2), 'utf8')
      await rename(temporary, this.filePath)
    })
    return this.writeChain
  }
}
