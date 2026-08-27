import { randomUUID } from 'node:crypto'
import type {
  CognitionStats,
  ConsolidationResult,
  MemoryAuditResult,
  MemoryKind,
  MemoryQuery,
  MemoryRecordInput,
  MemorySummary,
  ObservationInput
} from '../../shared/cognition'
import {
  clamp01,
  hasNegativePolarity,
  inferMemoryKind,
  lexicalSimilarity,
  normalizeText,
  recencyScore,
  scoreAttention
} from './scoring.ts'
import { DurableTextFile, type PersistenceCodec } from './persistence.ts'

type MemoryStatus = 'active' | 'archived'

type MemoryNode = MemorySummary & {
  source: MemoryRecordInput['source']
  goalIds: string[]
  evidence: NonNullable<MemoryRecordInput['evidence']>
  status: MemoryStatus
  lastAccessedAt: string
  accessCount: number
  reinforcement: number
  expiresAt?: string
}

type PersistedCognition = {
  version: 1
  memories: MemoryNode[]
  lastConsolidatedAt: string | null
}

export type CognitionStoreOptions = {
  filePath: string
  now?: () => Date
  maxMemories?: number
  workingMemoryLimit?: number
  attentionThreshold?: number
  codec?: PersistenceCodec
}

const KINDS: MemoryKind[] = ['episodic', 'semantic', 'procedural', 'self', 'reflection']

function blankCounts(): Record<MemoryKind, number> {
  return { episodic: 0, semantic: 0, procedural: 0, self: 0, reflection: 0 }
}

export class CognitionStore {
  private readonly now: () => Date
  private readonly maxMemories: number
  private readonly workingMemoryLimit: number
  private readonly attentionThreshold: number
  private memories: MemoryNode[] = []
  private workingMemory: MemorySummary[] = []
  private lastConsolidatedAt: string | null = null
  private writeChain: Promise<void> = Promise.resolve()
  private readonly persistence: DurableTextFile

  constructor(options: CognitionStoreOptions) {
    this.now = options.now ?? (() => new Date())
    this.maxMemories = options.maxMemories ?? 10_000
    this.workingMemoryLimit = options.workingMemoryLimit ?? 12
    this.attentionThreshold = options.attentionThreshold ?? 0.38
    this.persistence = new DurableTextFile(options.filePath, options.codec)
  }

  async initialize(): Promise<void> {
    try {
      const stored = await this.persistence.read()
      if (!stored) return
      const parsed = JSON.parse(stored) as PersistedCognition
      if (parsed.version !== 1 || !Array.isArray(parsed.memories)) return
      this.memories = parsed.memories.filter((memory) => KINDS.includes(memory.kind))
      this.lastConsolidatedAt = parsed.lastConsolidatedAt ?? null
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw error
    }
  }

  async observe(input: ObservationInput): Promise<MemorySummary | null> {
    const attention = scoreAttention(input)
    const memoryInput: MemoryRecordInput = {
      kind: inferMemoryKind(input),
      content: input.content,
      source: input.source,
      tags: input.tags,
      confidence: input.confidence,
      salience: Math.max(input.salience ?? 0.5, attention),
      goalIds: input.goalIds,
      evidence: input.evidence,
      expiresAt: input.expiresAt
    }
    if (attention < this.attentionThreshold && !input.userDirected) {
      this.toWorkingMemory(memoryInput)
      return null
    }
    return this.remember(memoryInput)
  }

  async remember(input: MemoryRecordInput): Promise<MemorySummary> {
    const content = input.content.trim()
    if (!content) throw new Error('Memory content cannot be empty.')
    const now = this.now().toISOString()
    const node: MemoryNode = {
      id: randomUUID(),
      kind: input.kind,
      content,
      source: input.source,
      tags: [
        ...new Set((input.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))
      ],
      confidence: clamp01(input.confidence ?? 0.75),
      salience: clamp01(input.salience ?? 0.5),
      goalIds: [...new Set(input.goalIds ?? [])],
      evidence: input.evidence ?? [
        {
          source: input.source,
          observedAt: now,
          excerpt: content.slice(0, 240)
        }
      ],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      reinforcement: 1,
      expiresAt: input.expiresAt,
      evidenceCount: input.evidence?.length ?? 1
    }
    this.memories.push(node)
    this.toWorkingMemory(node)
    await this.persist()
    return this.toSummary(node)
  }

