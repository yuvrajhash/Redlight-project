import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { CognitiveSystem } from './system.ts'

it('links goal outcomes to durable reflection memory and session context', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yuv-system-'))
  const system = new CognitiveSystem({
    filePath: join(directory, 'memory.json'),
    planningFilePath: join(directory, 'planning.json'),
    now: () => new Date('2026-08-27T00:00:00.000Z')
  })
  await system.initialize()
  const goal = await system.createGoal({
    title: 'Test cognition',
    desiredOutcome: 'Cognitive tests pass',
    priority: 'high'
  })
  const planned = await system.planGoal({
    goalId: goal.id,
    steps: [{ title: 'Run tests', expectedOutcome: 'All cognitive tests pass' }]
  })
  await system.beginStep(goal.id, planned.steps[0]!.id)
  await system.resolveStep(goal.id, planned.steps[0]!.id, 'All cognitive tests passed', true)
  await system.learnBelief({
    subject: { name: 'YUV', kind: 'project' },
    predicate: 'uses',
    object: { name: 'cognitive tests', kind: 'concept' },
    source: 'reflection',
    confidence: 0.9
  })

  const reflections = await system.recall({
    query: 'cognitive tests outcome',
    kinds: ['reflection']
  })
  const context = await system.context({
    query: 'cognitive tests',
    includeRecent: true
  })

  assert.equal(reflections.length, 1)
  assert.match(reflections[0]!.content, /Expected:/)
  assert.match(context.text, /goal-reflection|Goal: Test cognition/)
  assert.match(context.text, /YUV uses cognitive tests/)
  assert.equal(system.planner.stats().completedGoals, 1)

  await system.clearAll()
  assert.equal(system.store.stats().totalMemories, 0)
  assert.equal(system.planner.stats().totalGoals, 0)
  assert.equal(system.knowledge.stats().beliefs, 0)
})
