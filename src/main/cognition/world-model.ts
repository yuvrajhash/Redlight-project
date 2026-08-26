import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  WorldChange,
  WorldEntity,
  WorldEntityInput,
  WorldSnapshot
} from '../../shared/runtime'
import { clamp01, normalizeText } from './scoring.ts'

type PersistedWorld = {
  version: 1
  entities: WorldEntity[]
  changes: WorldChange[]
}

export type WorldModelOptions = {
  filePath: string
  now?: () => Date
  maxChanges?: number
}

export class WorldModel {
  private readonly filePath: string
  private readonly now: () => Date
  private readonly maxChanges: number
  private entities: WorldEntity[] = []
  private changes: WorldChange[] = []
  private writeChain: Promise<void> = Promise.resolve()

  constructor(options: WorldModelOptions) {
    this.filePath = options.filePath
    this.now = options.now ?? (() => new Date())
    this.maxChanges = options.maxChanges ?? 2_000
  }

  async initialize(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as PersistedWorld
      if (parsed.version !== 1 || !Array.isArray(parsed.entities)) return
      this.entities = parsed.entities
      this.changes = Array.isArray(parsed.changes) ? parsed.changes.slice(-this.maxChanges) : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async observe(input: WorldEntityInput): Promise<{ entity: WorldEntity; changes: WorldChange[] }> {
    const name = input.name.trim()
    if (!name) throw new Error('A world entity needs a name.')
    const now = this.now().toISOString()
    const key = input.externalId
      ? `external:${input.externalId}`
      : `${input.kind}:${normalizeText(name)}`
    let entity = this.entities.find((candidate) =>
      input.externalId
        ? candidate.externalId === input.externalId
        : `${candidate.kind}:${normalizeText(candidate.name)}` === key
    )
    const observedChanges: WorldChange[] = []
    if (!entity) {
      entity = {
        id: randomUUID(),
        externalId: input.externalId,
        name,
        kind: input.kind,
        state: {},
        confidence: clamp01(input.confidence ?? 0.75),
        firstObservedAt: now,
        lastObservedAt: now,
        sourceEventIds: []
      }
      this.entities.push(entity)
    }
    for (const [property, current] of Object.entries(input.state ?? {})) {
      const previous = entity.state[property]
      if (previous === current) continue
      const change: WorldChange = {
        id: randomUUID(),
        entityId: entity.id,
        property,
        previous,
        current,
        observedAt: now,
        sourceEventId: input.sourceEventId
      }
      entity.state[property] = current
      this.changes.push(change)
      observedChanges.push(change)
    }
    entity.name = name
    entity.confidence = Math.max(entity.confidence, clamp01(input.confidence ?? 0.75))
    entity.lastObservedAt = now
    if (input.sourceEventId) {
      entity.sourceEventIds = [...new Set([...entity.sourceEventIds, input.sourceEventId])].slice(
        -20
      )
    }
    this.changes = this.changes.slice(-this.maxChanges)
    await this.persist()
    return {
      entity: structuredClone(entity),
      changes: structuredClone(observedChanges)
    }
  }

  snapshot(limit = 100): WorldSnapshot {
    return {
      capturedAt: this.now().toISOString(),
      entities: structuredClone(
        [...this.entities]
          .sort((a, b) => b.lastObservedAt.localeCompare(a.lastObservedAt))
          .slice(0, Math.max(1, Math.min(500, limit)))
      ),
      recentChanges: structuredClone(this.changes.slice(-50).reverse())
    }
  }

  find(query: string, limit = 10): WorldEntity[] {
    const terms = new Set(normalizeText(query).split(' ').filter(Boolean))
    return structuredClone(
      this.entities
        .map((entity) => {
          const haystack = normalizeText(
            `${entity.name} ${entity.kind} ${JSON.stringify(entity.state)}`
          )
          const score =
            [...terms].filter((term) => haystack.includes(term)).length / Math.max(1, terms.size)
          return { entity, score }
        })
        .filter(({ score }) => score > 0)
        .sort(
          (a, b) =>
            b.score - a.score || b.entity.lastObservedAt.localeCompare(a.entity.lastObservedAt)
        )
        .slice(0, Math.max(1, Math.min(50, limit)))
        .map(({ entity }) => entity)
    )
  }

  async pruneStale(maxAgeMs: number): Promise<number> {
    const cutoff = this.now().getTime() - Math.max(0, maxAgeMs)
    const before = this.entities.length
    this.entities = this.entities.filter(
      (entity) => entity.kind === 'person' || Date.parse(entity.lastObservedAt) >= cutoff
    )
    const removed = before - this.entities.length
    if (removed) await this.persist()
    return removed
  }

  stats(): { entities: number; changes: number } {
    return { entities: this.entities.length, changes: this.changes.length }
  }

  async clear(): Promise<void> {
    this.entities = []
    this.changes = []
    await this.persist()
  }

  private persist(): Promise<void> {
    const snapshot: PersistedWorld = {
      version: 1,
      entities: this.entities,
      changes: this.changes
    }
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporary = `${this.filePath}.tmp`
      await writeFile(temporary, JSON.stringify(snapshot, null, 2), 'utf8')
      await rename(temporary, this.filePath)
    })
    return this.writeChain
  }
}
