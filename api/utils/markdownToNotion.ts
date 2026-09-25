// Markdownの行解析用型定義
export interface ParsedMarkdownLine {
  level: number;
  type: 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'quote' | 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph';
  content: string;
  checked?: boolean;
}

// 1行のMarkdownを行頭インデントとブロック種別にパース
export function parseMarkdownLine(line: string): ParsedMarkdownLine {
  const indentMatch = line.match(/^(\s*)/);
  const spaces = indentMatch ? indentMatch[1].replace(/\t/g, '  ').length : 0;
  const level = Math.floor(spaces / 2);
  const trimmed = line.trim();

  if (!trimmed) {
    return { level: 0, type: 'paragraph', content: '' };
  }

  // チェックボックス (To-Do): - [ ] または - [x]
  const todoMatch = trimmed.match(/^[-*+]\s+\[( |x|X)\]\s*(.*)$/);
  if (todoMatch) {
    return {
      level,
      type: 'to_do',
      checked: todoMatch[1].toLowerCase() === 'x',
      content: todoMatch[2],
    };
  }

  // 箇条書きリスト: - , * , +
  const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
  if (bulletMatch) {
    return {
      level,
      type: 'bulleted_list_item',
      content: bulletMatch[1],
    };
  }

  // 番号付きリスト: 1. , 2. 等
  const numberMatch = trimmed.match(/^\d+\.\s+(.*)$/);
  if (numberMatch) {
    return {
      level,
      type: 'numbered_list_item',
      content: numberMatch[1],
    };
  }

  // 引用: >
  const quoteMatch = trimmed.match(/^>\s*(.*)$/);
  if (quoteMatch) {
    return {
      level,
      type: 'quote',
      content: quoteMatch[1],
    };
  }

  // 見出し
  if (trimmed.startsWith('# ')) {
    return { level: 0, type: 'heading_1', content: trimmed.substring(2) };
  }
  if (trimmed.startsWith('## ')) {
    return { level: 0, type: 'heading_2', content: trimmed.substring(3) };
  }
  if (trimmed.startsWith('### ')) {
    return { level: 0, type: 'heading_3', content: trimmed.substring(4) };
  }

  return {
    level,
    type: 'paragraph',
    content: trimmed,
  };
}

// パース結果からNotion API用ブロックオブジェクトを生成
export function createNotionBlock(item: ParsedMarkdownLine): any {
  const rich_text = item.content
    ? [{ type: 'text' as const, text: { content: item.content } }]
    : [];

  switch (item.type) {
    case 'bulleted_list_item':
      return {
        object: 'block' as const,
        type: 'bulleted_list_item' as const,
        bulleted_list_item: { rich_text },
      };
    case 'numbered_list_item':
      return {
        object: 'block' as const,
        type: 'numbered_list_item' as const,
        numbered_list_item: { rich_text },
      };
    case 'to_do':
      return {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: { rich_text, checked: !!item.checked },
      };
    case 'quote':
      return {
        object: 'block' as const,
        type: 'quote' as const,
        quote: { rich_text },
      };
    case 'heading_1':
      return {
        object: 'block' as const,
        type: 'heading_1' as const,
        heading_1: { rich_text },
      };
    case 'heading_2':
      return {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: { rich_text },
      };
    case 'heading_3':
      return {
        object: 'block' as const,
        type: 'heading_3' as const,
        heading_3: { rich_text },
      };
    case 'paragraph':
    default:
      return {
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: { rich_text },
      };
  }
}

// Markdown文字列をNotionネイティブ階層ブロック構造（children）へ変換
export function parseMarkdownToNotionBlocks(markdown: string): any[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split('\n');
  const rootBlocks: any[] = [];

  interface StackEntry {
    level: number;
    block: any;
    children: any[];
  }
  const stack: StackEntry[] = [];

  for (const rawLine of lines) {
    const item = parseMarkdownLine(rawLine);
    const block = createNotionBlock(item);

    // 見出しや空行はネストの親にせず、スタックをクリアしてルートに配置
    if (['heading_1', 'heading_2', 'heading_3'].includes(item.type) || !item.content) {
      stack.length = 0;
      rootBlocks.push(block);
      continue;
    }

    // ネスト深さはNotion API制限を考慮し最大2レベル（0, 1, 2）に丸める
    const targetLevel = Math.min(item.level, 2);

    if (targetLevel === 0) {
      stack.length = 0;
      rootBlocks.push(block);
      if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
        if (!block[item.type].children) {
          block[item.type].children = [];
        }
        stack.push({ level: 0, block, children: block[item.type].children });
      }
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level >= targetLevel) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(block);
        if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
          if (!block[item.type].children) {
            block[item.type].children = [];
          }
          stack.push({ level: targetLevel, block, children: block[item.type].children });
        }
      } else {
        rootBlocks.push(block);
        if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
          if (!block[item.type].children) {
            block[item.type].children = [];
          }
          stack.push({ level: 0, block, children: block[item.type].children });
        }
      }
    }
  }

  // childrenが空のブロックから children プロパティを削除（APIエラー防止）
  function cleanEmptyChildren(blocks: any[]) {
    for (const b of blocks) {
      const typeObj = b[b.type];
      if (typeObj && typeObj.children) {
        if (typeObj.children.length === 0) {
          delete typeObj.children;
        } else {
          cleanEmptyChildren(typeObj.children);
        }
      }
    }
  }
  cleanEmptyChildren(rootBlocks);

  return rootBlocks;
}