  async recall(query: MemoryQuery): Promise<MemorySummary[]> {
    const nowMs = this.now().getTime()
    const kinds = query.kinds ? new Set(query.kinds) : null
    const minConfidence = clamp01(query.minConfidence ?? 0.15)
    const limit = Math.max(1, Math.min(50, query.limit ?? 8))
    const ranked = this.memories
      .filter((memory) => (query.includeArchived ? true : memory.status === 'active'))
      .filter((memory) => !kinds || kinds.has(memory.kind))
      .filter((memory) => memory.confidence >= minConfidence)
      .filter((memory) => !memory.expiresAt || Date.parse(memory.expiresAt) > nowMs)
      .map((memory) => {
        const semantic = lexicalSimilarity(
          query.query,
          `${memory.content} ${memory.tags.join(' ')}`
        )
        let score =
          semantic * 0.56 +
          recencyScore(memory.updatedAt, nowMs) * 0.14 +
          memory.salience * 0.13 +
          memory.confidence * 0.11 +
          Math.min(1, Math.log2(memory.reinforcement + 1) / 4) * 0.06
        if (semantic === 0 && !query.includeRecent) score *= 0.25
        return { memory, score }
      })
      .filter(({ score }) => score >= 0.18)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    const accessedAt = this.now().toISOString()
    for (const { memory } of ranked) {
      memory.lastAccessedAt = accessedAt
      memory.accessCount++
    }
    if (ranked.length) await this.persist()
    return ranked.map(({ memory, score }) => ({
      ...this.toSummary(memory),
      score
    }))
  }

  async auditClaim(claim: string): Promise<MemoryAuditResult> {
    const normalizedClaim = claim.trim()
    if (!normalizedClaim) throw new Error('A claim is required for memory audit.')
    const candidates = await this.recall({
      query: normalizedClaim,
      limit: 12,
      minConfidence: 0.2,
      includeArchived: true
    })
    const claimIsNegative = hasNegativePolarity(normalizedClaim)
    const supporting = candidates.filter(
      (memory) => hasNegativePolarity(memory.content) === claimIsNegative
    )
    const conflicting = candidates.filter(
      (memory) => hasNegativePolarity(memory.content) !== claimIsNegative
    )
    const verdict =
      supporting.length && conflicting.length
        ? 'contested'
        : conflicting.length
          ? 'contradicted'
          : supporting.length
            ? 'supported'
            : 'insufficient'
    const evidence = [...supporting, ...conflicting]
    const confidence = evidence.length
      ? clamp01(
          evidence.reduce((sum, memory) => sum + memory.confidence * (memory.score ?? 0.5), 0) /
            evidence.reduce((sum, memory) => sum + (memory.score ?? 0.5), 0)
        )
      : 0
    const explanation =
      verdict === 'insufficient'
        ? 'No relevant stored evidence was found. External verification is required.'
        : `Found ${supporting.length} supporting and ${conflicting.length} conflicting memories. Memory is fallible; time-sensitive claims still require external verification.`
    return {
      claim: normalizedClaim,
      verdict,
      confidence,
      supporting,
      conflicting,
      explanation
    }
  }

