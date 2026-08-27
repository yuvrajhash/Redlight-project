import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ActionAuditLog } from './action-audit.ts'

test('persists action authorization and observed outcomes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yuv-actions-'))
  const filePath = join(directory, 'actions.json')
  const log = new ActionAuditLog({ filePath })
  const started = await log.record({
    action: 'Open settings',
    source: 'direct-control',
    risk: 'low',
    requiredApproval: false,
    approved: true,
    status: 'authorized'
  })
  await log.complete(started.id, 'succeeded', 'Settings opened.')

  const reloaded = new ActionAuditLog({ filePath })
  await reloaded.initialize()
  assert.equal(reloaded.list()[0].status, 'succeeded')
  assert.equal(reloaded.list()[0].detail, 'Settings opened.')
})

test('supports granular action-history deletion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yuv-actions-'))
  const log = new ActionAuditLog({ filePath: join(directory, 'actions.json') })
  const entry = await log.record({
    action: 'Delete a file',
    source: 'safety',
    risk: 'high',
    requiredApproval: true,
    approved: false,
    status: 'blocked'
  })
  assert.equal(await log.delete(entry.id), true)
  assert.deepEqual(log.list(), [])
})
