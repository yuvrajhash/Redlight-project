import tseslint from '@electron-toolkit/eslint-config-ts'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'out/**',
      'recovered-out/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js'
    ]
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Native module shims and OpenAI SDK response adapters require runtime-shaped values.
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
