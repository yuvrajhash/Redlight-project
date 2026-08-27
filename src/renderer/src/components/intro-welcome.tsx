import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function IntroWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-8 pt-10 text-center">
      <span className="pointer-events-none absolute left-6 top-6 h-5 w-5 border-l border-t border-white" />
      <span className="pointer-events-none absolute right-6 top-6 h-5 w-5 border-r border-t border-white" />
      <span className="pointer-events-none absolute bottom-6 left-6 h-5 w-5 border-b border-l border-white" />
      <span className="pointer-events-none absolute bottom-6 right-6 h-5 w-5 border-b border-r border-white" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-light tracking-tight">
          welcome to <span className="font-playfair font-medium italic">yuv</span>
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground lowercase">
          A private cognitive desktop assistant created and owned by Yuvraj Choudhary.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button onClick={onStart} className="gap-2 px-6">
          Start local setup <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-[11px] text-muted-foreground">No account or cloud login required.</p>
      </div>
    </div>
  )
}

type RowStatus = 'idle' | 'pending' | 'granted' | 'denied'

function PermissionRow({
  icon,
  title,
  description,
  status,
  onAction,
  actionLabel = 'Grant'
}: {
  icon: React.ReactNode
  title: string
  description: string
  status: RowStatus
  onAction: () => void
  actionLabel?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/40 text-foreground/80">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{description}</p>
      </div>
      {status === 'granted' ? (
        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Ready
        </span>
      ) : status === 'pending' ? (
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Waiting…
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant={status === 'denied' ? 'destructive' : 'secondary'}
          onClick={onAction}
          className="h-7 shrink-0 px-3 text-[11px]"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function PermissionsStep({
  onGranted,
  onContinue
}: {
  onGranted: (all: boolean) => void
  onContinue: () => void
}) {
  const isMac = useMemo(() => navigator.platform.toLowerCase().includes('mac'), [])
  const [mic, setMic] = useState<RowStatus>('idle')
  const [screen, setScreen] = useState<RowStatus>('idle')
  const [a11y, setA11y] = useState<RowStatus>('idle')
  const allGranted = mic === 'granted' && (!isMac || (screen === 'granted' && a11y === 'granted'))

  const refresh = async () => {
    const micStatus = await window.api.permissions.getMicStatus()
    setMic(micStatus === 'granted' ? 'granted' : micStatus === 'denied' ? 'denied' : 'idle')
    if (isMac) {
      const screenStatus = await window.api.permissions.getScreenStatus()
      setScreen(screenStatus === 'granted' ? 'granted' : 'idle')
      const trusted = await window.api.permissions.getAccessibilityStatus(false)
      setA11y(trusted ? 'granted' : 'idle')
    } else {
      setScreen('granted')
      setA11y('granted')
    }
  }

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 1500)
    return () => clearInterval(id)
  }, [isMac])

  useEffect(() => {
    onGranted(allGranted)
  }, [allGranted, onGranted])

  const requestMic = async () => {
    setMic('pending')
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      await window.api.permissions.requestMicAccess()
      setMic('granted')
    } catch {
      setMic('denied')
      await window.api.permissions.openMicSettings()
    }
  }

  return (
    <div className="relative flex h-full flex-col justify-center gap-4 px-8 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-light tracking-tight">
          unlock <span className="font-playfair font-medium italic">access</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          YUV needs a few permissions to see, hear, and help.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <PermissionRow
          icon={<span className="text-xs">MIC</span>}
          title="Microphone"
          description="So YUV can hear you"
          status={mic}
          onAction={requestMic}
        />
        {isMac && (
          <>
            <PermissionRow
              icon={<span className="text-xs">SCR</span>}
              title="Screen Recording"
              description="So YUV can see your display"
              status={screen}
              onAction={() => void window.api.permissions.openScreenSettings()}
              actionLabel="Open Settings"
            />
            <PermissionRow
              icon={<span className="text-xs">A11Y</span>}
              title="Accessibility"
              description="So YUV can click and type for you"
              status={a11y}
              onAction={() => void window.api.permissions.openAccessibilitySettings()}
              actionLabel="Open Settings"
            />
          </>
        )}
      </div>
      <Button onClick={onContinue} disabled={!allGranted} className="mt-2 w-full">
        {allGranted ? 'Continue' : 'Grant required permissions'}
      </Button>
    </div>
  )
}
