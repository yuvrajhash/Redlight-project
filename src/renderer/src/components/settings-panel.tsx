import { useEffect, useState } from 'react'
import {
  Brain,
  Check,
  KeyRound,
  LoaderCircle,
  Mic,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Trash2
} from 'lucide-react'
import { useStore } from '@/hooks/use-store'
import { useYUVSessionContext } from '@/realtime/useYUVSession'
import type { CognitionStats } from '../../../shared/cognition'
import type { RuntimeStats } from '../../../shared/runtime'
import type { DisplayChoice } from '../../../preload/types'
import type { PrivacySettings } from '../../../preload/types'

export function SettingsPanel() {
  const { saveApiKey, validateOpenAiKey, getPrivacySettings, setPrivacySettings } = useStore()
  const { selectedMicId, setMicDevice, restart } = useYUVSessionContext()
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [openaiKey, setOpenaiKey] = useState('')
  const [keyState, setKeyState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [keyError, setKeyError] = useState('')
  const [memoryStats, setMemoryStats] = useState<CognitionStats | null>(null)
  const [memoryBusy, setMemoryBusy] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)
  const [runtimeStats, setRuntimeStats] = useState<RuntimeStats | null>(null)
  const [displays, setDisplays] = useState<DisplayChoice[]>([])
  const [selectedDisplay, setSelectedDisplay] = useState<number | null>(null)
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null)

  useEffect(() => {
    const refresh = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter((d) => d.kind === 'audioinput'))
    }
    void refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh)
  }, [])

  useEffect(() => {
    void Promise.all([
      window.api.cognition.stats().then(setMemoryStats),
      window.api.runtime.stats().then(setRuntimeStats),
      window.api.displays.list().then((choices) => {
        setDisplays(choices)
        setSelectedDisplay(choices.find((display) => display.selected)?.id ?? null)
      }),
      getPrivacySettings().then(setPrivacy)
    ])
  }, [])

  const updatePrivacy = async (next: PrivacySettings) => {
    setPrivacy(next)
    await setPrivacySettings(next)
  }

  const consolidateMemory = async () => {
    setMemoryBusy(true)
    try {
      await window.api.runtime.sleep()
      const [memory, runtime] = await Promise.all([
        window.api.cognition.stats(),
        window.api.runtime.stats()
      ])
      setMemoryStats(memory)
      setRuntimeStats(runtime)
    } finally {
      setMemoryBusy(false)
    }
  }

  const toggleEmergencyStop = async () => {
    if (runtimeStats?.mode === 'emergency_stopped') {
      await window.api.runtime.resetEmergencyStop(true)
    } else {
      await window.api.runtime.emergencyStop()
    }
    setRuntimeStats(await window.api.runtime.stats())
  }

  const forgetEverything = async () => {
    if (!confirmForget) {
      setConfirmForget(true)
      return
    }
    setMemoryBusy(true)
    try {
      await window.api.cognition.clear()
      setMemoryStats(await window.api.cognition.stats())
      setConfirmForget(false)
    } finally {
      setMemoryBusy(false)
    }
  }

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = openaiKey.trim()
    setKeyError('')
    if (!key.startsWith('sk-')) {
      setKeyState('error')
      setKeyError(`That doesn't look like an OpenAI key (should start with "sk-").`)
      return
    }
    setKeyState('saving')
    try {
      const valid = await validateOpenAiKey(key)
      if (!valid) throw new Error("That key didn't work. Check it's active with billing.")
      await saveApiKey('openai', key)
      setOpenaiKey('')
      setKeyState('saved')
      restart()
    } catch (err) {
      setKeyState('error')
      setKeyError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="w-full">
      <div className="mx-1.5 rounded-xl border border-white/10 bg-slate-600/15 px-3 py-2.5 font-sans text-white">
        <label
          htmlFor="settings-mic"
          className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
        >
          <Mic className="h-3 w-3" /> Microphone
        </label>
        <select
          id="settings-mic"
          value={selectedMicId}
          onChange={(e) => void setMicDevice(e.target.value)}
          className="mb-3 w-full min-w-0 cursor-pointer truncate rounded-lg border border-input bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-100 outline-none transition-colors focus:border-[#1FD5F9]/60"
        >
          <option value="" className="bg-zinc-900 font-medium text-zinc-400">
            System default
          </option>
          {mics.map((m, i) => (
            <option key={m.deviceId} value={m.deviceId} className="bg-zinc-900 text-zinc-100">
              {m.label || `Microphone ${i + 1}`}
            </option>
          ))}
        </select>
        <label
          htmlFor="settings-display"
          className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
        >
          <Monitor className="h-3 w-3" /> Screen for vision and control
        </label>
        <select
          id="settings-display"
          value={selectedDisplay ?? ''}
          onChange={(event) => {
            const next = event.target.value ? Number(event.target.value) : null
            setSelectedDisplay(next)
            void window.api.displays.select(next)
          }}
          className="mb-3 w-full rounded-lg border border-input bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-100 outline-none"
        >
          {displays.map((display) => (
            <option key={display.id} value={display.id} className="bg-zinc-900">
              {display.label} · {display.width}×{display.height}
              {display.primary ? ' (Primary)' : ''}
            </option>
          ))}
        </select>
        <form onSubmit={handleSaveKey}>
          <label
            htmlFor="settings-openai-key"
            className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
          >
            <KeyRound className="h-3 w-3" /> OpenAI API Key
          </label>
          <div className="flex gap-1.5">
            <input
              id="settings-openai-key"
              type="password"
              placeholder="sk-…"
              value={openaiKey}
              onChange={(e) => {
                setOpenaiKey(e.target.value)
                if (keyState !== 'idle') setKeyState('idle')
              }}
              className="h-7 w-full min-w-0 rounded-lg border border-input bg-black/40 px-2.5 text-[11px] tracking-wide text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-[#1FD5F9]/60"
            />
            <button
              type="submit"
              disabled={keyState === 'saving' || !openaiKey.trim()}
              className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-[#1FD5F9]/15 px-3 text-[11px] font-semibold text-[#1FD5F9] transition-colors hover:bg-[#1FD5F9]/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {keyState === 'saving' ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : keyState === 'saved' ? (
                <Check className="h-3 w-3" />
              ) : (
                'Save'
              )}
            </button>
          </div>
          {keyState === 'error' ? (
            <p className="mt-1 text-[10px] font-medium text-red-400">{keyError}</p>
          ) : keyState === 'saved' ? (
            <p className="mt-1 text-[10px] font-medium text-[#1FD5F9]">
              Key updated — reconnecting YUV…
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-zinc-500">
              Saved encrypted locally. Replaces current key.
            </p>
          )}
        </form>
        <div className="mt-3 border-t border-white/10 pt-2.5">
          <div className="mb-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Private memory opt-in
            </p>
            <label className="flex items-center justify-between py-1 text-[10px] text-zinc-400">
              Remember conversations
              <input
                type="checkbox"
                checked={privacy?.storeConversationMemory ?? false}
                onChange={(event) =>
                  privacy &&
                  void updatePrivacy({
                    ...privacy,
                    storeConversationMemory: event.target.checked
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between py-1 text-[10px] text-zinc-400">
              Remember screen observations
              <input
                type="checkbox"
                checked={privacy?.storeScreenMemory ?? false}
                onChange={(event) =>
                  privacy &&
                  void updatePrivacy({
                    ...privacy,
                    storeScreenMemory: event.target.checked
                  })
                }
              />
            </label>
            <p className="text-[9px] text-zinc-600">
              Off by default. Saved cognition is encrypted.
            </p>
          </div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              <Brain className="h-3 w-3" /> Cognitive memory
            </span>
            <span className="text-[10px] text-zinc-500">
              {memoryStats ? `${memoryStats.activeMemories} active` : 'Loading…'}
            </span>
          </div>
          <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">
            YUV recalls memory, tracks world state, learns verified procedures and audits its
            reasoning locally.
          </p>
          {runtimeStats ? (
            <p className="mb-2 text-[10px] text-zinc-500">
              {runtimeStats.worldEntities} world entities · {runtimeStats.verifiedSkills}/
              {runtimeStats.learnedSkills} skills verified · {runtimeStats.reasoningAudits} audits
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={memoryBusy}
              onClick={() => void consolidateMemory()}
              className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 text-[10px] font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${memoryBusy ? 'animate-spin' : ''}`} /> Consolidate
            </button>
            <button
              type="button"
              disabled={memoryBusy}
              onClick={() => void forgetEverything()}
              className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-red-400/20 bg-red-400/5 text-[10px] font-medium text-red-300 hover:bg-red-400/10 disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> {confirmForget ? 'Confirm forget' : 'Forget all'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void toggleEmergencyStop()}
            className={`mt-1.5 flex h-7 w-full items-center justify-center gap-1 rounded-lg border text-[10px] font-semibold ${
              runtimeStats?.mode === 'emergency_stopped'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border-red-400/20 bg-red-400/5 text-red-300 hover:bg-red-400/10'
            }`}
          >
            <ShieldAlert className="h-3 w-3" />
            {runtimeStats?.mode === 'emergency_stopped'
              ? 'Reset emergency stop'
              : 'Stop all computer control'}
          </button>
          <p className="mt-1 text-center text-[9px] text-zinc-600">
            Global shortcut: Ctrl/Cmd + Shift + F12
          </p>
        </div>
      </div>
    </div>
  )
}
