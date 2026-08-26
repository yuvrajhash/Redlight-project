import { config as dotenvConfig } from 'dotenv'
import { join } from 'path'
import { exec } from 'child_process'
import { createServer } from 'http'
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  Tray
} from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
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
  startBackgroundSearch
} from './brains'

dotenvConfig({
  path: app.isPackaged
    ? join(process.resourcesPath, '.env.local')
    : join(app.getAppPath(), '.env.local')
})

const icon = join(__dirname, '../../resources/icon.png')
const REALTIME_MODEL = 'gpt-realtime'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false
let triggerServerStarted = false

function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload))
}

function createMainWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.bounds
  const onboarded = isOnboardingComplete()
  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.feynmanpi.friday')
  Menu.setApplicationMenu(null)
  nativeTheme.themeSource = 'dark'
  logPermissionDiagnostics()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => log.info('[IPC] ping → pong'))
  ipcMain.on('app:log', (_event, scope: string, message: string) => {
    log.info(`[${scope}] ${message}`)
  })

  ipcMain.handle('store:isOnboardingComplete', () => isOnboardingComplete())
  ipcMain.handle('store:setOnboardingComplete', (_event, value: boolean) => {
    setOnboardingComplete(value)
  })
  ipcMain.handle('store:saveApiKey', (_event, service: KnownService, key: string) => {
    saveApiKey(service, key)
  })
  ipcMain.handle('store:getApiKey', (_event, service: KnownService) => getApiKey(service))
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
      body: JSON.stringify({ session: { type: 'realtime', model: REALTIME_MODEL } })
    })
    const text = await res.text()
    if (!res.ok) {
      log.error(`[Realtime] ephemeral key mint failed ${res.status}: ${text.slice(0, 300)}`)
      throw new Error(`OpenAI ephemeral key request failed: ${res.status}`)
    }
    const data = JSON.parse(text) as { value?: string; client_secret?: { value?: string } }
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
  ipcMain.handle('control-computer', async (_event, task: string) => runComputerUseLoop(task))

  ipcMain.handle('complete-onboarding', () => {
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

  autoUpdater.logger = log
  autoUpdater.checkForUpdatesAndNotify()

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
  stopPushToTalk()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
