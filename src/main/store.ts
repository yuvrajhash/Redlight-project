import { safeStorage } from 'electron'
import Store from 'electron-store'

export type KnownService = 'livekit' | 'openai' | 'google' | 'sarvam'

export type ProviderConfig = {
  llm: string
  stt: string
  tts: string
}

export type FridayUser = {
  id: string
  email: string
  name: string
  picture?: string
}

type StoreSchema = {
  onboardingComplete: boolean
  encryptedApiKeys: Partial<Record<KnownService, string>>
  providerConfig: ProviderConfig
  user: FridayUser | null
}

const store = new Store<StoreSchema>({
  name: 'friday-config',
  defaults: {
    onboardingComplete: false,
    encryptedApiKeys: {},
    providerConfig: {
      llm: 'gemini',
      stt: 'sarvam',
      tts: 'sarvam'
    },
    user: null
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
    console.warn('safeStorage encryption not available, storing as-is')
    keys[service] = 'RAW_' + plainTextKey
    store.set('encryptedApiKeys', keys)
    return
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
    return storedValue.replace('RAW_', '')
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

export function getUser(): FridayUser | null {
  return store.get('user') ?? null
}

export function setUser(user: FridayUser | null): void {
  store.set('user', user)
}

export function resetStore(): void {
  store.clear()
}
