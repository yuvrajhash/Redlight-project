import { useEffect, useState, type ComponentType } from 'react'
import { Mic, MicOff, Settings } from 'lucide-react'
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura'
import { SearchSourcesPanel } from '@/components/search-sources-panel'
import { ComputerUseCard } from '@/components/computer-use-card'
import { SettingsPanel } from '@/components/settings-panel'
import { YUVSessionProvider, useYUVSessionContext } from '@/realtime/useYUVSession'

type PanelId = 'control' | 'settings'

const ISLAND_PANELS: Record<PanelId, { component: ComponentType; autoCloseMs?: number }> = {
  control: { component: ComputerUseCard },
  settings: { component: SettingsPanel }
}

export function DynamicIslandApp() {
  return (
    <YUVSessionProvider>
      <DynamicIsland />
      <SearchSourcesPanel />
    </YUVSessionProvider>
  )
}

function DynamicIsland() {
  const { agentState, remoteTrack, micMode, setMicMode, micLive } = useYUVSessionContext()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelContent, setPanelContent] = useState<PanelId>('settings')
  const [flashId, setFlashId] = useState(0)
  const [isControlling, setIsControlling] = useState(false)

  useEffect(() => {
    window.electron.ipcRenderer.send('set-ignore-mouse-events', true, {
      forward: true
    })
  }, [])

  useEffect(() => {
    const onFlash = () => {
      setFlashId((n) => n + 1)
    }
    const onControl = (_e: unknown, payload: { active: boolean }) => {
      setIsControlling(payload.active)
      if (payload.active) {
        setPanelContent('control')
        setIsPanelOpen(true)
      } else {
        setIsPanelOpen(false)
      }
    }
    const onPanel = (_e: unknown, isOpen: boolean) => {
      setPanelContent('settings')
      setIsPanelOpen(isOpen)
    }
    window.electron.ipcRenderer.on('screen-capture-flash', onFlash)
    window.electron.ipcRenderer.on('computer-control', onControl)
    window.electron.ipcRenderer.on('toggle-bottom-panel', onPanel)
    return () => {
      window.electron.ipcRenderer.removeAllListeners('screen-capture-flash')
      window.electron.ipcRenderer.removeAllListeners('computer-control')
      window.electron.ipcRenderer.removeAllListeners('toggle-bottom-panel')
    }
  }, [])

  useEffect(() => {
    const meta = ISLAND_PANELS[panelContent]
    if (!isPanelOpen || !meta.autoCloseMs) return
    const t = window.setTimeout(() => setIsPanelOpen(false), meta.autoCloseMs)
    return () => clearTimeout(t)
  }, [isPanelOpen, panelContent])

  const Panel = ISLAND_PANELS[panelContent].component

  return (
    <>
      {flashId > 0 && <div key={flashId} className="capture-flash-overlay" />}
      {isControlling && <div className="control-glow-overlay" />}
      <div
        className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3"
        onMouseEnter={() => {
          setIsExpanded(true)
          window.electron.ipcRenderer.send('set-ignore-mouse-events', false)
        }}
        onMouseLeave={() => {
          if (!isPanelOpen) {
            setIsExpanded(false)
            window.electron.ipcRenderer.send('set-ignore-mouse-events', true, {
              forward: true
            })
          }
        }}
      >
        <div
          className={`pointer-events-auto island-shimmer relative flex flex-col items-center overflow-hidden rounded-[28px] border border-white/10 bg-black/80 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 ${
            isExpanded || isPanelOpen ? 'w-[320px]' : 'w-[180px]'
          } ${micLive ? 'mic-glow-active' : ''}`}
        >
          <div className="flex h-14 w-full items-center justify-between px-3">
            <div className="h-10 w-10">
              <AgentAudioVisualizerAura agentState={agentState} audioTrack={remoteTrack} />
            </div>
            {(isExpanded || isPanelOpen) && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-white/10"
                  onClick={() => setMicMode(micMode === 'always' ? 'ptt' : 'always')}
                  title={micMode === 'always' ? 'Always listening' : 'Push to talk (Ctrl+Alt)'}
                >
                  {micLive ? (
                    <Mic className="h-4 w-4" />
                  ) : (
                    <MicOff className="h-4 w-4 text-zinc-400" />
                  )}
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-white/10"
                  onClick={() => {
                    setPanelContent('settings')
                    setIsPanelOpen((v) => !(v && panelContent === 'settings'))
                  }}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {isPanelOpen && (
            <div className="w-full border-t border-white/10 pb-2 pt-1">
              <Panel />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
