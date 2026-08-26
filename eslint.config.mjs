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
      // The recovered application relies on inferred return types, native module shims,
      // and a triple-slash bridge for its renderer environment declaration.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/triple-slash-reference': 'off'
    }
  }
)
