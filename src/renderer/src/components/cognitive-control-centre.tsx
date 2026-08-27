import {
  Activity,
  Brain,
  CheckCircle2,
  CircleAlert,
  Database,
  Download,
  Goal,
  Network,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Trash2,
  XCircle
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { MemoryDetail, MemoryKind, MemoryUpdate } from '../../../shared/cognition'
import type { CognitiveControlSnapshot } from '../../../shared/control-centre'
import type { Goal as GoalRecord, GoalStatus } from '../../../shared/planning'
import type { SkillRecord } from '../../../shared/runtime'
import { Button } from '@/components/ui/button'

type Tab = 'overview' | 'memory' | 'goals' | 'knowledge' | 'skills' | 'activity'

const TABS: Array<{ id: Tab; label: string; icon: typeof Brain }> = [
  { id: 'overview', label: 'Overview', icon: Brain },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'goals', label: 'Goals', icon: Goal },
  { id: 'knowledge', label: 'Knowledge', icon: Network },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'activity', label: 'Activity', icon: Activity }
]

const MEMORY_KINDS: Array<MemoryKind | 'all'> = [
  'all',
  'episodic',
  'semantic',
  'procedural',
  'self',
  'reflection'
]

function formatDate(value?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/5 text-zinc-400',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
    green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    red: 'border-red-400/20 bg-red-400/10 text-red-300'
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${tones[tone] ?? tones.neutral}`}>
      {children}
    </span>
  )
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-light text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-600">
      {text}
    </div>
  )
}

export function CognitiveControlCentre() {
  const [snapshot, setSnapshot] = useState<CognitiveControlSnapshot | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSnapshot(await window.api.controlCenter.snapshot())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load cognitive state.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const exported = async () => {
    const result = await window.api.controlCenter.export()
    if (result.exported) setNotice(`Exported to ${result.filePath ?? 'the selected file'}.`)
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#05080d] text-zinc-100">
      <div className="flex h-full">
        <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-black/20 p-4">
          <div className="mb-8 px-2 pt-2">
            <p className="font-playfair text-2xl italic text-white">yuv</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-400">
              Cognitive Control Centre
            </p>
          </div>
          <nav className="space-y-1" aria-label="Cognitive sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                  activeTab === id
                    ? 'bg-cyan-400/10 text-cyan-300'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <Shield className="h-3.5 w-3.5 text-emerald-400" /> Encrypted locally
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">
              Exported JSON is readable. Store it securely.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#05080d]/90 px-8 py-5 backdrop-blur-xl">
            <div>
              <h1 className="text-lg font-medium">
                {TABS.find((tab) => tab.id === activeTab)?.label}
              </h1>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {snapshot
                  ? `Snapshot ${formatDate(snapshot.generatedAt)}`
                  : 'Loading cognitive state…'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void exported()}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refresh()}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </header>

          <div className="p-8">
            {error ? (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-300">
                {notice}
              </div>
            ) : null}
            {!snapshot && loading ? <EmptyState text="Loading YUV’s cognitive state…" /> : null}
            {snapshot && activeTab === 'overview' ? (
              <Overview snapshot={snapshot} refresh={refresh} />
            ) : null}
            {snapshot && activeTab === 'memory' ? (
              <MemoryBrowser memories={snapshot.memories} refresh={refresh} />
            ) : null}
            {snapshot && activeTab === 'goals' ? (
              <GoalsBrowser goals={snapshot.goals} refresh={refresh} />
            ) : null}
            {snapshot && activeTab === 'knowledge' ? (
              <KnowledgeBrowser snapshot={snapshot} refresh={refresh} />
            ) : null}
            {snapshot && activeTab === 'skills' ? (
              <SkillsBrowser skills={snapshot.skills} refresh={refresh} />
            ) : null}
            {snapshot && activeTab === 'activity' ? (
              <ActivityBrowser snapshot={snapshot} refresh={refresh} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function Overview({
  snapshot,
  refresh
}: {
  snapshot: CognitiveControlSnapshot
  refresh: () => Promise<void>
}) {
  const updatePrivacy = async (
    key: keyof CognitiveControlSnapshot['privacy'],
    value: boolean | number
  ) => {
    await window.api.store.setPrivacySettings({ ...snapshot.privacy, [key]: value })
    await refresh()
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Memories"
          value={snapshot.cognition.totalMemories}
          detail={`${snapshot.cognition.activeMemories} active`}
        />
        <StatCard
          label="Goals"
          value={snapshot.planning.totalGoals}
          detail={`${snapshot.planning.activeGoals} active`}
        />
        <StatCard
          label="Knowledge"
          value={snapshot.knowledge.beliefs}
          detail={`${snapshot.knowledge.contestedBeliefs} contested`}
        />
        <StatCard
          label="Skills"
          value={snapshot.skills.length}
          detail={`${snapshot.skills.filter((skill) => skill.status === 'verified').length} verified`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="text-sm font-medium">Privacy and retention</h2>
          <p className="mt-1 text-[10px] text-zinc-500">Both sensitive modalities remain opt-in.</p>
          <label className="mt-5 flex items-center justify-between border-b border-white/5 pb-4 text-xs text-zinc-300">
            Remember conversations
            <input
              type="checkbox"
              checked={snapshot.privacy.storeConversationMemory}
              onChange={(event) =>
                void updatePrivacy('storeConversationMemory', event.target.checked)
              }
            />
          </label>
          <label className="flex items-center justify-between pt-4 text-xs text-zinc-300">
            Remember screen observations
            <input
              type="checkbox"
              checked={snapshot.privacy.storeScreenMemory}
              onChange={(event) => void updatePrivacy('storeScreenMemory', event.target.checked)}
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
            <label className="text-[10px] text-zinc-500">
              Conversation retention
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={snapshot.privacy.conversationRetentionDays}
                  onChange={(event) =>
                    void updatePrivacy('conversationRetentionDays', Number(event.target.value))
                  }
                  className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200"
                  aria-label="Conversation retention in days"
                />
                days
              </span>
            </label>
            <label className="text-[10px] text-zinc-500">
              Screen retention
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={snapshot.privacy.screenRetentionDays}
                  onChange={(event) =>
                    void updatePrivacy('screenRetentionDays', Number(event.target.value))
                  }
                  className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200"
                  aria-label="Screen retention in days"
                />
                days
              </span>
            </label>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="text-sm font-medium">Runtime state</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <p className="text-zinc-500">
              Mode <span className="float-right text-zinc-200">{snapshot.runtime.mode}</span>
            </p>
            <p className="text-zinc-500">
              Cycles{' '}
              <span className="float-right text-zinc-200">{snapshot.runtime.totalCycles}</span>
            </p>
            <p className="text-zinc-500">
              World entities{' '}
              <span className="float-right text-zinc-200">{snapshot.world.entities.length}</span>
            </p>
            <p className="text-zinc-500">
              Reasoning audits{' '}
              <span className="float-right text-zinc-200">{snapshot.reasoningAudits.length}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <h2 className="text-sm font-medium">Capability self-model</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.capabilities.length ? (
            snapshot.capabilities.map((capability) => (
              <div
                key={capability.name}
                className="rounded-xl border border-white/5 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">{capability.name}</span>
                  <Badge
                    tone={
                      capability.state === 'available'
                        ? 'green'
                        : capability.state === 'degraded'
                          ? 'amber'
                          : 'red'
                    }
                  >
                    {capability.state}
                  </Badge>
                </div>
                <p className="mt-2 text-[10px] text-zinc-600">
                  Confidence {Math.round(capability.confidence * 100)}%
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-600">No capabilities recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MemoryBrowser({
  memories,
  refresh
}: {
  memories: MemoryDetail[]
  refresh: () => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.toLowerCase())
  const [kind, setKind] = useState<MemoryKind | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(memories[0]?.id ?? null)
  const selected = memories.find((memory) => memory.id === selectedId) ?? null
  const filtered = useMemo(
    () =>
      memories.filter(
        (memory) =>
          (kind === 'all' || memory.kind === kind) &&
          (!deferredSearch ||
            `${memory.content} ${memory.tags.join(' ')}`.toLowerCase().includes(deferredSearch))
      ),
    [deferredSearch, kind, memories]
  )

  return (
    <div className="grid min-h-[620px] grid-cols-[minmax(300px,0.9fr)_minmax(420px,1.5fr)] gap-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search memory"
            className="h-9 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-xs outline-none focus:border-cyan-400/40"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {MEMORY_KINDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-full px-2 py-1 text-[9px] ${kind === value ? 'bg-cyan-400/15 text-cyan-300' : 'bg-white/5 text-zinc-600'}`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="max-h-[525px] space-y-1 overflow-y-auto pr-1 [content-visibility:auto]">
          {filtered.map((memory) => (
            <button
              key={memory.id}
              type="button"
              onClick={() => setSelectedId(memory.id)}
              className={`w-full rounded-xl border p-3 text-left ${selectedId === memory.id ? 'border-cyan-400/20 bg-cyan-400/[0.07]' : 'border-transparent hover:bg-white/[0.035]'}`}
            >
              <div className="flex items-center justify-between">
                <Badge tone={memory.status === 'active' ? 'cyan' : 'neutral'}>{memory.kind}</Badge>
                <span className="text-[9px] text-zinc-700">{formatDate(memory.updatedAt)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-zinc-300">
                {memory.content}
              </p>
            </button>
          ))}
        </div>
      </div>
      {selected ? (
        <MemoryEditor key={selected.id} memory={selected} refresh={refresh} />
      ) : (
        <EmptyState text="Select a memory to inspect it." />
      )}
    </div>
  )
}

