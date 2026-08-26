import type { Evidence, MemorySource } from './cognition'

export type EntityKind =
  'person' | 'organization' | 'product' | 'place' | 'project' | 'concept' | 'event' | 'other'

export type EntityInput = {
  name: string
  kind?: EntityKind
  aliases?: string[]
  attributes?: Record<string, string>
  confidence?: number
}

export type Entity = {
  id: string
  name: string
  normalizedName: string
  kind: EntityKind
  aliases: string[]
  attributes: Record<string, string>
  confidence: number
  mentionCount: number
  createdAt: string
  updatedAt: string
}

export type BeliefStatus = 'active' | 'contested' | 'superseded'

export type BeliefInput = {
  subject: EntityInput
  predicate: string
  object: EntityInput
  source: MemorySource
  confidence?: number
  evidence?: Evidence[]
  memoryIds?: string[]
  validFrom?: string
  validTo?: string
}

export type Belief = {
  id: string
  subjectId: string
  predicate: string
  normalizedPredicate: string
  objectId: string
  source: MemorySource
  confidence: number
  strength: number
  status: BeliefStatus
  evidence: Evidence[]
  memoryIds: string[]
  validFrom?: string
  validTo?: string
  supersedes: string[]
  createdAt: string
  updatedAt: string
}

export type BeliefFact = {
  beliefId: string
  subject: Entity
  predicate: string
  object: Entity
  confidence: number
  strength: number
  status: BeliefStatus
  validFrom?: string
  validTo?: string
  evidenceCount: number
  score?: number
}

export type KnowledgeQuery = {
  query: string
  limit?: number
  atTime?: string
  includeContested?: boolean
  includeSuperseded?: boolean
}

export type KnowledgeQueryResult = {
  entities: Entity[]
  facts: BeliefFact[]
}

export type KnowledgeStats = {
  entities: number
  beliefs: number
  activeBeliefs: number
  contestedBeliefs: number
  supersededBeliefs: number
}
