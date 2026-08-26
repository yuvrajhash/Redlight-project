import { config as dotenvConfig } from 'dotenv'
import { join } from 'path'
import { exec } from 'child_process'
import { createServer } from 'http'
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  Tray
} from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import log from './logger'
import {
  deleteApiKey,
  getApiKey,
  getProviderConfig,
  getUser,
  isOnboardingComplete,
  resetStore,
  saveApiKey,
  setOnboardingComplete,
  setProviderConfig,
  setUser,
  type KnownService,
  type ProviderConfig
} from './store'
import { validateGoogleApiKey, validateOpenAiApiKey } from './validate-key'
import {
  getAccessibilityStatus,
  getMicStatus,
  getScreenStatus,
  logPermissionDiagnostics,
  openAccessibilitySettings,
  openInputMonitoringSettings,
  openMicSettings,
  openScreenSettings,
  relaunchApp,
  requestMicAccess,
  triggerInputMonitoringPrompt
} from './permissions'
import { signInWithGoogle } from './auth'
import {
  captureScreen,
  runComputerAction,
  startPushToTalk,
  stopPushToTalk,
  type ComputerAction
} from './os'
import {
  describeScreen,
  getAgentConfig,
  runComputerUseLoop,
  startBackgroundSearch,
  stopComputerUseLoop
} from './brains'
import { CognitiveSystem } from './cognition/system'
import type { MemoryQuery, MemoryRecordInput, ObservationInput } from '../shared/cognition'
import type { GoalInput, GoalPlanInput, GoalQuery, GoalStatus } from '../shared/planning'
import type { BeliefInput, KnowledgeQuery } from '../shared/knowledge'
import type {
  CapabilityInput,
  PerceptionEventInput,
  ReasoningAuditInput,
  SkillInput,
  SkillOutcome,
  WorldEntityInput
} from '../shared/runtime'

dotenvConfig({
  path: app.isPackaged
    ? join(process.resourcesPath, '.env.local')
    : join(app.getAppPath(), '.env.local')
})

const icon = join(__dirname, '../../resources/icon.png')
const REALTIME_MODEL = 'gpt-realtime'
const COGNITIVE_CONSOLIDATION_MS = 15 * 60 * 1000

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false
let triggerServerStarted = false
let cognition: CognitiveSystem | null = null
let cognitionTimer: NodeJS.Timeout | null = null
let cognitiveCycleTimer: NodeJS.Timeout | null = null

function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload))
}

function createMainWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height, x, y } = primaryDisplay.bounds
  const onboarded = isOnboardingComplete()
  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    type: 'toolbar',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required',
      additionalArguments: [`--onboarding-complete=${onboarded}`]
    }
  })
  if (onboarded) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setSkipTaskbar(false)
    showDesktop(mainWindow)
  }
  wireWindow(mainWindow)
  loadRenderer(mainWindow)
}

