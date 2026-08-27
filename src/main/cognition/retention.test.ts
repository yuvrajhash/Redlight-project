import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrivacySettings } from '../../shared/control-centre.ts'
import { applyConfiguredRetention } from './retention.ts'

const privacy: PrivacySettings = {
  storeConversationMemory: true,
  storeScreenMemory: true,
  conversationRetentionDays: 30,
  screenRetentionDays: 1
}
const now = new Date('2026-08-27T00:00:00.000Z')

describe('configured memory retention', () => {
  it('applies modality-specific expiry to opted-in private memory', () => {
    const conversation = applyConfiguredRetention({ tags: ['conversation'] }, privacy, now)
    const screen = applyConfiguredRetention({ tags: ['screen-observation'] }, privacy, now)

    assert.equal(conversation.expiresAt, '2026-09-26T00:00:00.000Z')
    assert.equal(screen.expiresAt, '2026-08-28T00:00:00.000Z')
  })

  it('leaves non-private memory retention unchanged', () => {
    const input = { tags: ['reflection'], expiresAt: '2027-01-01T00:00:00.000Z' }
    assert.equal(applyConfiguredRetention(input, privacy, now), input)
  })
})
