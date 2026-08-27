import type { CognitionStats, MemoryDetail } from './cognition'
import type { Entity, BeliefFact, KnowledgeStats } from './knowledge'
import type { Goal, PlanningStats } from './planning'
import type {
  ActionAuditEntry,
  CapabilityRecord,
  ReasoningAudit,
  RuntimeStats,
  SkillRecord,
  WorldSnapshot
} from './runtime'

export type PrivacySettings = {
  storeConversationMemory: boolean
  storeScreenMemory: boolean
  conversationRetentionDays: number
  screenRetentionDays: number
}

export type CognitiveControlSnapshot = {
  generatedAt: string
  cognition: CognitionStats
  planning: PlanningStats
  knowledge: KnowledgeStats
  runtime: RuntimeStats
  memories: MemoryDetail[]
  goals: Goal[]
  entities: Entity[]
  facts: BeliefFact[]
  skills: SkillRecord[]
  actions: ActionAuditEntry[]
  world: WorldSnapshot
  capabilities: CapabilityRecord[]
  reasoningAudits: ReasoningAudit[]
  privacy: PrivacySettings
}
