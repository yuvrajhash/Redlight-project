import { randomUUID } from 'node:crypto'
import type {
  Belief,
  BeliefFact,
  BeliefInput,
  Entity,
  EntityInput,
  KnowledgeQuery,
  KnowledgeQueryResult,
  KnowledgeStats
} from '../../shared/knowledge'
import { clamp01, normalizeText, recencyScore } from './scoring.ts'
import { semanticSimilarity } from './semantic-vector.ts'
import { DurableTextFile, type PersistenceCodec } from './persistence.ts'

const SENSITIVE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(?:password|passcode|api[_ -]?key|secret|auth(?:entication)?[_ -]?token)\s*[:=]/i,
  /\b(?:sk|pk)_(?:live|test)_[a-z0-9]{12,}\b/i,
  /\bsk-[a-z0-9_-]{16,}\b/i,
  /\b(?:otp|one[- ]time password)\s*[:=]?\s*\d{4,8}\b/i,
  /\b(?:\d[ -]*?){13,19}\b/
]

type PersistedKnowledge = {
  version: 1
  entities: Entity[]
  beliefs: Belief[]
}

export type KnowledgeGraphOptions = {
  filePath: string
  now?: () => Date
  maxEntities?: number
  maxBeliefs?: number
  codec?: PersistenceCodec
}

export class KnowledgeGraph {
  private readonly now: () => Date
  private readonly maxEntities: number
  private readonly maxBeliefs: number
  private entities: Entity[] = []
  private beliefs: Belief[] = []
  private writeChain: Promise<void> = Promise.resolve()
  private readonly persistence: DurableTextFile

  constructor(options: KnowledgeGraphOptions) {
    this.now = options.now ?? (() => new Date())
    this.maxEntities = options.maxEntities ?? 20_000
    this.maxBeliefs = options.maxBeliefs ?? 50_000
    this.persistence = new DurableTextFile(options.filePath, options.codec)
  }

  async initialize(): Promise<void> {
    try {
      const stored = await this.persistence.read()
      if (!stored) return
      const parsed = JSON.parse(stored) as PersistedKnowledge
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.entities) ||
        !Array.isArray(parsed.beliefs)
      ) {
        return
      }
      this.entities = parsed.entities
      this.beliefs = parsed.beliefs
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async learn(input: BeliefInput): Promise<BeliefFact> {
    const predicate = input.predicate.trim()
    if (!predicate) throw new Error('A relationship predicate is required.')
    if (this.containsSensitiveMaterial(input)) {
      throw new Error('Sensitive credentials or financial data cannot be stored in knowledge.')
    }
    if (normalizeText(input.subject.name) === normalizeText(input.object.name)) {
      throw new Error('A belief must connect two distinct entities.')
    }
    this.validateValidity(input.validFrom, input.validTo)
    const newEntityCount = new Set(
      [input.subject, input.object]
        .filter((entity) => !this.findEntity(entity))
        .map((entity) => normalizeText(entity.name))
    ).size
    if (this.entities.length + newEntityCount > this.maxEntities) {
      throw new Error('Knowledge graph entity capacity reached.')
    }
    const subject = this.upsertEntity(input.subject)
    const object = this.upsertEntity(input.object)
    if (subject.id === object.id) throw new Error('A belief must connect two distinct entities.')
    const normalizedPredicate = normalizeText(predicate)
    const now = this.now().toISOString()
    const confidence = clamp01(input.confidence ?? 0.8)
    const duplicate = this.beliefs.find(
      (belief) =>
        belief.subjectId === subject.id &&
        belief.objectId === object.id &&
        belief.normalizedPredicate === normalizedPredicate &&
        belief.status !== 'superseded' &&
        this.sameValidity(belief, input)
    )
    if (duplicate) {
      duplicate.confidence = Math.max(duplicate.confidence, confidence)
      duplicate.strength = Math.min(10, duplicate.strength + 1)
      duplicate.evidence = [...duplicate.evidence, ...(input.evidence ?? [])].slice(-30)
      duplicate.memoryIds = [...new Set([...duplicate.memoryIds, ...(input.memoryIds ?? [])])]
      duplicate.updatedAt = now
      this.reconcileConflicts(duplicate, now)
      await this.persist()
      return this.toFact(duplicate)
    }

    if (this.beliefs.length >= this.maxBeliefs) {
      throw new Error('Knowledge graph belief capacity reached.')
    }

    const belief: Belief = {
      id: randomUUID(),
      subjectId: subject.id,
      predicate,
      normalizedPredicate,
      objectId: object.id,
      source: input.source,
      confidence,
      strength: 1,
      status: 'active',
      evidence: input.evidence ?? [
        {
          source: input.source,
          observedAt: now,
          excerpt: `${subject.name} ${predicate} ${object.name}`
        }
      ],
      memoryIds: [...new Set(input.memoryIds ?? [])],
      validFrom: input.validFrom,
      validTo: input.validTo,
      supersedes: [],
      createdAt: now,
      updatedAt: now
    }

    this.reconcileConflicts(belief, now)
    this.beliefs.push(belief)
    await this.persist()
    return this.toFact(belief)
  }

