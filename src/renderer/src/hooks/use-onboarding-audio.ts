import { useEffect, useRef, useState, useCallback } from 'react'

type MusicSection = { start: number; end: number }

export function useOnboardingAudio(
  musicSrc: string,
  section: MusicSection
) {
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)
  const [level, setLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [outputTrack, setOutputTrack] = useState<MediaStreamTrack | null>(null)

  useEffect(() => {
    const music = new Audio(musicSrc)
    music.loop = true
    music.volume = 0.35
    musicRef.current = music
    void music.play().catch(() => {})
    return () => {
      music.pause()
      musicRef.current = null
    }
  }, [musicSrc])

  useEffect(() => {
    const music = musicRef.current
    if (!music) return
    const seek = () => {
      if (music.currentTime < section.start || music.currentTime >= section.end) {
        music.currentTime = section.start
      }
    }
    seek()
    const id = window.setInterval(seek, 500)
    return () => clearInterval(id)
  }, [section.start, section.end])

  useEffect(() => {
    const music = musicRef.current
    const voice = voiceRef.current
    if (music) music.muted = muted
    if (voice) voice.muted = muted
  }, [muted])

  const playVoice = useCallback(async (src: string) => {
    voiceRef.current?.pause()
    const voice = new Audio(src)
    voiceRef.current = voice
    voice.volume = 1
    setSpeaking(true)
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    try {
      const ctx = new AudioCtx()
      const source = ctx.createMediaElementSource(voice)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(ctx.destination)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let raf = 0
      const tick = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]!
        setLevel(Math.min(1, sum / data.length / 80))
        raf = requestAnimationFrame(tick)
      }
      tick()
      voice.onended = () => {
        cancelAnimationFrame(raf)
        setSpeaking(false)
        setLevel(0)
        void ctx.close()
      }
      const stream = (
        voice as HTMLAudioElement & { captureStream?: () => MediaStream }
      ).captureStream?.()
      setOutputTrack(stream?.getAudioTracks()[0] ?? null)
    } catch {
      voice.onended = () => setSpeaking(false)
    }
    await voice.play().catch(() => setSpeaking(false))
  }, [])

  const playOutro = useCallback(async () => {
    const music = musicRef.current
    if (!music) return
    const start = performance.now()
    await new Promise<void>((resolve) => {
      const fade = () => {
        const t = (performance.now() - start) / 2000
        music.volume = Math.max(0, 0.35 * (1 - t))
        if (t < 1) requestAnimationFrame(fade)
        else {
          music.pause()
          resolve()
        }
      }
      fade()
    })
  }, [])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  return { level, muted, toggleMute, playVoice, speaking, outputTrack, playOutro }
}
