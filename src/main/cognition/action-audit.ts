import { randomUUID } from 'node:crypto'
import type { ActionAuditEntry, ActionAuditInput, ActionAuditStatus } from '../../shared/runtime'
import { DurableTextFile, type PersistenceCodec } from './persistence.ts'

type PersistedActionAudit = { version: 1; entries: ActionAuditEntry[] }

export class ActionAuditLog {
  private entries: ActionAuditEntry[] = []
  private writeChain: Promise<void> = Promise.resolve()
  private readonly persistence: DurableTextFile
  private readonly now: () => Date
  private readonly maxEntries: number

  constructor(options: {
    filePath: string
    codec?: PersistenceCodec
    now?: () => Date
    maxEntries?: number
  }) {
    this.persistence = new DurableTextFile(options.filePath, options.codec)
    this.now = options.now ?? (() => new Date())
    this.maxEntries = options.maxEntries ?? 2_000
  }

  async initialize(): Promise<void> {
    const stored = await this.persistence.read()
    if (!stored) return
    const parsed = JSON.parse(stored) as PersistedActionAudit
    if (parsed.version === 1 && Array.isArray(parsed.entries)) {
      this.entries = parsed.entries.slice(-this.maxEntries)
    }
  }

  async record(input: ActionAuditInput): Promise<ActionAuditEntry> {
    const action = input.action.trim()
    if (!action) throw new Error('An audited action needs a description.')
    const entry: ActionAuditEntry = {
      ...input,
      id: randomUUID(),
      action,
      createdAt: input.createdAt ?? this.now().toISOString()
    }
    this.entries.push(entry)
    this.entries = this.entries.slice(-this.maxEntries)
    await this.persist()
    return structuredClone(entry)
  }

  async complete(
    id: string,
    status: Extract<ActionAuditStatus, 'succeeded' | 'failed' | 'cancelled'>,
    detail?: string,
    error?: string
  ): Promise<ActionAuditEntry> {
    const entry = this.entries.find((candidate) => candidate.id === id)
    if (!entry) throw new Error('Action audit entry not found.')
    entry.status = status
    entry.detail = detail ?? entry.detail
    entry.error = error
    entry.completedAt = this.now().toISOString()
    await this.persist()
    return structuredClone(entry)
  }

  list(limit = 200): ActionAuditEntry[] {
    return this.entries
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(1, Math.min(500, limit)))
      .map((entry) => structuredClone(entry))
  }

  async delete(id: string): Promise<boolean> {
    const before = this.entries.length
    this.entries = this.entries.filter((entry) => entry.id !== id)
    if (this.entries.length === before) return false
    await this.persist()
    return true
  }

  async clear(): Promise<void> {
    this.entries = []
    await this.persist()
  }

  private persist(): Promise<void> {
    const snapshot: PersistedActionAudit = { version: 1, entries: this.entries }
    this.writeChain = this.writeChain.then(() =>
      this.persistence.write(JSON.stringify(snapshot, null, 2))
    )
    return this.writeChain
  }
}
