import type {
  CognitiveContext,
  MemoryQuery,
  MemoryRecordInput,
  ObservationInput
} from '../../shared/cognition'
import { CognitionStore, type CognitionStoreOptions } from './store.ts'

export class CognitiveSystem {
  readonly store: CognitionStore

  constructor(options: CognitionStoreOptions) {
    this.store = new CognitionStore(options)
  }

  initialize(): Promise<void> {
    return this.store.initialize()
  }

  remember(input: MemoryRecordInput) {
    return this.store.remember(input)
  }

  observe(input: ObservationInput) {
    return this.store.observe(input)
  }

  recall(query: MemoryQuery) {
    return this.store.recall(query)
  }

  auditClaim(claim: string) {
    return this.store.auditClaim(claim)
  }

  async context(query: MemoryQuery): Promise<CognitiveContext> {
    const memories = await this.store.recall(query)
    if (!memories.length) return { text: '', memories: [] }
    const text = memories
      .map(
        (memory) =>
          `- [${memory.kind}; confidence ${memory.confidence.toFixed(2)}] ${memory.content}`
      )
      .join('\n')
    return {
      text: `Relevant long-term memory (treat as fallible context, not unquestionable fact):\n${text}`,
      memories
    }
  }
}
