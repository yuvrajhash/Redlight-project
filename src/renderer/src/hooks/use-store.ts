import { useMemo } from 'react'
import type { KnownService, PrivacySettings, ProviderConfig } from '../../../preload/types'

export function useStore() {
  return useMemo(
    () => ({
      initialOnboardingComplete: window.api.store.initialOnboardingComplete,
      isOnboardingComplete: () => window.api.store.isOnboardingComplete(),
      setOnboardingComplete: (value: boolean) => window.api.store.setOnboardingComplete(value),
      saveApiKey: (service: KnownService, key: string) => window.api.store.saveApiKey(service, key),
      deleteApiKey: (service: KnownService) => window.api.store.deleteApiKey(service),
      validateGoogleKey: (key: string) => window.api.store.validateGoogleKey(key),
      validateOpenAiKey: (key: string) => window.api.store.validateOpenAiKey(key),
      getProviderConfig: () => window.api.store.getProviderConfig(),
      setProviderConfig: (config: ProviderConfig) => window.api.store.setProviderConfig(config),
      getPrivacySettings: () => window.api.store.getPrivacySettings(),
      setPrivacySettings: (settings: PrivacySettings) =>
        window.api.store.setPrivacySettings(settings),
      resetStore: () => window.api.store.resetStore()
    }),
    []
  )
}
