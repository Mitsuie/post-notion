import { describe, it, expect } from 'vitest';
import { splitText, toRichText, RICH_TEXT_CONTENT_MAX, RICH_TEXT_ITEMS_MAX } from './richText.ts';

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
