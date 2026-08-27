import { useCallback, useState, type HTMLAttributes } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { YUVOrb } from '@/components/yuv-orb'
import { IntroWelcome, PermissionsStep } from '@/components/intro-welcome'
import { BYOKSetup } from '@/components/byok-setup'

type Step = 'welcome' | 'permissions' | 'byok'

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

  const finishOnboarding = useCallback(async () => {
    setFinishing(true)
    setFinishError('')
    try {
      await onComplete()
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Could not finish setup.')
      setFinishing(false)
    }
  }, [onComplete])

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
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_90deg,rgba(31,213,249,0.16),rgba(99,102,241,0.08),rgba(31,213,249,0.16))] blur-3xl"
            animate={{ rotate: 360, scale: [0.9, 1.05, 0.9] }}
            transition={{
              rotate: { duration: 24, repeat: Infinity, ease: 'linear' },
              scale: { duration: 7, repeat: Infinity }
            }}
          />
        </div>
        <YUVOrb speaking={false} audioTrack={null} />
        <div className="flex w-full max-w-lg flex-col items-center gap-3">
          <div
            className={cn(
              'relative h-[350px] w-full overflow-hidden rounded-[24px] border border-border bg-black/90 shadow-2xl backdrop-blur-xl',
              'transition-[filter] duration-700 ease-in-out',
              inverted && '[filter:invert(1)]'
            )}
          >
            <motion.div
              className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_45%,rgba(31,213,249,0.12),transparent_55%)]"
              initial={false}
              animate={asciiMotionByStep[step]}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
            <div className="relative z-10 h-full">
              {step === 'welcome' && <IntroWelcome onStart={() => setStep('permissions')} />}
              {step === 'permissions' && (
                <PermissionsStep onGranted={setPermsGranted} onContinue={() => setStep('byok')} />
              )}
              {step === 'byok' && <BYOKSetup onComplete={() => void finishOnboarding()} />}
            </div>
          </div>
          {finishError ? (
            <p className="max-w-md text-center text-xs text-red-300">{finishError}</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
