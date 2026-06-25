// Flat ESLint config (ESLint 9) using typescript-eslint.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // firmware is C++, dist/ is build output — never lint these.
  { ignores: ['**/dist/**', '**/node_modules/**', 'firmware/**'] },
  ...tseslint.configs.recommended,
  // Machine-enforced purity for the pure-TS core (Blueprint §4 / eval-as-code):
  // core/ may ONLY depend on @nhipsang/schema + its own internals — no React,
  // no DOM/UI, no sibling audio/transport/ui modules.
  {
    files: ['simulator/src/core/**/*.ts', 'simulator/src/core/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'core/ must stay pure TS — no React.' },
            { name: 'react-dom', message: 'core/ must stay pure TS — no React.' },
          ],
          patterns: [
            {
              group: ['../ui', '../ui/*', '../audio', '../audio/*', '../transport', '../transport/*'],
              message: 'core/ may only depend on @nhipsang/schema and core internals.',
            },
          ],
        },
      ],
    },
  },
);
