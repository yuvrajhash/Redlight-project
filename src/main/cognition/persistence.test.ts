import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DurableTextFile, type PersistenceCodec } from './persistence.ts'

const codec: PersistenceCodec = {
  isEncoded: (value) => value.startsWith('ENC:'),
  encode: (value) => `ENC:${Buffer.from(value).toString('base64')}`,
  decode: (value) => Buffer.from(value.slice(4), 'base64').toString('utf8')
}

test('encrypts new cognitive snapshots and migrates legacy plaintext', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuv-persistence-'))
  const path = join(dir, 'memory.json')
  await writeFile(path, JSON.stringify({ version: 1, value: 'legacy' }), 'utf8')
  const file = new DurableTextFile(path, codec)
  assert.equal(JSON.parse((await file.read())!).value, 'legacy')
  assert.match(await readFile(path, 'utf8'), /^ENC:/)
  await assert.rejects(readFile(`${path}.bak`, 'utf8'), { code: 'ENOENT' })
})

test('recovers the last valid snapshot when the primary file is corrupt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuv-persistence-'))
  const path = join(dir, 'memory.json')
  const file = new DurableTextFile(path, codec)
  await file.write(JSON.stringify({ version: 1, value: 'first' }))
  await file.write(JSON.stringify({ version: 1, value: 'second' }))
  await writeFile(path, 'corrupt', 'utf8')
  assert.equal(JSON.parse((await file.read())!).value, 'first')
})
