import { defineConfig, globalIgnores } from 'eslint/config';
import typescript from 'eslint-config-next/typescript';
import hooks from 'eslint-plugin-react-hooks';
export default defineConfig([
  ...typescript,
  globalIgnores(['node_modules/**', 'ios/**', 'android/**', 'dist/**', '.expo/**']),
  { plugins: { 'react-hooks': hooks }, rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error',
  } },
]);
