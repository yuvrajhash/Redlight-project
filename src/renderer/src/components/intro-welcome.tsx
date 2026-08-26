import { useEffect, useMemo, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FridayUser } from '../../../preload/types'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.02.68-2.32 1.09-3.71 1.09-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function IntroWelcome({ onStart }: { onStart: () => void }) {
  const [user, setUser] = useState<FridayUser | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.api.auth.getUser().then(setUser)
  }, [])

  const signIn = async () => {
    setError('')
    setSigningIn(true)
    try {
      setUser(await window.api.auth.signInWithGoogle())
    } catch (err) {
      console.error('Google sign-in failed:', err)
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  const firstName = user?.name?.split(' ')[0] || 'continue'

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-8 pt-10 text-center">
      <span className="pointer-events-none absolute left-6 top-6 h-5 w-5 border-l border-t border-white" />
      <span className="pointer-events-none absolute right-6 top-6 h-5 w-5 border-r border-t border-white" />
      <span className="pointer-events-none absolute bottom-6 left-6 h-5 w-5 border-b border-l border-white" />
      <span className="pointer-events-none absolute bottom-6 right-6 h-5 w-5 border-b border-r border-white" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-light tracking-tight">
          welcome to <span className="font-playfair font-medium italic">friday</span>
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground lowercase">
          This could be the beginning of something <span className="italic">beautiful</span>.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        {user ? (
          <Button onClick={onStart} className="gap-2 px-6">
            <Check className="h-4 w-4 text-emerald-400" />
            Continue as {firstName}
          </Button>
        ) : (
          <Button onClick={signIn} disabled={signingIn} className="gap-2 px-6">
            {signingIn ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Waiting for Google…
              </>
            ) : (
              <>
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>
        )}
        {user ? (
          <p className="text-[11px] text-muted-foreground">{user.email}</p>
        ) : error ? (
          <p className="max-w-xs text-[11px] font-medium text-destructive">{error}</p>
        ) : signingIn ? (
          <p className="text-[11px] text-muted-foreground">
            Finish in your browser, then come back here.
          </p>
        ) : null}
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
    const all =
      mic === 'granted' && (!isMac || (screen === 'granted' && a11y === 'granted'))
    onGranted(all || !isMac)
  }, [mic, screen, a11y, isMac, onGranted])

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
          Friday needs a few permissions to see, hear, and help.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <PermissionRow
          icon={<span className="text-xs">MIC</span>}
          title="Microphone"
          description="So Friday can hear you"
          status={mic}
          onAction={requestMic}
        />
        {isMac && (
          <>
            <PermissionRow
              icon={<span className="text-xs">SCR</span>}
              title="Screen Recording"
              description="So Friday can see your display"
              status={screen}
              onAction={() => void window.api.permissions.openScreenSettings()}
              actionLabel="Open Settings"
            />
            <PermissionRow
              icon={<span className="text-xs">A11Y</span>}
              title="Accessibility"
              description="So Friday can click and type for you"
              status={a11y}
              onAction={() => void window.api.permissions.openAccessibilitySettings()}
              actionLabel="Open Settings"
            />
          </>
        )}
      </div>
      <Button onClick={onContinue} className="mt-2 w-full">
        Continue
      </Button>
    </div>
  )
}
