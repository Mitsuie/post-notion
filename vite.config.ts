/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
    environment: 'node',
    include: ['{src,api}/**/*.test.ts'],
  },
});
