import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Desktop is a CommonJS Electron app; require() is expected in forge config and preload
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['.vite/**', 'out/**'],
  }
);
