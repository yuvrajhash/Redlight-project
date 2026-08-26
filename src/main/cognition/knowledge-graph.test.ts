import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { KnowledgeGraph } from './knowledge-graph.ts'

async function createGraph(now = new Date('2026-08-27T00:00:00.000Z')) {
  const directory = await mkdtemp(join(tmpdir(), 'friday-knowledge-'))
  const filePath = join(directory, 'knowledge.json')
  const graph = new KnowledgeGraph({ filePath, now: () => now })
  await graph.initialize()
  return { graph, filePath }
}

describe('KnowledgeGraph', () => {
  it('merges aliases and reinforces duplicate beliefs', async () => {
    const { graph } = await createGraph()
    const first = await graph.learn({
      subject: { name: 'Rootellect', kind: 'organization' },
      predicate: 'sells',
      object: { name: 'Mind Calm', kind: 'product' },
      source: 'user',
      confidence: 0.8
    })
    const reinforced = await graph.learn({
      subject: { name: 'Rootellect', aliases: ['Rootellect Wellness'] },
      predicate: 'sells',
      object: { name: 'Mind Calm', aliases: ['Mind Calm™'] },
      source: 'user',
      confidence: 0.9
    })

    assert.equal(first.beliefId, reinforced.beliefId)
    assert.equal(reinforced.strength, 2)
    assert.equal(graph.stats().entities, 2)
    assert.equal(graph.stats().beliefs, 1)
  })

  it('supersedes weaker conflicting beliefs with stronger evidence', async () => {
    const { graph } = await createGraph()
    await graph.learn({
      subject: { name: 'Mind Calm', kind: 'product' },
      predicate: 'site price',
      object: { name: '₹999', kind: 'concept' },
      source: 'assistant',
      confidence: 0.55
    })
    const revised = await graph.learn({
      subject: { name: 'Mind Calm', kind: 'product' },
      predicate: 'site price',
      object: { name: '₹1049', kind: 'concept' },
      source: 'user',
      confidence: 0.95
    })

    assert.equal(revised.status, 'active')
    assert.equal(revised.object.name, '₹1049')
    assert.equal(graph.stats().supersededBeliefs, 1)
    assert.equal(graph.query({ query: 'Mind Calm site price' }).facts[0]!.object.name, '₹1049')
  })

  it('marks similarly credible contradictions as contested', async () => {
    const { graph } = await createGraph()
    await graph.learn({
      subject: { name: 'Project Atlas' },
      predicate: 'launch date',
      object: { name: '1 September', kind: 'event' },
      source: 'user',
      confidence: 0.8
    })
    const second = await graph.learn({
      subject: { name: 'Project Atlas' },
      predicate: 'launch date',
      object: { name: '5 September', kind: 'event' },
      source: 'tool',
      confidence: 0.76
    })

    assert.equal(second.status, 'contested')
    assert.equal(graph.stats().contestedBeliefs, 2)
    assert.equal(graph.query({ query: 'Atlas launch', includeContested: true }).facts.length, 2)
  })

  it('revises a contested belief when new evidence makes it stronger', async () => {
    const { graph } = await createGraph()
    await graph.learn({
      subject: { name: 'Project Atlas' },
      predicate: 'launch date',
      object: { name: '1 September', kind: 'event' },
      source: 'assistant',
      confidence: 0.7
    })
    await graph.learn({
      subject: { name: 'Project Atlas' },
      predicate: 'launch date',
      object: { name: '5 September', kind: 'event' },
      source: 'assistant',
      confidence: 0.72
    })
    const reinforced = await graph.learn({
      subject: { name: 'Project Atlas' },
      predicate: 'launch date',
      object: { name: '5 September', kind: 'event' },
      source: 'user',
      confidence: 0.95
    })

    assert.equal(reinforced.status, 'active')
    assert.equal(graph.stats().supersededBeliefs, 1)
  })

  it('keeps non-overlapping historical beliefs without contradiction', async () => {
    const { graph } = await createGraph()
    await graph.learn({
      subject: { name: 'Alex', kind: 'person' },
      predicate: 'works at',
      object: { name: 'Company A', kind: 'organization' },
      source: 'user',
      validTo: '2025-01-01T00:00:00.000Z'
    })
    await graph.learn({
      subject: { name: 'Alex', kind: 'person' },
      predicate: 'works at',
      object: { name: 'Company B', kind: 'organization' },
      source: 'user',
      validFrom: '2025-01-01T00:00:00.000Z'
    })

    assert.equal(graph.stats().activeBeliefs, 2)
    const historical = graph.query({
      query: 'Alex works',
      atTime: '2024-06-01T00:00:00.000Z'
    })
    assert.equal(historical.facts.length, 1)
    assert.equal(historical.facts[0]!.object.name, 'Company A')
  })

  it('retrieves connected facts through semantic graph recall', async () => {
    const { graph } = await createGraph()
    await graph.learn({
      subject: { name: 'Rootellect', kind: 'organization' },
      predicate: 'has hero product',
      object: {
        name: 'Mind Calm',
        kind: 'product',
        attributes: { benefit: 'calmness sleep clarity' }
      },
      source: 'user'
    })

    const result = graph.query({ query: 'calm sleep product' })
    assert.equal(result.facts.length, 1)
    assert.equal(result.facts[0]!.subject.name, 'Rootellect')
  })

  it('rejects credentials and financial secrets structurally', async () => {
    const { graph } = await createGraph()
    await assert.rejects(
      graph.learn({
        subject: { name: 'Production account' },
        predicate: 'api key',
        object: { name: 'sk-example_secret_value_123456789' },
        source: 'user'
      }),
      /cannot be stored/
    )
    assert.equal(graph.stats().beliefs, 0)
    assert.equal(graph.stats().entities, 0)
  })
})