function showDesktop(win: BrowserWindow): void {
  if (process.platform !== 'win32') return
  exec(
    'powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"',
    { windowsHide: true },
    (err) => {
      if (err) {
        log.warn(`[startup] MinimizeAll failed: ${err.message}`)
        return
      }
      if (win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  )
}

function wireWindow(win: BrowserWindow): void {
  win.on('ready-to-show', () => {
    win.show()
  })
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
    return false
  })
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

function loadRenderer(win: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startServices(): void {
  if (!triggerServerStarted) {
    startTriggerServer()
    void startPushToTalk((active) => broadcast('push-to-talk', { active }))
    void requestMicAccess()
    triggerServerStarted = true
  }
}

function startTriggerServer(): void {
  const server = createServer((req, res) => {
    if (req.url === '/toggle-panel' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => (body += chunk.toString()))
      req.on('end', () => {
        try {
          const data = JSON.parse(body) as { isOpen?: boolean }
          const isOpen = Boolean(data.isOpen)
          BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('toggle-bottom-panel', isOpen)
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, isOpen }))
        } catch {
          res.writeHead(400)
          res.end('Invalid JSON')
        }
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  server.listen(3210, '127.0.0.1', () => {
    log.info('[Trigger Server] Listening on http://127.0.0.1:3210')
  })
}

function showOrCreateWindow(): void {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].show()
    return
  }
  createMainWindow()
  if (isOnboardingComplete()) {
    startServices()
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.feynmanpi.friday')
  Menu.setApplicationMenu(null)
  nativeTheme.themeSource = 'dark'
  logPermissionDiagnostics()

  cognition = new CognitiveSystem({
    filePath: join(app.getPath('userData'), 'cognition-v1.json'),
    planningFilePath: join(app.getPath('userData'), 'planning-v1.json'),
    knowledgeFilePath: join(app.getPath('userData'), 'knowledge-v1.json'),
    worldFilePath: join(app.getPath('userData'), 'world-v1.json'),
    skillsFilePath: join(app.getPath('userData'), 'skills-v1.json'),
    selfFilePath: join(app.getPath('userData'), 'self-v1.json')
  })
  try {
    await cognition.initialize()
    log.info(`[Cognition] initialized with ${cognition.store.stats().totalMemories} memories`)
  } catch (error) {
    log.error(`[Cognition] failed to load persisted memory; starting empty: ${error}`)
  }
  cognitionTimer = setInterval(() => {
    void cognition
      ?.sleep()
      .then((result) =>
        log.info(`[Cognition] sleep consolidation complete: ${JSON.stringify(result)}`)
      )
      .catch((error) => log.error(`[Cognition] sleep consolidation failed: ${error}`))
  }, COGNITIVE_CONSOLIDATION_MS)
  cognitionTimer.unref()
  cognitiveCycleTimer = setInterval(() => {
    if (!cognition || cognition.runtime.stats().queuedEvents === 0) return
    void cognition.runCycle().catch((error) => log.error(`[Cognition] cycle failed: ${error}`))
  }, 2_000)
  cognitiveCycleTimer.unref()

  globalShortcut.register('CommandOrControl+Shift+F12', () => {
    cognition?.supervisor.emergencyStop()
    stopComputerUseLoop()
    broadcast('computer-control', { active: false, emergencyStopped: true })
    log.warn('[Safety] emergency stop activated')
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => log.info('[IPC] ping → pong'))
  ipcMain.on('app:log', (_event, scope: string, message: string) => {
    log.info(`[${scope}] ${message}`)
  })

  ipcMain.handle('cognition:remember', (_event, input: MemoryRecordInput) =>
    cognition?.remember(input)
  )
  ipcMain.handle('cognition:observe', (_event, input: ObservationInput) =>
    cognition?.observe(input)
  )
  ipcMain.handle('cognition:recall', (_event, query: MemoryQuery) => cognition?.recall(query))
  ipcMain.handle('cognition:context', (_event, query: MemoryQuery) => cognition?.context(query))
  ipcMain.handle('cognition:audit', (_event, claim: string) => cognition?.auditClaim(claim))
  ipcMain.handle('cognition:stats', () => cognition?.store.stats())
  ipcMain.handle('cognition:consolidate', () => cognition?.store.consolidate())
  ipcMain.handle('cognition:clear', () => cognition?.clearAll())
  ipcMain.handle('knowledge:learn', (_event, input: BeliefInput) => cognition?.learnBelief(input))
  ipcMain.handle('knowledge:query', (_event, query: KnowledgeQuery) =>
    cognition?.queryKnowledge(query)
  )
  ipcMain.handle('knowledge:inspectEntity', (_event, entityId: string) =>
    cognition?.inspectEntity(entityId)
  )
  ipcMain.handle('knowledge:stats', () => cognition?.knowledge.stats())
  ipcMain.handle('planning:createGoal', (_event, input: GoalInput) => cognition?.createGoal(input))
  ipcMain.handle('planning:setPlan', (_event, input: GoalPlanInput) => cognition?.planGoal(input))
  ipcMain.handle('planning:listGoals', (_event, query?: GoalQuery) => cognition?.listGoals(query))
  ipcMain.handle('planning:nextActions', (_event, limit?: number) => cognition?.nextActions(limit))
  ipcMain.handle(
    'planning:approveStep',
    (_event, goalId: string, stepId: string, userConfirmed: boolean) =>
      cognition?.approveStep(goalId, stepId, userConfirmed)
  )
  ipcMain.handle('planning:beginStep', (_event, goalId: string, stepId: string) =>
    cognition?.beginStep(goalId, stepId)
  )
  ipcMain.handle(
    'planning:resolveStep',
    (_event, goalId: string, stepId: string, outcome: string, succeeded: boolean) =>
      cognition?.resolveStep(goalId, stepId, outcome, succeeded)
  )
  ipcMain.handle('planning:setGoalStatus', (_event, goalId: string, status: GoalStatus) =>
    cognition?.setGoalStatus(goalId, status)
  )
  ipcMain.handle('planning:stats', () => cognition?.planner.stats())
  ipcMain.handle('runtime:ingest', (_event, input: PerceptionEventInput) =>
    cognition?.ingestPerception(input)
  )
  ipcMain.handle('runtime:cycle', () => cognition?.runCycle())
  ipcMain.handle('runtime:sleep', () => cognition?.sleep())
  ipcMain.handle('runtime:stats', () => cognition?.runtime.stats())
  ipcMain.handle('runtime:updateWorld', (_event, input: WorldEntityInput) =>
    cognition?.updateWorld(input)
  )
  ipcMain.handle('runtime:worldSnapshot', () => cognition?.world.snapshot())
  ipcMain.handle('runtime:learnSkill', (_event, input: SkillInput) => cognition?.learnSkill(input))
  ipcMain.handle('runtime:matchSkills', (_event, query: string, limit?: number) =>
    cognition?.matchSkills(query, limit)
  )
  ipcMain.handle('runtime:recordSkillOutcome', (_event, input: SkillOutcome) =>
    cognition?.recordSkillOutcome(input)
  )
  ipcMain.handle('runtime:updateCapability', (_event, input: CapabilityInput) =>
    cognition?.updateCapability(input)
  )
  ipcMain.handle('runtime:auditReasoning', (_event, input: ReasoningAuditInput) =>
    cognition?.auditReasoning(input)
  )
  ipcMain.handle('runtime:selfSnapshot', () => cognition?.self.snapshot())
  ipcMain.handle('runtime:emergencyStop', () => {
    cognition?.supervisor.emergencyStop()
    stopComputerUseLoop()
    broadcast('computer-control', { active: false, emergencyStopped: true })
  })
  ipcMain.handle('runtime:resetEmergencyStop', (_event, userConfirmed: boolean) =>
    cognition?.supervisor.reset(userConfirmed)
  )

  ipcMain.handle('store:isOnboardingComplete', () => isOnboardingComplete())
  ipcMain.handle('store:setOnboardingComplete', (_event, value: boolean) => {
    setOnboardingComplete(value)
  })
  ipcMain.handle('store:saveApiKey', (_event, service: KnownService, key: string) => {
    saveApiKey(service, key)
  })
  ipcMain.handle('store:deleteApiKey', (_event, service: KnownService) => {
    deleteApiKey(service)
  })
  ipcMain.handle('store:validateGoogleKey', async (_event, key: string) =>
    validateGoogleApiKey(key)
  )
  ipcMain.handle('store:validateOpenAiKey', async (_event, key: string) =>
    validateOpenAiApiKey(key)
  )
  ipcMain.handle('store:getProviderConfig', () => getProviderConfig())
  ipcMain.handle('store:setProviderConfig', (_event, providerConfig: ProviderConfig) =>
    setProviderConfig(providerConfig)
  )
  ipcMain.handle('store:resetStore', () => {
    resetStore()
  })

  ipcMain.handle('permissions:getMicStatus', () => getMicStatus())
  ipcMain.handle('permissions:openMicSettings', () => openMicSettings())
  ipcMain.handle('permissions:getScreenStatus', () => getScreenStatus())
  ipcMain.handle('permissions:openScreenSettings', () => openScreenSettings())
  ipcMain.handle('permissions:getAccessibilityStatus', (_event, prompt?: boolean) =>
    getAccessibilityStatus(prompt)
  )
  ipcMain.handle('permissions:openAccessibilitySettings', () => openAccessibilitySettings())
  ipcMain.handle('permissions:triggerInputMonitoringPrompt', () => triggerInputMonitoringPrompt())
  ipcMain.handle('permissions:openInputMonitoringSettings', () => openInputMonitoringSettings())
  ipcMain.handle('permissions:requestMicAccess', () => requestMicAccess())

  ipcMain.handle('auth:signInWithGoogle', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    try {
      return await signInWithGoogle()
    } finally {
      win?.show()
      win?.focus()
    }
  })
  ipcMain.handle('auth:getUser', () => getUser())
  ipcMain.handle('auth:signOut', () => setUser(null))

  ipcMain.handle('realtime:mintEphemeralKey', async () => {
    const apiKey = getApiKey('openai')
    if (!apiKey) {
      throw new Error('No OpenAI API key found. Complete BYOK onboarding with an OpenAI key.')
    }
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: { type: 'realtime', model: REALTIME_MODEL }
      })
    })
    const text = await res.text()
    if (!res.ok) {
      log.error(`[Realtime] ephemeral key mint failed ${res.status}: ${text.slice(0, 300)}`)
      throw new Error(`OpenAI ephemeral key request failed: ${res.status}`)
    }
    const data = JSON.parse(text) as {
      value?: string
      client_secret?: { value?: string }
    }
    const value = data.value ?? data.client_secret?.value
    if (!value) {
      log.error(`[Realtime] ephemeral key response missing value: ${text.slice(0, 300)}`)
      throw new Error('OpenAI ephemeral key response had no key value.')
    }
    log.info(`[Realtime] ephemeral key minted (model ${REALTIME_MODEL})`)
    return { value, model: REALTIME_MODEL }
  })

  ipcMain.handle('get-agent-config', () => getAgentConfig())
  ipcMain.handle('capture-screen', async () => {
    const image = await captureScreen()
    broadcast('screen-capture-flash')
    log.info('[Vision] look_at_screen (direct) - screenshot captured & injected')
    return { image }
  })
  ipcMain.handle('describe-screen', async (_event, question: string) => {
    broadcast('screen-capture-flash')
    log.info(`[Vision] look_at_screen (subagent) Q: ${question}`)
    try {
      const answer = await describeScreen(question)
      log.info(`[Vision] answer: ${answer}`)
      return answer
    } catch (err) {
      log.error(`[Vision] describeScreen failed: ${err}`)
      return 'I could not make out the screen just now, boss.'
    }
  })
  ipcMain.handle('web-search', (_event, query: string) => startBackgroundSearch(query))
  ipcMain.handle('computer-action', async (_event, action: ComputerAction) => {
    const authorization = cognition?.supervisor.authorize(`direct ${action.action}`, false)
    if (authorization && !authorization.allowed) {
      return { ok: false, error: authorization.reason }
    }
    broadcast('computer-control', { active: true, action: action.action })
    const detail = [
      action.x != null ? `(${action.x},${action.y})` : '',
      action.keys ?? '',
      action.text != null ? JSON.stringify(action.text) : '',
      action.direction ?? ''
    ]
      .filter(Boolean)
      .join(' ')
    log.info(`[Control] action: ${action.action} ${detail}`.trim())
    try {
      await runComputerAction(action)
      return { ok: true }
    } catch (err) {
      log.error(`[Control] action failed: ${err}`)
      return { ok: false, error: String(err) }
    }
  })
  ipcMain.handle('control-computer', async (_event, task: string, approved = false) => {
    const authorization = cognition?.supervisor.authorize(task, approved)
    if (authorization && !authorization.allowed) return `Approval required: ${authorization.reason}`
    return runComputerUseLoop(task)
  })

  ipcMain.handle('complete-onboarding', () => {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      if (getMicStatus() !== 'granted') {
        throw new Error('Microphone permission must be granted before onboarding can finish.')
      }
    }
    if (process.platform === 'darwin') {
      if (getScreenStatus() !== 'granted' || !getAccessibilityStatus(false)) {
        throw new Error(
          'Screen Recording and Accessibility permissions must be granted before onboarding can finish.'
        )
      }
    }
    setOnboardingComplete(true)
    if (process.platform === 'darwin') {
      relaunchApp()
      return
    }
    startServices()
    mainWindow?.setIgnoreMouseEvents(true, { forward: true })
    mainWindow?.setAlwaysOnTop(true, 'screen-saver')
    mainWindow?.setSkipTaskbar(true)
    mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  })

  ipcMain.on('toggle-dynamic-island-panel', (event, isOpen: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.send('toggle-bottom-panel', isOpen)
  })
  ipcMain.on(
    'set-ignore-mouse-events',
    (event, ignore: boolean, options?: { forward?: boolean }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.setIgnoreMouseEvents(ignore, options)
      win?.setAlwaysOnTop(true, 'screen-saver')
    }
  )

  createMainWindow()
  if (isOnboardingComplete()) {
    startServices()
  }

  const trayImage =
    process.platform === 'darwin'
      ? nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
      : icon
  tray = new Tray(trayImage)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Friday',
      click: () => showOrCreateWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setToolTip('Friday')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => showOrCreateWindow())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) showOrCreateWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (cognitionTimer) clearInterval(cognitionTimer)
  cognitionTimer = null
  if (cognitiveCycleTimer) clearInterval(cognitiveCycleTimer)
  cognitiveCycleTimer = null
  globalShortcut.unregisterAll()
  void cognition?.sleep().catch((error) => {
    log.error(`[Cognition] final consolidation failed: ${error}`)
  })
  stopPushToTalk()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
