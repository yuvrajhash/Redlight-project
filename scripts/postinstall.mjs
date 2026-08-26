// Tolerant native-deps rebuild.
//
// `electron-builder install-app-deps` rebuilds native modules against Electron's
// ABI. Some modules (uiohook-napi) ship prebuilt N-API binaries that are ABI-stable
// and load at runtime without any rebuild — but @electron/rebuild doesn't recognise
// their node-gyp-build prebuild and tries to compile from source, which fails on
// machines without a C++/Python toolchain. That failure shouldn't abort the whole
// install (it would block every `pnpm <script>` via the deps-verify check), since
// the prebuilt binary is used at runtime anyway.
//
// So: run the rebuild, surface its output, but never fail on a non-zero exit.

import { spawnSync } from 'node:child_process'

const res = spawnSync('electron-builder', ['install-app-deps'], {
  stdio: 'inherit',
  shell: true
})

if (res.status !== 0) {
  console.warn(
    '[postinstall] electron-builder install-app-deps exited non-zero — continuing. ' +
      'Modules with prebuilt binaries (e.g. uiohook-napi) still load at runtime.'
  )
}

process.exit(0)
