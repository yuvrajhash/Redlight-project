import { safeStorage } from 'electron'
import type { PersistenceCodec } from './cognition/persistence'

const PREFIX = 'YUV_ENCRYPTED_V1:'

export function createCognitiveStorageCodec(): PersistenceCodec {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure OS storage is unavailable; persistent cognition is disabled.')
  }
  return {
    isEncoded: (value) => value.startsWith(PREFIX),
    encode: (plainText) => `${PREFIX}${safeStorage.encryptString(plainText).toString('base64')}`,
    decode: (storedText) => {
      if (!storedText.startsWith(PREFIX)) return storedText
      const encrypted = Buffer.from(storedText.slice(PREFIX.length), 'base64')
      return safeStorage.decryptString(encrypted)
    }
  }
}
