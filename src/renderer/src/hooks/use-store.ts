import { useMemo } from 'react'
import type { FridayUser, KnownService, ProviderConfig } from '../../../preload/types'

export function useStore() {
  return useMemo(
    () => ({
      initialOnboardingComplete: window.api.store.initialOnboardingComplete,
      isOnboardingComplete: () => window.api.store.isOnboardingComplete(),
      setOnboardingComplete: (value: boolean) => window.api.store.setOnboardingComplete(value),
      saveApiKey: (service: KnownService, key: string) => window.api.store.saveApiKey(service, key),
      getApiKey: (service: KnownService) => window.api.store.getApiKey(service),
      deleteApiKey: (service: KnownService) => window.api.store.deleteApiKey(service),
      validateGoogleKey: (key: string) => window.api.store.validateGoogleKey(key),
      validateOpenAiKey: (key: string) => window.api.store.validateOpenAiKey(key),
      getProviderConfig: () => window.api.store.getProviderConfig(),
      setProviderConfig: (config: ProviderConfig) => window.api.store.setProviderConfig(config),
      resetStore: () => window.api.store.resetStore(),
      getUser: (): Promise<FridayUser | null> => window.api.auth.getUser()
    }),
    []
  )
}
