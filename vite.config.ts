/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };
import { addCspToHeadersFile, buildContentSecurityPolicy } from './scripts/csp.ts';

// ビルドした index.html のインラインスクリプトのハッシュから CSP（Report-Only）を作り、dist/_headers に書き出す
// （public/_headers は writeBundle の時点でコピー済み。ビルドのたびに再計算するため、ハッシュの更新漏れが起きない）
function cspHeadersPlugin(): Plugin {
  return {
    name: 'post-notion:csp-headers',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8');
      const headersPath = path.join(outDir, '_headers');
      const headers = fs.existsSync(headersPath) ? fs.readFileSync(headersPath, 'utf-8') : '';
      fs.writeFileSync(headersPath, addCspToHeadersFile(headers, buildContentSecurityPolicy(html)));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cspHeadersPlugin()],
  define: {
    // 設定画面のバージョン表記を package.json に一元化する
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Vite 8 既定の Lightning CSS で圧縮すると、接頭辞なしの backdrop-filter が落ちる（-webkit- のみ残り Firefox で効かない）うえ、
    // 文字の描画位置がずれるため、Vite 7 までと同じ esbuild で圧縮する（esbuild は devDependencies に明示）
    cssMinify: 'esbuild',
  },
  server: {
    port: 5173,
    // 既定はループバック限定。LAN へ公開する場合のみ VITE_HOST=1 を指定する
    host: process.env.VITE_HOST === '1',
    // `npm run server:dev`（Port 3000）と併用すると、UI をホットリロードしながら API を利用できる
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    // DOM が必要なテストだけ、ファイル先頭の `// @vitest-environment happy-dom` で切り替える
    environment: 'node',
    include: ['{src,api,scripts}/**/*.test.{ts,tsx}'],
  },
});
