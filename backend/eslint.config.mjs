import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['src/generated/**', 'dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
