import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  addCspToHeadersFile,
  buildContentSecurityPolicy,
  computeInlineScriptHashes,
  CSP_HEADER_NAME,
  extractInlineScripts,
} from './csp.ts';

// CSP 仕様・MDN の例と同じ値（alert('Hello, world.'); の SHA-256）
const HELLO = "alert('Hello, world.');";
const HELLO_HASH = "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='";

describe('extractInlineScripts', () => {
  it('src 属性のないスクリプトの本文だけを出現順に返す', () => {
    const html = `
      <script>first()</script>
      <script type="module" crossorigin src="/assets/index-abc.js"></script>
      <script type="module">second()</script>
      <SCRIPT>third()</SCRIPT >`;
    expect(extractInlineScripts(html)).toEqual(['first()', 'second()', 'third()']);
  });

  it('本文の前後の空白・改行をそのまま保つ', () => {
    expect(extractInlineScripts('<script>\n  a();\n</script>')).toEqual(['\n  a();\n']);
  });

  it('HTML コメント内のスクリプトは対象外', () => {
    expect(extractInlineScripts('<!-- <script>old()</script> --><script>a()</script>')).toEqual(['a()']);
  });

  it('data-src などの src 以外の属性では除外しない', () => {
    expect(extractInlineScripts('<script data-src="x">a()</script>')).toEqual(['a()']);
  });

  it('CRLF・CR を LF に正規化する（ブラウザの照合と一致させる）', () => {
    expect(extractInlineScripts('<script>a();\r\nb();\rc();</script>')).toEqual(['a();\nb();\nc();']);
  });
});

describe('computeInlineScriptHashes', () => {
  it('SHA-256 を base64 で CSP のソース式にする', () => {
    expect(computeInlineScriptHashes(`<script>${HELLO}</script>`)).toEqual([HELLO_HASH]);
  });

  it('改行コードが違っても同じハッシュになる', () => {
    const lf = computeInlineScriptHashes('<script>\na();\n</script>');
    const crlf = computeInlineScriptHashes('<script>\r\na();\r\n</script>');
    expect(crlf).toEqual(lf);
  });

  it('同じ本文のハッシュは 1 つにまとめる', () => {
    expect(computeInlineScriptHashes(`<script>${HELLO}</script><script>${HELLO}</script>`)).toEqual([HELLO_HASH]);
  });

  it('本文が変わるとハッシュも変わる', () => {
    expect(computeInlineScriptHashes('<script>a()</script>')).not.toEqual(computeInlineScriptHashes('<script>b()</script>'));
  });

  it('インラインスクリプトがなければ空', () => {
    expect(computeInlineScriptHashes('<script src="/a.js"></script>')).toEqual([]);
  });

  it('index.html の 2 つのインラインスクリプト（テーマの即時適用・起動監視）を対象にする', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const html = fs.readFileSync(path.resolve(dir, '../index.html'), 'utf-8');
    const scripts = extractInlineScripts(html);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toContain('post-notion-theme');
    expect(scripts[1]).toContain('__APP_MOUNTED__');
    expect(computeInlineScriptHashes(html)).toHaveLength(2);
    // ハッシュで許可できないインラインのイベントハンドラが残っていない
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});

describe('buildContentSecurityPolicy', () => {
  it('script-src にインラインスクリプトのハッシュを含める', () => {
    const policy = buildContentSecurityPolicy(`<script>${HELLO}</script>`);
    expect(policy).toContain(`script-src 'self' ${HELLO_HASH};`);
  });

  it('方針どおりのディレクティブを含む', () => {
    const policy = buildContentSecurityPolicy('');
    expect(policy.split('; ')).toEqual([
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]);
  });

  it("'unsafe-inline' を script-src に含めない", () => {
    const scriptSrc = buildContentSecurityPolicy(`<script>${HELLO}</script>`)
      .split('; ')
      .find((directive) => directive.startsWith('script-src'));
    expect(scriptSrc).not.toContain('unsafe');
  });
});

describe('addCspToHeadersFile', () => {
  const HEADERS = '# comment\n/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n';

  it('「/*」ブロックに CSP の行を追加し、既存のヘッダーを保つ', () => {
    expect(addCspToHeadersFile(HEADERS, 'default-src a')).toBe(
      `# comment\n/*\n  ${CSP_HEADER_NAME}: default-src a\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n`
    );
  });

  it('既存の CSP の行は置き換える（重複させない）', () => {
    const once = addCspToHeadersFile(HEADERS, 'default-src a');
    const twice = addCspToHeadersFile(once, 'default-src b');
    expect(twice).toBe(addCspToHeadersFile(HEADERS, 'default-src b'));
    expect(twice).not.toContain('default-src a');
  });

  it('「/*」ブロックがなければ末尾に追加する', () => {
    expect(addCspToHeadersFile('/api/*\n  X-Test: 1\n\n', 'default-src a')).toBe(
      `/api/*\n  X-Test: 1\n\n/*\n  ${CSP_HEADER_NAME}: default-src a\n`
    );
    expect(addCspToHeadersFile('', 'default-src a')).toBe(`/*\n  ${CSP_HEADER_NAME}: default-src a\n`);
  });

  it('CRLF のファイルも扱える', () => {
    expect(addCspToHeadersFile('/*\r\n  X-Frame-Options: DENY\r\n', 'default-src a')).toBe(
      `/*\n  ${CSP_HEADER_NAME}: default-src a\n  X-Frame-Options: DENY\n`
    );
  });
});
