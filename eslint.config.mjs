import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const angular = require('@angular-eslint/eslint-plugin');
const templates = require('@angular-eslint/eslint-plugin-template');
const parser = require('@typescript-eslint/parser');
const types = require('@typescript-eslint/eslint-plugin');

export default [
  { ignores: ['www/**', 'node_modules/**', 'src/environments/supabase.generated.ts'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser, parserOptions: { tsconfigRootDir: path.resolve(import.meta.dirname) } },
    plugins: { '@angular-eslint': angular, '@typescript-eslint': types },
    rules: { ...angular.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': 'error' },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: require('@angular-eslint/template-parser') },
    plugins: { '@angular-eslint/template': templates },
    rules: { ...templates.configs.recommended.rules },
  },
];
