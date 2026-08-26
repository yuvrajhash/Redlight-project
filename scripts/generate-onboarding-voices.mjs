// Generates Friday's onboarding narration as bundled audio files.
//
// Onboarding plays BEFORE the user enters their OpenAI key, so these lines can't
// be synthesized at runtime — they must ship with the app. Run this whenever the
// script in `lines` below changes:
//
//   node scripts/generate-onboarding-voices.mjs
//
// Reads OPENAI_API_KEY from the environment or .env.local. Writes one mp3 per
// step into src/renderer/src/assets/sfx/voice/. Keep the `text` here in sync with
// the `subtitle` captions in src/renderer/src/components/onboarding/script.ts.
//
// NOTE: OpenAI's usage policies require disclosing to end users that this voice
// is AI-generated. Friday is overtly an AI assistant, which satisfies that.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const MODEL = 'gpt-4o-mini-tts'
const VOICE = 'marin' // warm + high quality; swap for 'cedar'/'shimmer'/'nova' to taste

// Friday's persona — calm, warm, quietly confident. Steers tone, not words.
const INSTRUCTIONS = [
  'You are Friday, a calm, warm, and quietly confident AI assistant — a poised',
  'personal concierge. Speak unhurried and reassuring, with subtle warmth and a',
  'faint futuristic polish. Use natural pauses and gentle intonation. Never robotic,',
  'never theatrical.'
].join(' ')

// One entry per onboarding step. `id` becomes <id>.mp3.
const lines = [
  {
    id: 'welcome',
    text: "Welcome. I'm Friday. Let's get you set up — it'll only take a minute."
  },
  {
    id: 'permissions',
    text: "First, I'll need a little access — so I can see your screen, and hear your voice."
  },
  {
    id: 'byok',
    text: 'One last thing: your key. It stays encrypted on this machine, and never leaves it. Then we begin.'
  }
]

function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  try {
    const env = readFileSync(resolve(root, '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/)
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
    }
  } catch {
    /* fall through */
  }
  throw new Error('OPENAI_API_KEY not found in environment or .env.local')
}

const key = loadKey()
const outDir = resolve(root, 'src/renderer/src/assets/sfx/voice')
mkdirSync(outDir, { recursive: true })

for (const { id, text } of lines) {
  process.stdout.write(`· ${id} … `)
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: text,
      instructions: INSTRUCTIONS,
      response_format: 'mp3'
    })
  })

  if (!res.ok) {
    console.error(`\n  failed (${res.status}): ${await res.text()}`)
    process.exit(1)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const file = resolve(outDir, `${id}.mp3`)
  writeFileSync(file, buf)
  console.log(`${(buf.length / 1024).toFixed(0)} KB → ${file}`)
}

console.log('\nDone. Voices written to src/renderer/src/assets/sfx/voice/')
