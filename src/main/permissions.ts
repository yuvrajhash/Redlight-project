import { app, shell, systemPreferences } from 'electron'
import log from './logger'
import { triggerInputMonitoringPrompt as triggerPttPrompt } from './os'

export type MediaAccessStatus = ReturnType<typeof systemPreferences.getMediaAccessStatus>

export function getMicStatus(): MediaAccessStatus {
  const status = systemPreferences.getMediaAccessStatus('microphone')
  log.info(`[PERMS] mic = ${status}`)
  return status
}

export async function requestMicAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  try {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    log.info(`[PERMS] askForMediaAccess(microphone) → ${granted}`)
    return granted
  } catch (err) {
    log.warn(`[PERMS] askForMediaAccess(microphone) failed: ${err}`)
    return false
  }
}

export function getScreenStatus(): MediaAccessStatus | 'granted' {
  if (process.platform !== 'darwin') return 'granted'
  const status = systemPreferences.getMediaAccessStatus('screen')
  log.info(`[PERMS] screen = ${status}`)
  return status
}

export function getAccessibilityStatus(prompt = false): boolean {
  if (process.platform !== 'darwin') return true
  const trusted = systemPreferences.isTrustedAccessibilityClient(prompt)
  log.info(`[PERMS] accessibility = ${trusted} (prompt=${prompt})`)
  return trusted
}

export function logPermissionDiagnostics(): void {
  log.info('[PERMS] ── startup diagnostics ──')
  log.info(`[PERMS] platform=${process.platform} packaged=${app.isPackaged}`)
  log.info(`[PERMS] execPath=${process.execPath}`)
  log.info(`[PERMS] appPath=${app.getAppPath()}`)
  if (process.platform === 'darwin') {
    log.info(`[PERMS] bundleId=${app.getName()} (id ${process.mas ? 'mas' : 'non-mas'})`)
    log.info(`[PERMS] mic=${systemPreferences.getMediaAccessStatus('microphone')}`)
    log.info(`[PERMS] screen=${systemPreferences.getMediaAccessStatus('screen')}`)
    log.info(`[PERMS] accessibility=${systemPreferences.isTrustedAccessibilityClient(false)}`)
  }
}

export async function openMicSettings(): Promise<void> {
  if (process.platform === 'win32') {
    await shell.openExternal('ms-settings:privacy-microphone')
  } else if (process.platform === 'darwin') {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
    )
  }
}

export async function openScreenSettings(): Promise<void> {
  if (process.platform === 'darwin') {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  }
}

export async function openAccessibilitySettings(): Promise<void> {
  if (process.platform === 'darwin') {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    )
  }
}

export async function openInputMonitoringSettings(): Promise<void> {
  if (process.platform === 'darwin') {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
    )
  }
}

export function relaunchApp(): void {
  app.relaunch()
  app.exit(0)
}

export async function triggerInputMonitoringPrompt(): Promise<void> {
  await triggerPttPrompt()
}
