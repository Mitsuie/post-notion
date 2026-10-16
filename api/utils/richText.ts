/**
 * Notion rich_text の上限に合わせてテキストを分割するユーティリティ
 * - text.content は 1 要素あたり 2,000 文字まで
 * - rich_text 配列は 100 要素まで
 */

export const RICH_TEXT_CONTENT_MAX = 2000;
export const RICH_TEXT_ITEMS_MAX = 100;

export type RichTextAnnotations = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

export type RichTextItem = {
  type: 'text';
  text: { content: string; link?: { url: string } };
  annotations?: RichTextAnnotations;
};

/**
 * テキストを maxLength 以下の断片に分割する
 * - 長さは JavaScript の文字列長（UTF-16 コード単位）で数え、上限を確実に下回るようにする
 * - コードポイント単位で区切るため、絵文字などのサロゲートペアを分断しない
 */
export function splitText(text: string, maxLength: number = RICH_TEXT_CONTENT_MAX): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of text) {
    if (current.length + char.length > maxLength) {
      chunks.push(current);
      current = '';
    }
    current += char;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * テキストを Notion の rich_text 配列へ変換する
 * - 2,000 文字ごとに要素を分ける
 * - 100 要素（約 200,000 文字）を超える分は切り捨て、truncated: true を返す（実運用では到達しない想定の安全弁）
 */
export function toRichText(text: string): { richText: RichTextItem[]; truncated: boolean } {
  const chunks = splitText(text);
  const truncated = chunks.length > RICH_TEXT_ITEMS_MAX;
  const richText = chunks
    .slice(0, RICH_TEXT_ITEMS_MAX)
    .map((content) => ({ type: 'text' as const, text: { content } }));
  return { richText, truncated };
}

/**
 * インライン記法（1 種類ずつ。入れ子は扱わない）
 * - 左から最初に一致した記法を採用し、同じ位置では上から順に優先する
 * - 記号の内側の先頭・末尾が空白の場合は記法とみなさない（`2 * 3 * 4` などの誤検出を防ぐ）
 * - `_斜体_` は単語の途中（snake_case 等）では記法とみなさない
 * - リンクは http(s) のみ。`javascript:` 等は文字として残す
 */
const INLINE_PATTERN = new RegExp(
  [
    /`(?<code>[^`\n]+)`/.source,
    /\[(?<linkText>[^\]\n]+)\]\((?<linkUrl>https?:\/\/[^\s)]+)\)/.source,
    /\*\*(?<bold>[^\s*](?:[^\n]*?[^\s*])?)\*\*/.source,
    /~~(?<strike>[^\s~](?:[^\n]*?[^\s~])?)~~/.source,
    /\*(?<italicStar>[^\s*](?:[^\n*]*?[^\s*])?)\*/.source,
    /(?<![\p{L}\p{N}_])_(?<italicUnderscore>[^\s_](?:[^\n_]*?[^\s_])?)_(?![\p{L}\p{N}_])/u.source,
  ].join('|'),
  'gu'
);

type InlineSegment = { content: string; annotations?: RichTextAnnotations; url?: string };

function tokenizeInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_PATTERN)) {
    const g = m.groups ?? {};
    if (m.index > last) segments.push({ content: text.slice(last, m.index) });
    if (g.code !== undefined) segments.push({ content: g.code, annotations: { code: true } });
    else if (g.linkText !== undefined) segments.push({ content: g.linkText, url: g.linkUrl });
    else if (g.bold !== undefined) segments.push({ content: g.bold, annotations: { bold: true } });
    else if (g.strike !== undefined) segments.push({ content: g.strike, annotations: { strikethrough: true } });
    else segments.push({ content: g.italicStar ?? g.italicUnderscore, annotations: { italic: true } });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ content: text.slice(last) });
  return segments;
}

/**
 * Markdown のインライン装飾（太字・斜体・コード・リンク・取り消し線）を rich_text 配列へ変換する
 * - 各要素に 2,000 文字分割を適用し、装飾・リンクは分割後の各要素へ引き継ぐ
 * - 100 要素を超える分は切り捨てる（toRichText と同じ安全弁）
 */
export function parseInline(text: string): RichTextItem[] {
  const items: RichTextItem[] = [];
  for (const seg of tokenizeInline(text)) {
    for (const content of splitText(seg.content)) {
      const item: RichTextItem = { type: 'text', text: seg.url ? { content, link: { url: seg.url } } : { content } };
      if (seg.annotations) item.annotations = seg.annotations;
      items.push(item);
    }
  }
  return items.slice(0, RICH_TEXT_ITEMS_MAX);
}
