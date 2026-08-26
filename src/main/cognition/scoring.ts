import type { MemoryKind, ObservationInput } from '../../shared/cognition'

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

export function tokenize(value: string): string[] {
  return (value.toLocaleLowerCase().match(TOKEN_PATTERN) ?? []).filter((token) => token.length > 1)
}

export function lexicalSimilarity(left: string, right: string): number {
  const a = new Set(tokenize(left))
  const b = new Set(tokenize(right))
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection++
  return intersection / Math.sqrt(a.size * b.size)
}

export function recencyScore(timestamp: string, nowMs: number): number {
  const ageMs = Math.max(0, nowMs - Date.parse(timestamp))
  const halfLifeMs = 14 * 24 * 60 * 60 * 1000
  return Math.pow(0.5, ageMs / halfLifeMs)
}

export function scoreAttention(input: ObservationInput): number {
  const sourceWeight = input.source === 'user' ? 0.22 : input.source === 'system' ? 0.08 : 0.14
  const directed = input.userDirected ? 0.28 : 0
  const novelty = clamp01(input.novelty ?? 0.5) * 0.2
  const risk = clamp01(input.risk ?? 0) * 0.22
  const statedSalience = clamp01(input.salience ?? 0.5) * 0.18
  return clamp01(sourceWeight + directed + novelty + risk + statedSalience)
}

export function inferMemoryKind(input: ObservationInput): MemoryKind {
  if (input.kind) return input.kind
  if (input.source === 'assistant' || input.source === 'reflection') return 'reflection'
  if (input.source === 'system') return 'self'
  return 'episodic'
}

export function hasNegativePolarity(value: string): boolean {
  return /\b(no|not|never|incorrect|wrong|false|failed|cannot|can't|won't|isn't|wasn't|no longer)\b/i.test(
    value
  )
}
