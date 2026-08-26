import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { OpenAIRealtimeWebRTC, RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
import { createFridayTools } from './tools'

export type AgentState = 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'failed'

export type MicMode = 'always' | 'ptt'

const FALLBACK_INSTRUCTIONS =
  'You are F.R.I.D.A.Y., a calm, concise voice assistant. Keep replies short and conversational — usually one sentence. Speak naturally.'
const GREETING = "Greet the user briefly with: 'Friday online, boss.'"
const MIC_DEVICE_KEY = 'friday.micDeviceId'
const MIC_MODE_KEY = 'friday.micMode'

export type FridaySessionValue = {
  agentState: AgentState
  remoteTrack: MediaStreamTrack | null
  micMode: MicMode
  setMicMode: (mode: MicMode) => void
  pttActive: boolean
  micLive: boolean
  connected: boolean
  selectedMicId: string
  setMicDevice: (deviceId: string) => Promise<void>
  restart: () => void
}

const FridaySessionContext = createContext<FridaySessionValue | null>(null)

export function useFridaySessionContext(): FridaySessionValue {
  const ctx = useContext(FridaySessionContext)
  if (!ctx) {
    throw new Error('useFridaySessionContext must be used within <FridaySessionProvider>')
  }
  return ctx
}

export function FridaySessionProvider({ children }: { children: ReactNode }) {
  const value = useFridaySession()
  return <FridaySessionContext.Provider value={value}>{children}</FridaySessionContext.Provider>
}

export function useFridaySession(): FridaySessionValue {
  const initialMicMode: MicMode =
    window.localStorage.getItem(MIC_MODE_KEY) === 'always' ? 'always' : 'ptt'
  const [agentState, setAgentState] = useState<AgentState>('connecting')
  const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null)
  const [micMode, setMicModeState] = useState<MicMode>(initialMicMode)
  const [pttActive, setPttActive] = useState(false)
  const [connected, setConnected] = useState(false)
  const micModeRef = useRef<MicMode>(initialMicMode)
  const pttActiveRef = useRef(false)
  const [selectedMicId, setSelectedMicId] = useState(
    () => window.localStorage.getItem(MIC_DEVICE_KEY) ?? ''
  )
  const [generation, setGeneration] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transportRef = useRef<any>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const speakingRef = useRef(false)
  const activeResponseRef = useRef(false)
  const pendingSpeakRef = useRef<string | null>(null)

  const handleEvent = useCallback((event: { type?: string; transcript?: string }) => {
    const t = event?.type
    if (t === 'conversation.item.input_audio_transcription.completed') {
      if (event.transcript) {
        const transcript = event.transcript.trim()
        window.api.log('Transcript', `user transcript captured (${transcript.length} chars)`)
        void window.api.cognition
          .remember({
            kind: 'episodic',
            content: `The user said: ${transcript}`,
            source: 'user',
            tags: ['conversation', 'user-statement'],
            confidence: 0.98,
            salience: 0.62
          })
          .catch((error) => window.api.log('Cognition', `failed to remember user turn: ${error}`))
      }
    } else if (t === 'response.output_audio_transcript.done') {
      if (event.transcript) {
        const transcript = event.transcript.trim()
        window.api.log('Transcript', `assistant transcript captured (${transcript.length} chars)`)
        void window.api.cognition
          .remember({
            kind: 'reflection',
            content: `Friday replied: ${transcript}`,
            source: 'assistant',
            tags: ['conversation', 'assistant-response'],
            confidence: 0.7,
            salience: 0.42
          })
          .catch((error) =>
            window.api.log('Cognition', `failed to remember assistant turn: ${error}`)
          )
      }
    }
    if (t === 'input_audio_buffer.speech_started') {
      window.api.log('Mic', 'server VAD: speech_started (audio IS reaching OpenAI)')
      speakingRef.current = false
      setAgentState('listening')
    } else if (t === 'input_audio_buffer.speech_stopped') {
      window.api.log('Mic', 'server VAD: speech_stopped')
      setAgentState('thinking')
    } else if (t === 'response.created') {
      activeResponseRef.current = true
      setAgentState('thinking')
    } else if (t === 'response.done') {
      activeResponseRef.current = false
      const pending = pendingSpeakRef.current
      if (pending) {
        pendingSpeakRef.current = null
        sessionRef.current?.transport.sendEvent({
          type: 'response.create',
          response: { instructions: pending }
        })
      }
    }
  }, [])

  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const [{ value: ephemeralKey, model }, cfg, memoryContext] = await Promise.all([
          window.api.realtime.mintEphemeralKey(),
          window.api.getAgentConfig().catch(() => null),
          window.api.cognition
            .context({
              query:
                'recent conversation user preferences active goals recurring tasks corrections',
              limit: 10,
              minConfidence: 0.3,
              includeRecent: true
            })
            .catch(() => ({ text: '', memories: [] }))
        ])
        if (disposed) return
        const audioEl = new Audio()
        audioEl.autoplay = true
        audioElRef.current = audioEl
        const tools = createFridayTools({
          visionMode: cfg?.visionMode ?? 'subagent',
          controlBrain: cfg?.controlBrain ?? 'openai-cua',
          inject: (event) => sessionRef.current?.transport.sendEvent(event)
        })
        const agent = new RealtimeAgent({
          name: 'friday',
          voice: cfg?.voice ?? 'marin',
          instructions: [cfg?.systemPrompt ?? FALLBACK_INSTRUCTIONS, memoryContext.text]
            .filter(Boolean)
            .join('\n\n'),
          tools
        })
        let inputStream: MediaStream | undefined
        const savedMic = window.localStorage.getItem(MIC_DEVICE_KEY)
        if (savedMic) {
          try {
            inputStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: savedMic } }
            })
          } catch {
            inputStream = undefined
          }
        }
        if (disposed) {
          inputStream?.getTracks().forEach((t) => t.stop())
          return
        }
        const transport = new OpenAIRealtimeWebRTC({
          audioElement: audioEl,
          mediaStream: inputStream
        })
        transportRef.current = transport
        const session = new RealtimeSession(agent, {
          transport,
          model,
          config: {
            inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' }
          }
        })
        sessionRef.current = session
        session.on('transport_event', handleEvent)
        session.on('error', (...args: unknown[]) => {
          console.error('[Realtime] session error:', ...args)
          window.api.log('Realtime', `session error: ${args.map((a) => String(a)).join(' ')}`)
        })
        await session.connect({ apiKey: ephemeralKey })
        if (disposed) return
        setConnected(true)
        setAgentState('idle')
        session.mute(!(micModeRef.current === 'always' || pttActiveRef.current))
        window.api.log(
          'Session',
          `connected (model ${model}, vision ${cfg?.visionMode}, control ${cfg?.controlBrain})`
        )
        const grabTrack = () => {
          const stream = (
            audioEl as HTMLAudioElement & { captureStream?: () => MediaStream }
          ).captureStream?.()
          const track = stream?.getAudioTracks()[0] ?? null
          if (track) setRemoteTrack(track)
        }
        audioEl.addEventListener('playing', grabTrack)
        grabTrack()
        session.transport.sendEvent({
          type: 'response.create',
          response: { instructions: GREETING }
        })
      } catch (err) {
        console.error('[Realtime] failed to start session:', err)
        window.api.log('Realtime', `failed to start session: ${String(err)}`)
        if (!disposed) setAgentState('failed')
      }
    })()
    return () => {
      disposed = true
      sessionRef.current?.close()
      sessionRef.current = null
      transportRef.current = null
      audioElRef.current = null
    }
  }, [handleEvent, generation])

  useEffect(() => {
    if (!remoteTrack) return
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const source = ctx.createMediaStreamSource(new MediaStream([remoteTrack]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.4
    source.connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const SPEAK_THRESHOLD = 0.015
    const SILENCE_MS = 700
    let raf = 0
    let silenceStart = 0
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      const now = performance.now()
      if (rms > SPEAK_THRESHOLD) {
        silenceStart = 0
        if (!speakingRef.current) {
          speakingRef.current = true
          setAgentState('speaking')
        }
      } else if (speakingRef.current) {
        if (!silenceStart) silenceStart = now
        else if (now - silenceStart > SILENCE_MS) {
          speakingRef.current = false
          setAgentState('idle')
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      source.disconnect()
      analyser.disconnect()
      void ctx.close().catch(() => {})
    }
  }, [remoteTrack])

  useEffect(() => {
    const handler = (_e: unknown, payload: { answer: string | null }) => {
      const instructions = payload.answer
        ? `Your background internet search just came back. Tell the boss what you found in one or two short, natural spoken sentences — confident and casual, no lists or number dumps. Speak ONLY facts from the result below; if it contradicts anything you said earlier, THIS is the truth — correct yourself naturally. Do not add facts that aren't here.

Result:
${payload.answer}`
        : "Your background internet search failed. Tell the boss briefly you couldn't pull it up right now."
      if (payload.answer) {
        void window.api.cognition
          .remember({
            kind: 'semantic',
            content: payload.answer,
            source: 'tool',
            tags: ['web-search', 'externally-verified'],
            confidence: 0.82,
            salience: 0.58,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
          .catch((error) => window.api.log('Cognition', `failed to remember search: ${error}`))
      }
      if (activeResponseRef.current) {
        pendingSpeakRef.current = instructions
      } else {
        sessionRef.current?.transport.sendEvent({
          type: 'response.create',
          response: { instructions }
        })
      }
    }
    window.electron.ipcRenderer.on('web-search-result', handler)
    return () => {
      window.electron.ipcRenderer.removeAllListeners('web-search-result')
    }
  }, [])

  const applyMute = useCallback(() => {
    const live = micModeRef.current === 'always' || pttActiveRef.current
    sessionRef.current?.mute(!live)
  }, [])

  const setMicMode = useCallback(
    (mode: MicMode) => {
      micModeRef.current = mode
      setMicModeState(mode)
      window.localStorage.setItem(MIC_MODE_KEY, mode)
      applyMute()
    },
    [applyMute]
  )

  useEffect(() => {
    const handler = (_e: unknown, payload: { active: boolean }) => {
      window.api.log('Mic', `ptt event received active=${payload.active}`)
      pttActiveRef.current = payload.active
      setPttActive(payload.active)
      applyMute()
    }
    window.electron.ipcRenderer.on('push-to-talk', handler)
    return () => {
      window.electron.ipcRenderer.removeAllListeners('push-to-talk')
    }
  }, [applyMute])

  const setMicDevice = useCallback(async (deviceId: string) => {
    window.localStorage.setItem(MIC_DEVICE_KEY, deviceId)
    setSelectedMicId(deviceId)
    const transport = transportRef.current
    const pc = transport?.connectionState?.peerConnection as RTCPeerConnection | undefined
    if (!transport || !pc) return
    const stream = await navigator.mediaDevices.getUserMedia(
      deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true }
    )
    const newTrack = stream.getAudioTracks()[0]!
    newTrack.enabled = !transport.muted
    const sender = pc.getSenders().find((s) => s.track?.kind === 'audio')
    const oldTrack = sender?.track ?? null
    await sender?.replaceTrack(newTrack)
    if (oldTrack && oldTrack !== newTrack) oldTrack.stop()
  }, [])

  const restart = useCallback(() => setGeneration((g) => g + 1), [])
  const micLive = micMode === 'always' || pttActive

  return {
    agentState,
    remoteTrack,
    micMode,
    setMicMode,
    pttActive,
    micLive,
    connected,
    selectedMicId,
    setMicDevice,
    restart
  }
}
