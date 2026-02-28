import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  eslintConfigPrettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // svelte-check handles compile validation; this rule fires false positives
      // on rest-props patterns used by shadcn-svelte components
      'svelte/valid-compile': 'off',
    },
  },
  {
    ignores: ['.svelte-kit/**', 'build/**', 'dist/**'],
  }
);
