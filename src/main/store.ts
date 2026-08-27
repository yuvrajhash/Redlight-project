import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { PrivacySettings } from '../shared/control-centre'

export type KnownService = 'livekit' | 'openai' | 'google' | 'sarvam'

export type ProviderConfig = {
  llm: string
  stt: string
  tts: string
}

export type { PrivacySettings } from '../shared/control-centre'

type StoreSchema = {
  onboardingComplete: boolean
  encryptedApiKeys: Partial<Record<KnownService, string>>
  providerConfig: ProviderConfig
  selectedDisplayId: number | null
  privacySettings: PrivacySettings
}

const store = new Store<StoreSchema>({
  name: 'yuv-config',
  defaults: {
    onboardingComplete: false,
    encryptedApiKeys: {},
    providerConfig: {
      llm: 'gemini',
      stt: 'sarvam',
      tts: 'sarvam'
    },
    selectedDisplayId: null,
    privacySettings: {
      storeConversationMemory: false,
      storeScreenMemory: false,
      conversationRetentionDays: 30,
      screenRetentionDays: 1
    }
  }
})

export function isOnboardingComplete(): boolean {
  return store.get('onboardingComplete')
}

export function setOnboardingComplete(value: boolean): void {
  store.set('onboardingComplete', value)
}

export function saveApiKey(service: KnownService, plainTextKey: string): void {
  const keys = store.get('encryptedApiKeys')
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure OS key storage is unavailable. YUV refused to save the API key.')
  }
  const encryptedBuffer = safeStorage.encryptString(plainTextKey)
  keys[service] = 'ENC_' + encryptedBuffer.toString('base64')
  store.set('encryptedApiKeys', keys)
}

export function getApiKey(service: KnownService): string | null {
  const keys = store.get('encryptedApiKeys')
  const storedValue = keys[service]
  if (!storedValue) return null
  if (storedValue.startsWith('RAW_')) {
    delete keys[service]
    store.set('encryptedApiKeys', keys)
    console.error(`Removed insecure legacy API key storage for service: ${service}`)
    return null
  }
  if (storedValue.startsWith('ENC_')) {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('Cannot decrypt: safeStorage is currently unavailable on this system.')
      return null
    }
    try {
      const base64String = storedValue.replace('ENC_', '')
      const buffer = Buffer.from(base64String, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      console.error(`Failed to decrypt API key for service: ${service}`)
      return null
    }
  }
  return null
}

export function deleteApiKey(service: KnownService): void {
  const keys = store.get('encryptedApiKeys')
  delete keys[service]
  store.set('encryptedApiKeys', keys)
}

export function getProviderConfig(): ProviderConfig {
  return store.get('providerConfig')
}

export function setProviderConfig(config: ProviderConfig): void {
  store.set('providerConfig', config)
}

export function getSelectedDisplayId(): number | null {
  return store.get('selectedDisplayId')
}

export function setSelectedDisplayId(displayId: number | null): void {
  store.set('selectedDisplayId', displayId)
}

export function getPrivacySettings(): PrivacySettings {
  const saved = store.get('privacySettings')
  return {
    storeConversationMemory: saved.storeConversationMemory ?? false,
    storeScreenMemory: saved.storeScreenMemory ?? false,
    conversationRetentionDays: saved.conversationRetentionDays ?? 30,
    screenRetentionDays: saved.screenRetentionDays ?? 1
  }
}

export function setPrivacySettings(settings: PrivacySettings): void {
  const retention = (value: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(1, Math.min(3650, Math.round(value))) : fallback
  store.set('privacySettings', {
    storeConversationMemory: settings.storeConversationMemory === true,
    storeScreenMemory: settings.storeScreenMemory === true,
    conversationRetentionDays: retention(settings.conversationRetentionDays, 30),
    screenRetentionDays: retention(settings.screenRetentionDays, 1)
  })
}

export function resetStore(): void {
  store.clear()
}
