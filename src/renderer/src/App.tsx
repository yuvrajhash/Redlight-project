import { useState } from 'react'
import { useStore } from '@/hooks/use-store'
import { Onboarding } from '@/components/onboarding'
import { DynamicIslandApp } from '@/components/dynamic-island'
import { CognitiveControlCentre } from '@/components/cognitive-control-centre'

export default function App() {
  const isControlCentre =
    new URLSearchParams(window.location.search).get('view') === 'control-centre'
  const { initialOnboardingComplete } = useStore()
  const [onboarded, setOnboarded] = useState(initialOnboardingComplete)

  if (isControlCentre) return <CognitiveControlCentre />

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {onboarded && (
        <div className="absolute inset-0 z-0">
          <DynamicIslandApp />
        </div>
      )}
      {!onboarded && (
        <div className="absolute inset-0 z-10">
          <Onboarding
            onComplete={async () => {
              await window.api.completeOnboarding()
              setOnboarded(true)
            }}
          />
        </div>
      )}
    </div>
  )
}
