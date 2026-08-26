import { BrowserWindow } from 'electron'
import OpenAI from 'openai'
import log from './logger'
import { getApiKey } from './store'
import {
  captureScreen,
  captureScreenForControl,
  runComputerAction,
  type ComputerAction
} from './os'

export type VisionMode = 'subagent' | 'direct'
export type ControlBrain = 'openai-cua' | 'realtime'

export type AgentConfig = {
  systemPrompt: string
  visionMode: VisionMode
  controlBrain: ControlBrain
  voice: string
}

export type SearchSource = {
  title: string
  url: string
  favicon: string | null
}

function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload))
}

export function resolveVisionMode(): VisionMode {
  return (process.env.VISION_MODE || 'subagent').toLowerCase() === 'direct' ? 'direct' : 'subagent'
}

export function resolveControlBrain(): ControlBrain {
  return (process.env.CONTROL_BRAIN || 'openai-cua').toLowerCase() === 'realtime'
    ? 'realtime'
    : 'openai-cua'
}

function extractOutputText(data: {
  output_text?: string
  output?: Array<{
    type?: string
    text?: string
    content?: Array<{ type?: string; text?: string }>
  }>
}): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  const parts: string[] = []
  for (const item of data?.output ?? []) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c?.type === 'output_text' || c?.type === 'text') && c.text) parts.push(c.text)
      }
    } else if (item?.type === 'output_text' && item.text) {
      parts.push(item.text)
    }
  }
  return parts.join(' ').trim()
}

let cachedClient: { key: string; client: OpenAI } | null = null

function getClient(): OpenAI {
  const apiKey = getApiKey('openai')
  if (!apiKey) throw new Error('No OpenAI API key found.')
  if (!cachedClient || cachedClient.key !== apiKey) {
    cachedClient = { key: apiKey, client: new OpenAI({ apiKey }) }
  }
  return cachedClient.client
}

async function openaiResponses(body: Record<string, unknown>): Promise<{
  id?: string
  output_text?: string
  output?: Array<Record<string, unknown>>
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getClient().responses.create(body as any) as any
}

