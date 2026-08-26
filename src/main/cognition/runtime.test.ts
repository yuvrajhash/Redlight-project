import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { CognitiveSystem } from './system.ts'
import { PerceptionBuffer } from './perception.ts'
import { ExecutionSupervisor, classifyAction } from './safety.ts'
import { SelfModel } from './metacognition.ts'
import { SkillLibrary } from './skills.ts'
import { WorldModel } from './world-model.ts'

const FIXED_NOW = new Date('2026-08-27T00:00:00.000Z')

async function tempFile(name: string) {
  const directory = await mkdtemp(join(tmpdir(), 'yuv-runtime-'))
  return join(directory, name)
}

describe('Perception and world model', () => {
  it('attends user-directed and risky events while filtering routine noise', () => {
    const buffer = new PerceptionBuffer({
      attentionThreshold: 0.5,
      now: () => FIXED_NOW
    })
    buffer.ingest({
      modality: 'system',
      source: 'clock',
      content: 'Routine clock tick',
      confidence: 0.9,
      novelty: 0,
      urgency: 0,
      risk: 0
    })
    buffer.ingest({
      modality: 'language',
      source: 'user',
      content: 'YUV, inspect this error',
      userDirected: true
    })
    buffer.ingest({
      modality: 'system',
      source: 'security',
      content: 'Credential prompt appeared',
      risk: 1,
      urgency: 0.9
    })

    const result = buffer.drain(10)
    assert.equal(result.attended.length, 2)
    assert.equal(result.ignored.length, 1)
    assert.equal(buffer.size(), 0)
  })

  it('tracks state transitions with provenance and survives reload', async () => {
    const filePath = await tempFile('world.json')
    const world = new WorldModel({ filePath, now: () => FIXED_NOW })
    await world.initialize()
    await world.observe({
      name: 'Chrome',
      kind: 'application',
      state: { status: 'open' },
      sourceEventId: 'event-1'
    })
    const changed = await world.observe({
      name: 'Chrome',
      kind: 'application',
      state: { status: 'closed' },
      sourceEventId: 'event-2'
    })
    assert.equal(changed.changes[0]!.previous, 'open')
    assert.equal(changed.changes[0]!.current, 'closed')

    const reloaded = new WorldModel({ filePath, now: () => FIXED_NOW })
    await reloaded.initialize()
    assert.equal(reloaded.snapshot().entities[0]!.state.status, 'closed')
    assert.deepEqual(reloaded.snapshot().entities[0]!.sourceEventIds, ['event-1', 'event-2'])
  })
})

describe('Procedural learning', () => {
  it('keeps demonstrations as candidates until repeated success verifies them', async () => {
    const library = new SkillLibrary({
      filePath: await tempFile('skills.json'),
      now: () => FIXED_NOW
    })
    await library.initialize()
    const skill = await library.learn({
      name: 'Open project dashboard',
      description: 'Open the dashboard from the desktop',
      triggerPhrases: ['show dashboard'],
      demonstration: {
        source: 'user',
        steps: [
          {
            instruction: 'Open the dashboard',
            expectedOutcome: 'Dashboard is visible',
            risk: 'low'
          }
        ]
      }
    })
    assert.equal(skill.status, 'candidate')
    await library.recordOutcome({
      skillId: skill.id,
      succeeded: true,
      evidence: 'Dashboard was visible'
    })
    const verified = await library.recordOutcome({
      skillId: skill.id,
      succeeded: true,
      evidence: 'Dashboard was visible again'
    })
    assert.equal(verified.status, 'verified')
    assert.equal(library.match('show dashboard')[0]!.executable, true)
  })

  it('never marks a verified high-risk procedure autonomously executable', async () => {
    const library = new SkillLibrary({
      filePath: await tempFile('risky-skills.json'),
      now: () => FIXED_NOW
    })
    await library.initialize()
    const skill = await library.learn({
      name: 'Send payment',
      description: 'Submit a vendor payment',
      demonstration: {
        source: 'verified-tool',
        steps: [
          {
            instruction: 'Submit payment',
            expectedOutcome: 'Payment submitted',
            risk: 'critical'
          }
        ]
      }
    })
    await library.recordOutcome({
      skillId: skill.id,
      succeeded: true,
      evidence: 'Sandbox confirmation'
    })
    await library.recordOutcome({
      skillId: skill.id,
      succeeded: true,
      evidence: 'Second sandbox confirmation'
    })
    const match = library.match('send payment')[0]!
    assert.equal(match.skill.status, 'verified')
    assert.equal(match.executable, false)
    assert.match(match.reason, /approval/)
  })
})

