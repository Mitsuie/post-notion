import { createHash } from 'node:crypto';

// Content-Security-Policy（SEC-08）。まず Report-Only で導入し、違反がないことを確認してから本適用する
// Cloudflare Pages（ビルド時に dist/_headers へ書き出す）と Node.js サーバー（dist/index.html から計算）の両方がこの処理を使う
export const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

// HTML コメントとスクリプト要素を出現順に走査する（コメント内の <script> を拾わないため）
const COMMENT_OR_SCRIPT = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SRC_ATTRIBUTE = /\ssrc\s*=/i;

// src 属性のないスクリプト要素の本文を出現順に返す
export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  for (const match of html.matchAll(COMMENT_OR_SCRIPT)) {
    const [whole, attributes, body] = match;
    if (whole.startsWith('<!--') || SRC_ATTRIBUTE.test(` ${attributes}`)) continue;
    // ブラウザは HTML の解析前に改行を LF へ正規化してからハッシュを照合するため、CRLF のファイルでも一致させる
    scripts.push(body.replace(/\r\n?/g, '\n'));
  }
  return scripts;
}

// インラインスクリプトの SHA-256 ハッシュを CSP のソース式（'sha256-…'）で返す（重複は除く）
export function computeInlineScriptHashes(html: string): string[] {
  const hashes = extractInlineScripts(html).map(
    (script) => `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
  );
  return [...new Set(hashes)];
}

export function buildContentSecurityPolicy(html: string): string {
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", ...computeInlineScriptHashes(html)]],
    // インラインスタイル（QA-11）が残っているため 'unsafe-inline' は当面許可する
    ['style-src', ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['font-src', ['https://fonts.gstatic.com']],
    // 本文の画像は Notion 等の外部 URL を表示する
    ['img-src', ["'self'", 'data:', 'https:']],
    ['connect-src', ["'self'"]],
    ['manifest-src', ["'self'"]],
    ['worker-src', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}

// Cloudflare Pages の _headers の「/*」ブロックに CSP を追加する（既存の CSP 行は置き換える）
export function addCspToHeadersFile(headers: string, policy: string): string {
  const cspLine = `  ${CSP_HEADER_NAME}: ${policy}`;
  const lines = headers
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !line.trimStart().toLowerCase().startsWith(`${CSP_HEADER_NAME.toLowerCase()}:`));
  const index = lines.findIndex((line) => line.trim() === '/*');
  if (index === -1) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    return [...lines, ...(lines.length > 0 ? [''] : []), '/*', cspLine, ''].join('\n');
  }
  lines.splice(index + 1, 0, cspLine);
  return lines.join('\n');
}