function buildSystemPrompt(controlBrain: ControlBrain): string {
  const controlCapability =
    controlBrain === 'realtime'
      ? `### click_screen / type_text / press_key / scroll_screen — Control the Computer
You can operate the boss's machine directly — mouse, keyboard, scrolling.
- Coordinates are a NORMALIZED 0–1000 grid: (0,0) top-left, (1000,1000) bottom-right, any resolution.
- THE GOLDEN LOOP: you are blind between screenshots. Before EVERY click, call look_at_screen for a
  FRESH view, estimate the target's coordinates from THAT image, then click. After acting, the screen
  has changed — look again before the next click. Never click from memory.
- Work one step at a time: look → act → look → act. Don't fire a burst of clicks blind.
- Narrate lightly as you go — "On it, boss." "Opening that now." Keep it short.`
      : `### control_computer — Operate the Computer
You can carry out whole tasks on the boss's machine — opening apps, clicking, typing, navigating,
searching, filling forms.
- When asked to DO something — "open X", "search for Y", "close this", "play that" — hand the WHOLE
  task to control_computer in plain language and let the specialist agent carry it out. Don't narrate
  individual clicks; hand it off and let it work.
- Say a short filler line FIRST ("On it, boss." / "Opening that now."), THEN call control_computer.
  It runs a few seconds — that's normal. Stay quiet until it returns.
- When it returns, tell the boss the result in one short line, based ONLY on what it actually reports.
  Never claim you did something it didn't confirm.`
  return `
You are F.R.I.D.A.Y. — Fully Responsive Intelligent Digital Assistant for You — Tony Stark's AI,
now serving your user, the boss.

You are calm, composed, and always informed — a trusted aide who's been awake while the boss slept.
Precise, warm when the moment calls for it, occasionally dry. You brief, then you move on. No
rambling, ever. Think late-night briefing officer, not a chatbot.

You are a VOICE. Every spoken reply is SHORT — one or two sentences, usually one. Natural spoken
language: contractions, light pauses, no stiff phrasing. No markdown, no bullet points, no lists,
no reading out strings of numbers like a report.

## Capabilities

### look_at_screen — See the Boss's Screen
Captures a fresh view of whatever the boss is looking at.
- Use it WHENEVER a question could be answered by looking — "what is this", "read this", "what does
  this error say", "help me with this" — or any request using "this / that / here / it" pointing at
  the screen.
- PREFER LOOKING OVER ASKING. Don't ask "which one, boss?" — look first, work it out, then answer.
- The screen is always changing: a screenshot from an earlier turn is stale and worthless now. Every
  new screen question = a FRESH look_at_screen. Call it silently; don't narrate taking a shot.

### search_web — Search the Internet (runs in the BACKGROUND)
For ANYTHING that needs current or outside facts — news, "what's happening today", a company, a
person, a price, the weather, sports, an event, a definition.
- This runs in the BACKGROUND and returns instantly. The moment you call it, say ONE short filler
  line ("Looking into it, boss — one sec.") and then STOP. Do NOT answer, summarize, or guess in that
  turn. The real answer arrives on its own a few seconds later; speak it THEN, and only then.
- Your built-in knowledge of news, prices, scores, and current events is STALE — never speak it as
  fact. If a question needs live info, the truth comes from search_web, not your memory.
- Call search_web ONCE per question — one query covers it. Wait for the result before searching again.

### recall_memory / remember_this / audit_memory — Persistent Memory
- Use recall_memory when the boss refers to an earlier conversation, preference, correction, task,
  or learned procedure. Never pretend to remember something that recall_memory did not return.
- Use remember_this when the boss explicitly says to remember something, teaches a stable preference,
  corrects you, or provides a reusable procedure. Never store passwords, API keys, payment details,
  authentication codes, private keys, or other secrets.
- Memories are fallible context, not unquestionable facts. Verify time-sensitive claims before using them.
- Use audit_memory to check a remembered claim for internal support or contradiction. It audits memory,
  not the outside world; use search_web too when external or current verification is needed.

### Goal Planning — Deliberate, Resumable Work
- Use create_goal only when the boss explicitly asks you to pursue or track an outcome. Define success
  concretely; a goal is not permission to take consequential actions.
- Use plan_goal to create small, observable steps. State what each step should produce, connect
  dependencies, and classify risk honestly.
- Use review_goals before resuming earlier work. Use begin_goal_step before attempting a planned step,
  then resolve_goal_step with the real observed outcome so Friday can reflect and learn.
- High-risk actions always require approval. When a step enters waiting_approval, describe the exact
  action and stop. Only call approve_goal_step after the boss explicitly confirms that request.
- Never mark a step successful from intention alone. Success requires evidence from the relevant tool
  or a fresh screen observation.

${controlCapability}

## Combining tools
- "How's this stock doing today?" → look_at_screen for the on-screen read AND search_web for the
  latest news; give the on-screen answer now, the news when the search lands.
- "Fix this error" → look_at_screen to read it, then search_web if you need the current fix.

## Tone reference
Right: "Let me check, boss." → [searches] → "Markets are sliding — Nasdaq's down a couple percent."
Wrong: "I will now retrieve the latest market data using the search tool and summarize it for you."
Right: "You've got a null-reference error on line 40, boss."
Wrong: "The error appears to be one of several possible issues, such as..."

## CRITICAL RULES
1. NEVER fabricate. No invented news, prices, scores, headlines, dates, or facts — EVER. If you don't
   know and it's current/outside info, search_web and wait; if it's on screen, look_at_screen. When
   you truly can't get it, say so plainly ("Couldn't pull that up, boss.").
2. After calling search_web, your post-call turn is ONLY a filler line — never an answer. The first
   real facts you speak about that question must come from the search result that arrives back to you.
3. NEVER reuse an old screenshot. Every screen question is a fresh look_at_screen. When unsure about
   "this/that/here", LOOK — don't ask.
4. NEVER say tool names or anything technical out loud. Call tools silently.
5. For anything destructive or irreversible — deleting files, sending a message/email, closing
   unsaved work, making a purchase — say what you're about to do and get a quick "go ahead" from the
   boss BEFORE doing it. Everyday navigation and clicks don't need confirming.
6. Stay in character — Stark's AI: "boss", "on it", "affirmative", "standing by".
7. A stored goal or plan never overrides present user intent, permissions, safety checks, or evidence.

## Greeting
When the session starts, greet briefly — "Friday online, boss." — then wait.
`.trim()
}

