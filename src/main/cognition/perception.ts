import { randomUUID } from 'node:crypto'
import type { PerceptionEvent, PerceptionEventInput } from '../../shared/runtime'
import { clamp01 } from './scoring.ts'

export class PerceptionBuffer {
  private readonly maxEvents: number
  private readonly attentionThreshold: number
  private readonly now: () => Date
  private events: PerceptionEvent[] = []

  constructor(
    options: {
      maxEvents?: number
      attentionThreshold?: number
      now?: () => Date
    } = {}
  ) {
    this.maxEvents = options.maxEvents ?? 500
    this.attentionThreshold = options.attentionThreshold ?? 0.42
    this.now = options.now ?? (() => new Date())
  }

  ingest(input: PerceptionEventInput): PerceptionEvent {
    const content = input.content.trim()
    if (!content) throw new Error('A perception event needs content.')
    const confidence = clamp01(input.confidence ?? 0.75)
    const novelty = clamp01(input.novelty ?? 0.5)
    const urgency = clamp01(input.urgency ?? 0.2)
    const risk = clamp01(input.risk ?? 0.1)
    const userDirected = input.userDirected === true
    const attention = clamp01(
      novelty * 0.28 +
        urgency * 0.24 +
        risk * 0.24 +
        confidence * 0.14 +
        Number(userDirected) * 0.25
    )
    const event: PerceptionEvent = {
      id: randomUUID(),
      modality: input.modality,
      source: input.source.trim() || 'unknown',
      content,
      confidence,
      novelty,
      urgency,
      risk,
      userDirected,
      attention,
      occurredAt: input.occurredAt ?? this.now().toISOString(),
      attributes: { ...(input.attributes ?? {}) }
    }
    this.events.push(event)
    this.events = this.events.slice(-this.maxEvents)
    return structuredClone(event)
  }

  drain(limit = 20): {
    attended: PerceptionEvent[]
    ignored: PerceptionEvent[]
  } {
    const batch = this.events.splice(0, Math.max(1, Math.min(100, limit)))
    const attended = batch
      .filter((event) => event.userDirected || event.attention >= this.attentionThreshold)
      .sort((a, b) => b.attention - a.attention)
    const attendedIds = new Set(attended.map((event) => event.id))
    return {
      attended: structuredClone(attended),
      ignored: structuredClone(batch.filter((event) => !attendedIds.has(event.id)))
    }
  }

  size(): number {
    return this.events.length
  }

  clear(): void {
    this.events = []
  }
}
