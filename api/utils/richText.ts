/**
 * Notion rich_text の上限に合わせてテキストを分割するユーティリティ
 * - text.content は 1 要素あたり 2,000 文字まで
 * - rich_text 配列は 100 要素まで
 */

export const RICH_TEXT_CONTENT_MAX = 2000;
export const RICH_TEXT_ITEMS_MAX = 100;

export type RichTextItem = {
  type: 'text';
  text: { content: string };
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
