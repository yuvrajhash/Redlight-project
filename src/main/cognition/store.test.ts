import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { CognitionStore } from './store.ts'

describe('CognitionStore', () => {
  let directory = ''
  let filePath = ''
  let now = new Date('2026-08-27T00:00:00.000Z')

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'yuv-cognition-test-'))
    filePath = join(directory, 'memory.json')
    now = new Date('2026-08-27T00:00:00.000Z')
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('persists typed memories and recalls only relevant content by default', async () => {
    const store = new CognitionStore({ filePath, now: () => now })
    await store.initialize()
    await store.remember({
      kind: 'semantic',
      content: 'The user prefers the studio microphone for meetings.',
      source: 'user',
      tags: ['preference', 'microphone'],
      confidence: 0.96,
      salience: 0.8
    })
    await store.remember({
      kind: 'semantic',
      content: 'Tomorrow may have light rain.',
      source: 'tool',
      tags: ['weather'],
      confidence: 0.7,
      salience: 0.3
    })

    const results = await store.recall({
      query: 'Which microphone does the user prefer?'
    })
    assert.equal(results.length, 1)
    assert.match(results[0]?.content ?? '', /studio microphone/)

    const reloaded = new CognitionStore({ filePath, now: () => now })
    await reloaded.initialize()
    assert.equal(reloaded.stats().totalMemories, 2)
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).version, 1)
  })

  it('keeps low-attention observations in working memory without making them durable', async () => {
    const store = new CognitionStore({
      filePath,
      now: () => now,
      attentionThreshold: 0.6
    })
    const result = await store.observe({
      content: 'A routine background timer ticked.',
      source: 'system',
      novelty: 0,
      risk: 0,
      salience: 0.1
    })

    assert.equal(result, null)
    assert.equal(store.stats().totalMemories, 0)
    assert.equal(store.workingMemorySnapshot().length, 1)
  })

  it('merges reinforced memories and removes expired observations during consolidation', async () => {
    const store = new CognitionStore({ filePath, now: () => now })
    const stableMemory = {
      kind: 'procedural' as const,
      content: 'Open settings before changing the microphone.',
      source: 'tool' as const,
      tags: ['procedure'],
      confidence: 0.8,
      salience: 0.7
    }
    await store.remember(stableMemory)
    await store.remember(stableMemory)
    await store.remember({
      kind: 'episodic',
      content: 'Temporary screen observation.',
      source: 'screen',
      expiresAt: '2026-08-26T00:00:00.000Z'
    })

    const result = await store.consolidate()
    assert.equal(result.merged, 1)
    assert.equal(result.removedExpired, 1)
    assert.equal(result.remaining, 1)
  })

  it('archives the least valuable memories when the active limit is exceeded', async () => {
    const store = new CognitionStore({
      filePath,
      now: () => now,
      maxMemories: 2
    })
    for (let i = 0; i < 3; i++) {
      now = new Date(now.getTime() + 1000)
      await store.remember({
        kind: 'episodic',
        content: `Experience ${i}`,
        source: 'system',
        salience: i / 2,
        confidence: 0.8
      })
    }

    const result = await store.consolidate()
    assert.equal(result.archived, 1)
    assert.equal(store.stats().activeMemories, 2)
    assert.equal(store.stats().archivedMemories, 1)
  })

  it('audits a claim against supporting and conflicting memories', async () => {
    const store = new CognitionStore({ filePath, now: () => now })
    await store.remember({
      kind: 'semantic',
      content: 'The preferred meeting microphone is the studio microphone.',
      source: 'user',
      confidence: 0.95
    })
    await store.remember({
      kind: 'reflection',
      content:
        'The studio microphone is not the preferred meeting microphone after the device change.',
      source: 'assistant',
      confidence: 0.7
    })

    const result = await store.auditClaim(
      'The studio microphone is the preferred meeting microphone.'
    )
    assert.equal(result.verdict, 'contested')
    assert.equal(result.supporting.length, 1)
    assert.equal(result.conflicting.length, 1)
    assert.ok(result.confidence > 0.7)
  })
})
