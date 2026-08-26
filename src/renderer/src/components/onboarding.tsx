import { useCallback, useEffect, useState, type HTMLAttributes } from 'react'
import { motion } from 'motion/react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AsciiVideo } from '@/components/ascii-video'
import { FridayOrb } from '@/components/friday-orb'
import { IntroWelcome, PermissionsStep } from '@/components/intro-welcome'
import { BYOKSetup } from '@/components/byok-setup'
import { useOnboardingAudio } from '@/hooks/use-onboarding-audio'
import velvetCircuit from '@/assets/audio/velvet-circuit.mp3'
import welcomeVoice from '@/assets/audio/welcome.mp3'
import permissionsVoice from '@/assets/audio/permissions.mp3'
import byokVoice from '@/assets/audio/byok.mp3'
import videoSrc from '@/assets/video/onboarding-spinner-bg.mp4'

type Step = 'welcome' | 'permissions' | 'byok'

const onboardingScript: Record<Step, { voice: string }> = {
  welcome: { voice: welcomeVoice },
  permissions: { voice: permissionsVoice },
  byok: { voice: byokVoice }
}

const asciiMotionByStep: Record<Step, { opacity: number; y: number }> = {
  welcome: { opacity: 0.9, y: 0 },
  permissions: { opacity: 0.55, y: -20 },
  byok: { opacity: 0.7, y: 0 }
}

export function Onboarding({
  onComplete,
  className,
  ...props
}: {
  onComplete: () => void | Promise<void>
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  const [step, setStep] = useState<Step>('welcome')
  const [permsGranted, setPermsGranted] = useState(false)
  const inverted = step === 'permissions' && permsGranted
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const musicSection = {
    welcome: { start: 0, end: 27.5 },
    permissions: { start: 40, end: 142 },
    byok: { start: 144.3, end: Infinity }
  }[step]
  const { level, muted, toggleMute, playVoice, speaking, outputTrack, playOutro } =
    useOnboardingAudio(velvetCircuit, musicSection)

  useEffect(() => {
    void playVoice(onboardingScript[step].voice)
  }, [step, playVoice])

  const finishOnboarding = useCallback(async () => {
    setFinishing(true)
    setFinishError('')
    try {
      await playOutro()
      await onComplete()
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Could not finish setup.')
      setFinishing(false)
    }
  }, [onComplete, playOutro])

  return (
    <div className={cn('absolute inset-0', className)} {...props}>
      <motion.div
        className="absolute inset-0 flex items-center justify-center p-8 text-foreground"
        initial={false}
        animate={{ opacity: finishing ? 0 : 1 }}
        transition={{ duration: finishing ? 2.6 : 0.3, ease: 'easeInOut' }}
        style={{ pointerEvents: finishing ? 'none' : undefined }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.82)_100%)]" />
        <FridayOrb speaking={speaking} audioTrack={outputTrack} />
        <div className="flex w-full max-w-lg flex-col items-center gap-3">
          <div
            className={cn(
              'relative h-[350px] w-full overflow-hidden rounded-[24px] border border-border bg-black/90 shadow-2xl backdrop-blur-xl',
              'transition-[filter] duration-700 ease-in-out',
              inverted && '[filter:invert(1)]'
            )}
          >
            <motion.div
              className="pointer-events-none absolute inset-0 z-0"
              initial={false}
              animate={asciiMotionByStep[step]}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              <motion.div
                className="absolute inset-0"
                style={{
                  scale: 1 + level * 0.08,
                  filter: `brightness(${1 + level * 0.5})`
                }}
              >
                <AsciiVideo src={videoSrc} className="absolute top-0 h-full w-full" />
              </motion.div>
            </motion.div>
            <div className="relative z-10 h-full">
              {step === 'welcome' && <IntroWelcome onStart={() => setStep('permissions')} />}
              {step === 'permissions' && (
                <PermissionsStep onGranted={setPermsGranted} onContinue={() => setStep('byok')} />
              )}
              {step === 'byok' && <BYOKSetup onComplete={() => void finishOnboarding()} />}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-zinc-300 backdrop-blur"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
          {finishError ? (
            <p className="max-w-md text-center text-xs text-red-300">{finishError}</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
