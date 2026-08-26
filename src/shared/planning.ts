export type GoalPriority = 'low' | 'normal' | 'high' | 'critical'

export type GoalStatus = 'active' | 'paused' | 'blocked' | 'completed' | 'cancelled'

export type PlanStepStatus =
  'pending' | 'waiting_approval' | 'in_progress' | 'completed' | 'failed' | 'skipped'

export type ActionRisk = 'low' | 'medium' | 'high' | 'critical'

export type GoalInput = {
  title: string
  desiredOutcome: string
  priority?: GoalPriority
  constraints?: string[]
  source?: 'user' | 'assistant'
  targetAt?: string
}

export type PlanStepDraft = {
  title: string
  expectedOutcome: string
  risk?: ActionRisk
  requiresApproval?: boolean
  dependsOn?: number[]
}

export type GoalPlanInput = {
  goalId: string
  steps: PlanStepDraft[]
}

export type PlanStep = {
  id: string
  title: string
  expectedOutcome: string
  actualOutcome?: string
  status: PlanStepStatus
  risk: ActionRisk
  requiresApproval: boolean
  approvedAt?: string
  dependsOn: string[]
  attempts: number
  createdAt: string
  updatedAt: string
}

export type Goal = {
  id: string
  title: string
  desiredOutcome: string
  priority: GoalPriority
  status: GoalStatus
  constraints: string[]
  source: 'user' | 'assistant'
  targetAt?: string
  steps: PlanStep[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type GoalQuery = {
  statuses?: GoalStatus[]
  limit?: number
}

export type NextAction = {
  goalId: string
  goalTitle: string
  step: PlanStep
  ready: boolean
  reason: string
}

export type StepResolution = {
  goal: Goal
  step: PlanStep
  reflection: {
    expected: string
    actual: string
    matched: boolean
    lesson: string
  }
}

export type PlanningStats = {
  totalGoals: number
  activeGoals: number
  blockedGoals: number
  completedGoals: number
  pendingSteps: number
  waitingApprovalSteps: number
}
