import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const noDangerousHtml = {
  selector:
    "JSXAttribute[name.name='dangerouslySetInnerHTML'], MemberExpression[property.name=/^(innerHTML|outerHTML|insertAdjacentHTML)$/], CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
  message: 'Render user text as React text only (NFR-05).',
};

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/', 'blob-report/', 'node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js', 'scripts/*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': ['error', noDangerousHtml],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'three', 'idb', 'zustand'].map((name) => ({
            name,
            message: 'src/domain must stay pure (ADR-05).',
          })),
          patterns: [
            {
              group: ['react/*', 'react-dom/*', 'three/*', 'idb/*', 'zustand/*'],
              message: 'src/domain must stay pure (ADR-05).',
            },
            {
              group: ['@/app', '@/app/*', '@/render3d', '@/render3d/*', '@/persistence', '@/persistence/*', '@/i18n', '@/i18n/*'],
              message: 'src/domain may import only zod and src/domain.',
            },
            {
              group: ['../app/*', '../render3d/*', '../persistence/*', '../i18n/*', '../../app/*', '../../render3d/*', '../../persistence/*', '../../i18n/*'],
              message: 'src/domain may import only zod and src/domain.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'Intl', 'crypto'].map((name) => ({
          name,
          message: 'Browser globals and locale APIs are not allowed in src/domain.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        noDangerousHtml,
        { selector: "NewExpression[callee.name='Date']", message: 'No clock in src/domain (NFR-01).' },
        { selector: "MemberExpression[object.name='Date']", message: 'No clock in src/domain (NFR-01).' },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'No randomness in src/domain (NFR-01).' },
        { selector: "Identifier[name='Intl']", message: 'No locale APIs in src/domain (NFR-01).' },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
