import { normalizeText } from './scoring.ts'

const VECTOR_SIZE = 128

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function features(text: string): string[] {
  const normalized = normalizeText(text)
  const words = normalized.split(' ').filter(Boolean)
  const trigrams: string[] = []
  for (const word of words) {
    const padded = `^${word}$`
    for (let index = 0; index <= padded.length - 3; index++) {
      trigrams.push(padded.slice(index, index + 3))
    }
  }
  return [...words.map((word) => `w:${word}`), ...trigrams.map((item) => `c:${item}`)]
}

export function semanticVector(text: string): number[] {
  const vector = Array<number>(VECTOR_SIZE).fill(0)
  for (const feature of features(text)) {
    const value = hash(feature)
    const index = value % VECTOR_SIZE
    const sign = value & 0x100 ? 1 : -1
    vector[index]! += sign
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return magnitude ? vector.map((value) => value / magnitude) : vector
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || !left.length) return 0
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index++) {
    dot += left[index]! * right[index]!
    leftMagnitude += left[index]! * left[index]!
    rightMagnitude += right[index]! * right[index]!
  }
  if (!leftMagnitude || !rightMagnitude) return 0
  return Math.max(0, dot / Math.sqrt(leftMagnitude * rightMagnitude))
}

export function semanticSimilarity(left: string, right: string): number {
  return cosineSimilarity(semanticVector(left), semanticVector(right))
}
