import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.cursor/**', '.agent/**', '.agents/**', 'skills/**', 'scratch/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Primitivos shadcn: fast-refresh não se aplica.
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Contexts exportam Provider + hook (padrão documentado em AGENTS.md).
    files: ['src/contexts/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Ficheiros de configuração correm em Node.
    files: ['*.config.{js,jsx}', 'vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Testes e utilitários de teste usam globais Node (global, process) além do browser.
    files: [
      '**/*.test.{js,jsx}',
      '**/*.integration.test.{js,jsx}',
      '**/*E2E.test.{js,jsx}',
      'src/test/**/*.{js,jsx}',
      'src/setupTests.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
])
