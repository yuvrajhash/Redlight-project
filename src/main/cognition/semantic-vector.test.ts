import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { semanticSimilarity, semanticVector } from './semantic-vector.ts'

describe('local semantic vectors', () => {
  it('produces normalized fixed-size vectors', () => {
    const vector = semanticVector('YUV remembers the user preference')
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    assert.equal(vector.length, 128)
    assert.ok(Math.abs(magnitude - 1) < 0.000001)
  })

  it('ranks related text above unrelated text', () => {
    const related = semanticSimilarity(
      'Rootellect product pricing',
      'pricing for Rootellect products'
    )
    const unrelated = semanticSimilarity('Rootellect product pricing', 'weather in another country')
    assert.ok(related > unrelated)
    assert.ok(related > 0.25)
  })
})