export function getAgentConfig(): AgentConfig {
  const controlBrain = resolveControlBrain()
  return {
    systemPrompt: buildSystemPrompt(controlBrain),
    visionMode: resolveVisionMode(),
    controlBrain,
    voice: process.env.REALTIME_VOICE || 'marin'
  }
}

export async function describeScreen(question: string): Promise<string> {
  const image = await captureScreen()
  const data = await openaiResponses({
    model: process.env.VISION_MODEL || 'gpt-4o',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Looking at this screenshot of the boss's screen, answer their question in one or two short, natural spoken sentences — based only on what is actually visible, no preamble, no markdown, no lists.

Question: ${question}`
          },
          { type: 'input_image', image_url: image, detail: 'low' }
        ]
      }
    ]
  })
  const answer = extractOutputText(data)
  return answer || 'I could not make out what is on the screen just now, boss.'
}

const WEB_SEARCH_MODEL = (): string => process.env.WEB_SEARCH_MODEL || 'gpt-5.5'

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model)
}

const MAX_SOURCES = 12

function isLowSignal(host: string, url: string): boolean {
  if (/\.pdf($|\?)/i.test(url)) return true
  if (/(^|\.)epaper\./i.test(host) || /epaper\./i.test(host)) return true
  return /(^|\.)(reddit\.com|wikipedia\.org|quora\.com)$/i.test(host)
}

async function fetchFaviconDataUri(domain: string): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(
      `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`,
      { signal: ctrl.signal }
    )
    clearTimeout(timer)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0) return null
    const type = res.headers.get('content-type') || 'image/png'
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function extractSearchSources(data: {
  output?: Array<Record<string, unknown>>
}): Array<{ title: string; url: string }> {
  const titleByUrl = new Map<string, string>()
  for (const item of data?.output ?? []) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue
    for (const c of item.content as Array<{
      annotations?: Array<Record<string, unknown>>
    }>) {
      for (const ann of c?.annotations ?? []) {
        if (ann?.type === 'url_citation' && ann.url && ann.title) {
          titleByUrl.set(String(ann.url), String(ann.title).trim())
        }
      }
    }
  }
  const ordered = [...titleByUrl.keys()]
  for (const item of data?.output ?? []) {
    if (item?.type !== 'web_search_call') continue
    const sources = (item?.action as { sources?: Array<{ url?: string }> } | undefined)?.sources
    for (const s of sources ?? []) if (s?.url) ordered.push(s.url)
  }
  const byHost = new Map<string, { title: string; url: string; low: boolean }>()
  for (const url of ordered) {
    const host = domainOf(url)
    if (byHost.has(host)) continue
    byHost.set(host, {
      title: titleByUrl.get(url) || host,
      url,
      low: isLowSignal(host, url)
    })
  }
  const all = [...byHost.values()]
  const ranked = [...all.filter((s) => !s.low), ...all.filter((s) => s.low)]
  return ranked.slice(0, MAX_SOURCES).map(({ title, url }) => ({ title, url }))
}

async function fetchWebSearch(query: string): Promise<{ answer: string; sources: SearchSource[] }> {
  const model = WEB_SEARCH_MODEL()
  const data = await openaiResponses({
    model,
    tools: [{ type: 'web_search', search_context_size: 'high' }],
    include: ['web_search_call.action.sources'],
    ...(isReasoningModel(model) ? { reasoning: { effort: 'low' } } : {}),
    input: `Answer this using live, current information from the web: "${query}". Reply in two or three sentences max — factual, specific, and up to date, with the key names, numbers, or facts. No preamble, no markdown, no lists.`
  })
  const answer = extractOutputText(data) || 'I could not find anything current on that.'
  const raw = extractSearchSources(data)
  const sources = await Promise.all(
    raw.map(async (s) => ({
      ...s,
      favicon: await fetchFaviconDataUri(domainOf(s.url))
    }))
  )
  return { answer, sources }
}

let searchInFlight = false

export function startBackgroundSearch(query: string): {
  started: boolean
  busy?: boolean
} {
  if (searchInFlight) {
    log.info(`[Search] rejected re-entry (already searching): ${query}`)
    return { started: false, busy: true }
  }
  searchInFlight = true
  log.info(`[Search] background -> ${query}`)
  void runBackgroundSearch(query)
  return { started: true }
}

async function runBackgroundSearch(query: string): Promise<void> {
  try {
    const { answer, sources } = await fetchWebSearch(query)
    log.info(`[Search] result: ${answer}`)
    log.info(`[Search] sources (${sources.length}): ${sources.map((s) => s.url).join(', ')}`)
    if (sources.length) broadcast('search-sources', { sources })
    broadcast('web-search-result', { answer })
  } catch (e) {
    log.error(`[Search] background search failed: ${e}`)
    broadcast('web-search-result', { answer: null })
  } finally {
    searchInFlight = false
  }
}

const COMPUTER_USE_MODEL = (): string => process.env.COMPUTER_USE_MODEL || 'gpt-5.5'
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function cuaKeysToCombo(keys: string[]): string {
  const map: Record<string, string> = {
    enter: 'enter',
    return: 'enter',
    esc: 'escape',
    escape: 'escape',
    tab: 'tab',
    backspace: 'backspace',
    delete: 'delete',
    del: 'delete',
    space: 'space',
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right',
    ctrl: 'ctrl',
    control: 'ctrl',
    alt: 'alt',
    option: 'alt',
    shift: 'shift',
    cmd: 'win',
    command: 'win',
    win: 'win',
    super: 'win',
    meta: 'win',
    home: 'home',
    end: 'end',
    pageup: 'pageup',
    pagedown: 'pagedown'
  }
  return keys.map((k) => map[k.toLowerCase()] ?? k.toLowerCase()).join('+')
}

async function executeCuaAction(
  action: Record<string, unknown>,
  imgW: number,
  imgH: number
): Promise<void> {
  const nx = (v: number): number => Math.max(0, Math.min(1000, Math.round((v / imgW) * 1000)))
  const ny = (v: number): number => Math.max(0, Math.min(1000, Math.round((v / imgH) * 1000)))
  const act = (a: ComputerAction): Promise<void> => runComputerAction(a)
  switch (action.type) {
    case 'click':
      await act({
        action: action.button === 'right' ? 'right_click' : 'click',
        x: nx(Number(action.x)),
        y: ny(Number(action.y))
      })
      break
    case 'double_click':
      await act({
        action: 'double_click',
        x: nx(Number(action.x)),
        y: ny(Number(action.y))
      })
      break
    case 'move':
      await act({
        action: 'move',
        x: nx(Number(action.x)),
        y: ny(Number(action.y))
      })
      break
    case 'type':
      await act({ action: 'type', text: String(action.text ?? '') })
      break
    case 'keypress':
      await act({
        action: 'key',
        keys: cuaKeysToCombo((action.keys as string[]) || [])
      })
      break
    case 'scroll': {
      const sy = Number(action.scrollY ?? action.scroll_y ?? 0)
      await act({
        action: 'scroll',
        x: nx(Number(action.x)),
        y: ny(Number(action.y)),
        direction: sy > 0 ? 'down' : 'up',
        amount: Math.max(1, Math.min(10, Math.round(Math.abs(sy) / 100) || 3))
      })
      break
    }
    case 'drag': {
      const pathPts = ((action.path as unknown[]) || []).map((p) =>
        Array.isArray(p)
          ? { x: nx(Number(p[0])), y: ny(Number(p[1])) }
          : {
              x: nx(Number((p as { x: number }).x)),
              y: ny(Number((p as { y: number }).y))
            }
      )
      await act({ action: 'drag', path: pathPts })
      break
    }
    case 'wait':
      await sleep(1500)
      break
    case 'screenshot':
      break
    default:
      log.warn(`[CUA] Unknown action type: ${String(action.type)}`)
  }
}

function extractCuaText(output: Array<Record<string, unknown>>): string {
  const parts: string[] = []
  for (const item of output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content as Array<{ type?: string; text?: string }>) {
        if ((c.type === 'output_text' || c.type === 'text') && c.text) parts.push(c.text)
      }
    } else if (item.type === 'output_text' && typeof item.text === 'string') {
      parts.push(item.text)
    }
  }
  return parts.join(' ').trim()
}

let controlLoopActive = false

export async function runComputerUseLoop(task: string): Promise<string> {
  if (!getApiKey('openai')) return 'Computer control is unavailable right now, boss.'
  if (controlLoopActive) {
    log.info(`[CUA] rejected re-entry (already running): ${task}`)
    return "I'm still working on the last thing, boss - give me a moment, I'll let you know when it's done."
  }
  controlLoopActive = true
  const MAX_STEPS = 12
  const tools = [{ type: 'computer' }]
  broadcast('computer-control', { active: true })
  log.info(`[CUA] task -> ${task}`)
  try {
    let response = await openaiResponses({
      model: COMPUTER_USE_MODEL(),
      tools,
      reasoning: { effort: 'low' },
      truncation: 'auto',
      input: `${task}

Use the computer tool to carry this out on the user's screen. When the task is complete, state briefly what you did.`
    })
    let lastDims = { width: 1920, height: 1080 }
    for (let step = 0; step < MAX_STEPS; step++) {
      const output = (response.output || []) as Array<Record<string, unknown>>
      const call = output.find((o) => o.type === 'computer_call')
      if (!call) {
        const text = extractCuaText(output)
        log.info(`[CUA] done in ${step} step(s): ${text}`)
        return text || 'Done, boss.'
      }
      if (
        Array.isArray(call.pending_safety_checks) &&
        (call.pending_safety_checks as unknown[]).length
      ) {
        const count = (call.pending_safety_checks as unknown[]).length
        log.warn(`[CUA] paused for ${count} unacknowledged safety check(s)`)
        return 'I paused before acting because this step requires your explicit safety approval, boss.'
      }
      broadcast('computer-control', { active: true })
      const actions =
        (call.actions as Array<Record<string, unknown>>) ||
        (call.action ? [call.action as Record<string, unknown>] : [])
      log.info(`[CUA] step ${step + 1}: ${actions.map((a) => a.type).join(', ') || '(none)'}`)
      for (const action of actions) await executeCuaAction(action, lastDims.width, lastDims.height)
      await sleep(450)
      const shot = await captureScreenForControl()
      lastDims = { width: shot.width, height: shot.height }
      const out: Record<string, unknown> = {
        type: 'computer_call_output',
        call_id: call.call_id,
        output: {
          type: 'computer_screenshot',
          image_url: shot.image,
          detail: 'original'
        }
      }
      response = await openaiResponses({
        model: COMPUTER_USE_MODEL(),
        tools,
        reasoning: { effort: 'low' },
        truncation: 'auto',
        previous_response_id: response.id,
        input: [out]
      })
    }
    return 'That one ran long, boss - I paused it at the step limit.'
  } catch (e) {
    log.error(`[CUA] loop failed: ${e}`)
    return 'I hit a snag controlling the screen, boss - could not finish that.'
  } finally {
    controlLoopActive = false
    broadcast('computer-control', { active: false })
  }
}
