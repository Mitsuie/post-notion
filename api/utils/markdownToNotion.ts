import { parseInline, toRichText, type RichTextItem } from './richText.ts';
import { limitNestedChildren } from './blocks.ts';

// Markdownの行解析用型定義
export interface ParsedMarkdownLine {
  level: number;
  type: 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'quote' | 'heading_1' | 'heading_2' | 'heading_3' | 'divider' | 'paragraph';
  content: string;
  checked?: boolean;
}

// 生成するブロックの種別と本文（本文は種別名のキーの下に置く。例: { type: 'paragraph', paragraph: { rich_text } }）
type NotionBlockType = ParsedMarkdownLine['type'] | 'code';
type NotionBlockBody = { rich_text?: RichTextItem[]; checked?: boolean; language?: string; children?: NotionBlock[] };
export type NotionBlock = { object: 'block'; type: NotionBlockType } & { [K in NotionBlockType]?: NotionBlockBody };

// Notion のコードブロックが受け付ける言語（@notionhq/client の LanguageRequest）
const NOTION_CODE_LANGUAGES = new Set([
  'abap', 'agda', 'arduino', 'ascii art', 'assembly', 'bash', 'basic', 'bnf', 'c', 'c#', 'c++', 'clojure',
  'coffeescript', 'coq', 'css', 'dart', 'dhall', 'diff', 'docker', 'ebnf', 'elixir', 'elm', 'erlang', 'f#',
  'flow', 'fortran', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'hcl', 'html', 'idris', 'java',
  'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript', 'llvm ir', 'lua', 'makefile',
  'markdown', 'markup', 'matlab', 'mathematica', 'mermaid', 'nix', 'notion formula', 'objective-c', 'ocaml',
  'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'purescript', 'python', 'r',
  'racket', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss', 'shell', 'smalltalk', 'solidity',
  'sql', 'swift', 'toml', 'typescript', 'vb.net', 'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml',
  'yaml', 'java/c/c++/c#',
]);

// よく使われる略記を Notion の言語名へ対応付ける
const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', rs: 'rust', kt: 'kotlin', golang: 'go',
  sh: 'shell', zsh: 'shell', console: 'shell', ps1: 'powershell',
  yml: 'yaml', md: 'markdown', dockerfile: 'docker',
  cs: 'c#', csharp: 'c#', cpp: 'c++', 'objc': 'objective-c',
  text: 'plain text', txt: 'plain text', plaintext: 'plain text',
};

/** フェンスの言語指定を Notion の言語名へ変換する（対応外・未指定は plain text） */
export function toNotionCodeLanguage(info: string): string {
  const lang = info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const resolved = CODE_LANGUAGE_ALIASES[lang] ?? lang;
  return NOTION_CODE_LANGUAGES.has(resolved) ? resolved : 'plain text';
}

const FENCE_PATTERN = /^\s*```(.*)$/;
const DIVIDER_PATTERN = /^(?:-{3,}|\*{3,}|_{3,})$/;

// 1行のMarkdownを行頭インデントとブロック種別にパース
export function parseMarkdownLine(line: string): ParsedMarkdownLine {
  const indentMatch = line.match(/^(\s*)/);
  const spaces = indentMatch ? indentMatch[1].replace(/\t/g, '  ').length : 0;
  const level = Math.floor(spaces / 2);
  const trimmed = line.trim();

  if (!trimmed) {
    return { level: 0, type: 'paragraph', content: '' };
  }

  // 区切り線: --- / *** / ___（箇条書きより先に判定する）
  if (DIVIDER_PATTERN.test(trimmed)) {
    return { level: 0, type: 'divider', content: trimmed };
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
export function createNotionBlock(item: ParsedMarkdownLine): NotionBlock {
  // インライン装飾を解釈し、2,000 文字を超える要素は rich_text の複数要素に分割する
  const rich_text = item.content ? parseInline(item.content) : [];

  switch (item.type) {
    case 'divider':
      return { object: 'block' as const, type: 'divider' as const, divider: {} };
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

// フェンス内のコードから code ブロックを生成（行単位の解析・インライン装飾の解釈はしない）
export function createCodeBlock(code: string, info: string): NotionBlock {
  return {
    object: 'block' as const,
    type: 'code' as const,
    code: { rich_text: code ? toRichText(code).richText : [], language: toNotionCodeLanguage(info) },
  };
}

// Markdown文字列をNotionネイティブ階層ブロック構造（children）へ変換
// 戻り値の any は、既存テストがブロック種別を絞り込まずに本文（blocks[0].paragraph など）を参照するため
export function parseMarkdownToNotionBlocks(markdown: string): any[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split('\n');
  const rootBlocks: NotionBlock[] = [];

  interface StackEntry {
    level: number;
    block: NotionBlock;
    children: NotionBlock[];
  }
  const stack: StackEntry[] = [];

  // 直前に空段落を出力したか（連続する空行を1つの空段落にまとめるため）
  let lastWasBlank = false;

  // 開いているコードフェンス（閉じられなければ末尾までをコードとして扱う。CommonMark と同じ）
  let fence: { info: string; lines: string[] } | null = null;

  for (const rawLine of lines) {
    if (fence) {
      if (/^\s*```\s*$/.test(rawLine)) {
        rootBlocks.push(createCodeBlock(fence.lines.join('\n'), fence.info));
        fence = null;
      } else {
        fence.lines.push(rawLine.replace(/\r$/, ''));
      }
      continue;
    }

    // コードフェンスの開始: ネストを解除してルートに配置する
    const fenceMatch = rawLine.match(FENCE_PATTERN);
    if (fenceMatch) {
      stack.length = 0;
      lastWasBlank = false;
      fence = { info: fenceMatch[1], lines: [] };
      continue;
    }

    const item = parseMarkdownLine(rawLine);

    // 空行はネストをリセットし、連続する空行は1つの空段落にまとめる（先頭の空行は出力しない）
    if (!item.content) {
      stack.length = 0;
      if (rootBlocks.length > 0 && !lastWasBlank) {
        rootBlocks.push(createNotionBlock(item));
        lastWasBlank = true;
      }
      continue;
    }
    lastWasBlank = false;

    const block = createNotionBlock(item);

    // 見出し・区切り線はネストの親にせず、スタックをクリアしてルートに配置
    if (['heading_1', 'heading_2', 'heading_3', 'divider'].includes(item.type)) {
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
        const body = block[item.type]!;
        if (!body.children) {
          body.children = [];
        }
        stack.push({ level: 0, block, children: body.children });
      }
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level >= targetLevel) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(block);
        if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
          const body = block[item.type]!;
          if (!body.children) {
            body.children = [];
          }
          stack.push({ level: targetLevel, block, children: body.children });
        }
      } else {
        rootBlocks.push(block);
        if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
          const body = block[item.type]!;
          if (!body.children) {
            body.children = [];
          }
          stack.push({ level: 0, block, children: body.children });
        }
      }
    }
  }

  if (fence) rootBlocks.push(createCodeBlock(fence.lines.join('\n'), fence.info));

  // childrenが空のブロックから children プロパティを削除（APIエラー防止）
  function cleanEmptyChildren(blocks: NotionBlock[]) {
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

  // 末尾の空行は出力しない
  if (lastWasBlank) rootBlocks.pop();

  // ネストした children の 100 件上限を超える分は親の兄弟として後ろに出す
  return limitNestedChildren(rootBlocks);
}
