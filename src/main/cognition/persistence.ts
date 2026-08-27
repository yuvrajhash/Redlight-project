import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type PersistenceCodec = {
  encode: (plainText: string) => string
  decode: (storedText: string) => string
  isEncoded: (storedText: string) => boolean
}

export class DurableTextFile {
  private readonly filePath: string
  private readonly codec?: PersistenceCodec

  constructor(filePath: string, codec?: PersistenceCodec) {
    this.filePath = filePath
    this.codec = codec
  }

  async read(): Promise<string | null> {
    const candidates = [this.filePath, `${this.filePath}.bak`]
    let lastError: unknown
    for (const candidate of candidates) {
      try {
        const stored = await readFile(candidate, 'utf8')
        const plain = this.codec?.isEncoded(stored) ? this.codec.decode(stored) : stored
        JSON.parse(plain)
        if (candidate.endsWith('.bak')) await this.write(plain)
        else if (this.codec && !this.codec.isEncoded(stored)) await this.write(plain)
        return plain
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') lastError = error
      }
    }
    if (lastError) throw lastError
    return null
  }

  async write(plainText: string): Promise<void> {
    JSON.parse(plainText)
    await mkdir(dirname(this.filePath), { recursive: true })
    try {
      const current = await readFile(this.filePath, 'utf8')
      if (!this.codec || this.codec.isEncoded(current)) {
        await writeFile(`${this.filePath}.bak`, current, {
          encoding: 'utf8',
          mode: 0o600
        })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const temporary = `${this.filePath}.tmp`
    const stored = this.codec ? this.codec.encode(plainText) : plainText
    await writeFile(temporary, stored, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, this.filePath)
  }
}
