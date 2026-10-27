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
 * - 100 要素を超える分は切り捨て、truncated: true を返す（toRichText と同じ安全弁）
 */
export function toInlineRichText(text: string): { richText: RichTextItem[]; truncated: boolean } {
  const items: RichTextItem[] = [];
  for (const seg of tokenizeInline(text)) {
    for (const content of splitText(seg.content)) {
      const item: RichTextItem = { type: 'text', text: seg.url ? { content, link: { url: seg.url } } : { content } };
      if (seg.annotations) item.annotations = seg.annotations;
      items.push(item);
    }
  }
  return { richText: items.slice(0, RICH_TEXT_ITEMS_MAX), truncated: items.length > RICH_TEXT_ITEMS_MAX };
}

/** toInlineRichText の rich_text 配列のみを返す（100 要素を超える分は切り捨てる） */
export function parseInline(text: string): RichTextItem[] {
  return toInlineRichText(text).richText;
}

/** Notion API が返す rich_text 要素のうち、richTextToMarkdown が参照する項目 */
export type NotionRichTextLike = {
  plain_text?: string;
  href?: string | null;
  text?: { content?: string; link?: { url?: string } | null };
  annotations?: RichTextAnnotations;
};

// CommonMark の強調の区切り（左右の flanking）の判定に使う文字種
// パーサー（micromark）と同じく UTF-16 の 1 単位で判定する（絵文字などのサロゲートペアは句読点・記号とみなさない）
const PUNCTUATION = /[\p{P}\p{S}]/u;
const BOUNDARY = /[\s\p{P}\p{S}]/u;

/**
 * inner を強調の記号で囲んだとき、強調として認識されるか
 * - 内側の端が句読点・記号の場合、記号の外側の隣が空白・句読点・記号・行の端（空文字）でなければならない
 *   （例: `**重要！**です`・`です**「注意」**` は強調にならず、記号がそのまま表示される）
 */
function canEmphasize(inner: string, prev: string, next: string): boolean {
  const opens = !PUNCTUATION.test(inner[0]) || !prev || BOUNDARY.test(prev);
  const closes = !PUNCTUATION.test(inner[inner.length - 1]) || !next || BOUNDARY.test(next);
  return opens && closes;
}

/** リンク先を記法で表す（括弧・空白を含む URL は <…> で囲む。< > \ 改行を含む URL は表せないため undefined） */
function toLinkDestination(url: string): string | undefined {
  if (/[<>\\\n\r]/.test(url)) return undefined;
  return /[()\s]/.test(url) ? `<${url}>` : url;
}

/**
 * 1 行分の文字列に記号を付ける（内側の先頭・末尾の空白は記号の外に出す）
 * - prev・next は記号の外側の隣の文字（行の端は空文字）
 * - 太字・斜体は、強調として認識されない並びなら記号を付けない（記号が文字として表示されるのを防ぐ）
 */
function wrapInline(
  line: string,
  annotations: Required<RichTextAnnotations>,
  url?: string,
  prev = '',
  next = ''
): string {
  const [, lead, inner, trail] = /^(\s*)(.*?)(\s*)$/su.exec(line)!;
  if (!inner) return line;
  let body = inner;
  // バッククォートを含むコードは記法で表せないため、装飾なしで残す
  if (annotations.code && !body.includes('`')) body = `\`${body}\``;
  if (annotations.strikethrough) body = `~~${body}~~`;
  const destination = url ? toLinkDestination(url) : undefined;
  const stars = '*'.repeat((annotations.italic ? 1 : 0) + (annotations.bold ? 2 : 0));
  // リンクの内側では記号の外側の隣が [ ] になるため、常に強調として認識される
  const outerPrev = lead ? lead[lead.length - 1] : prev;
  const outerNext = trail ? trail[0] : next;
  if (stars && (destination || canEmphasize(body, outerPrev, outerNext))) body = `${stars}${body}${stars}`;
  if (destination) body = `[${body}](${destination})`;
  return `${lead}${body}${trail}`;
}

/**
 * rich_text 配列をインライン Markdown の文字列に戻す（parseInline の逆変換。コメントのアプリ内表示用）
 * - 太字・斜体・コード・取り消し線・http(s) のリンクを記号に戻す。下線・色などは扱わない
 * - 隣り合った同じ装飾の要素はまとめてから記号を付ける（2,000 文字分割で `**a****b**` にしない）
 * - 記法は改行をまたがないため、改行を含む要素は行ごとに記号を付ける
 * - 太字・斜体が前後の文字の都合で強調と認識されない場合は、記号を付けずに文字だけを返す
 * - 記号のエスケープはしない（装飾なしの `**` などは、従来どおり Markdown として表示される）
 */
export function richTextToMarkdown(items: NotionRichTextLike[]): string {
  const groups: { content: string; key: string; annotations: Required<RichTextAnnotations>; url?: string }[] = [];
  for (const item of items) {
    const content = item.plain_text ?? item.text?.content ?? '';
    if (!content) continue;
    const a = item.annotations ?? {};
    const annotations = { bold: !!a.bold, italic: !!a.italic, strikethrough: !!a.strikethrough, code: !!a.code };
    const rawUrl = item.href ?? item.text?.link?.url;
    const url = rawUrl && /^https?:\/\//.test(rawUrl) ? rawUrl : undefined;
    const key = JSON.stringify([annotations, url]);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.content += content;
    else groups.push({ content, key, annotations, url });
  }
  let out = '';
  groups.forEach((g, i) => {
    const lines = g.content.split('\n');
    const following = groups[i + 1];
    // 次の要素の先頭の文字（記号が付く場合は記号）。前後の要素で強調の認識が変わるのを判定するために使う
    const nextHead = following
      ? wrapInline(following.content.split('\n')[0], following.annotations, following.url)[0] ?? ''
      : '';
    lines.forEach((line, j) => {
      if (j > 0) out += '\n';
      const last = out[out.length - 1] ?? '';
      const prev = last === '\n' ? '' : last;
      const next = j < lines.length - 1 ? '' : nextHead;
      out += wrapInline(line, g.annotations, g.url, prev, next);
    });
  });
  return out;
}
