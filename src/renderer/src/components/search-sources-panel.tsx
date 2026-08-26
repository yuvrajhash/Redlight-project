import { useEffect, useState } from 'react'

export type SearchSource = {
  title: string
  url: string
  favicon: string | null
}

export function SearchSourcesPanel() {
  const [sources, setSources] = useState<SearchSource[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (_e: unknown, payload: { sources: SearchSource[] }) => {
      setSources(payload.sources ?? [])
      setVisible(true)
      window.setTimeout(() => setVisible(false), 13000)
    }
    window.electron.ipcRenderer.on('search-sources', handler)
    return () => {
      window.electron.ipcRenderer.removeAllListeners('search-sources')
    }
  }, [])

  if (!visible || sources.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-6 top-1/2 z-40 flex w-56 -translate-y-1/2 flex-col gap-2">
      {sources.slice(0, 6).map((s) => (
        <div
          key={s.url}
          className="source-viz-glow flex items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-2.5 py-2 text-left backdrop-blur-md"
        >
          {s.favicon ? (
            <img src={s.favicon} alt="" className="h-4 w-4 rounded-sm" />
          ) : (
            <div className="h-4 w-4 rounded-sm bg-white/20" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-zinc-100">{s.title}</p>
            <p className="truncate text-[10px] text-zinc-500">{s.url}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
