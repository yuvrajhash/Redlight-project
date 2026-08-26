import { useState } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { useStore } from '@/hooks/use-store'

export function BYOKSetup({ onComplete }: { onComplete: () => void }) {
  const { saveApiKey, validateOpenAiKey } = useStore()
  const [openaiKey, setOpenaiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const key = openaiKey.trim()
      if (!key) throw new Error('An OpenAI API key is required.')
      if (!key.startsWith('sk-'))
        throw new Error(`That doesn't look like an OpenAI key (it should start with "sk-").`)
      const valid = await validateOpenAiKey(key)
      if (!valid)
        throw new Error("That key didn't work. Check it's active and has billing enabled.")
      await saveApiKey('openai', key)
      onComplete()
    } catch (err) {
      console.error('Failed to save:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center px-10 py-8">
      <span className="pointer-events-none absolute left-6 top-6 h-5 w-5 border-l border-t border-white/70" />
      <span className="pointer-events-none absolute right-6 top-6 h-5 w-5 border-r border-t border-white/70" />
      <span className="pointer-events-none absolute bottom-6 left-6 h-5 w-5 border-b border-l border-white/70" />
      <span className="pointer-events-none absolute bottom-6 right-6 h-5 w-5 border-b border-r border-white/70" />
      <div className="flex w-full max-w-[330px] flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-light tracking-tight">
              configure <span className="font-playfair font-medium italic">yuv</span>
            </h1>
          </div>
        </div>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <Field>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="openai-key"
                type="password"
                placeholder="OPENAI_API_KEY"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="pl-9 text-sm tracking-wide"
                autoFocus
              />
            </div>
            {error ? (
              <p className="text-[11px] font-medium text-destructive">{error}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Create an OpenAI API Key at platform.openai.com/api-keys.
              </p>
            )}
          </Field>
          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" disabled={loading} className="w-full gap-1.5 text-sm">
              {loading ? 'Booting sequence...' : 'Encrypt & Begin'}
            </Button>
          </div>
        </form>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Encrypted on this device — it never leaves your machine.
        </div>
      </div>
    </div>
  )
}
