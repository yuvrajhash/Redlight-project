import { app, desktopCapturer, screen } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import log from './logger'

export type ComputerAction = {
  action: 'move' | 'click' | 'double_click' | 'right_click' | 'type' | 'key' | 'scroll' | 'drag'
  x?: number
  y?: number
  text?: string
  keys?: string
  direction?: 'up' | 'down'
  amount?: number
  path?: Array<{ x: number; y: number }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NutModule = any

let nut: NutModule | null = null
let nutLoadFailed = false

async function primaryScreenSource(thumbnailSize: { width: number; height: number }) {
  const primary = screen.getPrimaryDisplay()
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize })
  if (sources.length === 0) throw new Error('No screen sources available')
  const source = sources.find((candidate) => candidate.display_id === String(primary.id))
  if (!source) {
    throw new Error('The primary display could not be matched to a screen-capture source.')
  }
  return source
}

export async function captureScreen(): Promise<string> {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scale = Math.min(1, 1280 / Math.max(width, height))
  const thumbnailSize = {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
  const source = await primaryScreenSource(thumbnailSize)
  const jpeg = source.thumbnail.toJPEG(70)
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

export async function captureScreenForControl(): Promise<{
  image: string
  width: number
  height: number
}> {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scale = Math.min(1, 1920 / Math.max(width, height))
  const source = await primaryScreenSource({
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  })
  const size = source.thumbnail.getSize()
  const jpeg = source.thumbnail.toJPEG(80)
  return {
    image: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    width: size.width,
    height: size.height
  }
}

async function getNut(): Promise<NutModule | null> {
  if (nut || nutLoadFailed) return nut
  try {
    const mod = await import('@nut-tree-fork/nut-js')
    nut = mod
    nut.mouse.config.autoDelayMs = 2
    nut.keyboard.config.autoDelayMs = 2
    log.info('[Control] nut.js loaded - input injection ready')
  } catch (err) {
    nutLoadFailed = true
    log.error(`[Control] Failed to load nut.js - input injection disabled: ${err}`)
  }
  return nut
}

function resolveKeys(n: NutModule, combo: string): unknown[] {
  const { Key } = n
  const map: Record<string, unknown> = {
    ctrl: Key.LeftControl,
    control: Key.LeftControl,
    alt: Key.LeftAlt,
    option: Key.LeftAlt,
    shift: Key.LeftShift,
    cmd: Key.LeftSuper,
    win: Key.LeftSuper,
    super: Key.LeftSuper,
    meta: Key.LeftSuper,
    enter: Key.Enter,
    return: Key.Enter,
    tab: Key.Tab,
    esc: Key.Escape,
    escape: Key.Escape,
    backspace: Key.Backspace,
    delete: Key.Delete,
    del: Key.Delete,
    space: Key.Space,
    up: Key.Up,
    down: Key.Down,
    left: Key.Left,
    right: Key.Right,
    home: Key.Home,
    end: Key.End,
    pageup: Key.PageUp,
    pagedown: Key.PageDown
  }
  return combo
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .map((p) => {
      if (p in map) return map[p]
      if (p.length === 1 && p >= 'a' && p <= 'z') return Key[p.toUpperCase()]
      if (p.length === 1 && p >= '0' && p <= '9') return Key[`Num${p}`]
      throw new Error(`Unknown key: ${p}`)
    })
}

export async function runComputerAction(a: ComputerAction): Promise<void> {
  const n = await getNut()
  if (!n) throw new Error('Input injection unavailable (nut.js failed to load)')
  const toPoint = async () => {
    const bounds = screen.getPrimaryDisplay().bounds
    const px = bounds.x + Math.round(((a.x ?? 0) / 1000) * bounds.width)
    const py = bounds.y + Math.round(((a.y ?? 0) / 1000) * bounds.height)
    return new n.Point(px, py)
  }
  switch (a.action) {
    case 'move':
      await n.mouse.setPosition(await toPoint())
      break
    case 'click':
      await n.mouse.setPosition(await toPoint())
      await n.mouse.leftClick()
      break
    case 'double_click':
      await n.mouse.setPosition(await toPoint())
      await n.mouse.doubleClick(n.Button.LEFT)
      break
    case 'right_click':
      await n.mouse.setPosition(await toPoint())
      await n.mouse.rightClick()
      break
    case 'type':
      if (a.text) await n.keyboard.type(a.text)
      break
    case 'key': {
      if (!a.keys) break
      const keys = resolveKeys(n, a.keys)
      const mods = keys.slice(0, -1)
      const last = keys[keys.length - 1]
      for (const m of mods) await n.keyboard.pressKey(m)
      await n.keyboard.pressKey(last)
      await n.keyboard.releaseKey(last)
      for (const m of mods.reverse()) await n.keyboard.releaseKey(m)
      break
    }
    case 'scroll': {
      if (a.x != null && a.y != null) await n.mouse.setPosition(await toPoint())
      const amount = a.amount ?? 3
      if (a.direction === 'up') await n.mouse.scrollUp(amount)
      else await n.mouse.scrollDown(amount)
      break
    }
    case 'drag': {
      if (!a.path || a.path.length < 2) break
      const bounds = screen.getPrimaryDisplay().bounds
      const pts = a.path.map(
        (p) =>
          new n.Point(
            bounds.x + Math.round((p.x / 1000) * bounds.width),
            bounds.y + Math.round((p.y / 1000) * bounds.height)
          )
      )
      await n.mouse.setPosition(pts[0])
      await n.mouse.pressButton(n.Button.LEFT)
      for (const pt of pts.slice(1)) await n.mouse.setPosition(pt)
      await n.mouse.releaseButton(n.Button.LEFT)
      break
    }
    default:
      throw new Error(`Unknown action: ${(a as ComputerAction).action}`)
  }
}

const nativeRequire = createRequire(join(app.getAppPath(), 'package.json'))
let started = false
let active = false
let sawAnyEvent = false

export async function startPushToTalk(onChange: (active: boolean) => void): Promise<void> {
  if (started) return
  let uIOhookModule: { uIOhook: { on: Function; start: Function; stop: Function } }
  try {
    uIOhookModule = nativeRequire('uiohook-napi')
  } catch (err) {
    log.error(`[PTT] uiohook-napi failed to load — push-to-talk disabled: ${err}`)
    return
  }
  const hook = uIOhookModule.uIOhook
  const handleEvent = (e: { ctrlKey: boolean; altKey: boolean }) => {
    if (!sawAnyEvent) {
      sawAnyEvent = true
      log.info('[PTT] receiving global key events — listen hook is live (Input Monitoring OK)')
    }
    const next = e.ctrlKey && e.altKey
    if (next !== active) {
      active = next
      onChange(active)
    }
  }
  hook.on('keydown', handleEvent)
  hook.on('keyup', handleEvent)
  try {
    hook.start()
    started = true
    log.info('[PTT] global hook started — hold Ctrl+Alt (Control+Option) to talk')
  } catch (err) {
    log.error(`[PTT] failed to start global hook — push-to-talk disabled: ${err}`)
    try {
      hook.stop()
    } catch {
      /* ignore */
    }
  }
}

export async function triggerInputMonitoringPrompt(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (started) return
  let uIOhookModule: { uIOhook: { start: Function; stop: Function } }
  try {
    uIOhookModule = nativeRequire('uiohook-napi')
  } catch (err) {
    log.warn(`[PTT] input-monitoring prompt: uiohook-napi failed to load: ${err}`)
    return
  }
  const hook = uIOhookModule.uIOhook
  try {
    hook.start()
    log.info('[PTT] input-monitoring prompt: started listen tap to register Friday in the list')
  } catch (err) {
    log.warn(`[PTT] input-monitoring prompt: failed to start listen tap: ${err}`)
    return
  }
  setTimeout(() => {
    try {
      hook.stop()
    } catch {
      /* ignore */
    }
  }, 600)
}

export function stopPushToTalk(): void {
  if (!started) return
  try {
    const { uIOhook } = nativeRequire('uiohook-napi')
    uIOhook.stop()
  } catch (err) {
    log.warn(`[PTT] failed to stop global hook: ${err}`)
  }
  started = false
  active = false
  sawAnyEvent = false
}
