import type { PrivacySettings } from '../../shared/control-centre'

const DAY_MS = 24 * 60 * 60 * 1000

export function applyConfiguredRetention<T extends { tags?: string[]; expiresAt?: string }>(
  input: T,
  privacy: PrivacySettings,
  now: Date = new Date()
): T & { expiresAt?: string } {
  const tags = input.tags ?? []
  const retentionDays = tags.includes('conversation')
    ? privacy.conversationRetentionDays
    : tags.includes('screen-observation')
      ? privacy.screenRetentionDays
      : null
  if (retentionDays === null) return input
  return {
    ...input,
    expiresAt: new Date(now.getTime() + retentionDays * DAY_MS).toISOString()
  }
}
