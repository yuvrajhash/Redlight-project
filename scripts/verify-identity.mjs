import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const forbidden = [
  /SAGAR TAMANG/i,
  /SAGAR-TAMANG/i,
  /feynmanpi/i,
  /Tony Stark/i,
  /F\.R\.I\.D\.A\.Y/i,
  /\bfriday\b/i,
  /\bGroww\b/i
]
const allowed = new Set(['NOTICE.md', 'scripts/verify-identity.mjs'])
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
  encoding: 'utf8'
})
  .split(/\r?\n/)
  .filter(Boolean)

const violations = []
for (const file of files) {
  if (allowed.has(file)) continue
  let contents
  try {
    contents = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const pattern of forbidden) {
    if (pattern.test(contents)) violations.push(`${file}: ${pattern}`)
  }
}

if (violations.length) {
  console.error(`Legacy identity check failed:\n${violations.join('\n')}`)
  process.exit(1)
}
console.log(`YUV identity check passed across ${files.length} files.`)
