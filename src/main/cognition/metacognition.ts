import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  CapabilityInput,
  CapabilityRecord,
  ReasoningAudit,
  ReasoningAuditInput
} from '../../shared/runtime'
import { clamp01, hasNegativePolarity, normalizeText } from './scoring.ts'

type PersistedSelf = {
  version: 1
  capabilities: CapabilityRecord[]
  audits: ReasoningAudit[]
}

export class SelfModel {
  private readonly filePath: string
  private readonly now: () => Date
  private capabilities: CapabilityRecord[] = []
  private audits: ReasoningAudit[] = []
  private writeChain: Promise<void> = Promise.resolve()

  constructor(options: { filePath: string; now?: () => Date }) {
    this.filePath = options.filePath
    this.now = options.now ?? (() => new Date())
  }

  async initialize(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as PersistedSelf
      if (parsed.version !== 1) return
      this.capabilities = Array.isArray(parsed.capabilities) ? parsed.capabilities : []
      this.audits = Array.isArray(parsed.audits) ? parsed.audits.slice(-500) : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async updateCapability(input: CapabilityInput): Promise<CapabilityRecord> {
    const name = input.name.trim()
    if (!name || !input.evidence.trim())
      throw new Error('Capability updates require a name and evidence.')
    const now = this.now().toISOString()
    let record = this.capabilities.find((item) => normalizeText(item.name) === normalizeText(name))
    if (!record) {
      record = {
        ...input,
        name,
        confidence: clamp01(input.confidence ?? 0.7),
        updatedAt: now,
        successes: 0,
        failures: 0
      }
      this.capabilities.push(record)
    } else {
      record.state = input.state
      record.evidence = input.evidence.trim()
      record.confidence = clamp01(input.confidence ?? record.confidence)
      record.updatedAt = now
    }
    await this.persist()
    return structuredClone(record)
  }

  async recordCapabilityOutcome(
    name: string,
    succeeded: boolean,
    evidence: string
  ): Promise<CapabilityRecord> {
    let record = this.capabilities.find((item) => normalizeText(item.name) === normalizeText(name))
    if (!record) {
      record = await this.updateCapability({
        name,
        state: succeeded ? 'available' : 'degraded',
        confidence: 0.55,
        evidence
      })
      record = this.capabilities.find((item) => normalizeText(item.name) === normalizeText(name))!
    }
    if (succeeded) record.successes++
    else record.failures++
    const total = record.successes + record.failures
    record.confidence = clamp01((record.successes + 1) / (total + 2))
    record.state =
      record.failures >= 3 && record.failures > record.successes ? 'degraded' : record.state
    record.evidence = evidence.trim()
    record.updatedAt = this.now().toISOString()
    await this.persist()
    return structuredClone(record)
  }

  async audit(input: ReasoningAuditInput): Promise<ReasoningAudit> {
    if (!input.question.trim() || !input.conclusion.trim()) {
      throw new Error('A reasoning audit needs a question and conclusion.')
    }
    const assumptions = (input.assumptions ?? []).map((value) => value.trim()).filter(Boolean)
    const evidence = (input.evidence ?? []).map((value) => value.trim()).filter(Boolean)
    const issues: string[] = []
    if (!evidence.length) issues.push('No supporting evidence was supplied.')
    if (assumptions.length > evidence.length)
      issues.push('The conclusion relies on more assumptions than evidence.')
    const contradictory = evidence.some(
      (item) =>
        normalizeText(item)
          .split(' ')
          .some((word) => normalizeText(input.conclusion).includes(word)) &&
        hasNegativePolarity(item) !== hasNegativePolarity(input.conclusion)
    )
    if (contradictory)
      issues.push('At least one evidence item appears to contradict the conclusion.')
    if (!input.externallyVerified && input.confidence > 0.85) {
      issues.push('High confidence is not justified without external verification.')
    }
    const calibratedConfidence = clamp01(
      Math.min(input.confidence, input.externallyVerified ? 0.98 : 0.82) -
        Number(!evidence.length) * 0.3 -
        Number(contradictory) * 0.35 -
        Math.min(0.2, Math.max(0, assumptions.length - evidence.length) * 0.05)
    )
    const verdict = contradictory
      ? 'contradictory'
      : !evidence.length
        ? 'unsupported'
        : issues.length
          ? 'uncertain'
          : 'sound'
    const audit: ReasoningAudit = {
      ...input,
      id: randomUUID(),
      assumptions,
      evidence,
      verdict,
      issues,
      calibratedConfidence,
      createdAt: this.now().toISOString()
    }
    this.audits.push(audit)
    this.audits = this.audits.slice(-500)
    await this.persist()
    return structuredClone(audit)
  }

  snapshot(): {
    capabilities: CapabilityRecord[]
    recentAudits: ReasoningAudit[]
  } {
    return {
      capabilities: structuredClone(this.capabilities),
      recentAudits: structuredClone(this.audits.slice(-20).reverse())
    }
  }

  stats(): { capabilities: number; audits: number; degraded: number } {
    return {
      capabilities: this.capabilities.length,
      audits: this.audits.length,
      degraded: this.capabilities.filter((item) => item.state === 'degraded').length
    }
  }

  async clear(): Promise<void> {
    this.capabilities = []
    this.audits = []
    await this.persist()
  }

  private persist(): Promise<void> {
    const snapshot: PersistedSelf = {
      version: 1,
      capabilities: this.capabilities,
      audits: this.audits
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