describe('Metacognition and execution safety', () => {
  it('calibrates unsupported and contradictory reasoning downward', async () => {
    const self = new SelfModel({
      filePath: await tempFile('self.json'),
      now: () => FIXED_NOW
    })
    await self.initialize()
    const unsupported = await self.audit({
      question: 'Is it current?',
      conclusion: 'It is current',
      confidence: 0.95
    })
    assert.equal(unsupported.verdict, 'unsupported')
    assert.ok(unsupported.calibratedConfidence < 0.7)

    const contradictory = await self.audit({
      question: 'Did it pass?',
      conclusion: 'The test passed',
      evidence: ['The test did not pass'],
      confidence: 0.9
    })
    assert.equal(contradictory.verdict, 'contradictory')
    assert.ok(contradictory.calibratedConfidence < 0.5)
  })

  it('classifies consequential actions, requires approval, and enforces emergency stop', () => {
    assert.equal(classifyAction('send the payment to the vendor'), 'critical')
    assert.equal(classifyAction('publish this campaign'), 'high')
    assert.equal(classifyAction('open calculator'), 'low')
    const supervisor = new ExecutionSupervisor()
    assert.equal(supervisor.authorize('publish this campaign', false).allowed, false)
    assert.equal(supervisor.authorize('publish this campaign', true).allowed, true)
    supervisor.emergencyStop(FIXED_NOW)
    assert.equal(supervisor.authorize('open calculator', true).allowed, false)
    assert.throws(() => supervisor.reset(false), /explicit user confirmation/)
    supervisor.reset(true)
    assert.equal(supervisor.authorize('open calculator', false).allowed, true)
  })
})

describe('Integrated cognitive runtime', () => {
  it('runs perception, memory, world-state, goals, skills, reflection and sleep as one cycle', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'yuv-integrated-'))
    const system = new CognitiveSystem({
      filePath: join(directory, 'memory.json'),
      planningFilePath: join(directory, 'planning.json'),
      knowledgeFilePath: join(directory, 'knowledge.json'),
      worldFilePath: join(directory, 'world.json'),
      skillsFilePath: join(directory, 'skills.json'),
      selfFilePath: join(directory, 'self.json'),
      now: () => FIXED_NOW
    })
    await system.initialize()
    const goal = await system.createGoal({
      title: 'Diagnose editor',
      desiredOutcome: 'Editor error understood'
    })
    await system.planGoal({
      goalId: goal.id,
      steps: [{ title: 'Inspect error', expectedOutcome: 'Error is identified' }]
    })
    await system.learnSkill({
      name: 'Inspect editor error',
      description: 'Read and classify a visible editor error',
      triggerPhrases: ['inspect error'],
      demonstration: {
        source: 'user',
        steps: [
          {
            instruction: 'Read the error',
            expectedOutcome: 'Error text captured',
            risk: 'low'
          }
        ]
      }
    })
    system.ingestPerception({
      modality: 'vision',
      source: 'screen-capture',
      content: 'The editor displays a TypeScript error',
      confidence: 0.92,
      novelty: 0.9,
      urgency: 0.6,
      userDirected: true,
      attributes: {
        entityName: 'Editor',
        entityKind: 'application',
        'state.status': 'error'
      }
    })

    const cycle = await system.runCycle()
    assert.equal(cycle.attendedEvents.length, 1)
    assert.equal(cycle.worldChanges.length, 1)
    assert.equal(cycle.candidateActions.length, 1)
    assert.equal(cycle.skillMatches[0]!.name, 'Inspect editor error')
    assert.equal(system.world.snapshot().entities[0]!.state.status, 'error')
    assert.ok(system.store.stats().totalMemories >= 1)

    const sleep = await system.sleep()
    assert.equal(sleep.completedAt, FIXED_NOW.toISOString())
    assert.ok(system.store.stats().totalMemories >= 2)
    assert.equal(system.runtime.stats().totalCycles, 1)

    const context = await system.context({
      query: 'editor error',
      includeRecent: true
    })
    assert.match(context.text, /Current world model/)
    assert.match(context.text, /Relevant learned procedures/)
  })

  it('clears every persistent and volatile cognitive subsystem', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'yuv-clear-v4-'))
    const system = new CognitiveSystem({
      filePath: join(directory, 'memory.json'),
      now: () => FIXED_NOW
    })
    await system.initialize()
    await system.updateWorld({
      name: 'YUV',
      kind: 'concept',
      state: { active: true }
    })
    await system.learnSkill({
      name: 'Test skill',
      description: 'A test',
      demonstration: {
        source: 'user',
        steps: [{ instruction: 'Test', expectedOutcome: 'Done', risk: 'low' }]
      }
    })
    await system.updateCapability({
      name: 'vision',
      state: 'available',
      evidence: 'Test succeeded'
    })
    system.ingestPerception({
      modality: 'system',
      source: 'test',
      content: 'Pending event',
      userDirected: true
    })
    await system.clearAll()
    assert.equal(system.world.stats().entities, 0)
    assert.equal(system.skills.stats().total, 0)
    assert.equal(system.self.stats().capabilities, 0)
    assert.equal(system.runtime.stats().queuedEvents, 0)
  })
})
