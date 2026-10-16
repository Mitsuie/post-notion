import { describe, it, expect } from 'vitest';
import { parseInline, splitText, toRichText, RICH_TEXT_CONTENT_MAX, RICH_TEXT_ITEMS_MAX } from './richText.ts';

function lengthsOf(text: string): number[] {
  return toRichText(text).richText.map((t) => t.text.content.length);
}

describe('toRichText', () => {
  it('空文字は空配列を返す', () => {
    expect(toRichText('')).toEqual({ richText: [], truncated: false });
  });

  it('2,000 文字以下は1要素のまま', () => {
    expect(lengthsOf('a'.repeat(1999))).toEqual([1999]);
    expect(lengthsOf('a'.repeat(2000))).toEqual([2000]);
  });

  it('2,000 文字を超えると 2,000 文字ごとに分割する', () => {
    expect(lengthsOf('a'.repeat(2001))).toEqual([2000, 1]);
    expect(lengthsOf('a'.repeat(5000))).toEqual([2000, 2000, 1000]);
  });

  it('分割後の要素を連結すると元の文字列に戻る', () => {
    const text = 'あいう😀'.repeat(1500);
    expect(toRichText(text).richText.map((t) => t.text.content).join('')).toBe(text);
  });

  it('要素は Notion の text 型で返す', () => {
    expect(toRichText('hello').richText).toEqual([{ type: 'text', text: { content: 'hello' } }]);
  });

  it('境界にある絵文字（サロゲートペア）を分断しない', () => {
    const text = 'a'.repeat(1999) + '😀' + 'b';
    const items = toRichText(text).richText.map((t) => t.text.content);
    expect(items).toEqual(['a'.repeat(1999), '😀b']);
    for (const content of items) {
      expect(content.length).toBeLessThanOrEqual(RICH_TEXT_CONTENT_MAX);
    }
  });

  it('100 要素を超える分は切り捨て、truncated を返す', () => {
    const { richText, truncated } = toRichText('a'.repeat(RICH_TEXT_CONTENT_MAX * RICH_TEXT_ITEMS_MAX + 1));
    expect(richText).toHaveLength(RICH_TEXT_ITEMS_MAX);
    expect(truncated).toBe(true);
  });

  it('ちょうど 100 要素なら truncated は false', () => {
    const { richText, truncated } = toRichText('a'.repeat(RICH_TEXT_CONTENT_MAX * RICH_TEXT_ITEMS_MAX));
    expect(richText).toHaveLength(RICH_TEXT_ITEMS_MAX);
    expect(truncated).toBe(false);
  });
});

describe('splitText', () => {
  it('指定した長さで分割する', () => {
    expect(splitText('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });
});

// テスト用: rich_text を [内容, 装飾, リンク] の組に要約する
function summarize(text: string) {
  return parseInline(text).map((t) => [t.text.content, t.annotations ?? null, t.text.link?.url ?? null]);
}

describe('parseInline', () => {
  it('装飾のないテキストは1要素のまま', () => {
    expect(parseInline('ただのテキスト')).toEqual([{ type: 'text', text: { content: 'ただのテキスト' } }]);
    expect(parseInline('')).toEqual([]);
  });

  it('太字・斜体・コード・取り消し線・リンクを変換する', () => {
    expect(summarize('**太字**')).toEqual([['太字', { bold: true }, null]]);
    expect(summarize('*斜体*')).toEqual([['斜体', { italic: true }, null]]);
    expect(summarize('_斜体_')).toEqual([['斜体', { italic: true }, null]]);
    expect(summarize('`code`')).toEqual([['code', { code: true }, null]]);
    expect(summarize('~~取消~~')).toEqual([['取消', { strikethrough: true }, null]]);
    expect(summarize('[Notion](https://www.notion.so/)')).toEqual([['Notion', null, 'https://www.notion.so/']]);
  });

  it('記法の混在を左から順に変換する', () => {
    expect(summarize('a **b** `c` [d](http://e.example) ~~f~~ *g* h')).toEqual([
      ['a ', null, null],
      ['b', { bold: true }, null],
      [' ', null, null],
      ['c', { code: true }, null],
      [' ', null, null],
      ['d', null, 'http://e.example'],
      [' ', null, null],
      ['f', { strikethrough: true }, null],
      [' ', null, null],
      ['g', { italic: true }, null],
      [' h', null, null],
    ]);
  });

  it('閉じていない記号はそのまま文字として扱う', () => {
    for (const text of ['**太字', '`code', '~~取消', '*斜体', '[リンク](https://example.com', '[リンク]']) {
      expect(summarize(text)).toEqual([[text, null, null]]);
    }
  });

  it('記号の内側が空白で始まる・終わる場合や単語途中の _ は記法とみなさない', () => {
    for (const text of ['2 * 3 * 4', 'snake_case_name', '** 太字 **', 'a ~~ b ~~ c']) {
      expect(summarize(text)).toEqual([[text, null, null]]);
    }
  });

  it('http(s) 以外のリンクは文字として残す', () => {
    const text = '[押す](javascript:alert(1))';
    expect(summarize(text)).toEqual([[text, null, null]]);
  });

  it('入れ子は解釈せず、外側の記法の内容として残す', () => {
    expect(summarize('**[a](https://x.example) と `b`**')).toEqual([['[a](https://x.example) と `b`', { bold: true }, null]]);
  });

  it('コード内の記号は装飾として解釈しない', () => {
    expect(summarize('`**not bold**`')).toEqual([['**not bold**', { code: true }, null]]);
  });

  it('2,000 文字を超える装飾は分割後の各要素に装飾・リンクを引き継ぐ', () => {
    const bold = parseInline(`**${'b'.repeat(RICH_TEXT_CONTENT_MAX + 500)}**`);
    expect(bold.map((t) => [t.text.content.length, t.annotations])).toEqual([
      [RICH_TEXT_CONTENT_MAX, { bold: true }],
      [500, { bold: true }],
    ]);
    const link = parseInline(`[${'l'.repeat(RICH_TEXT_CONTENT_MAX + 1)}](https://example.com)`);
    expect(link.map((t) => [t.text.content.length, t.text.link?.url])).toEqual([
      [RICH_TEXT_CONTENT_MAX, 'https://example.com'],
      [1, 'https://example.com'],
    ]);
  });

  it('装飾の境界で要素を分け、前後の文字列を結合しない', () => {
    const items = parseInline(`${'a'.repeat(RICH_TEXT_CONTENT_MAX - 1)}**bb**`);
    expect(items.map((t) => [t.text.content.length, t.annotations ?? null])).toEqual([
      [RICH_TEXT_CONTENT_MAX - 1, null],
      [2, { bold: true }],
    ]);
  });

  it(`${RICH_TEXT_ITEMS_MAX} 要素を超える分は切り捨てる`, () => {
    const text = Array.from({ length: 80 }, (_, i) => `**${i}** `).join('');
    expect(parseInline(text)).toHaveLength(RICH_TEXT_ITEMS_MAX);
  });
});
