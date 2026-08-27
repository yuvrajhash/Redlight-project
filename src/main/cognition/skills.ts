import { randomUUID } from 'node:crypto'
import type { SkillInput, SkillMatch, SkillOutcome, SkillRecord } from '../../shared/runtime'
import { clamp01, lexicalSimilarity, normalizeText } from './scoring.ts'
import { DurableTextFile, type PersistenceCodec } from './persistence.ts'

type PersistedSkills = { version: 1; skills: SkillRecord[] }

export class SkillLibrary {
  private readonly now: () => Date
  private skills: SkillRecord[] = []
  private writeChain: Promise<void> = Promise.resolve()
  private readonly persistence: DurableTextFile

  constructor(options: { filePath: string; now?: () => Date; codec?: PersistenceCodec }) {
    this.now = options.now ?? (() => new Date())
    this.persistence = new DurableTextFile(options.filePath, options.codec)
  }

  async initialize(): Promise<void> {
    try {
      const stored = await this.persistence.read()
      if (!stored) return
      const parsed = JSON.parse(stored) as PersistedSkills
      if (parsed.version === 1 && Array.isArray(parsed.skills)) this.skills = parsed.skills
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async learn(input: SkillInput): Promise<SkillRecord> {
    const name = input.name.trim()
    const description = input.description.trim()
    if (!name || !description || !input.demonstration.steps.length) {
      throw new Error('A skill needs a name, description, and at least one demonstrated step.')
    }
    if (input.demonstration.steps.length > 30)
      throw new Error('A skill may contain at most 30 steps.')
    const now = this.now().toISOString()
    let skill = this.skills.find(
      (candidate) => normalizeText(candidate.name) === normalizeText(name)
    )
    if (!skill) {
      skill = {
        id: randomUUID(),
        name,
        description,
        triggerPhrases: [],
        demonstrations: [],
        steps: structuredClone(input.demonstration.steps),
        status: 'candidate',
        confidence: 0.45,
        successes: 0,
        failures: 0,
        createdAt: now,
        updatedAt: now
      }
      this.skills.push(skill)
    }
    skill.description = description
    skill.triggerPhrases = [
      ...new Set(
        [...skill.triggerPhrases, ...(input.triggerPhrases ?? [])]
          .map((value) => value.trim())
          .filter(Boolean)
      )
    ]
    skill.demonstrations.push(structuredClone(input.demonstration))
    skill.demonstrations = skill.demonstrations.slice(-10)
    skill.steps = structuredClone(input.demonstration.steps)
    skill.confidence = clamp01(
      skill.confidence + (input.demonstration.source === 'successful-task' ? 0.15 : 0.08)
    )
    skill.updatedAt = now
    await this.persist()
    return structuredClone(skill)
  }

  match(query: string, limit = 5): SkillMatch[] {
    return this.skills
      .filter((skill) => skill.status !== 'disabled')
      .map((skill) => {
        const text = [skill.name, skill.description, ...skill.triggerPhrases].join(' ')
        const score = lexicalSimilarity(query, text) * 0.75 + skill.confidence * 0.25
        const risky = skill.steps.some((step) => step.risk === 'high' || step.risk === 'critical')
        return {
          skill: structuredClone(skill),
          score,
          executable: skill.status === 'verified' && !risky,
          reason:
            skill.status !== 'verified'
              ? 'The skill is still a candidate and needs successful verification.'
              : risky
                ? 'The skill contains consequential steps and requires per-run approval.'
                : 'The skill is verified and contains only low or medium-risk steps.'
        }
      })
      .filter((match) => match.score >= 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(20, limit)))
  }

  async recordOutcome(input: SkillOutcome): Promise<SkillRecord> {
    const skill = this.skills.find((candidate) => candidate.id === input.skillId)
    if (!skill) throw new Error('Skill not found.')
    if (!input.evidence.trim()) throw new Error('Skill outcomes require observed evidence.')
    if (input.succeeded) skill.successes++
    else skill.failures++
    const total = skill.successes + skill.failures
    skill.confidence = clamp01((skill.successes + 1) / (total + 2))
    if (skill.successes >= 2 && skill.failures === 0) skill.status = 'verified'
    if (skill.failures >= 3 && skill.failures > skill.successes) skill.status = 'disabled'
    skill.updatedAt = input.observedAt ?? this.now().toISOString()
    await this.persist()
    return structuredClone(skill)
  }

  async promoteEligible(): Promise<number> {
    let promoted = 0
    for (const skill of this.skills) {
      if (skill.status === 'candidate' && skill.successes >= 2 && skill.failures === 0) {
        skill.status = 'verified'
        promoted++
      }
    }
    if (promoted) await this.persist()
    return promoted
  }

  list(): SkillRecord[] {
    return structuredClone(this.skills)
  }

  async setStatus(skillId: string, status: SkillRecord['status']): Promise<SkillRecord> {
    const skill = this.skills.find((candidate) => candidate.id === skillId)
    if (!skill) throw new Error('Skill not found.')
    if (!['candidate', 'verified', 'disabled'].includes(status)) {
      throw new Error('Invalid skill status.')
    }
    skill.status = status
    skill.updatedAt = this.now().toISOString()
    await this.persist()
    return structuredClone(skill)
  }

  async delete(skillId: string): Promise<boolean> {
    const before = this.skills.length
    this.skills = this.skills.filter((skill) => skill.id !== skillId)
    if (this.skills.length === before) return false
    await this.persist()
    return true
  }

  stats(): { total: number; verified: number; disabled: number } {
    return {
      total: this.skills.length,
      verified: this.skills.filter((skill) => skill.status === 'verified').length,
      disabled: this.skills.filter((skill) => skill.status === 'disabled').length
    }
  }

  async clear(): Promise<void> {
    this.skills = []
    await this.persist()
  }

  private persist(): Promise<void> {
    const snapshot: PersistedSkills = { version: 1, skills: this.skills }
    this.writeChain = this.writeChain.then(async () => {
      await this.persistence.write(JSON.stringify(snapshot, null, 2))
    })
    return this.writeChain
  }
}
