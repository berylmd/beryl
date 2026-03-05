import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import betterTailwind from 'eslint-plugin-better-tailwindcss';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  eslintConfigPrettier,
  ...svelte.configs['flat/prettier'],
  {
    // Apply Tailwind rules to app code; shadcn-svelte UI components are generated and managed separately
    files: ['**/*.svelte', '**/*.ts'],
    ignores: ['src/lib/components/ui/**'],
    ...betterTailwind.configs['recommended'],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/routes/layout.css',
      },
    },
    rules: {
      ...betterTailwind.configs['recommended'].rules,
      // Disabled: conflicts with Prettier (they fight over indentation in multiline class strings)
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
    },
  },
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
