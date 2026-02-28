import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    // The parser and its generated types use older JS patterns — relax strict rules
    rules: {
      'no-var': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
    },
  },
  {
    // Test files may import vitest helpers without using all of them
    files: ['test/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // grammar.ts is auto-generated from parser.ne — do not lint
    ignores: ['dist/**', 'grammar.ts'],
  }
);
