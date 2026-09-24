import type { Tag } from '../types';

/**
 * 本文から #ハッシュタグ を抽出し、一致するタグオブジェクトを解決する
 */
export function extractAndResolveTags(text: string, availableTags: Tag[]): Tag[] {
  // #タグ名 (半角・全角英数、アンダースコア、ハイフン、日本語)
  const regex = /#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\-]+)/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].toLowerCase());
  }

  if (matches.length === 0 || availableTags.length === 0) {
    return [];
  }

  const matchedTags: Tag[] = [];
  const seenIds = new Set<string>();

  for (const tagWord of matches) {
    // 1. 完全一致または前方一致（例: "02" で "02_運用 - Obsidian" にマッチ）
    const found = availableTags.find((t) => {
      const lowerName = t.name.toLowerCase();
      // "02" ➜ "02_..." でマッチ
      if (lowerName.startsWith(tagWord + '_') || lowerName.startsWith(tagWord + ' ')) {
        return true;
      }
      // "obsidian" ➜ "...obsidian..." でマッチ
      if (lowerName.includes(tagWord)) {
        return true;
      }
      return false;
    });

    if (found && !seenIds.has(found.id)) {
      matchedTags.push(found);
      seenIds.add(found.id);
    }
  }

  return matchedTags;
}
