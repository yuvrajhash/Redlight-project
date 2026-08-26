import { useEffect, useState } from 'react'
import { Check, KeyRound, LoaderCircle, Mic } from 'lucide-react'
import { useStore } from '@/hooks/use-store'
import { useFridaySessionContext } from '@/realtime/useFridaySession'

export function SettingsPanel() {
  const { saveApiKey, validateOpenAiKey } = useStore()
  const { selectedMicId, setMicDevice, restart } = useFridaySessionContext()
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [openaiKey, setOpenaiKey] = useState('')
  const [keyState, setKeyState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [keyError, setKeyError] = useState('')

  useEffect(() => {
    const refresh = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter((d) => d.kind === 'audioinput'))
    }
    void refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh)
  }, [])

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
              Key updated — reconnecting Friday…
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-zinc-500">
              Saved encrypted locally. Replaces current key.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
