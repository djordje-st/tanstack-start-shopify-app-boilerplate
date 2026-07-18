//  @ts-check

import { fileURLToPath } from 'node:url'
import { tanstackConfig } from '@tanstack/eslint-config'
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config'

const gitignore = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
  ...tanstackConfig,
  includeIgnoreFile(gitignore, { gitignoreResolution: true }),
  globalIgnores(['src/routeTree.gen.ts', 'src/types/generated/']),
  {
    rules: {
      'no-shadow': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
])
