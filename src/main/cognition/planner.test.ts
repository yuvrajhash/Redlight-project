import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { GoalPlanner } from './planner.ts'

async function createPlanner(now = new Date('2026-08-27T00:00:00.000Z')) {
  const directory = await mkdtemp(join(tmpdir(), 'yuv-planner-'))
  const filePath = join(directory, 'planning.json')
  const planner = new GoalPlanner({ filePath, now: () => now })
  await planner.initialize()
  return { planner, filePath }
}

describe('GoalPlanner', () => {
  it('persists goals and dependency-aware plans', async () => {
    const { planner, filePath } = await createPlanner()
    const goal = await planner.createGoal({
      title: 'Ship the release',
      desiredOutcome: 'A tested release is published',
      priority: 'high'
    })
    const planned = await planner.setPlan({
      goalId: goal.id,
      steps: [
        { title: 'Run tests', expectedOutcome: 'All tests pass' },
        {
          title: 'Publish release',
          expectedOutcome: 'Release is published',
          dependsOn: [0],
          risk: 'high'
        }
      ]
    })

    assert.equal(planned.steps.length, 2)
    assert.deepEqual(planned.steps[1]!.dependsOn, [planned.steps[0]!.id])
    assert.equal(planned.steps[1]!.requiresApproval, true)
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).goals.length, 1)
  })

  it('rejects invalid or forward dependencies', async () => {
    const { planner } = await createPlanner()
    const goal = await planner.createGoal({
      title: 'Goal',
      desiredOutcome: 'Done'
    })

    await assert.rejects(
      planner.setPlan({
        goalId: goal.id,
        steps: [
          { title: 'First', expectedOutcome: 'First done', dependsOn: [1] },
          { title: 'Second', expectedOutcome: 'Second done' }
        ]
      }),
      /earlier zero-based/
    )
  })

  it('offers only dependency-ready actions', async () => {
    const { planner } = await createPlanner()
    const goal = await planner.createGoal({
      title: 'Prepare report',
      desiredOutcome: 'Report sent'
    })
    const planned = await planner.setPlan({
      goalId: goal.id,
      steps: [
        { title: 'Collect data', expectedOutcome: 'Data collected' },
        {
          title: 'Draft report',
          expectedOutcome: 'Draft ready',
          dependsOn: [0]
        }
      ]
    })

    const actions = planner.nextActions()
    assert.equal(actions[0]!.step.id, planned.steps[0]!.id)
    assert.equal(actions[0]!.ready, true)
    assert.equal(actions[1]!.ready, false)
  })

  it('will not start risky actions without explicit approval', async () => {
    const { planner } = await createPlanner()
    const goal = await planner.createGoal({
      title: 'Send update',
      desiredOutcome: 'Update sent'
    })
    const planned = await planner.setPlan({
      goalId: goal.id,
      steps: [
        {
          title: 'Send the message',
          expectedOutcome: 'Recipient receives message',
          risk: 'high'
        }
      ]
    })
    const stepId = planned.steps[0]!.id

    const waiting = await planner.beginStep(goal.id, stepId)
    assert.equal(waiting.status, 'waiting_approval')
    await assert.rejects(planner.approveStep(goal.id, stepId, false), /explicit user confirmation/)
    await planner.approveStep(goal.id, stepId, true)
    const started = await planner.beginStep(goal.id, stepId)
    assert.equal(started.status, 'in_progress')
  })

  it('completes a goal and produces an outcome reflection', async () => {
    const { planner } = await createPlanner()
    const goal = await planner.createGoal({
      title: 'Verify build',
      desiredOutcome: 'Build verified'
    })
    const planned = await planner.setPlan({
      goalId: goal.id,
      steps: [{ title: 'Build app', expectedOutcome: 'Production build succeeds' }]
    })
    await planner.beginStep(goal.id, planned.steps[0]!.id)
    const result = await planner.resolveStep(
      goal.id,
      planned.steps[0]!.id,
      'Production build succeeded',
      true
    )

    assert.equal(result.goal.status, 'completed')
    assert.equal(result.reflection.matched, true)
    assert.match(result.reflection.lesson, /consistent/)
  })

  it('blocks a goal when an action fails', async () => {
    const { planner } = await createPlanner()
    const goal = await planner.createGoal({
      title: 'Deploy',
      desiredOutcome: 'App is live'
    })
    const planned = await planner.setPlan({
      goalId: goal.id,
      steps: [{ title: 'Deploy app', expectedOutcome: 'Deployment succeeds' }]
    })
    await planner.beginStep(goal.id, planned.steps[0]!.id)
    const result = await planner.resolveStep(
      goal.id,
      planned.steps[0]!.id,
      'Deployment failed because credentials were unavailable',
      false
    )

    assert.equal(result.goal.status, 'blocked')
    assert.match(result.reflection.lesson, /diagnosing/)
    assert.equal(planner.stats().blockedGoals, 1)
  })
})
