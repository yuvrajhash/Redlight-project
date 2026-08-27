export type MemoryKind = 'episodic' | 'semantic' | 'procedural' | 'self' | 'reflection'

export type MemorySource = 'user' | 'assistant' | 'screen' | 'tool' | 'system' | 'reflection'

export type Evidence = {
  source: MemorySource
  reference?: string
  observedAt: string
  excerpt?: string
}

export type MemoryRecordInput = {
  kind: MemoryKind
  content: string
  source: MemorySource
  tags?: string[]
  confidence?: number
  salience?: number
  goalIds?: string[]
  evidence?: Evidence[]
  expiresAt?: string
}

export type ObservationInput = Omit<MemoryRecordInput, 'kind'> & {
  kind?: MemoryKind
  novelty?: number
  risk?: number
  userDirected?: boolean
}

export type MemoryQuery = {
  query: string
  limit?: number
  kinds?: MemoryKind[]
  minConfidence?: number
  includeArchived?: boolean
  includeRecent?: boolean
}

export type MemorySummary = {
  id: string
  kind: MemoryKind
  content: string
  tags: string[]
  confidence: number
  salience: number
  createdAt: string
  updatedAt: string
  evidenceCount: number
  score?: number
}

export type MemoryStatus = 'active' | 'archived'

export type MemoryDetail = MemorySummary & {
  source: MemorySource
  goalIds: string[]
  evidence: Evidence[]
  status: MemoryStatus
  lastAccessedAt: string
  accessCount: number
  reinforcement: number
  expiresAt?: string
}

export type MemoryListQuery = {
  kinds?: MemoryKind[]
  statuses?: MemoryStatus[]
  text?: string
  limit?: number
}

export type MemoryUpdate = {
  content?: string
  tags?: string[]
  confidence?: number
  salience?: number
  status?: MemoryStatus
  expiresAt?: string | null
}

export type CognitionStats = {
  totalMemories: number
  activeMemories: number
  archivedMemories: number
  workingMemoryItems: number
  byKind: Record<MemoryKind, number>
  lastConsolidatedAt: string | null
}

export type ConsolidationResult = {
  merged: number
  archived: number
  removedExpired: number
  remaining: number
  completedAt: string
}

export type CognitiveContext = {
  text: string
  memories: MemorySummary[]
}

export type MemoryAuditResult = {
  claim: string
  verdict: 'supported' | 'contradicted' | 'contested' | 'insufficient'
  confidence: number
  supporting: MemorySummary[]
  conflicting: MemorySummary[]
  explanation: string
}