  async consolidate(): Promise<ConsolidationResult> {
    const now = this.now()
    const nowMs = now.getTime()
    let removedExpired = 0
    this.memories = this.memories.filter((memory) => {
      const expired = memory.expiresAt && Date.parse(memory.expiresAt) <= nowMs
      if (expired) removedExpired++
      return !expired
    })

    let merged = 0
    const canonical = new Map<string, MemoryNode>()
    const unique: MemoryNode[] = []
    for (const memory of this.memories) {
      const key = `${memory.kind}:${normalizeText(memory.content)}`
      const existing = canonical.get(key)
      if (!existing) {
        canonical.set(key, memory)
        unique.push(memory)
        continue
      }
      existing.updatedAt =
        memory.updatedAt > existing.updatedAt ? memory.updatedAt : existing.updatedAt
      existing.salience = Math.max(existing.salience, memory.salience)
      existing.confidence = Math.max(existing.confidence, memory.confidence)
      existing.reinforcement += memory.reinforcement
      existing.evidence = [...existing.evidence, ...memory.evidence].slice(-20)
      existing.evidenceCount = existing.evidence.length
      existing.tags = [...new Set([...existing.tags, ...memory.tags])]
      merged++
    }
    this.memories = unique

    let archived = 0
    const active = this.memories.filter((memory) => memory.status === 'active')
    if (active.length > this.maxMemories) {
      const candidates = active
        .map((memory) => ({
          memory,
          retention:
            memory.salience * 0.4 +
            memory.confidence * 0.3 +
            recencyScore(memory.lastAccessedAt, nowMs) * 0.2 +
            Math.min(1, memory.reinforcement / 5) * 0.1
        }))
        .sort((a, b) => a.retention - b.retention)
      for (const { memory } of candidates.slice(0, active.length - this.maxMemories)) {
        memory.status = 'archived'
        archived++
      }
    }

    this.lastConsolidatedAt = now.toISOString()
    await this.persist()
    return {
      merged,
      archived,
      removedExpired,
      remaining: this.memories.length,
      completedAt: this.lastConsolidatedAt
    }
  }

  async clear(): Promise<void> {
    this.memories = []
    this.workingMemory = []
    this.lastConsolidatedAt = null
    await this.persist()
  }

  stats(): CognitionStats {
    const byKind = blankCounts()
    for (const memory of this.memories) byKind[memory.kind]++
    return {
      totalMemories: this.memories.length,
      activeMemories: this.memories.filter((memory) => memory.status === 'active').length,
      archivedMemories: this.memories.filter((memory) => memory.status === 'archived').length,
      workingMemoryItems: this.workingMemory.length,
      byKind,
      lastConsolidatedAt: this.lastConsolidatedAt
    }
  }

  workingMemorySnapshot(): MemorySummary[] {
    return this.workingMemory.map((memory) => ({
      ...memory,
      tags: [...memory.tags]
    }))
  }

  private toWorkingMemory(input: MemoryRecordInput | MemoryNode): MemorySummary {
    const now = this.now().toISOString()
    const summary: MemorySummary = {
      id: 'id' in input ? input.id : randomUUID(),
      kind: input.kind,
      content: input.content.trim(),
      tags: [...(input.tags ?? [])],
      confidence: clamp01(input.confidence ?? 0.75),
      salience: clamp01(input.salience ?? 0.5),
      createdAt: 'createdAt' in input ? input.createdAt : now,
      updatedAt: 'updatedAt' in input ? input.updatedAt : now,
      evidenceCount: 'evidenceCount' in input ? input.evidenceCount : (input.evidence?.length ?? 1)
    }
    this.workingMemory = [
      summary,
      ...this.workingMemory.filter((item) => item.id !== summary.id)
    ].slice(0, this.workingMemoryLimit)
    return summary
  }

  private toSummary(memory: MemoryNode): MemorySummary {
    return {
      id: memory.id,
      kind: memory.kind,
      content: memory.content,
      tags: [...memory.tags],
      confidence: memory.confidence,
      salience: memory.salience,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      evidenceCount: memory.evidenceCount
    }
  }

  private persist(): Promise<void> {
    const snapshot: PersistedCognition = {
      version: 1,
      memories: this.memories,
      lastConsolidatedAt: this.lastConsolidatedAt
    }
    this.writeChain = this.writeChain.then(async () => {
      await this.persistence.write(JSON.stringify(snapshot, null, 2))
    })
    return this.writeChain
  }
}