function MemoryEditor({ memory, refresh }: { memory: MemoryDetail; refresh: () => Promise<void> }) {
  const [content, setContent] = useState(memory.content)
  const [tags, setTags] = useState(memory.tags.join(', '))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      const update: MemoryUpdate = {
        content,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      }
      await window.api.cognition.update(memory.id, update)
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!window.confirm('Permanently delete this memory?')) return
    await window.api.cognition.delete(memory.id)
    await refresh()
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge tone="cyan">{memory.kind}</Badge>
          <Badge>{memory.status}</Badge>
        </div>
        <span className="text-[10px] text-zinc-600">{memory.id}</span>
      </div>
      <label className="mt-6 block text-[10px] uppercase tracking-wider text-zinc-500">
        Content
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={8}
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-200 outline-none focus:border-cyan-400/40"
        />
      </label>
      <label className="mt-4 block text-[10px] uppercase tracking-wider text-zinc-500">
        Tags
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs outline-none focus:border-cyan-400/40"
        />
      </label>
      <div className="mt-5 grid grid-cols-2 gap-3 text-[10px] text-zinc-500">
        <p>
          Confidence{' '}
          <span className="float-right text-zinc-300">{Math.round(memory.confidence * 100)}%</span>
        </p>
        <p>
          Salience{' '}
          <span className="float-right text-zinc-300">{Math.round(memory.salience * 100)}%</span>
        </p>
        <p>
          Evidence <span className="float-right text-zinc-300">{memory.evidenceCount}</span>
        </p>
        <p>
          Reinforcement <span className="float-right text-zinc-300">{memory.reinforcement}</span>
        </p>
        <p>
          Created <span className="float-right text-zinc-300">{formatDate(memory.createdAt)}</span>
        </p>
        <p>
          Expires <span className="float-right text-zinc-300">{formatDate(memory.expiresAt)}</span>
        </p>
      </div>
      <div className="mt-6 flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          <Save className="h-3.5 w-3.5" /> Save changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void window.api.cognition
              .update(memory.id, { status: memory.status === 'active' ? 'archived' : 'active' })
              .then(refresh)
          }
        >
          {memory.status === 'active' ? 'Archive' : 'Restore'}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => void remove()}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  )
}