  query(input: KnowledgeQuery): KnowledgeQueryResult {
    const query = input.query.trim()
    if (!query) return { entities: [], facts: [] }
    const limit = Math.max(1, Math.min(50, input.limit ?? 10))
    const atTime = input.atTime ? Date.parse(input.atTime) : this.now().getTime()
    if (!Number.isFinite(atTime)) throw new Error('Knowledge query time is invalid.')
    const entityScores = this.entities
      .map((entity) => ({
        entity,
        score: semanticSimilarity(query, this.entityText(entity))
      }))
      .filter(({ score }) => score >= 0.12)
      .sort((left, right) => right.score - left.score)
    const seedIds = new Set(entityScores.slice(0, 8).map(({ entity }) => entity.id))
    const facts = this.beliefs
      .filter((belief) => input.includeSuperseded || belief.status !== 'superseded')
      .filter((belief) => input.includeContested || belief.status !== 'contested')
      .filter((belief) => this.isValidAt(belief, atTime))
      .map((belief) => {
        const fact = this.toFact(belief)
        const sentence = `${fact.subject.name} ${fact.predicate} ${fact.object.name}`
        const direct = semanticSimilarity(query, sentence)
        const connected = seedIds.has(belief.subjectId) || seedIds.has(belief.objectId) ? 0.18 : 0
        const confidence = belief.confidence * 0.12
        const reinforcement = Math.min(1, belief.strength / 5) * 0.08
        const recency = recencyScore(belief.updatedAt, this.now().getTime()) * 0.06
        const statusPenalty = belief.status === 'contested' ? 0.75 : 1
        return {
          ...fact,
          score: (direct * 0.56 + connected + confidence + reinforcement + recency) * statusPenalty
        }
      })
      .filter((fact) => (fact.score ?? 0) >= 0.18)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, limit)
    return {
      entities: entityScores
        .map(({ entity }) => entity)
        .slice(0, limit)
        .map((entity) => structuredClone(entity)),
      facts
    }
  }

  inspectEntity(entityId: string): KnowledgeQueryResult {
    const entity = this.entities.find((candidate) => candidate.id === entityId)
    if (!entity) throw new Error('Entity not found.')
    const facts = this.beliefs
      .filter((belief) => belief.subjectId === entityId || belief.objectId === entityId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((belief) => this.toFact(belief))
    return { entities: [structuredClone(entity)], facts }
  }

  stats(): KnowledgeStats {
    return {
      entities: this.entities.length,
      beliefs: this.beliefs.length,
      activeBeliefs: this.beliefs.filter((belief) => belief.status === 'active').length,
      contestedBeliefs: this.beliefs.filter((belief) => belief.status === 'contested').length,
      supersededBeliefs: this.beliefs.filter((belief) => belief.status === 'superseded').length
    }
  }

  async clear(): Promise<void> {
    this.entities = []
    this.beliefs = []
    await this.persist()
  }

  private upsertEntity(input: EntityInput): Entity {
    const name = input.name.trim()
    if (!name) throw new Error('An entity name is required.')
    const normalizedName = normalizeText(name)
    const existing = this.findEntity(input)
    const now = this.now().toISOString()
    if (existing) {
      existing.aliases = [
        ...new Set([
          ...existing.aliases,
          ...(input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
          ...(existing.name !== name ? [name] : [])
        ])
      ]
      existing.attributes = {
        ...existing.attributes,
        ...(input.attributes ?? {})
      }
      existing.confidence = Math.max(existing.confidence, clamp01(input.confidence ?? 0.8))
      existing.mentionCount++
      existing.updatedAt = now
      return existing
    }
    const entity: Entity = {
      id: randomUUID(),
      name,
      normalizedName,
      kind: input.kind ?? 'other',
      aliases: [...new Set((input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))],
      attributes: input.attributes ?? {},
      confidence: clamp01(input.confidence ?? 0.8),
      mentionCount: 1,
      createdAt: now,
      updatedAt: now
    }
    this.entities.push(entity)
    return entity
  }

  private containsSensitiveMaterial(input: BeliefInput): boolean {
    const text = [
      input.subject.name,
      ...(input.subject.aliases ?? []),
      ...Object.values(input.subject.attributes ?? {}),
      input.predicate,
      input.object.name,
      ...(input.object.aliases ?? []),
      ...Object.values(input.object.attributes ?? {}),
      ...(input.evidence ?? []).map((item) => item.excerpt ?? '')
    ].join(' ')
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))
  }

  private findEntity(input: EntityInput): Entity | undefined {
    const normalizedName = normalizeText(input.name)
    const normalizedAliases = (input.aliases ?? []).map(normalizeText)
    return this.entities.find(
      (entity) =>
        entity.normalizedName === normalizedName ||
        entity.aliases.some((alias) => normalizedName === normalizeText(alias)) ||
        normalizedAliases.includes(entity.normalizedName)
    )
  }

  private reconcileConflicts(belief: Belief, now: string): void {
    const conflicts = this.beliefs.filter(
      (candidate) =>
        candidate.id !== belief.id &&
        candidate.subjectId === belief.subjectId &&
        candidate.normalizedPredicate === belief.normalizedPredicate &&
        candidate.objectId !== belief.objectId &&
        candidate.status !== 'superseded' &&
        this.validityOverlaps(candidate, belief)
    )
    belief.status = 'active'
    for (const conflict of conflicts) {
      if (belief.confidence > conflict.confidence + 0.1) {
        conflict.status = 'superseded'
        conflict.updatedAt = now
        belief.supersedes = [...new Set([...belief.supersedes, conflict.id])]
      } else if (conflict.confidence > belief.confidence + 0.1) {
        belief.status = 'contested'
      } else {
        conflict.status = 'contested'
        conflict.updatedAt = now
        belief.status = 'contested'
      }
    }
  }

  private toFact(belief: Belief): BeliefFact {
    const subject = this.entities.find((entity) => entity.id === belief.subjectId)
    const object = this.entities.find((entity) => entity.id === belief.objectId)
    if (!subject || !object) throw new Error('Knowledge graph contains a dangling relationship.')
    return {
      beliefId: belief.id,
      subject: structuredClone(subject),
      predicate: belief.predicate,
      object: structuredClone(object),
      confidence: belief.confidence,
      strength: belief.strength,
      status: belief.status,
      validFrom: belief.validFrom,
      validTo: belief.validTo,
      evidenceCount: belief.evidence.length
    }
  }

  private entityText(entity: Entity): string {
    return [
      entity.name,
      ...entity.aliases,
      ...Object.entries(entity.attributes).flatMap(([key, value]) => [key, value])
    ].join(' ')
  }

  private sameValidity(
    belief: Pick<Belief, 'validFrom' | 'validTo'>,
    input: Pick<BeliefInput, 'validFrom' | 'validTo'>
  ): boolean {
    return belief.validFrom === input.validFrom && belief.validTo === input.validTo
  }

  private validateValidity(validFrom?: string, validTo?: string): void {
    const start = validFrom ? Date.parse(validFrom) : Number.NEGATIVE_INFINITY
    const end = validTo ? Date.parse(validTo) : Number.POSITIVE_INFINITY
    if (!Number.isFinite(start) && start !== Number.NEGATIVE_INFINITY) {
      throw new Error('Belief validFrom must be an ISO-compatible timestamp.')
    }
    if (!Number.isFinite(end) && end !== Number.POSITIVE_INFINITY) {
      throw new Error('Belief validTo must be an ISO-compatible timestamp.')
    }
    if (start >= end) throw new Error('Belief validFrom must be earlier than validTo.')
  }

  private validityOverlaps(
    left: Pick<Belief, 'validFrom' | 'validTo'>,
    right: Pick<Belief, 'validFrom' | 'validTo'>
  ): boolean {
    const leftStart = left.validFrom ? Date.parse(left.validFrom) : Number.NEGATIVE_INFINITY
    const leftEnd = left.validTo ? Date.parse(left.validTo) : Number.POSITIVE_INFINITY
    const rightStart = right.validFrom ? Date.parse(right.validFrom) : Number.NEGATIVE_INFINITY
    const rightEnd = right.validTo ? Date.parse(right.validTo) : Number.POSITIVE_INFINITY
    return leftStart < rightEnd && rightStart < leftEnd
  }

  private isValidAt(belief: Pick<Belief, 'validFrom' | 'validTo'>, atTime: number): boolean {
    const startsBefore = !belief.validFrom || Date.parse(belief.validFrom) <= atTime
    const endsAfter = !belief.validTo || Date.parse(belief.validTo) > atTime
    return startsBefore && endsAfter
  }

  private persist(): Promise<void> {
    const snapshot: PersistedKnowledge = {
      version: 1,
      entities: this.entities,
      beliefs: this.beliefs
    }
    this.writeChain = this.writeChain.then(async () => {
      await this.persistence.write(JSON.stringify(snapshot, null, 2))
    })
    return this.writeChain
  }
}
