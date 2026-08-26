import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lexicalSimilarity, scoreAttention } from './scoring.ts'

describe('cognitive scoring', () => {
  it('gives direct, risky user observations more attention', () => {
    const background = scoreAttention({
      content: 'The clock changed by one minute.',
      source: 'system',
      novelty: 0.1,
      risk: 0,
      salience: 0.1
    })
    const correction = scoreAttention({
      content: 'Remember that the previous conclusion was wrong.',
      source: 'user',
      novelty: 0.9,
      risk: 0.8,
      salience: 0.9,
      userDirected: true
    })

    assert.ok(correction > 0.9)
    assert.ok(correction > background)
  })

  it('matches related concepts without matching unrelated memories', () => {
    assert.ok(
      lexicalSimilarity('preferred microphone for meetings', 'user prefers the studio microphone') >
        0.2
    )
    assert.equal(lexicalSimilarity('preferred microphone', 'weather forecast tomorrow'), 0)
  })
})
