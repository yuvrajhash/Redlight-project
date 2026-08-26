import type { ActionRisk } from './planning'
export type { ActionRisk } from './planning'

export type PerceptionModality = 'language' | 'vision' | 'audio' | 'application' | 'system' | 'tool'

export type PerceptionEventInput = {
  modality: PerceptionModality
  source: string
  content: string
  confidence?: number
  novelty?: number
  urgency?: number
  risk?: number
  userDirected?: boolean
  occurredAt?: string
  attributes?: Record<string, string | number | boolean>
}

export type PerceptionEvent = Required<
  Pick<PerceptionEventInput, 'modality' | 'source' | 'content' | 'occurredAt'>
> & {
  id: string
  confidence: number
  novelty: number
  urgency: number
  risk: number
  userDirected: boolean
  attention: number
  attributes: Record<string, string | number | boolean>
}

export type WorldEntityKind =
  | 'person'
  | 'application'
  | 'window'
  | 'document'
  | 'device'
  | 'place'
  | 'task'
  | 'object'
  | 'concept'

export type WorldEntityInput = {
  externalId?: string
  name: string
  kind: WorldEntityKind
  state?: Record<string, string | number | boolean | null>
  confidence?: number
  sourceEventId?: string
}

export type WorldEntity = {
  id: string
  externalId?: string
  name: string
  kind: WorldEntityKind
  state: Record<string, string | number | boolean | null>
  confidence: number
  firstObservedAt: string
  lastObservedAt: string
  sourceEventIds: string[]
}

export type WorldChange = {
  id: string
  entityId: string
  property: string
  previous: string | number | boolean | null | undefined
  current: string | number | boolean | null
  observedAt: string
  sourceEventId?: string
}

export type WorldSnapshot = {
  capturedAt: string
  entities: WorldEntity[]
  recentChanges: WorldChange[]
}

export type SkillStep = {
  instruction: string
  expectedOutcome: string
  risk: ActionRisk
}

export type SkillDemonstration = {
  steps: SkillStep[]
  context?: string[]
  source: 'user' | 'successful-task' | 'verified-tool'
}

export type SkillInput = {
  name: string
  description: string
  triggerPhrases?: string[]
  demonstration: SkillDemonstration
}

export type SkillRecord = {
  id: string
  name: string
  description: string
  triggerPhrases: string[]
  demonstrations: SkillDemonstration[]
  steps: SkillStep[]
  status: 'candidate' | 'verified' | 'disabled'
  confidence: number
  successes: number
  failures: number
  createdAt: string
  updatedAt: string
}

export type SkillMatch = {
  skill: SkillRecord
  score: number
  executable: boolean
  reason: string
}

export type SkillOutcome = {
  skillId: string
  succeeded: boolean
  evidence: string
  observedAt?: string
}

export type CapabilityState = 'available' | 'degraded' | 'unavailable'

export type CapabilityInput = {
  name: string
  state: CapabilityState
  confidence?: number
  evidence: string
}

export type CapabilityRecord = Omit<CapabilityInput, 'confidence'> & {
  confidence: number
  updatedAt: string
  successes: number
  failures: number
}

export type ReasoningAuditInput = {
  question: string
  conclusion: string
  assumptions?: string[]
  evidence?: string[]
  confidence: number
  externallyVerified?: boolean
}

export type ReasoningAudit = ReasoningAuditInput & {
  id: string
  verdict: 'sound' | 'uncertain' | 'unsupported' | 'contradictory'
  issues: string[]
  calibratedConfidence: number
  createdAt: string
}

export type RuntimeMode = 'stopped' | 'observing' | 'paused' | 'emergency_stopped'

export type CognitiveCycleResult = {
  id: string
  startedAt: string
  completedAt: string
  attendedEvents: PerceptionEvent[]
  ignoredEventCount: number
  worldChanges: WorldChange[]
  candidateActions: Array<{
    goalId: string
    stepId: string
    title: string
    ready: boolean
    requiresApproval: boolean
  }>
  skillMatches: Array<{ skillId: string; name: string; score: number }>
  warnings: string[]
}

export type RuntimeStats = {
  mode: RuntimeMode
  queuedEvents: number
  totalCycles: number
  worldEntities: number
  learnedSkills: number
  verifiedSkills: number
  reasoningAudits: number
  emergencyStopAt: string | null
  lastCycleAt: string | null
  lastSleepAt: string | null
}

export type SleepReport = {
  startedAt: string
  completedAt: string
  memoriesMerged: number
  memoriesArchived: number
  expiredMemoriesRemoved: number
  skillsPromoted: number
  staleWorldEntitiesRemoved: number
  contradictionsReviewed: number
  insights: string[]
}

export type ActionAuthorization = {
  allowed: boolean
  risk: ActionRisk
  requiresApproval: boolean
  reason: string
}
