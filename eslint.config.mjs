// ESLint 9 flat config for Connect.
// - Next 16 ships FLAT configs (eslint-config-next/core-web-vitals, /typescript)
// - react-hooks v7 exposes real flat configs under configs.flat
// - security plugins: eslint-plugin-security (v4) + eslint-plugin-no-secrets
import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import noSecrets from 'eslint-plugin-no-secrets'
import reactHooks from 'eslint-plugin-react-hooks'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'coverage/**',

      // Generated / tooling output. These directories hold thousands of
      // third-party or machine-written files (e.g. the Sonar scanner unpacks
      // an eslint-bridge bundle into .scannerwork/.sonartmp). Linting them
      // produces thousands of phantom errors that hide real regressions, so
      // they are excluded at the source of truth (this config) rather than
      // relying on the caller to remember.
      '.scannerwork/**',
      '**/.scannerwork/**',
      'logs/**',
      'sonar-output.txt',
      'eslint-report.json',

      // Config files are tooling, not app code.
      'next-env.d.ts',
      '.parity-probe.cjs',
      'eslint.config.mjs',
      'next.config.mjs',
      'postcss.config.mjs',
      'vitest.config.mjs',
      'supabase/database.types.ts',
      '.github/**',

      // Local scratch / report output (see .gitignore). Globbed so newly
      // created scratch files cannot pollute the lint signal.
      '*.log',
      'tsc-errors*.txt',
      'tsc-run*.txt',
      'tsc-final*.txt',
      'tsc-out*.txt',
      'tsc2.txt',
      'tsc3.txt',
      'tsc_final.txt',
      'build-log.txt',
      'build-run.log',
      'lint*.log',
      'test-run.log',
      'vitest-run.log',
      'gates-*.txt',
      'smoke*.txt',
      '*.tsbuildinfo',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],

  {
    plugins: { security, 'no-secrets': noSecrets },
    rules: {
      // Project convention: consistent-but-not-pedantic TypeScript.
      'no-case-declarations': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      quotes: [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
      'no-secrets/no-secrets': [
        'error',
        {
          ignoreContent: [
            'https://',
            'http://',
            'localhost',
            '@supabase',
            '@mock',
          ],
          ignoreCase: true,
        },
      ],
      // The codebase legitimately reads object props by key (env proxy, stores).
      'security/detect-object-injection': 'off',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-child-process': 'error',
    },
  },

  {
    // TypeScript-only tuning so legacy + scaffolded code stays lint-clean.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },

  {
    // Standalone operator tooling under scripts/** (CLI automations, scanners).
    // These are run by a human or CI, never bundled into the app bundle, so
    // their entire contract is progress reporting on stdout — the UI-oriented
    // `no-console` policy does not apply.
    files: ['scripts/**/*.{js,mjs}'],
    rules: { 'no-console': 'off' },
  },
]
