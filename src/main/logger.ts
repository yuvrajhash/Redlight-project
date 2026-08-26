import log from 'electron-log/main'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync } from 'fs'

export const LOG_DIR = join(tmpdir(), 'electron-app-logs')
mkdirSync(LOG_DIR, { recursive: true })

log.transports.file.resolvePathFn = () => join(LOG_DIR, 'main.log')
log.transports.file.level = 'info'
log.transports.file.maxSize = 5 * 1024 * 1024
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false
log.initialize()

export default log
