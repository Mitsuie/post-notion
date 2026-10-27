import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// 既存コードへの指摘で CI を落とさないよう、推奨ルールの重大度を warn に下げる。
// 警告は別の PR で解消し、段階的に error へ戻す
const asWarn = (configs) =>
  configs.map((config) =>
    config.rules
      ? {
          ...config,
          rules: Object.fromEntries(
            Object.entries(config.rules).map(([name, entry]) => {
              const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
              const isOn = severity === 'error' || severity === 2;
              return [name, isOn ? ['warn', ...options] : entry];
            }),
          ),
        }
      : config,
  );

const tsFiles = ['{src,api,functions,server,scripts}/**/*.{ts,tsx}', 'vite.config.ts'];

export default defineConfig([
  globalIgnores(['dist', 'node_modules', '.wrangler', 'public']),
  {
    files: tsFiles,
    extends: asWarn([js.configs.recommended, ...tseslint.configs.recommended]),
    rules: {
      // any の解消は W3-2（QA-10）で扱う
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: asWarn([reactHooks.configs.flat.recommended]),
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // フックの呼び出し規則違反は実行時に壊れるため、既存コードでも error のままにする
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['{api,functions}/**/*.ts'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    files: ['{server,scripts}/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
