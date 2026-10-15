import { describe, it, expect } from 'vitest';
import { chunk, limitNestedChildren, CHILDREN_MAX } from './blocks.ts';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function paragraph(text: string, children?: any[]): any {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: text } }], ...(children ? { children } : {}) },
  };
}

describe('chunk', () => {
  it('0 件は空配列を返す', () => {
    expect(chunk([], 100)).toEqual([]);
  });

  it('100 件は1チャンク', () => {
    expect(chunk(range(100), 100).map((c) => c.length)).toEqual([100]);
  });

  it('101 件は 100 + 1 に分割する', () => {
    expect(chunk(range(101), 100).map((c) => c.length)).toEqual([100, 1]);
  });

  it('300 件は 100 × 3 に分割し、順序を保つ', () => {
    const chunks = chunk(range(300), 100);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 100]);
    expect(chunks.flat()).toEqual(range(300));
  });
});

describe('limitNestedChildren', () => {
  it('上限以下の children はそのまま', () => {
    const blocks = [paragraph('p', range(CHILDREN_MAX).map((i) => paragraph(`c${i}`)))];
    const result = limitNestedChildren(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].paragraph.children).toHaveLength(CHILDREN_MAX);
  });

  it('孫の階層で超過した分は子の階層の兄弟になり、子の階層も上限を守る', () => {
    const grandchildren = range(150).map((i) => paragraph(`g${i}`));
    const blocks = [paragraph('root', [paragraph('child', grandchildren)])];
    const result = limitNestedChildren(blocks);
    expect(result).toHaveLength(1);
    const children = result[0].paragraph.children;
    expect(children).toHaveLength(51); // child + 超過した g100〜g149
    expect(children[0].paragraph.children).toHaveLength(CHILDREN_MAX);
  });
});
