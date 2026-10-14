import { describe, it, expect } from 'vitest';
import { parseMarkdownLine, parseMarkdownToNotionBlocks } from './markdownToNotion.ts';

// ブロックのテキストを取り出すテスト用ヘルパー
function textOf(block: any): string {
  return block[block.type].rich_text.map((t: any) => t.text.content).join('');
}

function childrenOf(block: any): any[] | undefined {
  return block[block.type].children;
}

describe('parseMarkdownLine', () => {
  it('空行は内容なしの段落になる', () => {
    expect(parseMarkdownLine('')).toEqual({ level: 0, type: 'paragraph', content: '' });
    expect(parseMarkdownLine('    ')).toEqual({ level: 0, type: 'paragraph', content: '' });
  });

  it('箇条書き（- * +）を判定する', () => {
    expect(parseMarkdownLine('- a')).toEqual({ level: 0, type: 'bulleted_list_item', content: 'a' });
    expect(parseMarkdownLine('* b')).toEqual({ level: 0, type: 'bulleted_list_item', content: 'b' });
    expect(parseMarkdownLine('+ c')).toEqual({ level: 0, type: 'bulleted_list_item', content: 'c' });
  });

  it('番号付きリストを判定する', () => {
    expect(parseMarkdownLine('12. item')).toEqual({ level: 0, type: 'numbered_list_item', content: 'item' });
  });

  it('チェックボックスの未完了・完了を判定する', () => {
    expect(parseMarkdownLine('- [ ] todo')).toEqual({ level: 0, type: 'to_do', checked: false, content: 'todo' });
    expect(parseMarkdownLine('- [x] done')).toEqual({ level: 0, type: 'to_do', checked: true, content: 'done' });
    expect(parseMarkdownLine('- [X] done')).toEqual({ level: 0, type: 'to_do', checked: true, content: 'done' });
  });

  it('引用を判定する', () => {
    expect(parseMarkdownLine('> quote')).toEqual({ level: 0, type: 'quote', content: 'quote' });
  });

  it('見出しはインデントに関わらずレベル0になる', () => {
    expect(parseMarkdownLine('# h1')).toEqual({ level: 0, type: 'heading_1', content: 'h1' });
    expect(parseMarkdownLine('## h2')).toEqual({ level: 0, type: 'heading_2', content: 'h2' });
    expect(parseMarkdownLine('    ### h3')).toEqual({ level: 0, type: 'heading_3', content: 'h3' });
  });

  it('その他の行は前後の空白を除いた段落になる', () => {
    expect(parseMarkdownLine('  text  ')).toEqual({ level: 1, type: 'paragraph', content: 'text' });
  });

  it('2スペースを1レベルとし、タブは2スペースとして数える', () => {
    expect(parseMarkdownLine('  - a').level).toBe(1);
    expect(parseMarkdownLine('   - a').level).toBe(1);
    expect(parseMarkdownLine('    - a').level).toBe(2);
    expect(parseMarkdownLine('\t- a').level).toBe(1);
    expect(parseMarkdownLine('\t\t- a').level).toBe(2);
  });
});

describe('parseMarkdownToNotionBlocks', () => {
  it('空文字・空白のみは空配列を返す', () => {
    expect(parseMarkdownToNotionBlocks('')).toEqual([]);
    expect(parseMarkdownToNotionBlocks(' \n \n')).toEqual([]);
  });

  it('各ブロック種別を Notion ブロックへ変換する', () => {
    const blocks = parseMarkdownToNotionBlocks(
      ['# h1', '## h2', '### h3', '- bullet', '1. number', '- [x] todo', '> quote', 'text'].join('\n')
    );
    expect(blocks.map((b) => b.type)).toEqual([
      'heading_1',
      'heading_2',
      'heading_3',
      'bulleted_list_item',
      'numbered_list_item',
      'to_do',
      'quote',
      'paragraph',
    ]);
    expect(blocks.every((b) => b.object === 'block')).toBe(true);
    expect(blocks[5].to_do.checked).toBe(true);
    expect(textOf(blocks[7])).toBe('text');
  });

  it('インデントで子ブロックとしてネストする', () => {
    const blocks = parseMarkdownToNotionBlocks(['- a', '  - b', '    - c', '- d'].join('\n'));
    expect(blocks).toHaveLength(2);
    const [a, d] = blocks;
    expect(textOf(a)).toBe('a');
    expect(textOf(d)).toBe('d');
    const b = childrenOf(a)![0];
    expect(textOf(b)).toBe('b');
    expect(textOf(childrenOf(b)![0])).toBe('c');
  });

  it('ネスト深さは2に丸められ、深い行は深さ2の兄弟になる', () => {
    const blocks = parseMarkdownToNotionBlocks(['- a', '  - b', '    - c', '      - d'].join('\n'));
    const b = childrenOf(blocks[0])![0];
    const level2 = childrenOf(b)!;
    expect(level2.map(textOf)).toEqual(['c', 'd']);
    expect(childrenOf(level2[0])).toBeUndefined();
  });

  it('親のないインデント行はルートに置かれる', () => {
    const blocks = parseMarkdownToNotionBlocks('  - orphan');
    expect(blocks).toHaveLength(1);
    expect(textOf(blocks[0])).toBe('orphan');
  });

  it('子を持たないブロックには children プロパティを残さない', () => {
    const blocks = parseMarkdownToNotionBlocks(['- a', 'text'].join('\n'));
    for (const b of blocks) {
      expect('children' in b[b.type]).toBe(false);
    }
  });

  it('空行は空段落としてルートに出力され、ネストをリセットする', () => {
    const blocks = parseMarkdownToNotionBlocks(['- a', '', '  - b'].join('\n'));
    expect(blocks).toHaveLength(3);
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].paragraph.rich_text).toEqual([]);
    expect(textOf(blocks[2])).toBe('b');
  });

  it('連続する空行はそれぞれ空段落になる（現行仕様）', () => {
    const blocks = parseMarkdownToNotionBlocks(['a', '', '', 'b'].join('\n'));
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph', 'paragraph']);
  });

  it('見出しはネストをリセットする', () => {
    const blocks = parseMarkdownToNotionBlocks(['- a', '## h', '  - b'].join('\n'));
    expect(blocks.map((b) => b.type)).toEqual(['bulleted_list_item', 'heading_2', 'bulleted_list_item']);
    expect(childrenOf(blocks[0])).toBeUndefined();
  });
});