function GoalsBrowser({ goals, refresh }: { goals: GoalRecord[]; refresh: () => Promise<void> }) {
  const changeStatus = async (goal: GoalRecord, status: GoalStatus) => {
    await window.api.planning.updateGoal(goal.id, { status })
    await refresh()
  }
  const remove = async (goal: GoalRecord) => {
    if (!window.confirm(`Delete goal “${goal.title}”?`)) return
    await window.api.planning.deleteGoal(goal.id)
    await refresh()
  }
  if (!goals.length) return <EmptyState text="No goals have been created yet." />
  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <article key={goal.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">{goal.title}</h2>
                <Badge
                  tone={
                    goal.status === 'active'
                      ? 'cyan'
                      : goal.status === 'blocked'
                        ? 'red'
                        : goal.status === 'completed'
                          ? 'green'
                          : 'neutral'
                  }
                >
                  {goal.status}
                </Badge>
                <Badge>{goal.priority}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{goal.desiredOutcome}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${goal.title}`}
              onClick={() => void remove(goal)}
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          </div>
          <div className="mt-5 space-y-2">
            {goal.steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-[10px] text-zinc-500">
                  {index + 1}
                </span>
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : step.status === 'failed' ? (
                  <XCircle className="h-4 w-4 text-red-400" />
                ) : step.status === 'waiting_approval' ? (
                  <CircleAlert className="h-4 w-4 text-amber-400" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-zinc-700" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-zinc-300">{step.title}</p>
                  <p className="truncate text-[9px] text-zinc-600">{step.expectedOutcome}</p>
                </div>
                <Badge tone={step.risk === 'high' || step.risk === 'critical' ? 'red' : 'neutral'}>
                  {step.risk}
                </Badge>
                <Badge>{step.status}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            {goal.status === 'paused' || goal.status === 'blocked' ? (
              <Button size="sm" variant="outline" onClick={() => void changeStatus(goal, 'active')}>
                Resume
              </Button>
            ) : goal.status === 'active' ? (
              <Button size="sm" variant="outline" onClick={() => void changeStatus(goal, 'paused')}>
                Pause
              </Button>
            ) : null}
            {!['completed', 'cancelled'].includes(goal.status) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void changeStatus(goal, 'cancelled')}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

function KnowledgeBrowser({
  snapshot,
  refresh
}: {
  snapshot: CognitiveControlSnapshot
  refresh: () => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.toLowerCase())
  const facts = snapshot.facts.filter(
    (fact) =>
      !query ||
      `${fact.subject.name} ${fact.predicate} ${fact.object.name}`.toLowerCase().includes(query)
  )
  const removeFact = async (id: string) => {
    if (!window.confirm('Delete this relationship?')) return
    await window.api.knowledge.deleteBelief(id)
    await refresh()
  }
  return (
    <div className="space-y-5">
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search entities and relationships"
          className="h-9 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-xs outline-none focus:border-cyan-400/40"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {facts.map((fact) => (
          <div
            key={fact.beliefId}
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-200">
                  <span className="text-cyan-300">{fact.subject.name}</span>{' '}
                  <span className="text-zinc-600">{fact.predicate}</span>{' '}
                  <span className="text-cyan-300">{fact.object.name}</span>
                </p>
                <div className="mt-3 flex gap-2">
                  <Badge
                    tone={
                      fact.status === 'active'
                        ? 'green'
                        : fact.status === 'contested'
                          ? 'amber'
                          : 'neutral'
                    }
                  >
                    {fact.status}
                  </Badge>
                  <Badge>{Math.round(fact.confidence * 100)}% confidence</Badge>
                  <Badge>{fact.evidenceCount} evidence</Badge>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete relationship"
                onClick={() => void removeFact(fact.beliefId)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!facts.length ? <EmptyState text="No matching relationships." /> : null}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <h2 className="text-sm font-medium">Entities</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {snapshot.entities.map((entity) => (
            <span
              key={entity.id}
              className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-zinc-400"
            >
              {entity.name}
              <span className="text-zinc-700">{entity.kind}</span>
              <button
                type="button"
                aria-label={`Delete ${entity.name}`}
                onClick={() => {
                  if (window.confirm(`Delete ${entity.name} and all connected relationships?`))
                    void window.api.knowledge.deleteEntity(entity.id).then(refresh)
                }}
                className="text-zinc-700 hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkillsBrowser({
  skills,
  refresh
}: {
  skills: SkillRecord[]
  refresh: () => Promise<void>
}) {
  const setStatus = async (skill: SkillRecord, status: SkillRecord['status']) => {
    await window.api.skills.setStatus(skill.id, status)
    await refresh()
  }
  if (!skills.length) return <EmptyState text="No procedures have been learned yet." />
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {skills.map((skill) => (
        <article key={skill.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-medium">{skill.name}</h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{skill.description}</p>
            </div>
            <Badge
              tone={
                skill.status === 'verified'
                  ? 'green'
                  : skill.status === 'disabled'
                    ? 'red'
                    : 'amber'
              }
            >
              {skill.status}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-black/20 p-2">
              <p className="text-lg text-white">{skill.successes}</p>
              <p className="text-[9px] text-zinc-600">successes</p>
            </div>
            <div className="rounded-xl bg-black/20 p-2">
              <p className="text-lg text-white">{skill.failures}</p>
              <p className="text-[9px] text-zinc-600">failures</p>
            </div>
            <div className="rounded-xl bg-black/20 p-2">
              <p className="text-lg text-white">{Math.round(skill.confidence * 100)}%</p>
              <p className="text-[9px] text-zinc-600">confidence</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {skill.steps.map((step, index) => (
              <div
                key={`${skill.id}-${index}`}
                className="flex items-center gap-2 text-[10px] text-zinc-500"
              >
                <span className="text-zinc-700">{index + 1}.</span>
                <span className="flex-1">{step.instruction}</span>
                <Badge tone={step.risk === 'high' || step.risk === 'critical' ? 'red' : 'neutral'}>
                  {step.risk}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            {skill.status === 'disabled' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void setStatus(skill, 'candidate')}
              >
                Enable as candidate
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void setStatus(skill, 'disabled')}>
                Disable
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (window.confirm(`Delete skill “${skill.name}”?`))
                  void window.api.skills.delete(skill.id).then(refresh)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function ActivityBrowser({
  snapshot,
  refresh
}: {
  snapshot: CognitiveControlSnapshot
  refresh: () => Promise<void>
}) {
  if (!snapshot.actions.length)
    return <EmptyState text="No computer actions have been recorded yet." />
  return (
    <div className="space-y-3">
      {snapshot.actions.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4"
        >
          {entry.status === 'succeeded' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
          ) : entry.status === 'failed' || entry.status === 'blocked' ? (
            <XCircle className="mt-0.5 h-4 w-4 text-red-400" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 text-amber-400" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-200">{entry.action}</p>
              <Badge
                tone={
                  entry.status === 'succeeded'
                    ? 'green'
                    : entry.status === 'authorized'
                      ? 'cyan'
                      : 'red'
                }
              >
                {entry.status}
              </Badge>
              <Badge tone={entry.risk === 'high' || entry.risk === 'critical' ? 'red' : 'neutral'}>
                {entry.risk}
              </Badge>
              {entry.requiredApproval ? (
                <Badge tone={entry.approved ? 'green' : 'amber'}>
                  {entry.approved ? 'approved' : 'approval required'}
                </Badge>
              ) : null}
            </div>
            {entry.detail ? <p className="mt-2 text-[10px] text-zinc-500">{entry.detail}</p> : null}
            {entry.error ? <p className="mt-2 text-[10px] text-red-400">{entry.error}</p> : null}
            <p className="mt-2 text-[9px] text-zinc-700">
              {entry.source} · {formatDate(entry.createdAt)}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete action record"
            onClick={() => {
              if (window.confirm('Delete this audit entry?'))
                void window.api.actions.delete(entry.id).then(refresh)
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </Button>
        </div>
      ))}
    </div>
  )
}
