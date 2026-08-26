import { AgentAudioVisualizerAura } from './agents-ui/agent-audio-visualizer-aura'

export function FridayOrb({
  speaking,
  audioTrack
}: {
  speaking: boolean
  audioTrack: MediaStreamTrack | null
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
      <div className="h-[480px] w-[480px]">
        <AgentAudioVisualizerAura
          agentState={speaking ? 'speaking' : 'idle'}
          audioTrack={audioTrack}
        />
      </div>
    </div>
  )
}
