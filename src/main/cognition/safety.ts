import type { ActionAuthorization, ActionRisk, RuntimeMode } from '../../shared/runtime'

const CRITICAL_PATTERNS = [
  /\b(send|transfer|pay|purchase|buy)\b.*\b(money|payment|funds?|crypto|order)\b/i,
  /\b(delete|erase|wipe|format)\b.*\b(account|drive|disk|files?|data|history)\b/i,
  /\b(password|otp|one[- ]time password|api key|secret key|seed phrase)\b/i
]
const HIGH_PATTERNS = [
  /\b(send|post|publish|submit)\b.*\b(email|message|form|comment|ad|campaign)\b/i,
  /\b(refund|cancel subscription|change budget|install|uninstall)\b/i,
  /\b(sign in|log in|account settings|security settings)\b/i
]
const MEDIUM_PATTERNS = [/\b(download|upload|rename|move|edit|save|close)\b/i]

export function classifyAction(task: string): ActionRisk {
  if (CRITICAL_PATTERNS.some((pattern) => pattern.test(task))) return 'critical'
  if (HIGH_PATTERNS.some((pattern) => pattern.test(task))) return 'high'
  if (MEDIUM_PATTERNS.some((pattern) => pattern.test(task))) return 'medium'
  return 'low'
}

export class ExecutionSupervisor {
  private mode: RuntimeMode = 'observing'
  private emergencyStopAt: string | null = null

  authorize(task: string, approved: boolean): ActionAuthorization {
    const risk = classifyAction(task)
    if (this.mode === 'emergency_stopped') {
      return {
        allowed: false,
        risk,
        requiresApproval: false,
        reason:
          'Computer control is locked by the emergency stop. The user must explicitly reset it.'
      }
    }
    if (this.mode === 'paused' || this.mode === 'stopped') {
      return {
        allowed: false,
        risk,
        requiresApproval: false,
        reason: `Runtime is ${this.mode}.`
      }
    }
    const requiresApproval = risk === 'high' || risk === 'critical'
    return {
      allowed: !requiresApproval || approved,
      risk,
      requiresApproval,
      reason:
        requiresApproval && !approved
          ? `This is a ${risk}-risk consequential action and requires fresh explicit approval.`
          : 'Action is permitted by the current runtime policy.'
    }
  }

  emergencyStop(now = new Date()): void {
    this.mode = 'emergency_stopped'
    this.emergencyStopAt = now.toISOString()
  }

  reset(userConfirmed: boolean): void {
    if (!userConfirmed) throw new Error('Emergency stop reset requires explicit user confirmation.')
    this.mode = 'observing'
    this.emergencyStopAt = null
  }

  pause(): void {
    if (this.mode !== 'emergency_stopped') this.mode = 'paused'
  }

  resume(): void {
    if (this.mode === 'paused' || this.mode === 'stopped') this.mode = 'observing'
  }

  state(): { mode: RuntimeMode; emergencyStopAt: string | null } {
    return { mode: this.mode, emergencyStopAt: this.emergencyStopAt }
  }
}
